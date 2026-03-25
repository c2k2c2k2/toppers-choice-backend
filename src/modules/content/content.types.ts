import {
  CatalogVisibility,
  ContentAccessType,
  ContentStatus,
  Prisma,
} from '@prisma/client';
import { isContentScheduled } from './content.utils';

export const contentAssetSelect = Prisma.validator<Prisma.FileAssetSelect>()({
  id: true,
  purpose: true,
  accessLevel: true,
  status: true,
  originalFileName: true,
  contentType: true,
  sizeBytes: true,
});

export const contentEntrySelect = Prisma.validator<Prisma.ContentEntrySelect>()(
  {
    id: true,
    siteId: true,
    family: true,
    format: true,
    visibility: true,
    accessType: true,
    slug: true,
    title: true,
    excerpt: true,
    bodyJson: true,
    metaJson: true,
    coverImageAssetId: true,
    orderIndex: true,
    isFeatured: true,
    featuredOrderIndex: true,
    readingTimeMinutes: true,
    status: true,
    createdByUserId: true,
    updatedByUserId: true,
    publishedByUserId: true,
    publishedAt: true,
    archivedAt: true,
    createdAt: true,
    updatedAt: true,
    coverImageAsset: {
      select: contentAssetSelect,
    },
    examTrackLinks: {
      orderBy: {
        examTrack: {
          orderIndex: 'asc',
        },
      },
      select: {
        examTrack: {
          select: {
            id: true,
            code: true,
            slug: true,
            name: true,
            shortName: true,
            orderIndex: true,
          },
        },
      },
    },
    mediumLinks: {
      orderBy: {
        medium: {
          orderIndex: 'asc',
        },
      },
      select: {
        medium: {
          select: {
            id: true,
            code: true,
            slug: true,
            name: true,
            orderIndex: true,
          },
        },
      },
    },
    attachments: {
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        label: true,
        orderIndex: true,
        fileAssetId: true,
        fileAsset: {
          select: contentAssetSelect,
        },
      },
    },
  },
);

export type ContentEntryRecord = Prisma.ContentEntryGetPayload<{
  select: typeof contentEntrySelect;
}>;

export type ContentAccessSummary = {
  mode: 'FULL' | 'LOCKED';
  canView: boolean;
  requiresEntitlement: boolean;
  reason: string | null;
};

export function mapContentAsset(
  record: Prisma.FileAssetGetPayload<{ select: typeof contentAssetSelect }>,
) {
  return {
    id: record.id,
    purpose: record.purpose,
    accessLevel: record.accessLevel,
    status: record.status,
    originalFileName: record.originalFileName,
    contentType: record.contentType,
    sizeBytes: record.sizeBytes,
    publicDeliveryPath: `/public/assets/${record.id}`,
    protectedDeliveryPath: `/assets/${record.id}`,
  };
}

export function mapContentEntry(
  record: ContentEntryRecord,
  access: ContentAccessSummary,
  options: {
    includeBody?: boolean;
    includeAttachments?: boolean;
  } = {},
) {
  return {
    id: record.id,
    siteId: record.siteId,
    family: record.family,
    format: record.format,
    visibility: record.visibility,
    accessType: record.accessType,
    slug: record.slug,
    title: record.title,
    excerpt: record.excerpt,
    bodyJson: options.includeBody ? record.bodyJson : null,
    metaJson: options.includeBody ? record.metaJson : null,
    coverImageAssetId: record.coverImageAssetId,
    orderIndex: record.orderIndex,
    isFeatured: record.isFeatured,
    featuredOrderIndex: record.featuredOrderIndex,
    readingTimeMinutes: record.readingTimeMinutes,
    status: record.status,
    publishedAt: record.publishedAt,
    archivedAt: record.archivedAt,
    isScheduled: isContentScheduled(record.status, record.publishedAt),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    examTracks: record.examTrackLinks.map(({ examTrack }) => ({
      id: examTrack.id,
      code: examTrack.code,
      slug: examTrack.slug,
      name: examTrack.name,
      shortName: examTrack.shortName,
      orderIndex: examTrack.orderIndex,
    })),
    mediums: record.mediumLinks.map(({ medium }) => ({
      id: medium.id,
      code: medium.code,
      slug: medium.slug,
      name: medium.name,
      orderIndex: medium.orderIndex,
    })),
    coverImage: record.coverImageAsset
      ? mapContentAsset(record.coverImageAsset)
      : null,
    attachments: options.includeAttachments
      ? record.attachments.map((attachment) => ({
          id: attachment.id,
          label: attachment.label,
          orderIndex: attachment.orderIndex,
          fileAssetId: attachment.fileAssetId,
          fileAsset: mapContentAsset(attachment.fileAsset),
        }))
      : [],
    access,
  };
}

export function getPublicContentAccessSummary(): ContentAccessSummary {
  return {
    mode: 'FULL',
    canView: true,
    requiresEntitlement: false,
    reason: null,
  };
}

export function getAdminContentAccessSummary(): ContentAccessSummary {
  return {
    mode: 'FULL',
    canView: true,
    requiresEntitlement: false,
    reason: null,
  };
}

export function canPubliclyDeliverFreeContent(
  visibility: CatalogVisibility,
  accessType: ContentAccessType,
) {
  return (
    visibility === CatalogVisibility.PUBLIC &&
    accessType === ContentAccessType.FREE
  );
}

export function canAuthenticatedUsersReadFreeContent(
  visibility: CatalogVisibility,
  accessType: ContentAccessType,
) {
  return (
    visibility !== CatalogVisibility.INTERNAL &&
    accessType === ContentAccessType.FREE
  );
}

export function isPublishedContent(record: Pick<ContentEntryRecord, 'status'>) {
  return record.status === ContentStatus.PUBLISHED;
}
