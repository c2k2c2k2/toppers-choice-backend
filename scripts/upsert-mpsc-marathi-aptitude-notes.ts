import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { Client } from 'minio';
import {
  FileAssetAccess,
  FileAssetPurpose,
  FileAssetStatus,
  NoteAccessType,
  NoteStatus,
  Prisma,
  PrismaClient,
  UserStatus,
  UserType,
} from '@prisma/client';
import { loadEnvironmentFile } from '../src/common/test/load-env-file';

type ManifestItem = {
  driveFileId: string;
  originalFileName: string;
  slug: string;
  title: string;
  subjectCode: string;
};

type NoteRecord = {
  id: string;
  slug: string;
  title: string;
  orderIndex: number;
  publishedAt: Date | null;
  fullFileAssetId: string;
  previewFileAssetId: string | null;
};

type PlannedOperation = ManifestItem & {
  existingNote: NoteRecord | null;
  subject: {
    id: string;
    code: string;
    name: string;
    orderIndex: number;
  };
};

type StorageClient = ReturnType<typeof createStorageClient>;

const SITE_CODE = 'toppers-choice';
const TRACK_CODE = 'mpsc-marathi-allied';
const MEDIUM_CODE = 'mr';
const PREVIEW_PAGES = 3;
const NOTE_ACCESS_TYPE = NoteAccessType.PREVIEWABLE_PREMIUM;

const NOTES: ManifestItem[] = [
  {
    driveFileId: '1wRwYg5rW65c45eAXHaw86iwp_yQ4GQdD',
    originalFileName: 'Ankganit.pdf',
    slug: 'ankganit',
    title: 'अंकगणित',
    subjectCode: 'mathematics',
  },
  {
    driveFileId: '15cGaYjNH1RtXpBQeHXQwEfUHau7XeC8y',
    originalFileName: 'BuddhiMapan.pdf',
    slug: 'buddhimapan',
    title: 'बुद्धीमापन',
    subjectCode: 'test-of-reasoning',
  },
];

