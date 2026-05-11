import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { Client } from 'minio';
import {
  FileAssetAccess,
  FileAssetPurpose,
  FileAssetStatus,
  NoteAccessType,
  Prisma,
  PrismaClient,
  UserStatus,
  UserType,
} from '@prisma/client';
import { loadEnvironmentFile } from '../src/common/test/load-env-file';

type IndexEntryInput = {
  serialLabel?: string;
  title: string;
  pageNumber: number;
  indentLevel?: number;
  orderIndex?: number;
};

type NoteIndexInput = {
  noteSlug: string;
  noteTitle?: string;
  replaceExistingIndex?: boolean;
  entries: IndexEntryInput[];
};

type IndexImportFile = {
  version: number;
  encoding: string;
  siteCode: string;
  trackCode: string;
  subjectCode: string;
  mediumCode: string;
  notes: NoteIndexInput[];
};

type ImportOptions = {
  dryRun: boolean;
  indexPath: string;
  previewPages: number;
};

const DEFAULT_INDEX_PATH = '/Users/raje/Documents/note_indexing.json';

async function main() {
  loadEnvironmentFile();
  const options = parseArgs(process.argv.slice(2));
  const indexFile = await loadIndexFile(options.indexPath);
  const prisma = new PrismaClient();

  await prisma.$connect();
  try {
    const storage = createStorageClient();
    const context = await resolveContext(prisma, indexFile);
    const notes = await prisma.note.findMany({
      where: {
        siteId: context.site.id,
        subjectId: context.subject.id,
        mediumId: context.medium.id,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        pageCount: true,
        fullFileAssetId: true,
        previewFileAssetId: true,
        fullFileAsset: {
          select: {
            objectKey: true,
            originalFileName: true,
            contentType: true,
          },
        },
      },
      orderBy: { orderIndex: 'asc' },
    });

    const noteBySlug = new Map(notes.map((note) => [note.slug, note]));
    const indexPlan = buildIndexPlan(indexFile, noteBySlug);

    console.log(
      JSON.stringify(
        {
          dryRun: options.dryRun,
          indexPath: options.indexPath,
          site: context.site.code,
          track: context.track.code,
          subject: context.subject.code,
          medium: context.medium.code,
          actor: context.actor.email,
          notesToUpdateAccess: notes.length,
          notesToIndex: indexPlan.length,
          indexEntries: indexPlan.reduce(
            (total, item) => total + item.entries.length,
            0,
          ),
          previewPages: options.previewPages,
        },
        null,
        2,
      ),
    );

    if (options.dryRun) {
      console.log('Dry run complete. No notes were changed.');
      return;
    }

    await storage.client.bucketExists(storage.bucket);

    let createdPreviewAssets = 0;
    for (const note of notes) {
      const previewFileAssetId =
        note.previewFileAssetId ??
        (
          await createPreviewAsset({
            prisma,
            storage,
            context,
            note,
            previewPages: options.previewPages,
          })
        ).fileAssetId;

      if (!note.previewFileAssetId) {
        createdPreviewAssets += 1;
      }

      await prisma.note.update({
        where: { id: note.id },
        data: {
          accessType: NoteAccessType.PREVIEWABLE_PREMIUM,
          previewFileAssetId,
          previewPageCount: Math.min(options.previewPages, note.pageCount),
          updatedByUserId: context.actor.id,
        },
      });
    }

    let importedEntries = 0;
    for (const item of indexPlan) {
      await prisma.$transaction(async (tx) => {
        if (item.replaceExistingIndex) {
          await tx.noteIndexEntry.deleteMany({
            where: { siteId: context.site.id, noteId: item.note.id },
          });
        }

        await tx.noteIndexEntry.createMany({
          data: item.entries.map((entry, index) => ({
            siteId: context.site.id,
            noteId: item.note.id,
            serialLabel: entry.serialLabel?.trim() || null,
            title: entry.title.trim(),
            titleFontHint: null,
            pageNumber: entry.pageNumber,
            indentLevel: entry.indentLevel ?? 0,
            orderIndex: entry.orderIndex ?? (index + 1) * 10,
            createdByUserId: context.actor.id,
            updatedByUserId: context.actor.id,
          })),
        });
      });

      importedEntries += item.entries.length;
      console.log(
        `INDEXED ${item.note.slug} (${item.entries.length} entries)`,
      );
    }

    console.log(
      `Done. Created ${createdPreviewAssets} preview assets, updated ${notes.length} notes to PREVIEWABLE_PREMIUM, imported ${importedEntries} index entries.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

function parseArgs(argv: string[]): ImportOptions {
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument "${token}".`);
    }

    const [flag, inlineValue] = token.split('=', 2);
    const next = inlineValue ?? argv[index + 1];
    if (!inlineValue && (!next || next.startsWith('--'))) {
      flags.add(flag);
      continue;
    }

    values.set(flag, requireValue(flag, next));
    if (!inlineValue) {
      index += 1;
    }
  }

  const previewPages = Number(values.get('--preview-pages') ?? 3);
  if (!Number.isInteger(previewPages) || previewPages <= 0) {
    throw new Error('--preview-pages must be a positive integer.');
  }

  return {
    dryRun: flags.has('--dry-run'),
    indexPath: values.get('--index') ?? DEFAULT_INDEX_PATH,
    previewPages,
  };
}

