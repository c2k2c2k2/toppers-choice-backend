import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  CatalogVisibility,
  ContentAccessType,
  ContentFamily,
  ContentFormat,
  ContentStatus,
} from '@prisma/client';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const SLUG_PATTERN = /^[a-z0-9-]+$/;

function normalizeOptionalText(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().replace(/\s+/gu, ' ');
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalSlug(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }
  }

  return value;
}

export class ContentAttachmentInputDto {
  @ApiProperty({ example: 'cmag4asset001' })
  @IsString()
  fileAssetId!: string;

  @ApiPropertyOptional({ example: 'Worksheet PDF' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}

class ContentMutationBaseDto {
  @ApiProperty({ enum: ContentFamily })
  @IsEnum(ContentFamily)
  family!: ContentFamily;

  @ApiPropertyOptional({ enum: ContentFormat, default: ContentFormat.ARTICLE })
  @IsOptional()
  @IsEnum(ContentFormat)
  format?: ContentFormat;

  @ApiPropertyOptional({
    enum: CatalogVisibility,
    default: CatalogVisibility.PUBLIC,
  })
  @IsOptional()
  @IsEnum(CatalogVisibility)
  visibility?: CatalogVisibility;

  @ApiPropertyOptional({
    enum: ContentAccessType,
    default: ContentAccessType.FREE,
  })
  @IsOptional()
  @IsEnum(ContentAccessType)
  accessType?: ContentAccessType;

  @ApiProperty({ example: 'How To Start UPSC Preparation After Graduation' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title!: string;

  @ApiPropertyOptional({ example: 'how-to-start-upsc-preparation' })
  @Transform(({ value }) => normalizeOptionalSlug(value))
  @IsOptional()
  @IsString()
  @MaxLength(180)
  @Matches(SLUG_PATTERN)
  slug?: string;

  @ApiPropertyOptional({
    example: 'A practical roadmap for first-time aspirants.',
  })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(600)
  excerpt?: string;

  @ApiProperty({
    type: Object,
    example: {
      blocks: [
        { type: 'paragraph', text: 'Start with the syllabus and PYQs.' },
      ],
    },
  })
  @IsObject()
  bodyJson!: Record<string, unknown>;

  @ApiPropertyOptional({
    type: Object,
    example: { month: '2026-03', lessonLevel: 'beginner' },
  })
  @IsOptional()
  @IsObject()
  metaJson?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'cmag4cover001' })
  @IsOptional()
  @IsString()
  coverImageAssetId?: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsInt()
  @Min(0)
  readingTimeMinutes?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['cmag4track001', 'cmag4track002'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  examTrackIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['cmag4medium001', 'cmag4medium002'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  mediumIds?: string[];

  @ApiPropertyOptional({
    type: [ContentAttachmentInputDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContentAttachmentInputDto)
  @ArrayUnique((item: ContentAttachmentInputDto) => item.fileAssetId)
  attachments?: ContentAttachmentInputDto[];
}

export class CreateContentEntryDto extends ContentMutationBaseDto {}

export class UpdateContentEntryDto extends PartialType(CreateContentEntryDto) {}

export class PublishContentEntryDto {
  @ApiPropertyOptional({
    example: '2026-03-30T09:00:00.000Z',
    description:
      'Use a future timestamp to schedule publishing without exposing the content until that time.',
  })
  @IsOptional()
  @IsDateString()
  publishAt?: string;
}

export class FeatureContentEntryDto {
  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  featuredOrderIndex?: number;
}

export class ReorderContentEntriesDto {
  @ApiProperty({
    type: [String],
    example: ['cmag4content001', 'cmag4content002'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderedIds!: string[];
}

export class ListAdminContentQueryDto {
  @ApiPropertyOptional({ enum: ContentFamily })
  @IsOptional()
  @IsEnum(ContentFamily)
  family?: ContentFamily;

  @ApiPropertyOptional({ enum: ContentStatus })
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @ApiPropertyOptional({ enum: CatalogVisibility })
  @IsOptional()
  @IsEnum(CatalogVisibility)
  visibility?: CatalogVisibility;

  @ApiPropertyOptional({ enum: ContentAccessType })
  @IsOptional()
  @IsEnum(ContentAccessType)
  accessType?: ContentAccessType;

  @ApiPropertyOptional({ example: 'cmag4track001' })
  @IsOptional()
  @IsString()
  examTrackId?: string;

  @ApiPropertyOptional({ example: 'cmag4medium001' })
  @IsOptional()
  @IsString()
  mediumId?: string;

  @ApiPropertyOptional({ example: true })
  @Transform(({ value }) => normalizeOptionalBoolean(value))
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ example: 'interview' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class ListPublishedContentQueryDto {
  @ApiPropertyOptional({ enum: ContentFamily })
  @IsOptional()
  @IsEnum(ContentFamily)
  family?: ContentFamily;

  @ApiPropertyOptional({ enum: ContentFormat })
  @IsOptional()
  @IsEnum(ContentFormat)
  format?: ContentFormat;

  @ApiPropertyOptional({ example: 'cmag4track001' })
  @IsOptional()
  @IsString()
  examTrackId?: string;

  @ApiPropertyOptional({ example: 'cmag4medium001' })
  @IsOptional()
  @IsString()
  mediumId?: string;

  @ApiPropertyOptional({ example: true })
  @Transform(({ value }) => normalizeOptionalBoolean(value))
  @IsOptional()
  @IsBoolean()
  featuredOnly?: boolean;

  @ApiPropertyOptional({ example: 'guidance' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class PublicListContentQueryDto extends ListPublishedContentQueryDto {
  @ApiPropertyOptional({ example: 'toppers-choice' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsString()
  @Matches(SLUG_PATTERN)
  siteCode?: string;
}

export class ResolvePublicContentQueryDto {
  @ApiPropertyOptional({ example: 'toppers-choice' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsString()
  @Matches(SLUG_PATTERN)
  siteCode?: string;
}
