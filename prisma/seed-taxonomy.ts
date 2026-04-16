import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  CatalogVisibility,
  Prisma,
  PrismaClient,
} from '@prisma/client';

type TaxonomyClient = PrismaClient | Prisma.TransactionClient;

type TopicDraft = {
  code: string;
  slug: string;
  name: string;
  topics: TopicDraft[];
};

type SubjectDraft = {
  code: string;
  slug: string;
  name: string;
  topicEntryMode: 'FULL' | 'SUBJECT_ONLY' | 'DEFERRED';
  topics: TopicDraft[];
};

type MediumDraft = {
  code: string;
  slug: string;
  name: string;
};

type ExamTrackDraft = {
  code: string;
  slug: string;
  name: string;
  shortName?: string | null;
  defaultMediumCode: string;
  subjects: SubjectDraft[];
};

type TaxonomyDraft = {
  mediums: MediumDraft[];
  examTracks: ExamTrackDraft[];
};

type SummaryItem = {
  code: string;
  name: string;
};

export type TaxonomySyncSummary = {
  createdExamTracks: SummaryItem[];
  createdMediums: SummaryItem[];
  createdSubjects: Array<SummaryItem & { examTrackCode: string }>;
  createdTopics: Array<
    SummaryItem & { examTrackCode: string; subjectCode: string }
  >;
  deactivatedSubjects: Array<SummaryItem & { examTrackCode: string }>;
  deactivatedTopics: Array<
    SummaryItem & { examTrackCode: string; subjectCode: string }
  >;
  updatedExamTracks: SummaryItem[];
  updatedMediums: SummaryItem[];
};

type ExistingMedium = {
  id: string;
  code: string;
  slug: string;
  name: string;
};

type ExistingExamTrack = {
  id: string;
  code: string;
  slug: string;
  name: string;
};

type ExistingSubject = {
  id: string;
  code: string;
  slug: string;
  name: string;
};

type ExistingTopic = {
  id: string;
  code: string;
  slug: string;
  name: string;
};

const TAXONOMY_DRAFT_PATH = resolve(
  __dirname,
  '../references/client requirements/mpsc-taxonomy-canonical-draft.json',
);

const MEDIUM_CODE_ALIASES: Record<string, string[]> = {
  en: ['english'],
  mr: ['marathi'],
};

const EXAM_TRACK_CODE_ALIASES: Record<string, string[]> = {
  'mpsc-marathi-allied': ['mpsc-allied'],
};

export async function syncCanonicalTaxonomy(
  prisma: PrismaClient,
  siteId: string,
) {
  const draft = await loadDraft();
  const summary: TaxonomySyncSummary = {
    createdExamTracks: [],
    createdMediums: [],
    createdSubjects: [],
    createdTopics: [],
    deactivatedSubjects: [],
    deactivatedTopics: [],
    updatedExamTracks: [],
    updatedMediums: [],
  };

  await syncMediums(prisma, siteId, draft, summary);
  await syncExamTracks(prisma, siteId, draft, summary);

  return summary;
}

async function syncMediums(
  tx: TaxonomyClient,
  siteId: string,
  draft: TaxonomyDraft,
  summary: TaxonomySyncSummary,
) {
  const existing = await tx.medium.findMany({
    where: { siteId },
    select: {
      id: true,
      code: true,
      slug: true,
      name: true,
    },
  });

  for (const [index, mediumDraft] of draft.mediums.entries()) {
    const match = findMediumMatch(existing, mediumDraft);
    const createData: Prisma.MediumUncheckedCreateInput = {
      siteId,
      code: mediumDraft.code,
      slug: mediumDraft.slug,
      name: mediumDraft.name,
      description: null,
      visibility: CatalogVisibility.PUBLIC,
      isActive: true,
      orderIndex: (index + 1) * 10,
    };
    const updateData: Prisma.MediumUncheckedUpdateInput = {
      code: mediumDraft.code,
      slug: mediumDraft.slug,
      name: mediumDraft.name,
      description: null,
      visibility: CatalogVisibility.PUBLIC,
      isActive: true,
      orderIndex: (index + 1) * 10,
    };

    if (match) {
      await tx.medium.update({
        where: { id: match.id },
        data: updateData,
      });
      summary.updatedMediums.push({
        code: mediumDraft.code,
        name: mediumDraft.name,
      });
      continue;
    }

    await tx.medium.create({
      data: createData,
    });
    summary.createdMediums.push({
      code: mediumDraft.code,
      name: mediumDraft.name,
    });
  }
}