function requireValue(flag: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

async function loadIndexFile(path: string): Promise<IndexImportFile> {
  const parsed = JSON.parse(await readFile(path, 'utf8')) as IndexImportFile;
  if (!Array.isArray(parsed.notes)) {
    throw new Error('Index JSON must contain a notes array.');
  }

  for (const note of parsed.notes) {
    if (!note.noteSlug || !Array.isArray(note.entries)) {
      throw new Error('Every note index item must contain noteSlug and entries.');
    }

    for (const entry of note.entries) {
      if (
        !entry.title ||
        !Number.isInteger(entry.pageNumber) ||
        entry.pageNumber < 1
      ) {
        throw new Error(`Invalid index entry found for ${note.noteSlug}.`);
      }
    }
  }

  return parsed;
}

function createStorageClient() {
  const endpoint = requireEnv('OBJECT_STORAGE_ENDPOINT');
  const endpointUrl = new URL(endpoint);
  const bucket = requireEnv('OBJECT_STORAGE_BUCKET');
  const client = new Client({
    endPoint: endpointUrl.hostname,
    port:
      endpointUrl.port.length > 0
        ? Number(endpointUrl.port)
        : endpointUrl.protocol === 'https:'
          ? 443
          : 80,
    useSSL: endpointUrl.protocol === 'https:',
    accessKey: requireEnv('OBJECT_STORAGE_ACCESS_KEY_ID'),
    secretKey: requireEnv('OBJECT_STORAGE_SECRET_ACCESS_KEY'),
    region: process.env.OBJECT_STORAGE_REGION ?? 'us-east-1',
    pathStyle: (process.env.OBJECT_STORAGE_FORCE_PATH_STYLE ?? 'true') === 'true',
  });

  return { bucket, client };
}

function requireEnv(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable ${key}.`);
  }

  return value;
}

async function resolveContext(prisma: PrismaClient, indexFile: IndexImportFile) {
  const site = await prisma.site.findUnique({
    where: { code: indexFile.siteCode },
    select: { id: true, code: true },
  });
  if (!site) {
    throw new Error(`Site "${indexFile.siteCode}" was not found.`);
  }

  const [track, medium, actor] = await Promise.all([
    prisma.examTrack.findFirst({
      where: { siteId: site.id, code: indexFile.trackCode },
      select: { id: true, code: true },
    }),
    prisma.medium.findFirst({
      where: { siteId: site.id, code: indexFile.mediumCode },
      select: { id: true, code: true },
    }),
    prisma.user.findFirst({
      where: {
        siteId: site.id,
        userType: UserType.ADMIN,
        status: UserStatus.ACTIVE,
      },
      select: { id: true, email: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  if (!track) {
    throw new Error(`Track "${indexFile.trackCode}" was not found.`);
  }
  if (!medium) {
    throw new Error(`Medium "${indexFile.mediumCode}" was not found.`);
  }
  if (!actor) {
    throw new Error('No active admin actor was found.');
  }

  const subject = await prisma.subject.findFirst({
    where: {
      siteId: site.id,
      examTrackId: track.id,
      code: indexFile.subjectCode,
    },
    select: { id: true, code: true },
  });
  if (!subject) {
    throw new Error(`Subject "${indexFile.subjectCode}" was not found.`);
  }

  return { actor, medium, site, subject, track };
}

function buildIndexPlan(
  indexFile: IndexImportFile,
  noteBySlug: Map<
    string,
    {
      id: string;
      slug: string;
      title: string;
      pageCount: number;
    }
  >,
) {
  return indexFile.notes.map((item) => {
    const note = noteBySlug.get(item.noteSlug);
    if (!note) {
      throw new Error(`Note "${item.noteSlug}" was not found.`);
    }

    for (const entry of item.entries) {
      if (entry.pageNumber > note.pageCount) {
        throw new Error(
          `Index entry "${entry.title}" for "${item.noteSlug}" points to page ${entry.pageNumber}, but the note only has ${note.pageCount} pages.`,
        );
      }
    }

    return {
      note,
      replaceExistingIndex: item.replaceExistingIndex !== false,
      entries: item.entries,
    };
  });
}

async function createPreviewAsset(input: {
  prisma: PrismaClient;
  storage: ReturnType<typeof createStorageClient>;
  context: Awaited<ReturnType<typeof resolveContext>>;
  note: {
    id: string;
    slug: string;
    pageCount: number;
    fullFileAsset: {
      objectKey: string;
      originalFileName: string;
      contentType: string;
    };
  };
  previewPages: number;
}) {
  const { prisma, storage, context, note, previewPages } = input;
  const fullPdf = await readObjectToBuffer(
    storage.client,
    storage.bucket,
    note.fullFileAsset.objectKey,
  );
  const directory = join(tmpdir(), 'toppers-choice-note-previews');
  await mkdir(directory, { recursive: true });

  const sourcePath = join(directory, `${note.slug}-${randomUUID()}-full.pdf`);
  const previewPath = join(
    directory,
    `${note.slug}-${randomUUID()}-preview.pdf`,
  );
  await writeFile(sourcePath, fullPdf);
  createPreviewPdf(
    sourcePath,
    previewPath,
    Math.min(previewPages, note.pageCount),
  );

  const previewPdf = await readFile(previewPath);
  const objectKey = buildObjectKey(context.site.code, 'pdf');
  await storage.client.putObject(
    storage.bucket,
    objectKey,
    previewPdf,
    previewPdf.length,
    { 'Content-Type': 'application/pdf' },
  );
  const stat = await storage.client.statObject(storage.bucket, objectKey);

  return prisma.$transaction(async (tx) => {
    const fileAsset = await tx.fileAsset.create({
      data: {
        siteId: context.site.id,
        createdByUserId: context.actor.id,
        confirmedByUserId: context.actor.id,
        purpose: FileAssetPurpose.NOTE_PDF,
        accessLevel: FileAssetAccess.PROTECTED,
        status: FileAssetStatus.READY,
        objectKey,
        originalFileName: `preview-${note.fullFileAsset.originalFileName}`,
        extension: 'pdf',
        contentType: 'application/pdf',
        declaredSizeBytes: previewPdf.length,
        sizeBytes: stat.size ?? previewPdf.length,
        checksumSha256: createHash('sha256').update(previewPdf).digest('hex'),
        etag: stat.etag ?? null,
        confirmedAt: new Date(),
      },
      select: { id: true },
    });

    await tx.fileAssetReference.create({
      data: {
        siteId: context.site.id,
        fileAssetId: fileAsset.id,
        resourceType: 'note',
        resourceId: note.id,
        slot: 'preview_pdf',
        accessLevel: FileAssetAccess.PROTECTED,
      },
    });

    return { fileAssetId: fileAsset.id };
  });
}

async function readObjectToBuffer(
  client: Client,
  bucket: string,
  objectKey: string,
) {
  const stream = await client.getObject(bucket, objectKey);
  const chunks: Buffer[] = [];
  for await (const chunk of stream as Readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function createPreviewPdf(sourcePath: string, previewPath: string, pageCount: number) {
  execFileSync(
    'python3',
    [
      '-c',
      [
        'from pypdf import PdfReader, PdfWriter',
        'import sys',
        'reader = PdfReader(sys.argv[1])',
        'writer = PdfWriter()',
        'count = min(int(sys.argv[3]), len(reader.pages))',
        'for index in range(count):',
        '    writer.add_page(reader.pages[index])',
        'with open(sys.argv[2], "wb") as handle:',
        '    writer.write(handle)',
      ].join('\n'),
      sourcePath,
      previewPath,
      String(pageCount),
    ],
    { stdio: 'pipe' },
  );
}

function buildObjectKey(siteCode: string, extension: string) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');

  return [
    'sites',
    siteCode,
    FileAssetPurpose.NOTE_PDF.toLowerCase(),
    year,
    month,
    `${randomUUID()}.${extension}`,
  ].join('/');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
