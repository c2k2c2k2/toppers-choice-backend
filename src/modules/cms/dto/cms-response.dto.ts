import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CatalogVisibility,
  CmsAnnouncementLevel,
  CmsBannerPlacement,
  CmsRecordStatus,
  CmsSectionSurface,
  CmsSectionType,
  FileAssetAccess,
  FileAssetPurpose,
  FileAssetStatus,
} from '@prisma/client';

export class CmsAssetSummaryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: FileAssetPurpose })
  purpose!: FileAssetPurpose;

  @ApiProperty({ enum: FileAssetAccess })
  accessLevel!: FileAssetAccess;

  @ApiProperty({ enum: FileAssetStatus })
  status!: FileAssetStatus;

  @ApiProperty()
  originalFileName!: string;

  @ApiProperty()
  contentType!: string;

  @ApiPropertyOptional()
  sizeBytes!: number | null;

  @ApiProperty()
  publicDeliveryPath!: string;

  @ApiProperty()
  protectedDeliveryPath!: string;
}

export class CmsPageResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  summary!: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  bodyJson!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  seoJson!: Record<string, unknown> | null;

  @ApiProperty({ enum: CatalogVisibility })
  visibility!: CatalogVisibility;

  @ApiPropertyOptional()
  coverImageAssetId!: string | null;

  @ApiProperty()
  orderIndex!: number;

  @ApiProperty({ enum: CmsRecordStatus })
  status!: CmsRecordStatus;

  @ApiPropertyOptional()
  publishedAt!: Date | null;

  @ApiPropertyOptional()
  archivedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional({ type: CmsAssetSummaryResponseDto, nullable: true })
  coverImage!: CmsAssetSummaryResponseDto | null;
}

export class CmsBannerResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: CmsBannerPlacement })
  placement!: CmsBannerPlacement;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  subtitle!: string | null;

  @ApiPropertyOptional()
  body!: string | null;

  @ApiPropertyOptional()
  ctaLabel!: string | null;

  @ApiPropertyOptional()
  ctaHref!: string | null;

  @ApiPropertyOptional()
  imageAssetId!: string | null;

  @ApiProperty({ enum: CatalogVisibility })
  visibility!: CatalogVisibility;

  @ApiProperty()
  orderIndex!: number;

  @ApiPropertyOptional()
  startsAt!: Date | null;

  @ApiPropertyOptional()
  endsAt!: Date | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  metaJson!: Record<string, unknown> | null;

  @ApiProperty({ enum: CmsRecordStatus })
  status!: CmsRecordStatus;

  @ApiPropertyOptional()
  publishedAt!: Date | null;

  @ApiPropertyOptional({ type: CmsAssetSummaryResponseDto, nullable: true })
  image!: CmsAssetSummaryResponseDto | null;
}

export class CmsAnnouncementResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  body!: string;

  @ApiPropertyOptional()
  linkLabel!: string | null;

  @ApiPropertyOptional()
  linkHref!: string | null;

  @ApiProperty({ enum: CmsAnnouncementLevel })
  level!: CmsAnnouncementLevel;

  @ApiProperty({ enum: CatalogVisibility })
  visibility!: CatalogVisibility;

  @ApiProperty()
  isPinned!: boolean;

  @ApiProperty()
  orderIndex!: number;

  @ApiPropertyOptional()
  startsAt!: Date | null;

  @ApiPropertyOptional()
  endsAt!: Date | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  metaJson!: Record<string, unknown> | null;

  @ApiProperty({ enum: CmsRecordStatus })
  status!: CmsRecordStatus;

  @ApiPropertyOptional()
  publishedAt!: Date | null;
}

export class CmsSectionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: CmsSectionSurface })
  surface!: CmsSectionSurface;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  subtitle!: string | null;

  @ApiProperty({ enum: CmsSectionType })
  type!: CmsSectionType;

  @ApiPropertyOptional({ type: Object, nullable: true })
  bodyJson!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  configJson!: Record<string, unknown> | null;

  @ApiPropertyOptional()
  imageAssetId!: string | null;

  @ApiProperty({ enum: CatalogVisibility })
  visibility!: CatalogVisibility;

  @ApiProperty()
  orderIndex!: number;

  @ApiProperty({ enum: CmsRecordStatus })
  status!: CmsRecordStatus;

  @ApiPropertyOptional()
  publishedAt!: Date | null;

  @ApiPropertyOptional({ type: CmsAssetSummaryResponseDto, nullable: true })
  image!: CmsAssetSummaryResponseDto | null;
}

export class CmsResolveResponseDto {
  @ApiProperty({ type: [CmsPageResponseDto] })
  pages!: CmsPageResponseDto[];

  @ApiProperty({ type: [CmsBannerResponseDto] })
  banners!: CmsBannerResponseDto[];

  @ApiProperty({ type: [CmsAnnouncementResponseDto] })
  announcements!: CmsAnnouncementResponseDto[];

  @ApiProperty({ type: [CmsSectionResponseDto] })
  sections!: CmsSectionResponseDto[];
}

export class CmsPagesListResponseDto {
  @ApiProperty({ type: [CmsPageResponseDto] })
  items!: CmsPageResponseDto[];

  @ApiProperty()
  total!: number;
}

export class CmsBannersListResponseDto {
  @ApiProperty({ type: [CmsBannerResponseDto] })
  items!: CmsBannerResponseDto[];

  @ApiProperty()
  total!: number;
}

export class CmsAnnouncementsListResponseDto {
  @ApiProperty({ type: [CmsAnnouncementResponseDto] })
  items!: CmsAnnouncementResponseDto[];

  @ApiProperty()
  total!: number;
}

export class CmsSectionsListResponseDto {
  @ApiProperty({ type: [CmsSectionResponseDto] })
  items!: CmsSectionResponseDto[];

  @ApiProperty()
  total!: number;
}
