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
  PrismaClient,
  UserStatus,
  UserType,
} from '@prisma/client';
import { loadEnvironmentFile } from '../src/common/test/load-env-file';

type ManifestItem = {
  driveFileId: string;
  originalFileName: string;
  noteSlug: string;
  title: string;
  subjectCode: string;
  topicCodes: string[];
  clearExistingIndex?: boolean;
  indexEntries: Array<{
    pageNumber: number;
    title: string;
    indentLevel?: number;
    serialLabel?: string;
  }>;
};

type ImportOptions = {
  dryRun: boolean;
  previewPages: number;
  siteCode: string;
  adminEmail?: string;
};

type SubjectContext = {
  id: string;
  code: string;
  name: string;
};

type TopicRecord = {
  id: string;
  code: string;
  name: string;
};

type NoteRecord = {
  id: string;
  slug: string;
  title: string;
  subjectId: string;
  orderIndex: number;
  pageCount: number;
  status: NoteStatus;
  accessType: NoteAccessType;
  publishedAt: Date | null;
  fullFileAssetId: string;
  previewFileAssetId: string | null;
};

type PlannedOperation = ManifestItem & {
  subject: SubjectContext;
  topics: TopicRecord[];
  existingNote: NoteRecord | null;
};

type StorageClient = ReturnType<typeof createStorageClient>;

const TRACK_CODE = 'mpsc-english-medium';
const MEDIUM_CODE = 'en';
const PREVIEW_PAGE_COUNT_DEFAULT = 3;
const NOTE_ACCESS_TYPE = NoteAccessType.PREVIEWABLE_PREMIUM;

