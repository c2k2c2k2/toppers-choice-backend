import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CatalogVisibility,
  ContentAccessType,
  ContentFamily,
  ContentFormat,
  ContentStatus,
  FileAssetAccess,
  FileAssetPurpose,
  FileAssetStatus,
} from '@prisma/client';

export class ContentAccessSummaryResponseDto {
  @ApiProperty({ enum: ['FULL', 'LOCKED'] })
  mode!: 'FULL' | 'LOCKED';

  @ApiProperty()
  canView!: boolean;

  @ApiProperty()
  requiresEntitlement!: boolean;

  @ApiPropertyOptional({ nullable: true })
  reason!: string | null;
}

export class ContentTrackSummaryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  shortName!: string | null;

  @ApiProperty()
  orderIndex!: number;
}

export class ContentMediumSummaryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  orderIndex!: number;
}

export class ContentAssetSummaryResponseDto {
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

  @ApiPropertyOptional({ nullable: true })
  sizeBytes!: number | null;

  @ApiProperty()
  publicDeliveryPath!: string;

  @ApiProperty()
  protectedDeliveryPath!: string;
}

export class ContentAttachmentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  label!: string | null;

  @ApiProperty()
  orderIndex!: number;

  @ApiProperty()
  fileAssetId!: string;

  @ApiProperty({ type: ContentAssetSummaryResponseDto })
  fileAsset!: ContentAssetSummaryResponseDto;
}

export class ContentSummaryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  siteId!: string;

  @ApiProperty({ enum: ContentFamily })
  family!: ContentFamily;

  @ApiProperty({ enum: ContentFormat })
  format!: ContentFormat;

  @ApiProperty({ enum: CatalogVisibility })
  visibility!: CatalogVisibility;

  @ApiProperty({ enum: ContentAccessType })
  accessType!: ContentAccessType;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  excerpt!: string | null;

  @ApiProperty()
  orderIndex!: number;

  @ApiProperty()
  isFeatured!: boolean;

  @ApiPropertyOptional({ nullable: true })
  featuredOrderIndex!: number | null;

  @ApiPropertyOptional({ nullable: true })
  readingTimeMinutes!: number | null;

  @ApiProperty({ enum: ContentStatus })
  status!: ContentStatus;

  @ApiPropertyOptional({ nullable: true })
  publishedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  archivedAt!: Date | null;

  @ApiProperty()
  isScheduled!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: [ContentTrackSummaryResponseDto] })
  examTracks!: ContentTrackSummaryResponseDto[];

  @ApiProperty({ type: [ContentMediumSummaryResponseDto] })
  mediums!: ContentMediumSummaryResponseDto[];

  @ApiPropertyOptional({
    type: ContentAssetSummaryResponseDto,
    nullable: true,
  })
  coverImage!: ContentAssetSummaryResponseDto | null;

  @ApiProperty({ type: ContentAccessSummaryResponseDto })
  access!: ContentAccessSummaryResponseDto;
}

export class ContentDetailResponseDto extends ContentSummaryResponseDto {
  @ApiPropertyOptional({ type: Object, nullable: true })
  bodyJson!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  metaJson!: Record<string, unknown> | null;

  @ApiProperty({ type: [ContentAttachmentResponseDto] })
  attachments!: ContentAttachmentResponseDto[];
}

export class ContentListResponseDto {
  @ApiProperty({ type: [ContentSummaryResponseDto] })
  items!: ContentSummaryResponseDto[];

  @ApiProperty()
  total!: number;
}