async function main() {
  loadEnvironmentFile();
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  await prisma.$connect();
  try {
    const context = await resolveContext(prisma, options.adminEmail);
    const plan = await buildPlan(prisma, context.site.id);

    console.log(
      JSON.stringify(
        {
          dryRun: options.dryRun,
          site: context.site.code,
          track: context.track.code,
          medium: context.medium.code,
          actor: context.actor.email,
          noteCount: plan.length,
          notes: plan.map((item) => ({
            mode: item.existingNote ? 'update' : 'create',
            slug: item.slug,
            title: item.title,
            subject: item.subject.code,
            sourceFile: item.originalFileName,
            oldFullFileAssetId: item.existingNote?.fullFileAssetId ?? null,
            oldPreviewFileAssetId:
              item.existingNote?.previewFileAssetId ?? null,
          })),
        },
        null,
        2,
      ),
    );

    if (options.dryRun) {
      console.log('Dry run complete. No notes were changed.');
      return;
    }

    const storage = createStorageClient();
    const bucketExists = await storage.client.bucketExists(storage.bucket);
    if (!bucketExists) {
      throw new Error(
        `Object storage bucket "${storage.bucket}" does not exist.`,
      );
    }

    const orphanCandidateAssetIds = new Set<string>();
    for (const item of plan) {
      const result = await upsertNote({
        prisma,
        storage,
        context,
        item,
      });

      for (const assetId of result.removedAssetIds) {
        orphanCandidateAssetIds.add(assetId);
      }

      console.log(
        `${result.mode.toUpperCase()} ${result.slug} (${result.pageCount} pages, ${(result.sizeBytes / 1024 / 1024).toFixed(2)} MB)`,
      );
    }

    const cleanedAssetCount = await cleanupOrphanedAssets(
      prisma,
      storage,
      context.site.id,
      Array.from(orphanCandidateAssetIds),
    );
    console.log(`Cleaned up ${cleanedAssetCount} orphaned asset(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

function parseArgs(argv: string[]) {
  const flags = new Set<string>();
  const values = new Map<string, string>();

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

  return {
    adminEmail: values.get('--admin-email')?.trim().toLowerCase(),
    dryRun: flags.has('--dry-run'),
  };
}

function requireValue(flag: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
}

async function resolveContext(prisma: PrismaClient, adminEmail?: string) {
  const site = await prisma.site.findUnique({
    where: { code: SITE_CODE },
    select: { id: true, code: true },
  });
  if (!site) {
    throw new Error(`Site "${SITE_CODE}" was not found.`);
  }

  const [track, medium, actor] = await Promise.all([
    prisma.examTrack.findFirst({
      where: { siteId: site.id, code: TRACK_CODE, isActive: true },
      select: { id: true, code: true, name: true, defaultMediumId: true },
    }),
    prisma.medium.findFirst({
      where: { siteId: site.id, code: MEDIUM_CODE, isActive: true },
      select: { id: true, code: true, name: true },
    }),
    prisma.user.findFirst({
      where: {
        siteId: site.id,
        userType: UserType.ADMIN,
        status: UserStatus.ACTIVE,
        ...(adminEmail ? { email: adminEmail } : {}),
      },
      select: { id: true, email: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  if (!track) {
    throw new Error(`Exam track "${TRACK_CODE}" was not found.`);
  }
  if (!medium) {
    throw new Error(`Medium "${MEDIUM_CODE}" was not found.`);
  }
  if (!actor) {
    throw new Error('No active admin actor was found for import attribution.');
  }
  if (track.defaultMediumId !== medium.id) {
    throw new Error(
      `Track "${TRACK_CODE}" does not use "${MEDIUM_CODE}" as its default medium.`,
    );
  }

  return { actor, medium, site, track };
}

async function buildPlan(
  prisma: PrismaClient,
  siteId: string,
): Promise<PlannedOperation[]> {
  const subjects = await prisma.subject.findMany({
    where: {
      siteId,
      examTrack: { code: TRACK_CODE },
      code: { in: NOTES.map((item) => item.subjectCode) },
    },
    select: {
      id: true,
      code: true,
      name: true,
      orderIndex: true,
      isActive: true,
      visibility: true,
    },
  });
  const subjectByCode = new Map(
    subjects.map((subject) => [subject.code, subject]),
  );

  const existingNotes = await prisma.note.findMany({
    where: {
      siteId,
      slug: { in: NOTES.map((item) => item.slug) },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      orderIndex: true,
      publishedAt: true,
      fullFileAssetId: true,
      previewFileAssetId: true,
    },
  });
  const existingNoteBySlug = new Map(
    existingNotes.map((note) => [note.slug, note]),
  );

  return NOTES.map((item) => {
    const subject = subjectByCode.get(item.subjectCode);
    if (!subject) {
      throw new Error(`Subject "${item.subjectCode}" was not found.`);
    }
    if (!subject.isActive || subject.visibility !== 'PUBLIC') {
      throw new Error(
        `Subject "${item.subjectCode}" is not active and public.`,
      );
    }

    return {
      ...item,
      existingNote: existingNoteBySlug.get(item.slug) ?? null,
      subject,
    };
  });
}

async function upsertNote(input: {
  prisma: PrismaClient;
  storage: StorageClient;
  context: Awaited<ReturnType<typeof resolveContext>>;
  item: PlannedOperation;
}) {
  const { prisma, storage, context, item } = input;
  const downloaded = await downloadDrivePdf(item);
  let previewPathToCleanup = downloaded.previewPath;

  try {
    const fullPdf = await readFile(downloaded.localPath);
    const pageCount = readPdfPageCount(downloaded.localPath);
    const previewResult = await createPreviewPdf(
      downloaded.localPath,
      PREVIEW_PAGES,
    );
    previewPathToCleanup = previewResult.previewPath;

    const fullUpload = await uploadPdfAsset({
      storage,
      siteCode: context.site.code,
      originalFileName: item.originalFileName,
      body: fullPdf,
    });
    const previewUpload = await uploadPdfAsset({
      storage,
      siteCode: context.site.code,
      originalFileName: `preview-${item.originalFileName}`,
      body: previewResult.buffer,
    });

    const removedAssetIds = item.existingNote
      ? [
          item.existingNote.fullFileAssetId,
          item.existingNote.previewFileAssetId,
        ].filter((value): value is string => Boolean(value))
      : [];

    const note = await prisma.$transaction(async (tx) => {
      const fullFileAsset = await tx.fileAsset.create({
        data: buildFileAssetCreateInput(
          context.site.id,
          context.actor.id,
          fullUpload,
          fullPdf,
        ),
        select: { id: true },
      });
      const previewFileAsset = await tx.fileAsset.create({
        data: buildFileAssetCreateInput(
          context.site.id,
          context.actor.id,
          previewUpload,
          previewResult.buffer,
        ),
        select: { id: true },
      });

      if (item.existingNote) {
        await tx.fileAssetReference.deleteMany({
          where: {
            siteId: context.site.id,
            resourceType: 'note',
            resourceId: item.existingNote.id,
            slot: { in: ['full_pdf', 'preview_pdf'] },
          },
        });

        const updated = await tx.note.update({
          where: { id: item.existingNote.id },
          data: {
            subjectId: item.subject.id,
            mediumId: context.medium.id,
            slug: item.slug,
            title: item.title,
            fullFileAssetId: fullFileAsset.id,
            previewFileAssetId: previewFileAsset.id,
            accessType: NOTE_ACCESS_TYPE,
            previewPageCount: Math.min(PREVIEW_PAGES, pageCount),
            pageCount,
            orderIndex: item.existingNote.orderIndex,
            status: NoteStatus.PUBLISHED,
            updatedByUserId: context.actor.id,
            publishedByUserId: context.actor.id,
            publishedAt: item.existingNote.publishedAt ?? new Date(),
            archivedAt: null,
          },
          select: { slug: true },
        });

        await createNoteAssetReferences(tx, {
          siteId: context.site.id,
          noteId: item.existingNote.id,
          fullFileAssetId: fullFileAsset.id,
          previewFileAssetId: previewFileAsset.id,
        });

        return { mode: 'update' as const, slug: updated.slug };
      }

      const created = await tx.note.create({
        data: {
          siteId: context.site.id,
          subjectId: item.subject.id,
          mediumId: context.medium.id,
          slug: item.slug,
          title: item.title,
          shortDescription: null,
          description: null,
          fullFileAssetId: fullFileAsset.id,
          previewFileAssetId: previewFileAsset.id,
          coverImageAssetId: null,
          accessType: NOTE_ACCESS_TYPE,
          previewPageCount: Math.min(PREVIEW_PAGES, pageCount),
          pageCount,
          orderIndex: item.subject.orderIndex,
          status: NoteStatus.PUBLISHED,
          createdByUserId: context.actor.id,
          updatedByUserId: context.actor.id,
          publishedByUserId: context.actor.id,
          publishedAt: new Date(),
        },
        select: { id: true, slug: true },
      });

      await createNoteAssetReferences(tx, {
        siteId: context.site.id,
        noteId: created.id,
        fullFileAssetId: fullFileAsset.id,
        previewFileAssetId: previewFileAsset.id,
      });

      return { mode: 'create' as const, slug: created.slug };
    });

    return {
      mode: note.mode,
      slug: note.slug,
      pageCount,
      sizeBytes: fullPdf.length,
      removedAssetIds,
    };
  } finally {
    await safeUnlink(downloaded.localPath);
    await safeUnlink(previewPathToCleanup);
  }
}

async function createNoteAssetReferences(
  tx: Prisma.TransactionClient,
  input: {
    siteId: string;
    noteId: string;
    fullFileAssetId: string;
    previewFileAssetId: string;
  },
) {
  await tx.fileAssetReference.createMany({
    data: [
      {
        siteId: input.siteId,
        fileAssetId: input.fullFileAssetId,
        resourceType: 'note',
        resourceId: input.noteId,
        slot: 'full_pdf',
        accessLevel: FileAssetAccess.PROTECTED,
      },
      {
        siteId: input.siteId,
        fileAssetId: input.previewFileAssetId,
        resourceType: 'note',
        resourceId: input.noteId,
        slot: 'preview_pdf',
        accessLevel: FileAssetAccess.PROTECTED,
      },
    ],
  });
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
    pathStyle:
      (process.env.OBJECT_STORAGE_FORCE_PATH_STYLE ?? 'true') === 'true',
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

async function downloadDrivePdf(item: ManifestItem) {
  const directory = join(
    tmpdir(),
    'toppers-choice-mpsc-marathi-aptitude-notes',
  );
  await mkdir(directory, { recursive: true });
  const localPath = join(
    directory,
    basename(`${item.slug}-${randomUUID()}.pdf`),
  );
  const previewPath = join(
    directory,
    basename(`${item.slug}-${randomUUID()}-preview.pdf`),
  );
  const response = await fetch(
    `https://drive.google.com/uc?export=download&id=${item.driveFileId}`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to download "${item.originalFileName}": ${response.status} ${response.statusText}`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.subarray(0, 4).equals(Buffer.from('%PDF'))) {
    throw new Error(`Downloaded "${item.originalFileName}" was not a PDF.`);
  }

  await writeFile(localPath, buffer);
  return { localPath, previewPath };
}

function readPdfPageCount(localPath: string) {
  const output = execFileSync(
    'python3',
    [
      '-c',
      [
        'from pypdf import PdfReader',
        'import sys',
        'print(len(PdfReader(sys.argv[1]).pages))',
      ].join('; '),
      localPath,
    ],
    { encoding: 'utf8' },
  ).trim();
  const pageCount = Number(output);
  if (!Number.isInteger(pageCount) || pageCount <= 0) {
    throw new Error(`Could not resolve page count for ${localPath}.`);
  }

  return pageCount;
}

async function createPreviewPdf(localPath: string, previewPages: number) {
  const directory = join(
    tmpdir(),
    'toppers-choice-mpsc-marathi-aptitude-notes',
  );
  await mkdir(directory, { recursive: true });
  const previewPath = join(directory, basename(`preview-${randomUUID()}.pdf`));
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
      localPath,
      previewPath,
      String(previewPages),
    ],
    { stdio: 'pipe' },
  );

  return {
    buffer: await readFile(previewPath),
    previewPath,
  };
}

