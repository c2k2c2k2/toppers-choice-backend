import { Prisma } from '@prisma/client';

export const fileAssetSelect = Prisma.validator<Prisma.FileAssetSelect>()({
  id: true,
  siteId: true,
  createdByUserId: true,
  confirmedByUserId: true,
  purpose: true,
  accessLevel: true,
  status: true,
  objectKey: true,
  originalFileName: true,
  extension: true,
  contentType: true,
  declaredSizeBytes: true,
  sizeBytes: true,
  checksumSha256: true,
  etag: true,
  imageWidth: true,
  imageHeight: true,
  uploadExpiresAt: true,
  confirmedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type FileAssetRecord = Prisma.FileAssetGetPayload<{
  select: typeof fileAssetSelect;
}>;

export function mapFileAsset(record: FileAssetRecord) {
  return {
    id: record.id,
    siteId: record.siteId,
    purpose: record.purpose,
    accessLevel: record.accessLevel,
    status: record.status,
    objectKey: record.objectKey,
    originalFileName: record.originalFileName,
    extension: record.extension,
    contentType: record.contentType,
    declaredSizeBytes: record.declaredSizeBytes,
    sizeBytes: record.sizeBytes,
    checksumSha256: record.checksumSha256,
    etag: record.etag,
    imageWidth: record.imageWidth,
    imageHeight: record.imageHeight,
    createdByUserId: record.createdByUserId,
    confirmedByUserId: record.confirmedByUserId,
    uploadExpiresAt: record.uploadExpiresAt,
    confirmedAt: record.confirmedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    publicDeliveryPath: `/public/assets/${record.id}`,
    protectedDeliveryPath: `/assets/${record.id}`,
  };
}