async function syncExamTracks(
  tx: TaxonomyClient,
  siteId: string,
  draft: TaxonomyDraft,
  summary: TaxonomySyncSummary,
) {
  const existing = await tx.examTrack.findMany({
    where: { siteId },
    select: {
      id: true,
      code: true,
      slug: true,
      name: true,
    },
  });

  for (const [index, trackDraft] of draft.examTracks.entries()) {
    const match = findExamTrackMatch(existing, trackDraft);
    const createData: Prisma.ExamTrackUncheckedCreateInput = {
      siteId,
      code: trackDraft.code,
      slug: trackDraft.slug,
      name: trackDraft.name,
      shortName: trackDraft.shortName ?? null,
      description: null,
      visibility: CatalogVisibility.PUBLIC,
      isActive: true,
      orderIndex: (index + 1) * 10,
    };
    const updateData: Prisma.ExamTrackUncheckedUpdateInput = {
      code: trackDraft.code,
      slug: trackDraft.slug,
      name: trackDraft.name,
      shortName: trackDraft.shortName ?? null,
      description: null,
      visibility: CatalogVisibility.PUBLIC,
      isActive: true,
      orderIndex: (index + 1) * 10,
    };

    let trackId: string;

    if (match) {
      const updated = await tx.examTrack.update({
        where: { id: match.id },
        data: updateData,
        select: {
          id: true,
        },
      });
      trackId = updated.id;
      summary.updatedExamTracks.push({
        code: trackDraft.code,
        name: trackDraft.name,
      });
    } else {
      const created = await tx.examTrack.create({
        data: createData,
        select: {
          id: true,
        },
      });
      trackId = created.id;
      summary.createdExamTracks.push({
        code: trackDraft.code,
        name: trackDraft.name,
      });
    }

    await syncSubjectsForTrack(tx, siteId, trackId, trackDraft, summary);
  }
}

async function syncSubjectsForTrack(
  tx: TaxonomyClient,
  siteId: string,
  examTrackId: string,
  trackDraft: ExamTrackDraft,
  summary: TaxonomySyncSummary,
) {
  const existingSubjects = await tx.subject.findMany({
    where: {
      siteId,
      examTrackId,
    },
    select: {
      id: true,
      code: true,
      slug: true,
      name: true,
    },
  });

  const syncedSubjectIds = new Set<string>();

  for (const [index, subjectDraft] of trackDraft.subjects.entries()) {
    const match = findSubjectMatch(existingSubjects, subjectDraft);
    const createData: Prisma.SubjectUncheckedCreateInput = {
      siteId,
      examTrackId,
      code: subjectDraft.code,
      slug: subjectDraft.slug,
      name: subjectDraft.name,
      description: null,
      visibility: CatalogVisibility.PUBLIC,
      isActive: true,
      orderIndex: (index + 1) * 10,
    };
    const updateData: Prisma.SubjectUncheckedUpdateInput = {
      examTrackId,
      code: subjectDraft.code,
      slug: subjectDraft.slug,
      name: subjectDraft.name,
      description: null,
      visibility: CatalogVisibility.PUBLIC,
      isActive: true,
      orderIndex: (index + 1) * 10,
    };

    let subjectId: string;

    if (match) {
      const updated = await tx.subject.update({
        where: { id: match.id },
        data: updateData,
        select: {
          id: true,
        },
      });
      subjectId = updated.id;
    } else {
      const created = await tx.subject.create({
        data: createData,
        select: {
          id: true,
        },
      });
      subjectId = created.id;
      summary.createdSubjects.push({
        code: subjectDraft.code,
        name: subjectDraft.name,
        examTrackCode: trackDraft.code,
      });
    }

    syncedSubjectIds.add(subjectId);
    await syncTopicsForSubject(
      tx,
      siteId,
      subjectId,
      trackDraft.code,
      subjectDraft,
      summary,
    );
  }

  const legacySubjects = existingSubjects.filter(
    (subject) => !syncedSubjectIds.has(subject.id),
  );

  if (legacySubjects.length === 0) {
    return;
  }

  await tx.subject.updateMany({
    where: {
      id: {
        in: legacySubjects.map((subject) => subject.id),
      },
    },
    data: {
      isActive: false,
    },
  });

  await tx.topic.updateMany({
    where: {
      subjectId: {
        in: legacySubjects.map((subject) => subject.id),
      },
    },
    data: {
      isActive: false,
    },
  });

  summary.deactivatedSubjects.push(
    ...legacySubjects.map((subject) => ({
      code: subject.code,
      name: subject.name,
      examTrackCode: trackDraft.code,
    })),
  );

  const legacyTopics = await tx.topic.findMany({
    where: {
      subjectId: {
        in: legacySubjects.map((subject) => subject.id),
      },
    },
    select: {
      code: true,
      name: true,
      subject: {
        select: {
          code: true,
        },
      },
    },
  });

  summary.deactivatedTopics.push(
    ...legacyTopics.map((topic) => ({
      code: topic.code,
      name: topic.name,
      examTrackCode: trackDraft.code,
      subjectCode: topic.subject.code,
    })),
  );
}

