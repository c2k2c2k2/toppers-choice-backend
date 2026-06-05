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
  PrismaClient,
  UserStatus,
  UserType,
} from '@prisma/client';
import { loadEnvironmentFile } from '../src/common/test/load-env-file';

const DRIVE_FILE_ID = '1wCB9CiUVGkX4UQAQPAAJ_ecQ_zgGk_V6';
const ORIGINAL_FILE_NAME = 'Test of Reasoning.pdf';
const SITE_CODE = 'toppers-choice';
const MEDIUM_CODE = 'en';
const SUBJECT_CODE = 'test-of-reasoning';
const PREVIEW_PAGES = 3;

type StorageClient = ReturnType<typeof createStorageClient>;

async function main() {
  loadEnvironmentFile();
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  await prisma.$connect();
  try {
    const context = await resolveContext(prisma, options.adminEmail);
    const notes = await findReasoningNotes(
      prisma,
      context.site.id,
      context.medium.id,
    );

    console.log(
      JSON.stringify(
        {
          dryRun: options.dryRun,
          driveFileId: DRIVE_FILE_ID,
          sourceFile: ORIGINAL_FILE_NAME,
          site: context.site.code,
          medium: context.medium.code,
          actor: context.actor.email,
          noteCount: notes.length,
          notes: notes.map((note) => ({
            id: note.id,
            slug: note.slug,
            title: note.title,
            track: note.subject.examTrack.code,
            subject: note.subject.code,
            oldFullFileAssetId: note.fullFileAssetId,
            oldPreviewFileAssetId: note.previewFileAssetId,
            indexEntries: note._count.indexEntries,
          })),
        },
        null,
        2,
      ),
    );

    if (notes.length === 0) {
      throw new Error('No English Test of Reasoning notes were found.');
    }

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

    const downloaded = await downloadDrivePdf();
    let previewPathToCleanup = downloaded.previewPath;
    try {
      const fullPdf = await readFile(downloaded.localPath);
      const pageCount = readPdfPageCount(downloaded.localPath);
      const preview = await createPreviewPdf(
        downloaded.localPath,
        PREVIEW_PAGES,
      );
      previewPathToCleanup = preview.previewPath;

      const fullUpload = await uploadPdfAsset({
        storage,
        siteCode: context.site.code,
        originalFileName: ORIGINAL_FILE_NAME,
        body: fullPdf,
      });
      const previewUpload = await uploadPdfAsset({
        storage,
        siteCode: context.site.code,
        originalFileName: `preview-${ORIGINAL_FILE_NAME}`,
        body: preview.buffer,
      });

      const oldAssetIds = Array.from(
        new Set(
          notes.flatMap((note) =>
            [note.fullFileAssetId, note.previewFileAssetId].filter(
              (value): value is string => Boolean(value),
            ),
          ),
        ),
      );

      const result = await prisma.$transaction(async (tx) => {
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
            preview.buffer,
          ),
          select: { id: true },
        });

        for (const note of notes) {
          await tx.fileAssetReference.deleteMany({
            where: {
              siteId: context.site.id,
              resourceType: 'note',
              resourceId: note.id,
              slot: { in: ['full_pdf', 'preview_pdf'] },
            },
          });

          await tx.note.update({
            where: { id: note.id },
            data: {
              mediumId: context.medium.id,
              fullFileAssetId: fullFileAsset.id,
              previewFileAssetId: previewFileAsset.id,
              previewPageCount: Math.min(PREVIEW_PAGES, pageCount),
              pageCount,
              updatedByUserId: context.actor.id,
            },
          });

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
        }

        return {
          fullFileAssetId: fullFileAsset.id,
          previewFileAssetId: previewFileAsset.id,
        };
      });

      const cleanedAssetCount = await cleanupOrphanedAssets(
        prisma,
        storage,
        context.site.id,
        oldAssetIds,
      );

      console.log(
        JSON.stringify(
          {
            updatedNotes: notes.length,
            pageCount,
            sizeBytes: fullPdf.length,
            fullFileAssetId: result.fullFileAssetId,
            previewFileAssetId: result.previewFileAssetId,
            cleanedAssetCount,
          },
          null,
          2,
        ),
      );
    } finally {
      await safeUnlink(downloaded.localPath);
      await safeUnlink(previewPathToCleanup);
    }
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

  const [medium, actor] = await Promise.all([
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

  if (!medium) {
    throw new Error(`Medium "${MEDIUM_CODE}" was not found.`);
  }
  if (!actor) {
    throw new Error(
      'No active admin actor was found for replacement attribution.',
    );
  }

  return { actor, medium, site };
}

async function findReasoningNotes(
  prisma: PrismaClient,
  siteId: string,
  mediumId: string,
) {
  return prisma.note.findMany({
    where: {
      siteId,
      mediumId,
      subject: {
        code: SUBJECT_CODE,
      },
      OR: [
        { title: { equals: 'Test of Reasoning', mode: 'insensitive' } },
        { slug: { contains: 'test-of-reasoning', mode: 'insensitive' } },
        {
          fullFileAsset: {
            originalFileName: { contains: 'reasoning', mode: 'insensitive' },
          },
        },
      ],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      fullFileAssetId: true,
      previewFileAssetId: true,
      subject: {
        select: {
          code: true,
          examTrack: {
            select: {
              code: true,
              defaultMediumId: true,
            },
          },
        },
      },
      _count: {
        select: {
          indexEntries: true,
        },
      },
    },
    orderBy: [
      { subject: { examTrack: { orderIndex: 'asc' } } },
      { orderIndex: 'asc' },
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

async function downloadDrivePdf() {
  const directory = join(tmpdir(), 'toppers-choice-reasoning-note');
  await mkdir(directory, { recursive: true });
  const localPath = join(directory, basename(`reasoning-${randomUUID()}.pdf`));
  const previewPath = join(
    directory,
    basename(`reasoning-${randomUUID()}-preview.pdf`),
  );
  const response = await fetch(
    `https://drive.google.com/uc?export=download&id=${DRIVE_FILE_ID}`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to download "${ORIGINAL_FILE_NAME}": ${response.status} ${response.statusText}`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.subarray(0, 4).equals(Buffer.from('%PDF'))) {
    throw new Error(`Downloaded "${ORIGINAL_FILE_NAME}" was not a PDF.`);
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
  const directory = join(tmpdir(), 'toppers-choice-reasoning-note');
  await mkdir(directory, { recursive: true });
  const previewPath = join(
    directory,
    basename(`reasoning-${randomUUID()}-preview.pdf`),
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
