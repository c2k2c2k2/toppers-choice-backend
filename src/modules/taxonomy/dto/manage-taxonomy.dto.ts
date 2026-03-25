import { Transform } from 'class-transformer';
import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
} from '@nestjs/swagger';
import { CatalogVisibility } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
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

class TaxonomyMutationBaseDto {
  @ApiProperty({ example: 'MPSC' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'mpsc' })
  @Transform(({ value }) => normalizeOptionalSlug(value))
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(SLUG_PATTERN)
  code?: string;

  @ApiPropertyOptional({ example: 'mpsc' })
  @Transform(({ value }) => normalizeOptionalSlug(value))
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Matches(SLUG_PATTERN)
  slug?: string;

  @ApiPropertyOptional({
    example: 'Maharashtra Public Service Commission exam catalog.',
  })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ enum: CatalogVisibility, default: CatalogVisibility.PUBLIC })
  @IsOptional()
  @IsEnum(CatalogVisibility)
  visibility?: CatalogVisibility;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  isActive?: boolean;
}

export class CreateExamTrackDto extends TaxonomyMutationBaseDto {
  @ApiPropertyOptional({ example: 'MPSC' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(40)
  shortName?: string;
}

export class UpdateExamTrackDto extends PartialType(CreateExamTrackDto) {}

export class CreateMediumDto extends TaxonomyMutationBaseDto {}

export class UpdateMediumDto extends PartialType(CreateMediumDto) {}

export class CreateSubjectDto extends TaxonomyMutationBaseDto {
  @ApiProperty({ example: 'cmag4b4ph0000x5r7snyza123' })
  @IsString()
  examTrackId!: string;
}

export class UpdateSubjectDto extends PartialType(CreateSubjectDto) {}

export class CreateTopicDto extends TaxonomyMutationBaseDto {
  @ApiProperty({ example: 'cmag4b4ph0000x5r7snyza123' })
  @IsString()
  subjectId!: string;

  @ApiPropertyOptional({ example: 'cmag4b4ph0000x5r7snyza999' })
  @IsOptional()
  @IsString()
  parentId?: string | null;
}

export class UpdateTopicDto extends PartialType(CreateTopicDto) {}

export class CreateTagDto extends TaxonomyMutationBaseDto {}

export class UpdateTagDto extends PartialType(CreateTagDto) {}

export class ReorderTaxonomyDto {
  @ApiProperty({
    type: [String],
    example: ['cmag4b4ph0000x5r7snyza111', 'cmag4b4ph0000x5r7snyza222'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderedIds!: string[];
}

export class ResolvePublicCatalogQueryDto {
  @ApiPropertyOptional({ example: 'toppers-choice' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsString()
  @Matches(SLUG_PATTERN)
  siteCode?: string;
}

export class ListSubjectsQueryDto {
  @ApiPropertyOptional({ example: 'cmag4b4ph0000x5r7snyza123' })
  @IsOptional()
  @IsString()
  examTrackId?: string;
}

export class ListTopicsQueryDto {
  @ApiPropertyOptional({ example: 'cmag4b4ph0000x5r7snyza123' })
  @IsOptional()
  @IsString()
  subjectId?: string;
}