async function uploadPdfAsset(input: {
  storage: StorageClient;
  siteCode: string;
  originalFileName: string;
  body: Buffer;
}) {
  const { storage, siteCode, originalFileName, body } = input;
  const objectKey = buildObjectKey(siteCode, 'pdf');
  await storage.client.putObject(storage.bucket, objectKey, body, body.length, {
    'Content-Type': 'application/pdf',
  });
  const stat = await storage.client.statObject(storage.bucket, objectKey);

  return {
    etag: stat.etag ?? null,
    objectKey,
    originalFileName,
    sizeBytes: stat.size ?? body.length,
  };
}

function buildFileAssetCreateInput(
  siteId: string,
  actorId: string,
  uploaded: Awaited<ReturnType<typeof uploadPdfAsset>>,
  body: Buffer,
) {
  return {
    siteId,
    createdByUserId: actorId,
    confirmedByUserId: actorId,
    purpose: FileAssetPurpose.NOTE_PDF,
    accessLevel: FileAssetAccess.PROTECTED,
    status: FileAssetStatus.READY,
    objectKey: uploaded.objectKey,
    originalFileName: uploaded.originalFileName,
    extension: 'pdf',
    contentType: 'application/pdf',
    declaredSizeBytes: body.length,
    sizeBytes: uploaded.sizeBytes,
    checksumSha256: createHash('sha256').update(body).digest('hex'),
    etag: uploaded.etag,
    confirmedAt: new Date(),
  };
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

async function cleanupOrphanedAssets(
  prisma: PrismaClient,
  storage: StorageClient,
  siteId: string,
  candidateAssetIds: string[],
) {
  const assets = await prisma.fileAsset.findMany({
    where: { id: { in: candidateAssetIds }, siteId },
    select: { id: true, objectKey: true },
  });

  let cleaned = 0;
  for (const asset of assets) {
    const [referenceCount, noteReferenceCount] = await Promise.all([
      prisma.fileAssetReference.count({ where: { fileAssetId: asset.id } }),
      prisma.note.count({
        where: {
          siteId,
          OR: [
            { fullFileAssetId: asset.id },
            { previewFileAssetId: asset.id },
            { coverImageAssetId: asset.id },
          ],
        },
      }),
    ]);

    if (referenceCount > 0 || noteReferenceCount > 0) {
      continue;
    }

    await prisma.fileAsset.delete({ where: { id: asset.id } });
    try {
      await storage.client.removeObject(storage.bucket, asset.objectKey);
    } catch (error) {
      console.warn(
        `WARN could not remove orphaned object ${asset.objectKey}: ${getErrorMessage(error)}`,
      );
    }
    cleaned += 1;
  }

  return cleaned;
}

async function safeUnlink(path: string) {
  try {
    await unlink(path);
  } catch (error) {
    if (getErrorMessage(error).includes('ENOENT')) {
      return;
    }
    throw error;
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error) => {
  console.error(getErrorMessage(error));
  process.exitCode = 1;
});