const REPLACEMENT_NOTES: ManifestItem[] = [
  {
    driveFileId: '1AobpIGEYSU4Nu2IKxBfCADCUuPp-yNAm',
    originalFileName: 'COMPUTER & INFORMATION TECHNOLOGY.pdf',
    noteSlug: 'computer-information-technology',
    title: 'COMPUTER & INFORMATION TECHNOLOGY',
    subjectCode: 'general-knowledge',
    topicCodes: ['computer'],
    clearExistingIndex: true,
    indexEntries: [
      {
        serialLabel: '1',
        title: 'COMPUTER',
        pageNumber: 1,
      },
      {
        serialLabel: 'i',
        title: 'History of Computers',
        pageNumber: 1,
        indentLevel: 1,
      },
      {
        serialLabel: 'ii',
        title: 'Computer Generations',
        pageNumber: 1,
        indentLevel: 1,
      },
      {
        serialLabel: 'iii',
        title: 'Information System',
        pageNumber: 3,
        indentLevel: 1,
      },
      {
        serialLabel: '2',
        title: 'INFORMATION TECHNOLOGY',
        pageNumber: 13,
      },
      {
        serialLabel: 'i',
        title: 'Communication',
        pageNumber: 13,
        indentLevel: 1,
      },
      {
        serialLabel: 'ii',
        title: 'Internet (E-Mail, Anti Spam)',
        pageNumber: 15,
        indentLevel: 1,
      },
      {
        serialLabel: 'iii',
        title: 'E-Commerce',
        pageNumber: 17,
        indentLevel: 1,
      },
      {
        serialLabel: 'iv',
        title: 'Cyber laws',
        pageNumber: 17,
        indentLevel: 1,
      },
      {
        serialLabel: 'v',
        title: 'E-Governance',
        pageNumber: 19,
        indentLevel: 1,
      },
      {
        serialLabel: 'vi',
        title: 'Virus',
        pageNumber: 22,
        indentLevel: 1,
      },
      {
        serialLabel: 'vii',
        title: 'Other points',
        pageNumber: 22,
        indentLevel: 1,
      },
      {
        serialLabel: 'viii',
        title: 'Short forms',
        pageNumber: 22,
        indentLevel: 1,
      },
    ],
  },
  {
    driveFileId: '1lbrLirvdYXufmtBN2Qejbe3Adyn-TJGA',
    originalFileName: 'Human Biology.pdf',
    noteSlug: 'human-biology',
    title: 'Human Biology',
    subjectCode: 'general-knowledge',
    topicCodes: ['human-biology'],
    clearExistingIndex: true,
    indexEntries: [
      {
        serialLabel: '1',
        title: 'Historical Development of Human beings',
        pageNumber: 2,
      },
      {
        serialLabel: '2',
        title: 'Theories related to Human evolution',
        pageNumber: 2,
      },
      {
        serialLabel: '3',
        title:
          'Cell biology and allied [Cells, Tissues, DNA, RNA, Protoplasm, Chromosomes, Nucleus, Mitochondria, Organs and Organs system]',
        pageNumber: 4,
      },
      {
        serialLabel: '4',
        title:
          'Blood Circulatory System [Blood, RBCs, WBCs, Platelets, Blood groups, Pulse rate, Blood Pressure, Blood clotting, Factor, Blood vessels, Arteries, Veins, Capillaries, Heart]',
        pageNumber: 6,
      },
      {
        serialLabel: '5',
        title: 'Skeletal System [Bones and Joints]',
        pageNumber: 13,
      },
      {
        serialLabel: '6',
        title: 'Muscular System',
        pageNumber: 16,
      },
      {
        serialLabel: '7',
        title:
          'Digestive System & Digestive Glands [Alimentary Canal, Teeth, Tongue, Pharynx, Esophagus, Stomach, Small Intestine, Large Intestine, Liver, Pancreas, Salivary glands]',
        pageNumber: 17,
      },
      {
        serialLabel: '8',
        title: 'Respiratory System',
        pageNumber: 23,
      },
      {
        serialLabel: '9',
        title: 'Excretory System',
        pageNumber: 24,
      },
      {
        serialLabel: '10',
        title: 'Nervous System [Brain and Nerves]',
        pageNumber: 25,
      },
      {
        serialLabel: '11',
        title: 'Reproductive System',
        pageNumber: 27,
      },
      {
        serialLabel: '12',
        title: 'Endocrinal System',
        pageNumber: 28,
      },
      {
        serialLabel: '13',
        title: 'Vitamins',
        pageNumber: 31,
      },
      {
        serialLabel: '14',
        title: 'Skin',
        pageNumber: 33,
      },
      {
        serialLabel: '15',
        title: 'Ear',
        pageNumber: 34,
      },
      {
        serialLabel: '16',
        title: 'Eye and related diseases',
        pageNumber: 35,
      },
      {
        serialLabel: '17',
        title:
          'Bacterial Disease [Tuberculosis, Typhoid, Cholera, Pneumonia, Diphtheria, Tetanus, Whooping Cough, Leprosy, Plague]',
        pageNumber: 37,
      },
    ],
  },
];

