import {
  NoteAccessType,
  NoteStatus,
  NoteViewAccessMode,
  Prisma,
} from '@prisma/client';

export const noteTopicSelect = Prisma.validator<Prisma.NoteTopicSelect>()({
  topic: {
    select: {
      id: true,
      slug: true,
      code: true,
      name: true,
      parentId: true,
      orderIndex: true,
      isActive: true,
    },
  },
});

export const noteProgressSelect = Prisma.validator<Prisma.NoteProgressSelect>()(
  {
    noteId: true,
    userId: true,
    lastPageViewed: true,
    maxPageViewed: true,
    completionPercent: true,
    lastViewedAt: true,
    completedAt: true,
    updatedAt: true,
  },
);

export const noteSelect = Prisma.validator<Prisma.NoteSelect>()({
  id: true,
  siteId: true,
  subjectId: true,
  mediumId: true,
  slug: true,
  title: true,
  shortDescription: true,
  description: true,
  fullFileAssetId: true,
  previewFileAssetId: true,
  coverImageAssetId: true,
  accessType: true,
  previewPageCount: true,
  pageCount: true,
  orderIndex: true,
  status: true,
  createdByUserId: true,
  updatedByUserId: true,
  publishedByUserId: true,
  publishedAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  subject: {
    select: {
      id: true,
      name: true,
      slug: true,
      examTrackId: true,
    },
  },
  medium: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  noteTopics: {
    orderBy: {
      topic: {
        orderIndex: 'asc',
      },
    },
    select: noteTopicSelect,
  },
});

export type NoteRecord = Prisma.NoteGetPayload<{
  select: typeof noteSelect;
}>;

export type NoteProgressRecord = Prisma.NoteProgressGetPayload<{
  select: typeof noteProgressSelect;
}>;

export type NoteTopicSummary = {
  id: string;
  code: string;
  slug: string;
  name: string;
  parentId: string | null;
  orderIndex: number;
  isActive: boolean;
};

export type NoteAccessSummary = {
  mode: 'FULL' | 'PREVIEW' | 'LOCKED';
  canStartViewSession: boolean;
  requiresEntitlement: boolean;
  reason: string | null;
  previewPageCount: number | null;
};

export type NoteViewSessionAuthContext = {
  noteViewSessionId: string;
  noteId: string;
  siteId: string;
  userId: string;
  accessMode: NoteViewAccessMode;
};

export function mapNoteTopicSummary(
  record: NoteRecord['noteTopics'][number]['topic'],
): NoteTopicSummary {
  return {
    id: record.id,
    code: record.code,
    slug: record.slug,
    name: record.name,
    parentId: record.parentId,
    orderIndex: record.orderIndex,
    isActive: record.isActive,
  };
}

export function mapNoteProgress(record: NoteProgressRecord | null) {
  if (!record) {
    return null;
  }

  return {
    noteId: record.noteId,
    userId: record.userId,
    lastPageViewed: record.lastPageViewed,
    maxPageViewed: record.maxPageViewed,
    completionPercent: record.completionPercent,
    lastViewedAt: record.lastViewedAt,
    completedAt: record.completedAt,
    updatedAt: record.updatedAt,
  };
}

export function mapNoteRecord(
  record: NoteRecord,
  access: NoteAccessSummary,
  progress: NoteProgressRecord | null,
) {
  return {
    id: record.id,
    siteId: record.siteId,
    subjectId: record.subjectId,
    mediumId: record.mediumId,
    slug: record.slug,
    title: record.title,
    shortDescription: record.shortDescription,
    description: record.description,
    fullFileAssetId: record.fullFileAssetId,
    previewFileAssetId: record.previewFileAssetId,
    coverImageAssetId: record.coverImageAssetId,
    accessType: record.accessType,
    previewPageCount: record.previewPageCount,
    pageCount: record.pageCount,
    orderIndex: record.orderIndex,
    status: record.status,
    publishedAt: record.publishedAt,
    archivedAt: record.archivedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    subject: record.subject,
    medium: record.medium,
    topics: record.noteTopics.map(({ topic }) => mapNoteTopicSummary(topic)),
    access,
    progress: mapNoteProgress(progress),
  };
}

export function isPublishedNote(record: Pick<NoteRecord, 'status'>) {
  return record.status === NoteStatus.PUBLISHED;
}

export function isPreviewableNote(record: Pick<NoteRecord, 'accessType'>) {
  return record.accessType === NoteAccessType.PREVIEWABLE_PREMIUM;
}