async function syncTopicsForSubject(
  tx: TaxonomyClient,
  siteId: string,
  subjectId: string,
  examTrackCode: string,
  subjectDraft: SubjectDraft,
  summary: TaxonomySyncSummary,
) {
  const existingTopics = await tx.topic.findMany({
    where: {
      siteId,
      subjectId,
    },
    select: {
      id: true,
      code: true,
      slug: true,
      name: true,
    },
  });

  const syncedTopicIds = new Set<string>();

  await syncTopicBranch(
    tx,
    siteId,
    subjectId,
    examTrackCode,
    subjectDraft.code,
    subjectDraft.topics,
    null,
    existingTopics,
    syncedTopicIds,
    summary,
  );

  const legacyTopics = existingTopics.filter(
    (topic) => !syncedTopicIds.has(topic.id),
  );

  if (legacyTopics.length === 0) {
    return;
  }

  await tx.topic.updateMany({
    where: {
      id: {
        in: legacyTopics.map((topic) => topic.id),
      },
    },
    data: {
      isActive: false,
    },
  });

  summary.deactivatedTopics.push(
    ...legacyTopics.map((topic) => ({
      code: topic.code,
      name: topic.name,
      examTrackCode,
      subjectCode: subjectDraft.code,
    })),
  );
}

async function syncTopicBranch(
  tx: TaxonomyClient,
  siteId: string,
  subjectId: string,
  examTrackCode: string,
  subjectCode: string,
  topicDrafts: TopicDraft[],
  parentId: string | null,
  existingTopics: ExistingTopic[],
  syncedTopicIds: Set<string>,
  summary: TaxonomySyncSummary,
) {
  for (const [index, topicDraft] of topicDrafts.entries()) {
    const match = findTopicMatch(existingTopics, topicDraft);
    const createData: Prisma.TopicUncheckedCreateInput = {
      siteId,
      subjectId,
      parentId,
      code: topicDraft.code,
      slug: topicDraft.slug,
      name: topicDraft.name,
      description: null,
      visibility: CatalogVisibility.PUBLIC,
      isActive: true,
      orderIndex: (index + 1) * 10,
    };
    const updateData: Prisma.TopicUncheckedUpdateInput = {
      subjectId,
      parentId,
      code: topicDraft.code,
      slug: topicDraft.slug,
      name: topicDraft.name,
      description: null,
      visibility: CatalogVisibility.PUBLIC,
      isActive: true,
      orderIndex: (index + 1) * 10,
    };

    let topicId: string;

    if (match) {
      const updated = await tx.topic.update({
        where: { id: match.id },
        data: updateData,
        select: {
          id: true,
        },
      });
      topicId = updated.id;
    } else {
      const created = await tx.topic.create({
        data: createData,
        select: {
          id: true,
        },
      });
      topicId = created.id;
      summary.createdTopics.push({
        code: topicDraft.code,
        name: topicDraft.name,
        examTrackCode,
        subjectCode,
      });
    }

    syncedTopicIds.add(topicId);

    await syncTopicBranch(
      tx,
      siteId,
      subjectId,
      examTrackCode,
      subjectCode,
      topicDraft.topics,
      topicId,
      existingTopics,
      syncedTopicIds,
      summary,
    );
  }
}

function findMediumMatch(existing: ExistingMedium[], draft: MediumDraft) {
  return (
    existing.find((item) => item.code === draft.code) ??
    existing.find((item) =>
      (MEDIUM_CODE_ALIASES[draft.code] ?? []).includes(item.code),
    ) ??
    existing.find((item) => item.slug === draft.slug) ??
    existing.find((item) => normalize(item.name) === normalize(draft.name)) ??
    null
  );
}

function findExamTrackMatch(existing: ExistingExamTrack[], draft: ExamTrackDraft) {
  return (
    existing.find((item) => item.code === draft.code) ??
    existing.find((item) =>
      (EXAM_TRACK_CODE_ALIASES[draft.code] ?? []).includes(item.code),
    ) ??
    existing.find((item) => item.slug === draft.slug) ??
    existing.find((item) => normalize(item.name) === normalize(draft.name)) ??
    null
  );
}

function findSubjectMatch(existing: ExistingSubject[], draft: SubjectDraft) {
  return (
    existing.find((item) => item.code === draft.code) ??
    existing.find((item) => item.slug === draft.slug) ??
    null
  );
}

function findTopicMatch(existing: ExistingTopic[], draft: TopicDraft) {
  return (
    existing.find((item) => item.code === draft.code) ??
    existing.find((item) => item.slug === draft.slug) ??
    null
  );
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

async function loadDraft() {
  const raw = await readFile(TAXONOMY_DRAFT_PATH, 'utf8');
  return JSON.parse(raw) as TaxonomyDraft;
}
