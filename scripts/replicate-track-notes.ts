import {
  NoteStatus,
  PrismaClient,
  TestStatus,
} from '@prisma/client';
import { loadEnvironmentFile } from '../src/common/test/load-env-file';

type CloneSpec = {
  label: string;
  sourceTrackCode: string;
  sourceSubjectCode: string;
  targetTrackCode: string;
  targetSubjectCode: string;
};

type CloneSummary = {
  label: string;
  sourceNotes: number;
  created: number;
  reused: number;
  linkedTopics: number;
  copiedIndexEntries: number;
};

const CLONE_SPECS: CloneSpec[] = [
  {
    label: 'GK from MPSC English Medium to Banking',
    sourceTrackCode: 'mpsc-english-medium',
    sourceSubjectCode: 'general-knowledge',
    targetTrackCode: 'bank-staff-railway-allied',
    targetSubjectCode: 'general-knowledge',
  },
  {
    label: 'Mathematics from Banking to MPSC English Medium',
    sourceTrackCode: 'bank-staff-railway-allied',
    sourceSubjectCode: 'mathematics',
    targetTrackCode: 'mpsc-english-medium',
    targetSubjectCode: 'maths',
  },
  {
    label: 'Test of Reasoning notes from Banking to MPSC English Medium',
    sourceTrackCode: 'bank-staff-railway-allied',
    sourceSubjectCode: 'test-of-reasoning',
    targetTrackCode: 'mpsc-english-medium',
    targetSubjectCode: 'test-of-reasoning',
  },
];

