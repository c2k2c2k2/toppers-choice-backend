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
  topicCodes: string[];
};

type PlannedNoteImportItem = ManifestItem & {
  subjectId: string;
  topicIds: string[];
};

type ImportedNoteResult = {
  noteId: string;
  slug: string;
  pageCount: number;
  sizeBytes: number;
};

type ImportOptions = {
  dryRun: boolean;
  publish: boolean;
  previewPages: number;
  removeExisting: boolean;
  siteCode: string;
  adminEmail?: string;
};

type StorageClient = ReturnType<typeof createStorageClient>;

const TRACK_CODE = 'bank-staff-railway-allied';
const MEDIUM_CODE = 'en';
const DEFAULT_PREVIEW_PAGES = 3;
const NOTE_ACCESS_TYPE = NoteAccessType.PREVIEWABLE_PREMIUM;

const DRIVE_NOTES: ManifestItem[] = [
  {
    driveFileId: '1tlYaTCyc-MC6wTN6DZ28OKGV2bQy7E26',
    originalFileName: 'Area and Volume (Notes).pdf',
    slug: 'bsr-area-volume',
    title: 'Area and Volume',
    subjectCode: 'mathematics',
    topicCodes: ['area-volume'],
  },
  {
    driveFileId: '1Dk3VUa-JhE2u7D2IfXD3nyZJvq9CwEZM',
    originalFileName: 'Average (Notes).pdf',
    slug: 'bsr-average',
    title: 'Average',
    subjectCode: 'mathematics',
    topicCodes: ['average'],
  },
  {
    driveFileId: '1DBhWphW1cBabsMl73eVwuSV4vI6v8G5u',
    originalFileName: 'Banking (Notes).pdf',
    slug: 'bsr-banking',
    title: 'Banking',
    subjectCode: 'banking',
    topicCodes: [],
  },
  {
    driveFileId: '1hI0oh-7pmpHSu8vGbmAJATtzVpoAO5TH',
    originalFileName: 'LCM & HCF (Notes).pdf',
    slug: 'bsr-lcm-hcf',
    title: 'LCM and HCF',
    subjectCode: 'mathematics',
    topicCodes: ['lcm-hcf'],
  },
  {
    driveFileId: '14Cv--QX1z1S2IeuoJRkOXjPM-a_aP_6C',
    originalFileName: 'Marketing Management (Notes).pdf',
    slug: 'bsr-marketing-management',
    title: 'Marketing Management',
    subjectCode: 'marketing-management',
    topicCodes: [],
  },
  {
    driveFileId: '1m93zjxdxVeqQmGfDFNWXRFiq3DpKkt3D',
    originalFileName: 'Number System (Notes).pdf',
    slug: 'bsr-number-system',
    title: 'Number System',
    subjectCode: 'mathematics',
    topicCodes: ['number-system'],
  },
  {
    driveFileId: '1MMrJyuRX0-znFSPXlQCNmbTuFA1fsRM-',
    originalFileName: 'Percentage (Notes).pdf',
    slug: 'bsr-percentage',
    title: 'Percentage',
    subjectCode: 'mathematics',
    topicCodes: ['percentage'],
  },
  {
    driveFileId: '1T0kTrbNhkaG3mnDt0_IGV2a72oLUeU_j',
    originalFileName: 'Profit & Loss (Notes).pdf',
    slug: 'bsr-profit-loss',
    title: 'Profit and Loss',
    subjectCode: 'mathematics',
    topicCodes: ['profit-loss'],
  },
  {
    driveFileId: '1-uqsTB04fLitijMG9qobvzNWrntyk4EY',
    originalFileName: 'Ratio & Proportion (Notes).pdf',
    slug: 'bsr-ratio-proportion',
    title: 'Ratio and Proportion',
    subjectCode: 'mathematics',
    topicCodes: ['ratio-proportion'],
  },
  {
    driveFileId: '1DYDD30L7NB0hCG2cYfjnFzF9umd1npjC',
    originalFileName: 'S. I. & C. I. (Notes).pdf',
    slug: 'bsr-simple-compound-interest',
    title: 'Simple Interest and Compound Interest',
    subjectCode: 'mathematics',
    topicCodes: ['simple-compound-interest'],
  },
  {
    driveFileId: '1F_q1Q5wCRNZM974MuAJSV9DFJK7T-xsy',
    originalFileName: 'Test of Reasoning (Notes).pdf',
    slug: 'bsr-test-of-reasoning',
    title: 'Test of Reasoning',
    subjectCode: 'test-of-reasoning',
    topicCodes: [],
  },
  {
    driveFileId: '1uQQe_2zh5nn9lg_wdQ4yBukGwbKJ4kex',
    originalFileName: 'Time & Distance (Notes).pdf',
    slug: 'bsr-time-distance',
    title: 'Time and Distance',
    subjectCode: 'mathematics',
    topicCodes: ['time-distance'],
  },
  {
    driveFileId: '1yHN6WAUeVVPig8Pj_giAoKr37zTywv6a',
    originalFileName: 'Time & Work (Notes).pdf',
    slug: 'bsr-time-work',
    title: 'Time and Work',
    subjectCode: 'mathematics',
    topicCodes: ['time-work'],
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
    const plan = await buildImportPlan(prisma, context);

    printPlan(options, context, plan);
    if (options.dryRun) {
      console.log('Dry run complete. No notes or files were changed.');
      return;
    }

    const bucketExists = await storage.client.bucketExists(storage.bucket);
    if (!bucketExists) {
      throw new Error(`Object storage bucket "${storage.bucket}" does not exist.`);
    }

    const deletedObjectKeys = options.removeExisting
      ? await removeExistingTrackNotes(prisma, storage, context.site.id, context.track.id)
      : [];
    console.log(
      `Removed existing notes in ${TRACK_CODE}. Deleted ${deletedObjectKeys.length} old file asset object(s).`,
    );

    const imported: ImportedNoteResult[] = [];
    for (const [index, item] of plan.entries()) {
      const result = await importOneNote({
        prisma,
        storage,
        context,
        item,
        orderIndex: (index + 1) * 10,
        previewPages: options.previewPages,
        publish: options.publish,
      });
      imported.push(result);
      console.log(
        `IMPORTED ${result.slug} (${result.pageCount} pages, ${(result.sizeBytes / 1024 / 1024).toFixed(2)} MB)`,
      );
    }

    console.log(
      `Import complete. Created ${imported.length} notes, ${imported.length} full NOTE_PDF assets, and ${imported.length} preview NOTE_PDF assets.`,
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

  const previewPages = Number(values.get('--preview-pages') ?? DEFAULT_PREVIEW_PAGES);
  if (!Number.isInteger(previewPages) || previewPages <= 0) {
    throw new Error('--preview-pages must be a positive integer.');
  }

  return {
    adminEmail: values.get('--admin-email')?.trim().toLowerCase(),
    dryRun: flags.has('--dry-run'),
    previewPages,
    publish: !flags.has('--draft'),
    removeExisting: !flags.has('--keep-existing'),
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

async function resolveContext(prisma: PrismaClient, options: ImportOptions) {
  const site = await prisma.site.findUnique({
    where: { code: options.siteCode },
    select: { id: true, code: true },
  });
  if (!site) {
    throw new Error(`Site "${options.siteCode}" was not found.`);
  }

  const [track, medium, actor, subjects] = await Promise.all([
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
    prisma.subject.findMany({
      where: {
        siteId: site.id,
        examTrack: { code: TRACK_CODE },
      },
      select: { id: true, code: true, name: true },
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

  const subjectsByCode = new Map(subjects.map((subject) => [subject.code, subject]));
  return { actor, medium, site, subjectsByCode, track };
}

async function buildImportPlan(
  prisma: PrismaClient,
  context: Awaited<ReturnType<typeof resolveContext>>,
) {
  const subjectIds = Array.from(context.subjectsByCode.values()).map(
    (subject) => subject.id,
  );
  const topics = await prisma.topic.findMany({
    where: {
      siteId: context.site.id,
      subjectId: { in: subjectIds },
      isActive: true,
    },
    select: { id: true, code: true, name: true, subjectId: true },
  });

  const topicBySubjectCode = new Map<string, Map<string, { id: string; code: string }>>();
  for (const [subjectCode] of context.subjectsByCode) {
    topicBySubjectCode.set(subjectCode, new Map());
  }

  for (const topic of topics) {
    const subjectEntry = Array.from(context.subjectsByCode.values()).find(
      (subject) => subject.id === topic.subjectId,
    );
    if (!subjectEntry) {
      continue;
    }

    topicBySubjectCode.get(subjectEntry.code)?.set(topic.code, {
      id: topic.id,
      code: topic.code,
    });
  }

  const slugs = new Set<string>();
  const plan: PlannedNoteImportItem[] = [];

  for (const item of DRIVE_NOTES) {
    if (slugs.has(item.slug)) {
      throw new Error(`Duplicate note slug in manifest: ${item.slug}`);
    }
    slugs.add(item.slug);

    const subject = context.subjectsByCode.get(item.subjectCode);
    if (!subject) {
      throw new Error(`Subject "${item.subjectCode}" was not found.`);
    }

    const subjectTopics = topicBySubjectCode.get(item.subjectCode);
    if (!subjectTopics) {
      throw new Error(`No topic map could be resolved for subject "${item.subjectCode}".`);
    }

    const topicIds = item.topicCodes.map((topicCode) => {
      const topic = subjectTopics.get(topicCode);
      if (!topic) {
        throw new Error(
          `Topic "${topicCode}" for "${item.originalFileName}" was not found under subject "${item.subjectCode}".`,
        );
      }

      return topic.id;
    });

    plan.push({
      ...item,
      subjectId: subject.id,
      topicIds,
    });
  }

  return plan;
}

function printPlan(
  options: ImportOptions,
  context: Awaited<ReturnType<typeof resolveContext>>,
  plan: PlannedNoteImportItem[],
) {
  console.log(
    JSON.stringify(
      {
        dryRun: options.dryRun,
        publish: options.publish,
        previewPages: options.previewPages,
        removeExisting: options.removeExisting,
        actor: context.actor.email,
        site: context.site.code,
        track: context.track.code,
        medium: context.medium.code,
        noteCount: plan.length,
        notes: plan.map((item) => ({
          slug: item.slug,
          title: item.title,
          subject: item.subjectCode,
          topics: item.topicCodes,
        })),
      },
      null,
      2,
    ),
  );
}

async function removeExistingTrackNotes(
  prisma: PrismaClient,
  storage: StorageClient,
  siteId: string,
  trackId: string,
) {
  const existingNotes = await prisma.note.findMany({
    where: {
      siteId,
      subject: { examTrackId: trackId },
    },
    select: {
      id: true,
      fullFileAssetId: true,
      previewFileAssetId: true,
      coverImageAssetId: true,
    },
  });
  const noteIds = existingNotes.map((note) => note.id);
  const assetIds = Array.from(
    new Set(
      existingNotes.flatMap((note) =>
        [note.fullFileAssetId, note.previewFileAssetId, note.coverImageAssetId].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    ),
  );

  if (noteIds.length === 0) {
    return [];
  }

  const assets = await prisma.fileAsset.findMany({
    where: { id: { in: assetIds }, siteId },
    select: { id: true, objectKey: true },
  });

  const removableObjectKeys: string[] = [];

  await prisma.$transaction(async (tx) => {
    await tx.fileAssetReference.deleteMany({
      where: { siteId, resourceType: 'note', resourceId: { in: noteIds } },
    });
    await tx.note.deleteMany({ where: { siteId, id: { in: noteIds } } });

    for (const asset of assets) {
      const [referenceCount, noteReferenceCount] = await Promise.all([
        tx.fileAssetReference.count({ where: { fileAssetId: asset.id } }),
        tx.note.count({
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

      if (referenceCount === 0 && noteReferenceCount === 0) {
        await tx.fileAsset.delete({ where: { id: asset.id } });
        removableObjectKeys.push(asset.objectKey);
      }
    }
  });

  const deletedObjectKeys: string[] = [];
  for (const objectKey of removableObjectKeys) {
    try {
      await storage.client.removeObject(storage.bucket, objectKey);
      deletedObjectKeys.push(objectKey);
    } catch (error) {
      console.warn(
        `WARN could not remove old object ${objectKey}: ${getErrorMessage(error)}`,
      );
    }
  }

  return deletedObjectKeys;
}

async function importOneNote(input: {
  prisma: PrismaClient;
  storage: StorageClient;
  context: Awaited<ReturnType<typeof resolveContext>>;
  item: PlannedNoteImportItem;
  orderIndex: number;
  previewPages: number;
  publish: boolean;
}): Promise<ImportedNoteResult> {
  const { prisma, storage, context, item, orderIndex, previewPages, publish } = input;
  const localPath = await downloadDrivePdf(item);
  const previewResult = await createPreviewPdf(localPath, item.slug, previewPages);

  try {
    const [body, previewBody] = await Promise.all([
      readFile(localPath),
      readFile(previewResult.previewPath),
    ]);
    const checksumSha256 = createHash('sha256').update(body).digest('hex');
    const previewChecksumSha256 = createHash('sha256').update(previewBody).digest('hex');
    const pageCount = readPdfPageCount(localPath);
    const previewPageCount = Math.min(previewPages, pageCount);

    const fullObjectKey = buildObjectKey(context.site.code, 'pdf');
    const previewObjectKey = buildObjectKey(context.site.code, 'pdf');

    await storage.client.putObject(storage.bucket, fullObjectKey, body, body.length, {
      'Content-Type': 'application/pdf',
    });
    await storage.client.putObject(
      storage.bucket,
      previewObjectKey,
      previewBody,
      previewBody.length,
      { 'Content-Type': 'application/pdf' },
    );

    const [fullStat, previewStat] = await Promise.all([
      storage.client.statObject(storage.bucket, fullObjectKey),
      storage.client.statObject(storage.bucket, previewObjectKey),
    ]);

    const noteId = await prisma.$transaction(async (tx) => {
      const [fullFileAsset, previewFileAsset] = await Promise.all([
        tx.fileAsset.create({
          data: {
            siteId: context.site.id,
            createdByUserId: context.actor.id,
            confirmedByUserId: context.actor.id,
            purpose: FileAssetPurpose.NOTE_PDF,
            accessLevel: FileAssetAccess.PROTECTED,
            status: FileAssetStatus.READY,
            objectKey: fullObjectKey,
            originalFileName: item.originalFileName,
            extension: 'pdf',
            contentType: 'application/pdf',
            declaredSizeBytes: body.length,
            sizeBytes: fullStat.size ?? body.length,
            checksumSha256,
            etag: fullStat.etag ?? null,
            confirmedAt: new Date(),
          },
          select: { id: true },
        }),
        tx.fileAsset.create({
          data: {
            siteId: context.site.id,
            createdByUserId: context.actor.id,
            confirmedByUserId: context.actor.id,
            purpose: FileAssetPurpose.NOTE_PDF,
            accessLevel: FileAssetAccess.PROTECTED,
            status: FileAssetStatus.READY,
            objectKey: previewObjectKey,
            originalFileName: `preview-${item.originalFileName}`,
            extension: 'pdf',
            contentType: 'application/pdf',
            declaredSizeBytes: previewBody.length,
            sizeBytes: previewStat.size ?? previewBody.length,
            checksumSha256: previewChecksumSha256,
            etag: previewStat.etag ?? null,
            confirmedAt: new Date(),
          },
          select: { id: true },
        }),
      ]);

      const note = await tx.note.create({
        data: {
          siteId: context.site.id,
          subjectId: item.subjectId,
          mediumId: context.medium.id,
          slug: item.slug,
          title: item.title,
          shortDescription: null,
          description: null,
          fullFileAssetId: fullFileAsset.id,
          previewFileAssetId: previewFileAsset.id,
          coverImageAssetId: null,
          accessType: NOTE_ACCESS_TYPE,
          previewPageCount,
          pageCount,
          orderIndex,
          status: publish ? NoteStatus.PUBLISHED : NoteStatus.DRAFT,
          createdByUserId: context.actor.id,
          updatedByUserId: context.actor.id,
          publishedByUserId: publish ? context.actor.id : null,
          publishedAt: publish ? new Date() : null,
        },
        select: { id: true },
      });

      if (item.topicIds.length > 0) {
        await tx.noteTopic.createMany({
          data: item.topicIds.map((topicId) => ({
            noteId: note.id,
            topicId,
          })),
          skipDuplicates: true,
        });
      }

      await tx.fileAssetReference.createMany({
        data: [
          {
            siteId: context.site.id,
            fileAssetId: fullFileAsset.id,
            resourceType: 'note',
            resourceId: note.id,
            slot: 'full_pdf',
            accessLevel: FileAssetAccess.PROTECTED,
          },
          {
            siteId: context.site.id,
            fileAssetId: previewFileAsset.id,
            resourceType: 'note',
            resourceId: note.id,
            slot: 'preview_pdf',
            accessLevel: FileAssetAccess.PROTECTED,
          },
        ],
      });

      return note.id;
    });

    return {
      noteId,
      slug: item.slug,
      pageCount,
      sizeBytes: body.length,
    };
  } finally {
    await Promise.allSettled([safeUnlink(localPath), safeUnlink(previewResult.previewPath)]);
  }
}

async function downloadDrivePdf(item: ManifestItem) {
  const directory = join(tmpdir(), 'toppers-choice-drive-note-imports');
  await mkdir(directory, { recursive: true });
  const localPath = join(
    directory,
    `${randomUUID()}-${sanitizeFileName(item.originalFileName)}`,
  );

  const candidateUrls = [
    `https://drive.google.com/uc?export=download&id=${item.driveFileId}`,
    `https://drive.usercontent.google.com/download?id=${item.driveFileId}&export=download&confirm=t`,
  ];
  const failures: string[] = [];

  for (const url of candidateUrls) {
    try {
      execFileSync(
        'curl',
        [
          '--fail',
          '--silent',
          '--show-error',
          '--location',
          '--retry',
          '5',
          '--retry-delay',
          '2',
          '--retry-all-errors',
          url,
          '--output',
          localPath,
        ],
        {
          stdio: 'pipe',
        },
      );

      return localPath;
    } catch (error) {
      failures.push(`${url}: ${getErrorMessage(error)}`);
    }
  }

  throw new Error(
    `Could not download "${item.originalFileName}" from Google Drive.\n${failures.join('\n')}`,
  );

}

function sanitizeFileName(value: string) {
  return value.replaceAll(/[^a-zA-Z0-9._-]+/g, '-');
}

async function createPreviewPdf(sourcePath: string, noteSlug: string, previewPages: number) {
  const directory = join(tmpdir(), 'toppers-choice-note-previews');
  await mkdir(directory, { recursive: true });
  const previewPath = join(
    directory,
    `${noteSlug}-${randomUUID()}-preview.pdf`,
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
      sourcePath,
      previewPath,
      String(previewPages),
    ],
    { stdio: 'pipe' },
  );

  return { previewPath };
}

function readPdfPageCount(pdfPath: string) {
  const output = execFileSync(
    'python3',
    [
      '-c',
      [
        'from pypdf import PdfReader',
        'import sys',
        'print(len(PdfReader(sys.argv[1]).pages))',
      ].join('\n'),
      pdfPath,
    ],
    { encoding: 'utf8', stdio: 'pipe' },
  );

  const pageCount = Number(output.trim());
  if (!Number.isInteger(pageCount) || pageCount <= 0) {
    throw new Error(`Unable to determine page count for ${basename(pdfPath)}.`);
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

async function safeUnlink(path: string) {
  try {
    await unlink(path);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('ENOENT')) {
      throw error;
    }
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
