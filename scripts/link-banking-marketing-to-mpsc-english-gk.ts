import {
  CatalogVisibility,
  FileAssetAccess,
  NoteStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { loadEnvironmentFile } from '../src/common/test/load-env-file';

type LinkSpec = {
  sourceSlug: string;
  targetSlug: string;
  topicCode: string;
  topicName: string;
  topicOrderIndex: number;
};

type ResolvedTopic = {
  id: string;
  code: string;
  name: string;
  createdInThisRun: boolean;
};

type SourceNote = Awaited<ReturnType<typeof findSourceNote>>;

type PlanItem = {
  existingTarget: {
    id: string;
    slug: string;
  } | null;
  sourceNote: NonNullable<SourceNote>;
  spec: LinkSpec;
  topic: ResolvedTopic | null;
};

type LinkSummary = {
  sourceSlug: string;
  targetSlug: string;
  topicLinked: number;
  copiedIndexEntries: number;
  mode: 'created' | 'updated';
};

const SITE_CODE = 'toppers-choice';
const SOURCE_TRACK_CODE = 'bank-staff-railway-allied';
const TARGET_TRACK_CODE = 'mpsc-english-medium';
const TARGET_SUBJECT_CODE = 'general-knowledge';
const MEDIUM_CODE = 'en';

const LINK_SPECS: LinkSpec[] = [
  {
    sourceSlug: 'bsr-banking',
    targetSlug: 'mpsc-english-general-knowledge-banking',
    topicCode: 'banking',
    topicName: 'Banking',
    topicOrderIndex: 30,
  },
  {
    sourceSlug: 'bsr-marketing-management',
    targetSlug: 'mpsc-english-general-knowledge-marketing-management',
    topicCode: 'marketing',
    topicName: 'Marketing',
    topicOrderIndex: 35,
  },
];

async function main() {
  loadEnvironmentFile();
  const options = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  await prisma.$connect();
  try {
    const site = await prisma.site.findUnique({
      where: { code: SITE_CODE },
      select: { id: true, code: true },
    });
    if (!site) {
      throw new Error(`Site "${SITE_CODE}" was not found.`);
    }

    const [targetSubject, medium] = await Promise.all([
      prisma.subject.findFirst({
        where: {
          siteId: site.id,
          code: TARGET_SUBJECT_CODE,
          examTrack: { code: TARGET_TRACK_CODE },
        },
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
          visibility: true,
          examTrack: {
            select: {
              code: true,
              defaultMedium: { select: { code: true } },
            },
          },
        },
      }),
      prisma.medium.findFirst({
        where: { siteId: site.id, code: MEDIUM_CODE, isActive: true },
        select: { id: true, code: true },
      }),
    ]);

    if (!targetSubject) {
      throw new Error(
        `Target subject "${TARGET_TRACK_CODE}/${TARGET_SUBJECT_CODE}" was not found.`,
      );
    }
    if (
      !targetSubject.isActive ||
      targetSubject.visibility !== CatalogVisibility.PUBLIC
    ) {
      throw new Error(
        `Target subject "${TARGET_TRACK_CODE}/${TARGET_SUBJECT_CODE}" is not active and public.`,
      );
    }
    if (targetSubject.examTrack.defaultMedium?.code !== MEDIUM_CODE) {
      throw new Error(
        `Target track "${TARGET_TRACK_CODE}" does not use "${MEDIUM_CODE}" as its default medium.`,
      );
    }
    if (!medium) {
      throw new Error(`Medium "${MEDIUM_CODE}" was not found.`);
    }

    const plan: PlanItem[] = [];
    for (const spec of LINK_SPECS) {
      const [sourceNote, topic] = await Promise.all([
        findSourceNote(prisma, {
          mediumId: medium.id,
          siteId: site.id,
          slug: spec.sourceSlug,
        }),
        resolveTopic(prisma, {
          dryRun: options.dryRun,
          siteId: site.id,
          subjectId: targetSubject.id,
          spec,
        }),
      ]);

      if (!sourceNote) {
        throw new Error(`Source note "${spec.sourceSlug}" was not found.`);
      }

      const existingTarget = await prisma.note.findFirst({
        where: {
          siteId: site.id,
          subjectId: targetSubject.id,
          mediumId: medium.id,
          OR: [
            { slug: spec.targetSlug },
            {
              title: sourceNote.title,
              fullFileAssetId: sourceNote.fullFileAssetId,
            },
          ],
        },
        select: { id: true, slug: true },
      });

      plan.push({
        existingTarget,
        sourceNote,
        spec,
        topic,
      });
    }

    console.log(
      JSON.stringify(
        {
          dryRun: options.dryRun,
          site: site.code,
          targetTrack: TARGET_TRACK_CODE,
          targetSubject: targetSubject.code,
          medium: medium.code,
          items: plan.map((item) => ({
            mode: item.existingTarget ? 'reuse/update' : 'create',
            sourceSlug: item.sourceNote.slug,
            targetSlug: item.existingTarget?.slug ?? item.spec.targetSlug,
            title: item.sourceNote.title,
            topic: item.topic
              ? {
                  code: item.topic.code,
                  name: item.topic.name,
                  createdInThisRun: item.topic.createdInThisRun,
                }
              : {
                  code: item.spec.topicCode,
                  name: item.spec.topicName,
                  createdInThisRun: options.dryRun ? false : null,
                },
            fullFileAssetId: item.sourceNote.fullFileAssetId,
            previewFileAssetId: item.sourceNote.previewFileAssetId,
            indexEntries: item.sourceNote.indexEntries.length,
          })),
        },
        null,
        2,
      ),
    );

    if (options.dryRun) {
      console.log('Dry run complete. No notes or taxonomy were changed.');
      return;
    }

    const summaries: LinkSummary[] = [];
    for (const item of plan) {
      if (!item.topic) {
        throw new Error(`Topic "${item.spec.topicCode}" was not resolved.`);
      }
      const topic = item.topic;
      const mode: LinkSummary['mode'] = item.existingTarget
        ? 'updated'
        : 'created';

      const summary = await prisma.$transaction(async (tx) => {
        const targetNote =
          item.existingTarget ??
          (await tx.note.create({
            data: {
              siteId: site.id,
              subjectId: targetSubject.id,
              mediumId: medium.id,
              slug: await buildUniqueNoteSlug(
                tx,
                site.id,
                item.spec.targetSlug,
              ),
              title: item.sourceNote.title,
              shortDescription: item.sourceNote.shortDescription,
              description: item.sourceNote.description,
              fullFileAssetId: item.sourceNote.fullFileAssetId,
              previewFileAssetId: item.sourceNote.previewFileAssetId,
              coverImageAssetId: item.sourceNote.coverImageAssetId,
              accessType: item.sourceNote.accessType,
              previewPageCount: item.sourceNote.previewPageCount,
              pageCount: item.sourceNote.pageCount,
              orderIndex: item.sourceNote.orderIndex,
              status: item.sourceNote.status,
              createdByUserId: item.sourceNote.createdByUserId,
              updatedByUserId: item.sourceNote.updatedByUserId,
              publishedByUserId: item.sourceNote.publishedByUserId,
              publishedAt: item.sourceNote.publishedAt,
              archivedAt: item.sourceNote.archivedAt,
            },
            select: { id: true, slug: true },
          }));

        await tx.note.update({
          where: { id: targetNote.id },
          data: {
            subjectId: targetSubject.id,
            mediumId: medium.id,
            fullFileAssetId: item.sourceNote.fullFileAssetId,
            previewFileAssetId: item.sourceNote.previewFileAssetId,
            coverImageAssetId: item.sourceNote.coverImageAssetId,
            accessType: item.sourceNote.accessType,
            previewPageCount: item.sourceNote.previewPageCount,
            pageCount: item.sourceNote.pageCount,
            status: NoteStatus.PUBLISHED,
            updatedByUserId: item.sourceNote.updatedByUserId,
            archivedAt: null,
          },
        });

        const topicResult = await tx.noteTopic.createMany({
          data: [{ noteId: targetNote.id, topicId: topic.id }],
          skipDuplicates: true,
        });

        await ensureAssetReference(tx, {
          siteId: site.id,
          noteId: targetNote.id,
          fileAssetId: item.sourceNote.fullFileAssetId,
          slot: 'full_pdf',
        });
        if (item.sourceNote.previewFileAssetId) {
          await ensureAssetReference(tx, {
            siteId: site.id,
            noteId: targetNote.id,
            fileAssetId: item.sourceNote.previewFileAssetId,
            slot: 'preview_pdf',
          });
        }
        if (item.sourceNote.coverImageAssetId) {
          await ensureAssetReference(tx, {
            siteId: site.id,
            noteId: targetNote.id,
            fileAssetId: item.sourceNote.coverImageAssetId,
            slot: 'cover_image',
          });
        }

        const targetIndexCount = await tx.noteIndexEntry.count({
          where: { noteId: targetNote.id },
        });
        let copiedIndexEntries = 0;
        if (targetIndexCount === 0 && item.sourceNote.indexEntries.length > 0) {
          const indexResult = await tx.noteIndexEntry.createMany({
            data: item.sourceNote.indexEntries.map((entry) => ({
              siteId: site.id,
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
          copiedIndexEntries = indexResult.count;
        }

        return {
          sourceSlug: item.sourceNote.slug,
          targetSlug: targetNote.slug,
          topicLinked: topicResult.count,
          copiedIndexEntries,
          mode,
        };
      });

      summaries.push(summary);
    }

    console.log(JSON.stringify({ summaries }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

async function resolveTopic(
  prisma: PrismaClient,
  input: {
    dryRun: boolean;
    siteId: string;
    subjectId: string;
    spec: LinkSpec;
  },
) {
  const existing = await prisma.topic.findFirst({
    where: {
      siteId: input.siteId,
      subjectId: input.subjectId,
      code: input.spec.topicCode,
    },
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
      visibility: true,
    },
  });

  if (existing) {
    if (
      !existing.isActive ||
      existing.visibility !== CatalogVisibility.PUBLIC
    ) {
      throw new Error(
        `Topic "${input.spec.topicCode}" is not active and public.`,
      );
    }

    return { ...existing, createdInThisRun: false };
  }

  if (input.dryRun) {
    return null;
  }

  const created = await prisma.topic.create({
    data: {
      siteId: input.siteId,
      subjectId: input.subjectId,
      code: input.spec.topicCode,
      slug: input.spec.topicCode,
      name: input.spec.topicName,
      description: null,
      orderIndex: input.spec.topicOrderIndex,
      visibility: CatalogVisibility.PUBLIC,
      isActive: true,
    },
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
      visibility: true,
    },
  });

  return { ...created, createdInThisRun: true };
}

async function findSourceNote(
  prisma: PrismaClient,
  input: {
    mediumId: string;
    siteId: string;
    slug: string;
  },
) {
  return prisma.note.findFirst({
    where: {
      siteId: input.siteId,
      slug: input.slug,
      status: NoteStatus.PUBLISHED,
      mediumId: input.mediumId,
      subject: { examTrack: { code: SOURCE_TRACK_CODE } },
    },
    include: {
      indexEntries: {
        orderBy: [{ orderIndex: 'asc' }, { pageNumber: 'asc' }],
      },
    },
  });
}

async function buildUniqueNoteSlug(
  prisma: Prisma.TransactionClient,
  siteId: string,
  requestedSlug: string,
) {
  let nextSlug = requestedSlug;
  let suffix = 2;

  while (
    await prisma.note.findUnique({
      where: {
        siteId_slug: {
          siteId,
          slug: nextSlug,
        },
      },
      select: { id: true },
    })
  ) {
    nextSlug = `${requestedSlug}-${suffix}`;
    suffix += 1;
  }

  return nextSlug;
}

async function ensureAssetReference(
  tx: Prisma.TransactionClient,
  input: {
    siteId: string;
    noteId: string;
    fileAssetId: string;
    slot: string;
  },
) {
  await tx.fileAssetReference.upsert({
    where: {
      fileAssetId_resourceType_resourceId_slot: {
        fileAssetId: input.fileAssetId,
        resourceType: 'note',
        resourceId: input.noteId,
        slot: input.slot,
      },
    },
    update: {
      siteId: input.siteId,
      accessLevel: FileAssetAccess.PROTECTED,
    },
    create: {
      siteId: input.siteId,
      fileAssetId: input.fileAssetId,
      resourceType: 'note',
      resourceId: input.noteId,
      slot: input.slot,
      accessLevel: FileAssetAccess.PROTECTED,
    },
  });
}

function parseArgs(argv: string[]) {
  const flags = new Set<string>();

  for (const token of argv) {
    if (token === '--dry-run') {
      flags.add(token);
      continue;
    }

    throw new Error(`Unexpected argument "${token}".`);
  }

  return { dryRun: flags.has('--dry-run') };
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
