import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  CatalogVisibility,
  CmsAnnouncementLevel,
  CmsBannerPlacement,
  CmsRecordStatus,
  CmsSectionSurface,
  CmsSectionType,
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
} from 'class-validator';
import {
  normalizeOptionalSlug,
  normalizeOptionalText,
  SLUG_PATTERN,
} from '../cms.utils';

export class ListCmsRecordsQueryDto {
  @ApiPropertyOptional({ enum: CmsRecordStatus })
  @IsOptional()
  @IsEnum(CmsRecordStatus)
  status?: CmsRecordStatus;

  @ApiPropertyOptional({ enum: CatalogVisibility })
  @IsOptional()
  @IsEnum(CatalogVisibility)
  visibility?: CatalogVisibility;

  @ApiPropertyOptional({ enum: CmsBannerPlacement })
  @IsOptional()
  @IsEnum(CmsBannerPlacement)
  placement?: CmsBannerPlacement;

  @ApiPropertyOptional({ enum: CmsSectionSurface })
  @IsOptional()
  @IsEnum(CmsSectionSurface)
  surface?: CmsSectionSurface;

  @ApiPropertyOptional({ example: 'career guidance' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

class CmsPageBaseDto {
  @ApiProperty({ example: 'career-guidance' })
  @Transform(({ value }) => normalizeOptionalSlug(value))
  @IsOptional()
  @IsString()
  @MaxLength(160)
  @Matches(SLUG_PATTERN)
  slug?: string;

  @ApiProperty({ example: 'Career Guidance' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title!: string;

  @ApiPropertyOptional({
    example: 'Landing page content for the guidance section.',
  })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @ApiProperty({
    type: Object,
    example: { blocks: [{ type: 'paragraph', text: '...' }] },
  })
  @IsObject()
  bodyJson!: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object, example: { title: 'Career Guidance' } })
  @IsOptional()
  @IsObject()
  seoJson?: Record<string, unknown>;

  @ApiPropertyOptional({
    enum: CatalogVisibility,
    default: CatalogVisibility.PUBLIC,
  })
  @IsOptional()
  @IsEnum(CatalogVisibility)
  visibility?: CatalogVisibility;

  @ApiPropertyOptional({ example: 'cmag4cover001' })
  @IsOptional()
  @IsString()
  coverImageAssetId?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}

export class CreateCmsPageDto extends CmsPageBaseDto {}

export class UpdateCmsPageDto extends PartialType(CreateCmsPageDto) {}

class CmsBannerBaseDto {
  @ApiProperty({ enum: CmsBannerPlacement })
  @IsEnum(CmsBannerPlacement)
  placement!: CmsBannerPlacement;

  @ApiProperty({ example: 'Premium Notes For Serious Aspirants' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title!: string;

  @ApiPropertyOptional({
    example: 'Study smarter with curated PDFs and test series.',
  })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(240)
  subtitle?: string;

  @ApiPropertyOptional({ example: 'A short support paragraph for the banner.' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(600)
  body?: string;

  @ApiPropertyOptional({ example: 'Explore Plans' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(80)
  ctaLabel?: string;

  @ApiPropertyOptional({ example: '/plans' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(240)
  ctaHref?: string;

  @ApiPropertyOptional({ example: 'cmag4banner001' })
  @IsOptional()
  @IsString()
  imageAssetId?: string;

  @ApiPropertyOptional({
    enum: CatalogVisibility,
    default: CatalogVisibility.PUBLIC,
  })
  @IsOptional()
  @IsEnum(CatalogVisibility)
  visibility?: CatalogVisibility;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @ApiPropertyOptional({ example: '2026-03-26T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2026-04-30T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ type: Object, example: { theme: 'orange' } })
  @IsOptional()
  @IsObject()
  metaJson?: Record<string, unknown>;
}

export class CreateCmsBannerDto extends CmsBannerBaseDto {}

export class UpdateCmsBannerDto extends PartialType(CreateCmsBannerDto) {}

class CmsAnnouncementBaseDto {
  @ApiProperty({ example: 'New batch registrations are open now.' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title!: string;

  @ApiProperty({
    example: 'Secure your seat before the weekend closes admissions.',
  })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  body!: string;

  @ApiPropertyOptional({ example: 'Register Now' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(80)
  linkLabel?: string;

  @ApiPropertyOptional({ example: '/signup' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(240)
  linkHref?: string;

  @ApiPropertyOptional({
    enum: CmsAnnouncementLevel,
    default: CmsAnnouncementLevel.INFO,
  })
  @IsOptional()
  @IsEnum(CmsAnnouncementLevel)
  level?: CmsAnnouncementLevel;

  @ApiPropertyOptional({
    enum: CatalogVisibility,
    default: CatalogVisibility.PUBLIC,
  })
  @IsOptional()
  @IsEnum(CatalogVisibility)
  visibility?: CatalogVisibility;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @ApiPropertyOptional({ example: '2026-03-26T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ example: '2026-04-10T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ type: Object, example: { variant: 'inline' } })
  @IsOptional()
  @IsObject()
  metaJson?: Record<string, unknown>;
}

export class CreateCmsAnnouncementDto extends CmsAnnouncementBaseDto {}

export class UpdateCmsAnnouncementDto extends PartialType(
  CreateCmsAnnouncementDto,
) {}

class CmsSectionBaseDto {
  @ApiProperty({ enum: CmsSectionSurface })
  @IsEnum(CmsSectionSurface)
  surface!: CmsSectionSurface;

  @ApiProperty({ example: 'landing-featured-guidance' })
  @Transform(({ value }) => normalizeOptionalSlug(value))
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  @Matches(SLUG_PATTERN)
  code!: string;

  @ApiProperty({ example: 'Featured Guidance' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title!: string;

  @ApiPropertyOptional({ example: 'Start with the right guidance track.' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(240)
  subtitle?: string;

  @ApiProperty({ enum: CmsSectionType })
  @IsEnum(CmsSectionType)
  type!: CmsSectionType;

  @ApiPropertyOptional({ type: Object, example: { blocks: [] } })
  @IsOptional()
  @IsObject()
  bodyJson?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: Object,
    example: { family: 'CAREER_GUIDANCE', limit: 4 },
  })
  @IsOptional()
  @IsObject()
  configJson?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'cmag4section001' })
  @IsOptional()
  @IsString()
  imageAssetId?: string;

  @ApiPropertyOptional({
    enum: CatalogVisibility,
    default: CatalogVisibility.PUBLIC,
  })
  @IsOptional()
  @IsEnum(CatalogVisibility)
  visibility?: CatalogVisibility;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}

export class CreateCmsSectionDto extends CmsSectionBaseDto {}

export class UpdateCmsSectionDto extends PartialType(CreateCmsSectionDto) {}

export class PublishCmsRecordDto {
  @ApiPropertyOptional({ example: '2026-03-30T09:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  publishAt?: string;
}

export class ReorderCmsRecordsDto {
  @ApiProperty({ type: [String], example: ['cmag4one', 'cmag4two'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  orderedIds!: string[];
}
