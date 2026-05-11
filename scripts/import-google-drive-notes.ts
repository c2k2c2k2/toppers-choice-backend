import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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

type DriveNoteManifestItem = {
  driveFileId: string;
  originalFileName: string;
  slug: string;
  title: string;
  topicCodes: string[];
};

type PlannedNoteImportItem = DriveNoteManifestItem & {
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
  removeExisting: boolean;
  siteCode: string;
  adminEmail?: string;
};

const TRACK_CODE = 'mpsc-marathi-allied';
const SUBJECT_CODE = 'general-knowledge';
const MEDIUM_CODE = 'mr';

const DRIVE_NOTES: DriveNoteManifestItem[] = [
  {
    driveFileId: '1U9EWYv1QRK6Vf3LtpqYU00jLNNQfru_V',
    originalFileName: 'भारत - एक दृष्टीक्षेप.pdf',
    slug: 'bharat-ek-drishtikshep',
    title: 'भारत - एक दृष्टीक्षेप',
    topicCodes: ['india-at-a-glance'],
  },
  {
    driveFileId: '1hLjxeetwL-zEZatQNLPBNV0hVci5Q4gm',
    originalFileName: 'पंचायतराज.pdf',
    slug: 'panchayatraj',
    title: 'पंचायतराज',
    topicCodes: ['panchayat-raj'],
  },
  {
    driveFileId: '1092OMdT4AdMi9YHWo1Dkz4IMnquBJky1',
    originalFileName: 'आधुनिक भारताचा इतिहास.pdf',
    slug: 'adhunik-bharatacha-itihas',
    title: 'आधुनिक भारताचा इतिहास',
    topicCodes: ['history', 'modern-indian-history'],
  },
  {
    driveFileId: '1fvc5-nsLhP486B87eImfZXJtZj6Hgzq6',
    originalFileName: 'महाराष्ट्र नोट्स.pdf',
    slug: 'maharashtra-notes',
    title: 'महाराष्ट्र नोट्स',
    topicCodes: ['maharashtra'],
  },
  {
    driveFileId: '16I-CTziRwYDmo5XYpSsjP6FkNcybK7Uo',
    originalFileName: 'विविध देश.pdf',
    slug: 'vividh-desh',
    title: 'विविध देश',
    topicCodes: ['geography', 'various-countries'],
  },
  {
    driveFileId: '1JW1mkxGW9cJJtx08TadjL9pB_Cx02lXG',
    originalFileName: 'वाणिज्य व अर्थव्यवस्था.pdf',
    slug: 'vanijya-ani-arthavyavastha',
    title: 'वाणिज्य व अर्थव्यवस्था',
    topicCodes: ['commerce-economy'],
  },
  {
    driveFileId: '1fW8L5pwb0gQ4LnDgoVWPc8i05OXmvmki',
    originalFileName: 'वने व वन्य प्राणी.pdf',
    slug: 'vane-vanya-prani',
    title: 'वने व वन्य प्राणी',
    topicCodes: ['agriculture', 'forest-wildlife'],
  },
  {
    driveFileId: '1uo43dzFjCRBEzY5dJwUKHSZC-qtteqAb',
    originalFileName: 'सिंचन, जमीन खते, बियाणे.pdf',
    slug: 'sinchan-jamin-khate-biyane',
    title: 'सिंचन, जमीन खते, बियाणे',
    topicCodes: ['agriculture', 'irrigation-soil-fertilizers-seeds'],
  },
  {
    driveFileId: '1v5p4jL9ilTvN-_RbJNeqyp8k4yeV_Tl5',
    originalFileName: 'समाज सुधारक.pdf',
    slug: 'samaj-sudharak',
    title: 'समाज सुधारक',
    topicCodes: ['social-reformers'],
  },
  {
    driveFileId: '16LsWclBaznsps6zn3tnVvm-mQG0JkkRu',
    originalFileName: 'रसायनशास्त्र.pdf',
    slug: 'rasayanshastra',
    title: 'रसायनशास्त्र',
    topicCodes: ['chemistry'],
  },
  {
    driveFileId: '1ryf0V0Ril4yFZNV2EnROaG38_ch7d8am',
    originalFileName: 'राज्यशास्त्र.pdf',
    slug: 'rajyashastra',
    title: 'राज्यशास्त्र',
    topicCodes: ['political-science'],
  },
  {
    driveFileId: '1TTvHAgGs9BldLhBNeIad2Cou7jUHRNJR',
    originalFileName: 'प्राचीन इतिहास.pdf',
    slug: 'prachin-itihas',
    title: 'प्राचीन इतिहास',
    topicCodes: ['history', 'ancient-history'],
  },
  {
    driveFileId: '1LCX5w_a7PcuS8sr1MlFn8u5mw88mthHx',
    originalFileName: 'भूगोल.pdf',
    slug: 'bhugol',
    title: 'भूगोल',
    topicCodes: ['geography'],
  },
  {
    driveFileId: '1prbejqMHQrA_IPPc4wx0b3bwFV8yQfed',
    originalFileName: 'पशुसंवर्धन व दुग्ध व्यवसाय.pdf',
    slug: 'pashusanvardhan-dugdha-vyavsay',
    title: 'पशुसंवर्धन व दुग्ध व्यवसाय',
    topicCodes: ['agriculture', 'animal-husbandry-dairy'],
  },
  {
    driveFileId: '1SfzQP6pBbjZx43ipvUvWRpr1aIlKY3oA',
    originalFileName: 'पदार्थ विज्ञान (भौतिकशास्त्र).pdf',
    slug: 'padartha-vigyan-bhautikshastra',
    title: 'पदार्थ विज्ञान (भौतिकशास्त्र)',
    topicCodes: ['physics'],
  },
  {
    driveFileId: '1wZtoTky2Sx18qsbyPscyhfGlnEFXDxDO',
    originalFileName: 'मासेमारी विषयक.pdf',
    slug: 'masemari-vishayak',
    title: 'मासेमारी विषयक',
    topicCodes: ['agriculture', 'fisheries'],
  },
  {
    driveFileId: '1G92stqSxwuNBylVy_OV0IoLUNrOu1Epb',
    originalFileName: 'मानवी जीवशास्त्र.pdf',
    slug: 'manavi-jivshastra',
    title: 'मानवी जीवशास्त्र',
    topicCodes: ['human-biology'],
  },
  {
    driveFileId: '1Clphvhq9d4c7cl2ZeAWo-e-dJY6aYu0C',
    originalFileName: 'माहिती तंत्रज्ञान.pdf',
    slug: 'mahiti-tantradyan',
    title: 'माहिती तंत्रज्ञान',
    topicCodes: ['information-technology-computer'],
  },
  {
    driveFileId: '1qCCiA3N5SNjIGnhG3pTeVfbaHafj_wEw',
    originalFileName: 'मध्ययुगीन इतिहास.pdf',
    slug: 'madhyayugin-itihas',
    title: 'मध्ययुगीन इतिहास',
    topicCodes: ['history', 'medieval-history'],
  },
  {
    driveFileId: '1KtjruguaMZVeGCB4bWYex4IxYmpMootI',
    originalFileName: 'कृषी, धान्य, फळे, भाजीपाला व तत्सम.pdf',
    slug: 'krushi-dhanya-phale-bhajipala-tatsam',
    title: 'कृषी, धान्य, फळे, भाजीपाला व तत्सम',
    topicCodes: ['agriculture', 'climate-fruits-vegetables-allied'],
  },
  {
    driveFileId: '1EgROub8zAJ83i-KyYH5ZPT9rWMN-qhn1',
    originalFileName: 'कृषी अर्थशास्त्र व इतर मुद्दे.pdf',
    slug: 'krushi-arthashastra-itar-mudde',
    title: 'कृषी अर्थशास्त्र व इतर मुद्दे',
    topicCodes: [
      'agriculture',
      'agricultural-economics-schemes-green-revolution-other-issues',
    ],
  },
  {
    driveFileId: '1sV09KFaFQWeND7Ost1qmBkzm76RVvG8_',
    originalFileName: 'जीवशास्त्र.pdf',
    slug: 'jivshastra',
    title: 'जीवशास्त्र',
    topicCodes: ['biology'],
  },
  {
    driveFileId: '1covs1n93Hc1Gu3JijN9P2TYlEbEhSq4w',
    originalFileName: 'बँकिंग.pdf',
    slug: 'banking',
    title: 'बँकिंग',
    topicCodes: ['banking'],
  },
  {
    driveFileId: '1MWZSzbzXtSzk1YLbHUo0zJSoTA_HhSOY',
    originalFileName: 'आंतरराष्ट्रीय संघटना.pdf',
    slug: 'antarrashtriya-sanghatana',
    title: 'आंतरराष्ट्रीय संघटना',
    topicCodes: ['international-organizations'],
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
    const topicByCode = await resolveTopics(prisma, context.subject.id);
    const plan = await buildImportPlan(topicByCode);

    printPlan(options, context, plan);
    if (options.dryRun) {
      console.log('Dry run complete. No notes or files were changed.');
      return;
    }

    await storage.client.bucketExists(storage.bucket);
    const existingAssetObjectKeys = options.removeExisting
      ? await removeExistingNotes(prisma, storage, context.site.id)
      : [];
    console.log(
      `Removed existing notes. Deleted ${existingAssetObjectKeys.length} old file asset object(s).`,
    );

    const imported: ImportedNoteResult[] = [];
    for (const [index, item] of plan.entries()) {
      const result = await importOneNote({
        prisma,
        storage,
        context,
        item,
        orderIndex: (index + 1) * 10,
        publish: options.publish,
      });
      imported.push(result);
      console.log(
        `IMPORTED ${result.slug} (${result.pageCount} pages, ${(result.sizeBytes / 1024 / 1024).toFixed(2)} MB)`,
      );
    }

    console.log(
      `Import complete. Created ${imported.length} notes and ${imported.length} NOTE_PDF assets.`,
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

  return {
    adminEmail: values.get('--admin-email')?.trim().toLowerCase(),
    dryRun: flags.has('--dry-run'),
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

  const subject = await prisma.subject.findFirst({
    where: {
      siteId: site.id,
      examTrackId: track.id,
      code: SUBJECT_CODE,
    },
    select: { id: true, code: true, name: true },
  });
  if (!subject) {
    throw new Error(`Subject "${SUBJECT_CODE}" was not found.`);
  }

  return { actor, medium, site, subject, track };
}

async function resolveTopics(prisma: PrismaClient, subjectId: string) {
  const topics = await prisma.topic.findMany({
    where: { subjectId, isActive: true },
    select: { id: true, code: true, name: true },
  });

  return new Map(topics.map((topic) => [topic.code, topic]));
}

async function buildImportPlan(
  topicByCode: Awaited<ReturnType<typeof resolveTopics>>,
) : Promise<PlannedNoteImportItem[]> {
  const slugs = new Set<string>();
  const plan: PlannedNoteImportItem[] = [];

  for (const item of DRIVE_NOTES) {
    if (slugs.has(item.slug)) {
      throw new Error(`Duplicate note slug in manifest: ${item.slug}`);
    }
    slugs.add(item.slug);

    const topicIds = item.topicCodes.map((topicCode) => {
      const topic = topicByCode.get(topicCode);
      if (!topic) {
        throw new Error(
          `Topic "${topicCode}" for "${item.originalFileName}" was not found.`,
        );
      }
      return topic.id;
    });

    plan.push({ ...item, topicIds });
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
        removeExisting: options.removeExisting,
        publish: options.publish,
        actor: context.actor.email,
        site: context.site.code,
        track: context.track.code,
        subject: context.subject.code,
        medium: context.medium.code,
        noteCount: plan.length,
        notes: plan.map((item) => ({
          slug: item.slug,
          title: item.title,
          topics: item.topicCodes,
        })),
      },
      null,
      2,
    ),
  );
}

async function removeExistingNotes(
  prisma: PrismaClient,
  storage: ReturnType<typeof createStorageClient>,
  siteId: string,
) {
  const existingNotes = await prisma.note.findMany({
    where: { siteId },
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
        [
          note.fullFileAssetId,
          note.previewFileAssetId,
          note.coverImageAssetId,
        ].filter((value): value is string => Boolean(value)),
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
  storage: ReturnType<typeof createStorageClient>;
  context: Awaited<ReturnType<typeof resolveContext>>;
  item: PlannedNoteImportItem;
  orderIndex: number;
  publish: boolean;
}): Promise<ImportedNoteResult> {
  const { prisma, storage, context, item, orderIndex, publish } = input;
  const localPath = await downloadDrivePdf(item);
  const body = await readFile(localPath);
  const checksumSha256 = createHash('sha256').update(body).digest('hex');
  const pageCount = readPdfPageCount(localPath);
  const objectKey = buildObjectKey(context.site.code, 'pdf');

  await storage.client.putObject(storage.bucket, objectKey, body, body.length, {
    'Content-Type': 'application/pdf',
  });
  const stat = await storage.client.statObject(storage.bucket, objectKey);

  const noteId = await prisma.$transaction(async (tx) => {
    const fileAsset = await tx.fileAsset.create({
      data: {
        siteId: context.site.id,
        createdByUserId: context.actor.id,
        confirmedByUserId: context.actor.id,
        purpose: FileAssetPurpose.NOTE_PDF,
        accessLevel: FileAssetAccess.PROTECTED,
        status: FileAssetStatus.READY,
        objectKey,
        originalFileName: item.originalFileName,
        extension: 'pdf',
        contentType: 'application/pdf',
        declaredSizeBytes: body.length,
        sizeBytes: stat.size ?? body.length,
        checksumSha256,
        etag: stat.etag ?? null,
        confirmedAt: new Date(),
      },
      select: { id: true },
    });

    const note = await tx.note.create({
      data: {
        siteId: context.site.id,
        subjectId: context.subject.id,
        mediumId: context.medium.id,
        slug: item.slug,
        title: item.title,
        shortDescription: null,
        description: null,
        fullFileAssetId: fileAsset.id,
        previewFileAssetId: null,
        coverImageAssetId: null,
        accessType: NoteAccessType.FREE,
        previewPageCount: null,
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

    await tx.noteTopic.createMany({
      data: item.topicIds.map((topicId) => ({
        noteId: note.id,
        topicId,
      })),
      skipDuplicates: true,
    });

    await tx.fileAssetReference.create({
      data: {
        siteId: context.site.id,
        fileAssetId: fileAsset.id,
        resourceType: 'note',
        resourceId: note.id,
        slot: 'full_pdf',
        accessLevel: FileAssetAccess.PROTECTED,
      },
    });

    return note.id;
  });

  return {
    noteId,
    slug: item.slug,
    pageCount,
    sizeBytes: stat.size ?? body.length,
  };
}

async function downloadDrivePdf(item: DriveNoteManifestItem) {
  const directory = join(tmpdir(), 'toppers-choice-drive-notes');
  await mkdir(directory, { recursive: true });
  const safeName = basename(`${item.slug}.pdf`);
  const localPath = join(directory, safeName);
  const response = await fetch(
    `https://drive.google.com/uc?export=download&id=${item.driveFileId}`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to download "${item.originalFileName}": ${response.status} ${response.statusText}`,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.subarray(0, 4).equals(Buffer.from('%PDF'))) {
    throw new Error(
      `Downloaded "${item.originalFileName}" was not a PDF. Content-Type: ${contentType}`,
    );
  }

  await writeFile(localPath, buffer);
  return localPath;
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error) => {
  console.error(getErrorMessage(error));
  process.exitCode = 1;
});