async function main() {
  loadEnvironmentFile();
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  await prisma.$connect();
  try {
    const site = await prisma.site.findUnique({
      where: { code: options.siteCode },
      select: { id: true, code: true },
    });
    if (!site) {
      throw new Error(`Site "${options.siteCode}" was not found.`);
    }

    const summaries: CloneSummary[] = [];
    for (const spec of CLONE_SPECS) {
      summaries.push(await clonePublishedNotes(prisma, site.id, spec));
    }

    const reasoningTests = await prisma.test.findMany({
      where: {
        siteId: site.id,
        status: TestStatus.PUBLISHED,
        subject: {
          code: 'test-of-reasoning',
          examTrack: {
            code: {
              in: ['mpsc-english-medium', 'bank-staff-railway-allied'],
            },
          },
        },
      },
      orderBy: [{ examTrack: { code: 'asc' } }, { title: 'asc' }],
      select: {
        id: true,
        title: true,
        subject: {
          select: {
            code: true,
            examTrack: {
              select: {
                code: true,
              },
            },
          },
        },
      },
    });

    console.log(
      JSON.stringify(
        {
          site: site.code,
          noteReplication: summaries,
          reasoningTestCheck: {
            publishedCount: reasoningTests.length,
            items: reasoningTests.map((test) => ({
              id: test.id,
              title: test.title,
              trackCode: test.subject?.examTrack.code ?? null,
            })),
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function clonePublishedNotes(
  prisma: PrismaClient,
  siteId: string,
  spec: CloneSpec,
) {
  const [sourceSubject, targetSubject] = await Promise.all([
    findSubject(prisma, siteId, spec.sourceTrackCode, spec.sourceSubjectCode),
    findSubject(prisma, siteId, spec.targetTrackCode, spec.targetSubjectCode),
  ]);

  const sourceNotes = await prisma.note.findMany({
    where: {
      siteId,
      status: NoteStatus.PUBLISHED,
      subjectId: sourceSubject.id,
    },
    orderBy: [{ orderIndex: 'asc' }, { title: 'asc' }],
    include: {
      noteTopics: {
        include: {
          topic: {
            select: {
              code: true,
            },
          },
        },
      },
      indexEntries: {
        orderBy: [{ orderIndex: 'asc' }, { pageNumber: 'asc' }],
      },
    },
  });
  const targetTopics = await prisma.topic.findMany({
    where: {
      siteId,
      subjectId: targetSubject.id,
      isActive: true,
    },
    select: {
      id: true,
      code: true,
    },
  });
  const targetTopicIdByCode = new Map(
    targetTopics.map((topic) => [topic.code, topic.id]),
  );

  let created = 0;
  let reused = 0;
  let linkedTopics = 0;
  let copiedIndexEntries = 0;

  for (const sourceNote of sourceNotes) {
    const existing = await prisma.note.findFirst({
      where: {
        siteId,
        subjectId: targetSubject.id,
        fullFileAssetId: sourceNote.fullFileAssetId,
        title: sourceNote.title,
        mediumId: sourceNote.mediumId,
      },
      select: {
        id: true,
        slug: true,
      },
    });

    const targetNote =
      existing ??
      (await prisma.note.create({
        data: {
          siteId,
          subjectId: targetSubject.id,
          mediumId: sourceNote.mediumId,
          slug: await buildUniqueSlug(
            prisma,
            siteId,
            `${sourceNote.slug}-${targetSubject.slug}`,
          ),
          title: sourceNote.title,
          shortDescription: sourceNote.shortDescription,
          description: sourceNote.description,
          fullFileAssetId: sourceNote.fullFileAssetId,
          previewFileAssetId: sourceNote.previewFileAssetId,
          coverImageAssetId: sourceNote.coverImageAssetId,
          accessType: sourceNote.accessType,
          previewPageCount: sourceNote.previewPageCount,
          pageCount: sourceNote.pageCount,
          orderIndex: sourceNote.orderIndex,
          status: sourceNote.status,
          createdByUserId: sourceNote.createdByUserId,
          updatedByUserId: sourceNote.updatedByUserId,
          publishedByUserId: sourceNote.publishedByUserId,
          publishedAt: sourceNote.publishedAt,
          archivedAt: sourceNote.archivedAt,
        },
        select: {
          id: true,
          slug: true,
        },
      }));

    if (existing) {
      reused += 1;
    } else {
      created += 1;
    }

    const topicLinks = sourceNote.noteTopics
      .map(({ topic }) => targetTopicIdByCode.get(topic.code) ?? null)
      .filter((topicId): topicId is string => Boolean(topicId))
      .map((topicId) => ({
        noteId: targetNote.id,
        topicId,
      }));

    if (topicLinks.length > 0) {
      const result = await prisma.noteTopic.createMany({
        data: topicLinks,
        skipDuplicates: true,
      });
      linkedTopics += result.count;
    }

    const indexEntryCount = await prisma.noteIndexEntry.count({
      where: {
        noteId: targetNote.id,
      },
    });
    if (indexEntryCount === 0 && sourceNote.indexEntries.length > 0) {
      const result = await prisma.noteIndexEntry.createMany({
        data: sourceNote.indexEntries.map((entry) => ({
          siteId,
          noteId: targetNote.id,
          serialLabel: entry.serialLabel,
          title: entry.title,
          titleFontHint: entry.titleFontHint,
          pageNumber: entry.pageNumber,
          indentLevel: entry.indentLevel,
          orderIndex: entry.orderIndex,
          createdByUserId: entry.createdByUserId,
          updatedByUserId: entry.updatedByUserId,
        })),
      });
      copiedIndexEntries += result.count;
    }
  }

  return {
    label: spec.label,
    sourceNotes: sourceNotes.length,
    created,
    reused,
    linkedTopics,
    copiedIndexEntries,
  };
}

async function findSubject(
  prisma: PrismaClient,
  siteId: string,
  trackCode: string,
  subjectCode: string,
) {
  const subject = await prisma.subject.findFirst({
    where: {
      siteId,
      code: subjectCode,
      examTrack: {
        code: trackCode,
      },
    },
    select: {
      id: true,
      code: true,
      slug: true,
    },
  });

  if (!subject) {
    throw new Error(`Subject ${trackCode}/${subjectCode} was not found.`);
  }

  return subject;
}

async function buildUniqueSlug(
  prisma: PrismaClient,
  siteId: string,
  requestedSlug: string,
) {
  const baseSlug = slugify(requestedSlug);
  let nextSlug = baseSlug;
  let suffix = 2;

  while (
    await prisma.note.findUnique({
      where: {
        siteId_slug: {
          siteId,
          slug: nextSlug,
        },
      },
      select: {
        id: true,
      },
    })
  ) {
    nextSlug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return nextSlug;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseArgs(argv: string[]) {
  const values = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--') {
      continue;
    }

    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument "${token}".`);
    }

    const [flag, inlineValue] = token.split('=', 2);
    const next = inlineValue ?? argv[index + 1];
    if (!next || (!inlineValue && next.startsWith('--'))) {
      throw new Error(`Missing value for ${flag}.`);
    }

    values.set(flag, next);
    if (!inlineValue) {
      index += 1;
    }
  }

  return {
    siteCode: values.get('--site-code')?.trim() || 'toppers-choice',
  };
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