async function main() {
  loadEnvironmentFile();
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  await prisma.$connect();
  try {
    const storage = createStorageClient();
    const context = await resolveContext(prisma, options);
    const plan = await buildPlan(prisma, context.site.id);

    printPlan(options, context, plan);
    if (options.dryRun) {
      console.log('Dry run complete. No notes were changed.');
      return;
    }

    await storage.client.bucketExists(storage.bucket);

    const allReplacedAssetIds: string[] = [];
    for (const [index, item] of plan.entries()) {
      const result = await upsertNote({
        prisma,
        storage,
        context,
        item,
        previewPages: options.previewPages,
        fallbackOrderIndex: (index + 1) * 10,
      });

      allReplacedAssetIds.push(...result.removedAssetIds);
      console.log(
        `${result.mode.toUpperCase()} ${result.note.slug} (${result.pageCount} pages, ${(result.sizeBytes / 1024 / 1024).toFixed(2)} MB, ${item.indexEntries.length} index entries)`,
      );
    }

    const cleanedAssetCount = await cleanupOrphanedAssets(
      prisma,
      storage,
      context.site.id,
      allReplacedAssetIds,
    );

    console.log(
      `Done. Replaced ${plan.length} notes, refreshed indexes, and cleaned ${cleanedAssetCount} orphaned file asset(s).`,
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

  const previewPages = Number(
    values.get('--preview-pages') ?? PREVIEW_PAGE_COUNT_DEFAULT,
  );
  if (!Number.isInteger(previewPages) || previewPages <= 0) {
    throw new Error('--preview-pages must be a positive integer.');
  }

  return {
    adminEmail: values.get('--admin-email')?.trim().toLowerCase(),
    dryRun: flags.has('--dry-run'),
    previewPages,
    siteCode: values.get('--site-code')?.trim() || 'toppers-choice',
  };
}

function requireValue(flag: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return value;
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

async function resolveContext(prisma: PrismaClient, options: ImportOptions) {
  const site = await prisma.site.findUnique({
    where: { code: options.siteCode },
    select: { id: true, code: true },
  });
  if (!site) {
    throw new Error(`Site "${options.siteCode}" was not found.`);
  }

  const [track, medium, actor] = await Promise.all([
    prisma.examTrack.findFirst({
      where: { siteId: site.id, code: TRACK_CODE },
      select: { id: true, code: true, name: true },
    }),
    prisma.medium.findFirst({
      where: { siteId: site.id, code: MEDIUM_CODE },
      select: { id: true, code: true, name: true },
    }),
    prisma.user.findFirst({
      where: {
        siteId: site.id,
        userType: UserType.ADMIN,
        status: UserStatus.ACTIVE,
        ...(options.adminEmail ? { email: options.adminEmail } : {}),
      },
      select: { id: true, email: true, fullName: true },
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

  return { actor, medium, site, track };
}

async function buildPlan(prisma: PrismaClient, siteId: string) {
  const subjectCodes = Array.from(
    new Set(REPLACEMENT_NOTES.map((item) => item.subjectCode)),
  );
  const topicCodes = Array.from(
    new Set(REPLACEMENT_NOTES.flatMap((item) => item.topicCodes)),
  );
  const noteSlugs = Array.from(
    new Set(REPLACEMENT_NOTES.map((item) => item.noteSlug)),
  );

  const [subjects, topics, existingNotes] = await Promise.all([
    prisma.subject.findMany({
      where: {
        siteId,
        code: { in: subjectCodes },
        examTrack: { code: TRACK_CODE },
      },
      select: { id: true, code: true, name: true },
    }),
    prisma.topic.findMany({
      where: {
        siteId,
        code: { in: topicCodes },
        subject: { examTrack: { code: TRACK_CODE } },
      },
      select: {
        id: true,
        code: true,
        name: true,
        subjectId: true,
      },
    }),
    prisma.note.findMany({
      where: {
        siteId,
        slug: { in: noteSlugs },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        subjectId: true,
        orderIndex: true,
        pageCount: true,
        status: true,
        accessType: true,
        publishedAt: true,
        fullFileAssetId: true,
        previewFileAssetId: true,
      },
    }),
  ]);

  const subjectByCode = new Map(
    subjects.map((subject) => [subject.code, subject]),
  );
  const topicByCode = new Map(topics.map((topic) => [topic.code, topic]));
  const existingNoteBySlug = new Map(
    existingNotes.map((note) => [note.slug, note]),
  );

  const plan: PlannedOperation[] = [];
  for (const item of REPLACEMENT_NOTES) {
    const subject = subjectByCode.get(item.subjectCode);
    if (!subject) {
      throw new Error(
        `Subject "${item.subjectCode}" for "${item.noteSlug}" was not found.`,
      );
    }

    const resolvedTopics = item.topicCodes.map((topicCode) => {
      const topic = topicByCode.get(topicCode);
      if (!topic) {
        throw new Error(
          `Topic "${topicCode}" for "${item.noteSlug}" was not found.`,
        );
      }
      if (topic.subjectId !== subject.id) {
        throw new Error(
          `Topic "${topicCode}" does not belong to subject "${subject.code}".`,
        );
      }
      return topic;
    });

    plan.push({
      ...item,
      existingNote: existingNoteBySlug.get(item.noteSlug) ?? null,
      subject,
      topics: resolvedTopics,
    });
  }

  return plan;
}

function printPlan(
  options: ImportOptions,
  context: Awaited<ReturnType<typeof resolveContext>>,
  plan: PlannedOperation[],
) {
  console.log(
    JSON.stringify(
      {
        dryRun: options.dryRun,
        previewPages: options.previewPages,
        site: context.site.code,
        track: context.track.code,
        medium: context.medium.code,
        actor: context.actor.email,
        noteCount: plan.length,
        notes: plan.map((item) => ({
          mode: item.existingNote ? 'update' : 'create',
          slug: item.noteSlug,
          title: item.title,
          subject: item.subject.code,
          topics: item.topicCodes,
          source: item.originalFileName,
          indexEntries: item.indexEntries.length,
        })),
      },
      null,
      2,
    ),
  );
}

async function upsertNote(input: {
  prisma: PrismaClient;
  storage: StorageClient;
  context: Awaited<ReturnType<typeof resolveContext>>;
  item: PlannedOperation;
  previewPages: number;
  fallbackOrderIndex: number;
}) {
  const { prisma, storage, context, item, previewPages, fallbackOrderIndex } =
    input;
  const downloaded = await downloadDrivePdf(item);
  let previewPathToCleanup = downloaded.previewPath;

  try {
    const fullPdf = await readFile(downloaded.localPath);
    const previewResult = await createPreviewPdf(
      downloaded.localPath,
      item.noteSlug,
      previewPages,
    );
    const previewPdf = previewResult.buffer;
    previewPathToCleanup = previewResult.previewPath;
    const pageCount = readPdfPageCount(downloaded.localPath);

    for (const entry of item.indexEntries) {
      if (entry.pageNumber > pageCount) {
        throw new Error(
          `Index entry "${entry.title}" for "${item.noteSlug}" points to page ${entry.pageNumber}, but the note only has ${pageCount} pages.`,
        );
      }
    }

    const fullAsset = await uploadPdfAsset({
      storage,
      siteCode: context.site.code,
      originalFileName: item.originalFileName,
      body: fullPdf,
    });
    const previewAsset = await uploadPdfAsset({
      storage,
      siteCode: context.site.code,
      originalFileName: `preview-${item.originalFileName}`,
      body: previewPdf,
    });

    const oldAssetIds = item.existingNote
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
          fullAsset,
          fullPdf,
        ),
        select: { id: true },
      });
      const previewFileAsset = await tx.fileAsset.create({
        data: buildFileAssetCreateInput(
          context.site.id,
          context.actor.id,
          previewAsset,
          previewPdf,
        ),
        select: { id: true },
      });

      let noteId: string;
      let noteSlug: string;
      let noteOrderIndex: number;
      let notePublishedAt: Date | null;

      if (item.existingNote) {
        await tx.fileAssetReference.deleteMany({
          where: {
            siteId: context.site.id,
            resourceType: 'note',
            resourceId: item.existingNote.id,
            slot: { in: ['full_pdf', 'preview_pdf'] },
          },
        });
        await tx.noteTopic.deleteMany({
          where: { noteId: item.existingNote.id },
        });
        if (item.clearExistingIndex) {
          await tx.noteIndexEntry.deleteMany({
            where: { siteId: context.site.id, noteId: item.existingNote.id },
          });
        }

        const updated = await tx.note.update({
          where: { id: item.existingNote.id },
          data: {
            subjectId: item.subject.id,
            mediumId: context.medium.id,
            slug: item.noteSlug,
            title: item.title,
            fullFileAssetId: fullFileAsset.id,
            previewFileAssetId: previewFileAsset.id,
            accessType: NOTE_ACCESS_TYPE,
            previewPageCount: Math.min(previewPages, pageCount),
            pageCount,
            orderIndex: item.existingNote.orderIndex,
            status: NoteStatus.PUBLISHED,
            updatedByUserId: context.actor.id,
            publishedByUserId: context.actor.id,
            publishedAt: item.existingNote.publishedAt ?? new Date(),
            archivedAt: null,
          },
          select: { id: true, slug: true, orderIndex: true, publishedAt: true },
        });

        noteId = updated.id;
        noteSlug = updated.slug;
        noteOrderIndex = updated.orderIndex;
        notePublishedAt = updated.publishedAt;
      } else {
        const created = await tx.note.create({
          data: {
            siteId: context.site.id,
            subjectId: item.subject.id,
            mediumId: context.medium.id,
            slug: item.noteSlug,
            title: item.title,
            shortDescription: null,
            description: null,
            fullFileAssetId: fullFileAsset.id,
            previewFileAssetId: previewFileAsset.id,
            coverImageAssetId: null,
            accessType: NOTE_ACCESS_TYPE,
            previewPageCount: Math.min(previewPages, pageCount),
            pageCount,
            orderIndex: fallbackOrderIndex,
            status: NoteStatus.PUBLISHED,
            createdByUserId: context.actor.id,
            updatedByUserId: context.actor.id,
            publishedByUserId: context.actor.id,
            publishedAt: new Date(),
          },
          select: { id: true, slug: true, orderIndex: true, publishedAt: true },
        });

        noteId = created.id;
        noteSlug = created.slug;
        noteOrderIndex = created.orderIndex;
        notePublishedAt = created.publishedAt;
      }

      await tx.noteTopic.createMany({
        data: item.topics.map((topic) => ({
          noteId,
          topicId: topic.id,
        })),
        skipDuplicates: true,
      });

      await tx.fileAssetReference.createMany({
        data: [
          {
            siteId: context.site.id,
            fileAssetId: fullFileAsset.id,
            resourceType: 'note',
            resourceId: noteId,
            slot: 'full_pdf',
            accessLevel: FileAssetAccess.PROTECTED,
          },
          {
            siteId: context.site.id,
            fileAssetId: previewFileAsset.id,
            resourceType: 'note',
            resourceId: noteId,
            slot: 'preview_pdf',
            accessLevel: FileAssetAccess.PROTECTED,
          },
        ],
      });

      if (item.clearExistingIndex !== false) {
        await tx.noteIndexEntry.deleteMany({
          where: { siteId: context.site.id, noteId },
        });
      }

      if (item.indexEntries.length > 0) {
        await tx.noteIndexEntry.createMany({
          data: item.indexEntries.map((entry, index) => ({
            siteId: context.site.id,
            noteId,
            serialLabel: entry.serialLabel?.trim() || null,
            title: entry.title.trim(),
            titleFontHint: null,
            pageNumber: entry.pageNumber,
            indentLevel: entry.indentLevel ?? 0,
            orderIndex: (index + 1) * 10,
            createdByUserId: context.actor.id,
            updatedByUserId: context.actor.id,
          })),
        });
      }

      return {
        id: noteId,
        slug: noteSlug,
        orderIndex: noteOrderIndex,
        publishedAt: notePublishedAt,
        mode: item.existingNote ? ('update' as const) : ('create' as const),
      };
    });

    return {
      mode: note.mode,
      note,
      pageCount,
      sizeBytes: fullPdf.length,
      removedAssetIds: oldAssetIds,
    };
  } finally {
    await safeUnlink(downloaded.localPath);
    await safeUnlink(previewPathToCleanup);
  }
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

async function downloadDrivePdf(item: ManifestItem) {
  const directory = join(tmpdir(), 'toppers-choice-drive-replacements');
  await mkdir(directory, { recursive: true });
  const localPath = join(
    directory,
    basename(`${item.noteSlug}-${randomUUID()}.pdf`),
  );
  const previewPath = join(
    directory,
    basename(`${item.noteSlug}-${randomUUID()}-preview.pdf`),
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

  await mkdir(directory, { recursive: true });
  await writeFile(localPath, buffer);
  return { localPath, previewPath };
}

async function createPreviewPdf(
  localPath: string,
  slug: string,
  previewPages: number,
) {
  const directory = join(tmpdir(), 'toppers-choice-drive-replacements');
  await mkdir(directory, { recursive: true });
  const previewPath = join(
    directory,
    basename(`${slug}-${randomUUID()}-preview.pdf`),
  );
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
  if (candidateAssetIds.length === 0) {
    return 0;
  }

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
  } catch {
    // ignore cleanup errors for temp files
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error) => {
  console.error(getErrorMessage(error));
  process.exitCode = 1;
});
