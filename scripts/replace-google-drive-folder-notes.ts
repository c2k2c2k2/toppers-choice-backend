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
  orderIndex?: number;
  clearExistingIndex?: boolean;
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
  coverImageAssetId: string | null;
};

type PlannedOperation = ManifestItem & {
  subject: SubjectContext;
  topics: TopicRecord[];
  existingNote: NoteRecord | null;
};

type StorageClient = ReturnType<typeof createStorageClient>;

const TRACK_CODE = 'mpsc-marathi-allied';
const MEDIUM_CODE = 'mr';
const PREVIEW_PAGE_COUNT_DEFAULT = 3;
const NOTE_ACCESS_TYPE = NoteAccessType.PREVIEWABLE_PREMIUM;
const ARCHIVE_SLUGS = ['masemari-vishayak'] as const;

const REPLACEMENT_NOTES: ManifestItem[] = [
  {
    driveFileId: '1Kyx6k7u3MBWFB_sDFfAw48DrHSN-H2do',
    originalFileName: 'Krushi ArthShastra & Itar Mudde.pdf',
    noteSlug: 'krushi-arthashastra-itar-mudde',
    title: 'कृषी अर्थशास्त्र व इतर मुद्दे',
    subjectCode: 'general-knowledge',
    topicCodes: [
      'agriculture',
      'agricultural-economics-schemes-green-revolution-other-issues',
    ],
    clearExistingIndex: true,
  },
  {
    driveFileId: '1-jpgnj-Rbs1O-dKVRIg8FJxz0tkc3k-N',
    originalFileName: 'Pashu Sanwardhan & Dugdh Vyavasay.pdf',
    noteSlug: 'pashusanvardhan-dugdha-vyavsay',
    title: 'पशुसंवर्धन व दुग्ध व्यवसाय',
    subjectCode: 'general-knowledge',
    topicCodes: ['agriculture', 'animal-husbandry-dairy'],
    clearExistingIndex: true,
  },
  {
    driveFileId: '1bbr_NdU-Hg9BixjpIul7Np_OvpVsMnTH',
    originalFileName: 'Sangnak & Mahiti Tantradnyan.pdf',
    noteSlug: 'mahiti-tantradyan',
    title: 'माहिती तंत्रज्ञान',
    subjectCode: 'general-knowledge',
    topicCodes: ['information-technology-computer'],
    clearExistingIndex: true,
  },
  {
    driveFileId: '1DRC-S2Zk7J2tbIYPHkEe2bewcD68B5qs',
    originalFileName: 'BhoutikShastra.pdf',
    noteSlug: 'padartha-vigyan-bhautikshastra',
    title: 'पदार्थ विज्ञान (भौतिकशास्त्र)',
    subjectCode: 'general-knowledge',
    topicCodes: ['physics'],
    clearExistingIndex: true,
  },
  {
    driveFileId: '1IpYr6XChfI2CmGt9QUZPakCSa_D2VF2u',
    originalFileName: 'Madhya Yugin Itihaas.pdf',
    noteSlug: 'madhyayugin-itihas',
    title: 'मध्ययुगीन इतिहास',
    subjectCode: 'general-knowledge',
    topicCodes: ['history', 'medieval-history'],
    clearExistingIndex: true,
  },
  {
    driveFileId: '1JSQuNA7uIiDk7evsxV0b0OfqaqEqr5B7',
    originalFileName: 'Panchyatraj.pdf',
    noteSlug: 'panchayatraj',
    title: 'पंचायतराज',
    subjectCode: 'general-knowledge',
    topicCodes: ['panchayat-raj'],
    clearExistingIndex: true,
  },
  {
    driveFileId: '1CxB9m13lIaq4tMKzpLRtxsMAMEzxdkPV',
    originalFileName: 'Vane & Vanya Prani.pdf',
    noteSlug: 'vane-vanya-prani',
    title: 'वने व वन्य प्राणी',
    subjectCode: 'general-knowledge',
    topicCodes: ['agriculture', 'forest-wildlife'],
    clearExistingIndex: true,
  },
  {
    driveFileId: '1zup39vCUDRW035KyXhE7UTvuz1BrGvA-',
    originalFileName: 'Vanijya & Arth Shastra.pdf',
    noteSlug: 'vanijya-ani-arthavyavastha',
    title: 'वाणिज्य व अर्थव्यवस्था',
    subjectCode: 'general-knowledge',
    topicCodes: ['commerce-economy'],
    clearExistingIndex: true,
  },
  {
    driveFileId: '1Abdpo045r5Vq8qEpuUk6IP7NKyKg5JQe',
    originalFileName: 'Vividh Desh.pdf',
    noteSlug: 'vividh-desh',
    title: 'विविध देश',
    subjectCode: 'general-knowledge',
    topicCodes: ['geography', 'various-countries'],
    clearExistingIndex: true,
  },
  {
    driveFileId: '1wDZGZyzuBBeullAW_ATqDeTvzu6Y_zOw',
    originalFileName: 'Banking.pdf',
    noteSlug: 'banking',
    title: 'बँकिंग',
    subjectCode: 'general-knowledge',
    topicCodes: ['banking'],
    clearExistingIndex: true,
  },
  {
    driveFileId: '1niAIy7Vg6EQxpf8zfXhz3U9WBVXZswph',
    originalFileName: 'Bhugol.pdf',
    noteSlug: 'bhugol',
    title: 'भूगोल',
    subjectCode: 'general-knowledge',
    topicCodes: ['geography'],
    clearExistingIndex: true,
  },
  {
    driveFileId: '1MKXw9ws0RPBABX0LqS_UuBLJe9QSiA2n',
    originalFileName: 'One Words_2.pdf',
    noteSlug: 'vocabulary',
    title: 'Vocabulary',
    subjectCode: 'english',
    topicCodes: ['english-vocabulary'],
    orderIndex: 10,
  },
  {
    driveFileId: '13D0N3kgaF3scZlOsvhH25hutae3eI-_t',
    originalFileName: 'Jivshastra (Vanspati & Prani).pdf',
    noteSlug: 'jivshastra',
    title: 'जीवशास्त्र',
    subjectCode: 'general-knowledge',
    topicCodes: ['biology'],
    clearExistingIndex: true,
  },
  {
    driveFileId: '12DiwR3V6M0p2Yd96Z4N6vG1tJr5JRF72',
    originalFileName: 'Notes - Sinchan & Masemari.pdf',
    noteSlug: 'sinchan-jamin-khate-biyane',
    title: 'सिंचन, जमीन, खते, बियाणे व मासेमारी',
    subjectCode: 'general-knowledge',
    topicCodes: [
      'agriculture',
      'irrigation-soil-fertilizers-seeds',
      'fisheries',
    ],
    clearExistingIndex: true,
  },
  {
    driveFileId: '1sedeiBiZk4X16YeZW1rhfZExC6hMmpS1',
    originalFileName: 'Notes - Krushi, Dhanya, Fale, Bhajipala tatsam.pdf',
    noteSlug: 'krushi-dhanya-phale-bhajipala-tatsam',
    title: 'कृषी, धान्य, फळे, भाजीपाला व तत्सम',
    subjectCode: 'general-knowledge',
    topicCodes: ['agriculture', 'climate-fruits-vegetables-allied'],
    clearExistingIndex: true,
  },
  {
    driveFileId: '1eI6DFYLZ5WRABgpOGA-vJHq7zw4hTYlB',
    originalFileName: 'Notes - Prachin Itihaas.pdf',
    noteSlug: 'prachin-itihas',
    title: 'प्राचीन इतिहास',
    subjectCode: 'general-knowledge',
    topicCodes: ['history', 'ancient-history'],
    clearExistingIndex: true,
  },
  {
    driveFileId: '126IRHw2vtezRJr_S-QqRgCtyGFHfbyOp',
    originalFileName: 'Notes - Rasayanshastra.pdf',
    noteSlug: 'rasayanshastra',
    title: 'रसायनशास्त्र',
    subjectCode: 'general-knowledge',
    topicCodes: ['chemistry'],
    clearExistingIndex: true,
  },
  {
    driveFileId: '1nGkliFWMQgfOfFonmolHxun-2D3GuMrf',
    originalFileName: 'Notes - Manavi Jivshastra.pdf',
    noteSlug: 'manavi-jivshastra',
    title: 'मानवी जीवशास्त्र',
    subjectCode: 'general-knowledge',
    topicCodes: ['human-biology'],
    clearExistingIndex: true,
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

    const bucketExists = await storage.client.bucketExists(storage.bucket);
    if (!bucketExists) {
      throw new Error(`Object storage bucket "${storage.bucket}" does not exist.`);
    }

    const orphanCandidateAssetIds = new Set<string>();
    for (const [index, item] of plan.entries()) {
      const result = await upsertNote({
        prisma,
        storage,
        context,
        item,
        previewPages: options.previewPages,
        fallbackOrderIndex: (index + 1) * 10,
      });

      for (const assetId of result.removedAssetIds) {
        orphanCandidateAssetIds.add(assetId);
      }

      console.log(
        `${result.mode.toUpperCase()} ${result.note.slug} (${result.pageCount} pages, ${(result.sizeBytes / 1024 / 1024).toFixed(2)} MB)`,
      );
    }

    for (const slug of ARCHIVE_SLUGS) {
      const archived = await archiveNote(prisma, context.site.id, context.actor.id, slug);
      if (archived) {
        console.log(`ARCHIVED ${slug}`);
      }
    }

    const normalizedAssetCount = await normalizeAllNoteAssetNames(
      prisma,
      context.site.id,
    );
    console.log(`Normalized ${normalizedAssetCount} note asset filename(s) to ASCII-safe values.`);

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

  const previewPages = Number(values.get('--preview-pages') ?? PREVIEW_PAGE_COUNT_DEFAULT);
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

async function buildPlan(
  prisma: PrismaClient,
  siteId: string,
): Promise<PlannedOperation[]> {
  const subjects = await prisma.subject.findMany({
    where: {
      siteId,
      examTrack: { code: TRACK_CODE },
      code: { in: Array.from(new Set(REPLACEMENT_NOTES.map((item) => item.subjectCode))) },
    },
    select: { id: true, code: true, name: true },
  });
  const subjectByCode = new Map(subjects.map((subject) => [subject.code, subject]));

  const subjectIds = subjects.map((subject) => subject.id);
  const topics = await prisma.topic.findMany({
    where: { siteId, subjectId: { in: subjectIds }, isActive: true },
    select: { id: true, code: true, name: true, subjectId: true },
  });
  const topicsBySubjectCode = new Map<string, Map<string, TopicRecord>>();
  for (const subject of subjects) {
    topicsBySubjectCode.set(subject.code, new Map());
  }
  for (const topic of topics) {
    const subject = subjects.find((item) => item.id === topic.subjectId);
    if (!subject) {
      continue;
    }
    topicsBySubjectCode.get(subject.code)?.set(topic.code, {
      id: topic.id,
      code: topic.code,
      name: topic.name,
    });
  }

  const existingNotes = await prisma.note.findMany({
    where: {
      siteId,
      slug: {
        in: Array.from(new Set([...REPLACEMENT_NOTES.map((item) => item.noteSlug), ...ARCHIVE_SLUGS])),
      },
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
      coverImageAssetId: true,
    },
  });
  const existingNoteBySlug = new Map(existingNotes.map((note) => [note.slug, note]));

  const plan: PlannedOperation[] = [];
  for (const item of REPLACEMENT_NOTES) {
    const subject = subjectByCode.get(item.subjectCode);
    if (!subject) {
      throw new Error(`Subject "${item.subjectCode}" was not found.`);
    }

    const topicMap = topicsBySubjectCode.get(item.subjectCode);
    if (!topicMap) {
      throw new Error(`No topic map could be resolved for subject "${item.subjectCode}".`);
    }

    const topics = item.topicCodes.map((topicCode) => {
      const topic = topicMap.get(topicCode);
      if (!topic) {
        throw new Error(
          `Topic "${topicCode}" for "${item.originalFileName}" was not found under subject "${item.subjectCode}".`,
        );
      }
      return topic;
    });

    plan.push({
      ...item,
      existingNote: existingNoteBySlug.get(item.noteSlug) ?? null,
      subject,
      topics,
    });
  }

  return plan;
}

function printPlan(
  options: ImportOptions,
  context: Awaited<ReturnType<typeof resolveContext>>,
  plan: PlannedOperation[],
) {
  const summary = {
    dryRun: options.dryRun,
    previewPages: options.previewPages,
    site: context.site.code,
    track: context.track.code,
    medium: context.medium.code,
    actor: context.actor.email,
    archiveSlugs: ARCHIVE_SLUGS,
    noteCount: plan.length,
    createCount: plan.filter((item) => !item.existingNote).length,
    updateCount: plan.filter((item) => Boolean(item.existingNote)).length,
    notes: plan.map((item) => ({
      mode: item.existingNote ? 'update' : 'create',
      slug: item.noteSlug,
      title: item.title,
      subject: item.subject.code,
      topics: item.topicCodes,
      source: item.originalFileName,
    })),
    skippedFiles: [
      {
        fileName: 'One Words_2 Sets.pdf',
        reason: 'Duplicate of One Words_2.pdf without the standalone index page.',
      },
      {
        fileName: 'Anukramnika - Vocabulary.pdf',
        reason: 'Standalone index page already contained inside One Words_2.pdf.',
      },
    ],
  };

  console.log(JSON.stringify(summary, null, 2));
}

async function upsertNote(input: {
  prisma: PrismaClient;
  storage: StorageClient;
  context: Awaited<ReturnType<typeof resolveContext>>;
  item: PlannedOperation;
  previewPages: number;
  fallbackOrderIndex: number;
}) {
  const { prisma, storage, context, item, previewPages, fallbackOrderIndex } = input;
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
      ? [item.existingNote.fullFileAssetId, item.existingNote.previewFileAssetId].filter(
          (value): value is string => Boolean(value),
        )
      : [];

    const note = await prisma.$transaction(async (tx) => {
      const fullFileAsset = await tx.fileAsset.create({
        data: buildFileAssetCreateInput(context.site.id, context.actor.id, fullAsset, fullPdf),
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

      if (item.existingNote) {
        await tx.fileAssetReference.deleteMany({
          where: {
            siteId: context.site.id,
            resourceType: 'note',
            resourceId: item.existingNote.id,
            slot: { in: ['full_pdf', 'preview_pdf'] },
          },
        });
        await tx.noteTopic.deleteMany({ where: { noteId: item.existingNote.id } });
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
          select: { id: true, slug: true },
        });

        await tx.noteTopic.createMany({
          data: item.topics.map((topic) => ({
            noteId: updated.id,
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
              resourceId: updated.id,
              slot: 'full_pdf',
              accessLevel: FileAssetAccess.PROTECTED,
            },
            {
              siteId: context.site.id,
              fileAssetId: previewFileAsset.id,
              resourceType: 'note',
              resourceId: updated.id,
              slot: 'preview_pdf',
              accessLevel: FileAssetAccess.PROTECTED,
            },
          ],
        });

        return { id: updated.id, slug: updated.slug, mode: 'update' as const };
      }

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
          orderIndex: item.orderIndex ?? fallbackOrderIndex,
          status: NoteStatus.PUBLISHED,
          createdByUserId: context.actor.id,
          updatedByUserId: context.actor.id,
          publishedByUserId: context.actor.id,
          publishedAt: new Date(),
        },
        select: { id: true, slug: true },
      });

      await tx.noteTopic.createMany({
        data: item.topics.map((topic) => ({
          noteId: created.id,
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
            resourceId: created.id,
            slot: 'full_pdf',
            accessLevel: FileAssetAccess.PROTECTED,
          },
          {
            siteId: context.site.id,
            fileAssetId: previewFileAsset.id,
            resourceType: 'note',
            resourceId: created.id,
            slot: 'preview_pdf',
            accessLevel: FileAssetAccess.PROTECTED,
          },
        ],
      });

      return { id: created.id, slug: created.slug, mode: 'create' as const };
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
  const localPath = join(directory, basename(`${item.noteSlug}-${randomUUID()}.pdf`));
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

  await writeFile(localPath, buffer);
  return { localPath, previewPath };
}

async function createPreviewPdf(localPath: string, slug: string, previewPages: number) {
  const directory = join(tmpdir(), 'toppers-choice-drive-replacements');
  await mkdir(directory, { recursive: true });
  const previewPath = join(directory, basename(`${slug}-${randomUUID()}-preview.pdf`));
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

async function archiveNote(
  prisma: PrismaClient,
  siteId: string,
  actorId: string,
  slug: string,
) {
  const existing = await prisma.note.findFirst({
    where: { siteId, slug },
    select: { id: true, status: true },
  });
  if (!existing || existing.status === NoteStatus.ARCHIVED) {
    return false;
  }

  await prisma.note.update({
    where: { id: existing.id },
    data: {
      status: NoteStatus.ARCHIVED,
      archivedAt: new Date(),
      updatedByUserId: actorId,
    },
  });
  return true;
}

async function normalizeAllNoteAssetNames(prisma: PrismaClient, siteId: string) {
  const notes = await prisma.note.findMany({
    where: { siteId },
    select: {
      slug: true,
      fullFileAssetId: true,
      previewFileAssetId: true,
    },
  });

  let updatedCount = 0;
  for (const note of notes) {
    await prisma.fileAsset.update({
      where: { id: note.fullFileAssetId },
      data: { originalFileName: `${note.slug}.pdf` },
    });
    updatedCount += 1;

    if (note.previewFileAssetId) {
      await prisma.fileAsset.update({
        where: { id: note.previewFileAssetId },
        data: { originalFileName: `preview-${note.slug}.pdf` },
      });
      updatedCount += 1;
    }
  }

  return updatedCount;
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
    if (getErrorMessage(error).includes('ENOENT')) {
      return;
    }
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error) => {
  console.error(getErrorMessage(error));
  process.exitCode = 1;
});
