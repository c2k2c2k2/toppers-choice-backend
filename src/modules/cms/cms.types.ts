import { CatalogVisibility, CmsRecordStatus, Prisma } from '@prisma/client';

export const cmsAssetSelect = Prisma.validator<Prisma.FileAssetSelect>()({
  id: true,
  purpose: true,
  accessLevel: true,
  status: true,
  originalFileName: true,
  contentType: true,
  sizeBytes: true,
});

export const cmsPageSelect = Prisma.validator<Prisma.CmsPageSelect>()({
  id: true,
  siteId: true,
  slug: true,
  title: true,
  summary: true,
  bodyJson: true,
  seoJson: true,
  visibility: true,
  coverImageAssetId: true,
  orderIndex: true,
  status: true,
  publishedAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  coverImageAsset: {
    select: cmsAssetSelect,
  },
});

export const cmsBannerSelect = Prisma.validator<Prisma.CmsBannerSelect>()({
  id: true,
  siteId: true,
  placement: true,
  title: true,
  subtitle: true,
  body: true,
  ctaLabel: true,
  ctaHref: true,
  imageAssetId: true,
  visibility: true,
  orderIndex: true,
  startsAt: true,
  endsAt: true,
  metaJson: true,
  status: true,
  publishedAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  imageAsset: {
    select: cmsAssetSelect,
  },
});

export const cmsAnnouncementSelect =
  Prisma.validator<Prisma.CmsAnnouncementSelect>()({
    id: true,
    siteId: true,
    title: true,
    body: true,
    linkLabel: true,
    linkHref: true,
    level: true,
    visibility: true,
    isPinned: true,
    orderIndex: true,
    startsAt: true,
    endsAt: true,
    metaJson: true,
    status: true,
    publishedAt: true,
    archivedAt: true,
    createdAt: true,
    updatedAt: true,
  });

export const cmsSectionSelect = Prisma.validator<Prisma.CmsSectionSelect>()({
  id: true,
  siteId: true,
  surface: true,
  code: true,
  title: true,
  subtitle: true,
  type: true,
  bodyJson: true,
  configJson: true,
  imageAssetId: true,
  visibility: true,
  orderIndex: true,
  status: true,
  publishedAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  imageAsset: {
    select: cmsAssetSelect,
  },
});

export type CmsPageRecord = Prisma.CmsPageGetPayload<{
  select: typeof cmsPageSelect;
}>;
export type CmsBannerRecord = Prisma.CmsBannerGetPayload<{
  select: typeof cmsBannerSelect;
}>;
export type CmsAnnouncementRecord = Prisma.CmsAnnouncementGetPayload<{
  select: typeof cmsAnnouncementSelect;
}>;
export type CmsSectionRecord = Prisma.CmsSectionGetPayload<{
  select: typeof cmsSectionSelect;
}>;

export function mapCmsAsset(
  record: Prisma.FileAssetGetPayload<{ select: typeof cmsAssetSelect }>,
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

export function mapCmsPage(
  record: CmsPageRecord,
  options: {
    includeBody?: boolean;
  } = {},
) {
  return {
    id: record.id,
    siteId: record.siteId,
    slug: record.slug,
    title: record.title,
    summary: record.summary,
    bodyJson: options.includeBody ? record.bodyJson : null,
    seoJson: options.includeBody ? record.seoJson : null,
    visibility: record.visibility,
    coverImageAssetId: record.coverImageAssetId,
    orderIndex: record.orderIndex,
    status: record.status,
    publishedAt: record.publishedAt,
    archivedAt: record.archivedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    coverImage: record.coverImageAsset
      ? mapCmsAsset(record.coverImageAsset)
      : null,
  };
}

export function mapCmsBanner(record: CmsBannerRecord) {
  return {
    id: record.id,
    siteId: record.siteId,
    placement: record.placement,
    title: record.title,
    subtitle: record.subtitle,
    body: record.body,
    ctaLabel: record.ctaLabel,
    ctaHref: record.ctaHref,
    imageAssetId: record.imageAssetId,
    visibility: record.visibility,
    orderIndex: record.orderIndex,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    metaJson: record.metaJson,
    status: record.status,
    publishedAt: record.publishedAt,
    archivedAt: record.archivedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    image: record.imageAsset ? mapCmsAsset(record.imageAsset) : null,
  };
}

export function mapCmsAnnouncement(record: CmsAnnouncementRecord) {
  return {
    id: record.id,
    siteId: record.siteId,
    title: record.title,
    body: record.body,
    linkLabel: record.linkLabel,
    linkHref: record.linkHref,
    level: record.level,
    visibility: record.visibility,
    isPinned: record.isPinned,
    orderIndex: record.orderIndex,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    metaJson: record.metaJson,
    status: record.status,
    publishedAt: record.publishedAt,
    archivedAt: record.archivedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function mapCmsSection(
  record: CmsSectionRecord,
  options: {
    includeBody?: boolean;
  } = {},
) {
  return {
    id: record.id,
    siteId: record.siteId,
    surface: record.surface,
    code: record.code,
    title: record.title,
    subtitle: record.subtitle,
    type: record.type,
    bodyJson: options.includeBody ? record.bodyJson : null,
    configJson: options.includeBody ? record.configJson : null,
    imageAssetId: record.imageAssetId,
    visibility: record.visibility,
    orderIndex: record.orderIndex,
    status: record.status,
    publishedAt: record.publishedAt,
    archivedAt: record.archivedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    image: record.imageAsset ? mapCmsAsset(record.imageAsset) : null,
  };
}

export function isCmsPublished(record: {
  status: CmsRecordStatus;
  publishedAt: Date | null;
}) {
  if (record.status !== CmsRecordStatus.PUBLISHED) {
    return false;
  }

  return !record.publishedAt || record.publishedAt <= new Date();
}

export function buildCmsVisibilityWhere(includeAuthenticated: boolean) {
  return includeAuthenticated
    ? {
        in: [CatalogVisibility.PUBLIC, CatalogVisibility.AUTHENTICATED],
      }
    : CatalogVisibility.PUBLIC;
}
