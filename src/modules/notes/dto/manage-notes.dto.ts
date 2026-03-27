import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { NoteAccessType, NoteStatus } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const SLUG_PATTERN = /^[a-z0-9-]+$/;
const MARATHI_FONT_HINT_VALUES = ['shree-dev', 'surekh'] as const;

function normalizeText(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().replace(/\s+/gu, ' ');
}

function normalizeSlug(value: unknown) {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim().toLowerCase();
}

export class CreateNoteDto {
  @ApiProperty({ example: 'Indian Polity Marathon Notes' })
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title!: string;

  @ApiPropertyOptional({ example: 'indian-polity-marathon-notes' })
  @Transform(({ value }) => normalizeSlug(value))
  @IsOptional()
  @IsString()
  @MaxLength(180)
  @Matches(SLUG_PATTERN)
  slug?: string;

  @ApiProperty({ example: 'cmag4b4ph0000x5r7snyza123' })
  @IsString()
  subjectId!: string;

  @ApiPropertyOptional({ example: 'cmag4b4ph0000x5r7snyza456' })
  @IsOptional()
  @IsString()
  mediumId?: string;

  @ApiProperty({ example: 'cmag4b4ph0000x5r7snyza999' })
  @IsString()
  fullFileAssetId!: string;

  @ApiPropertyOptional({ example: 'cmag4b4ph0000x5r7preview123' })
  @IsOptional()
  @IsString()
  previewFileAssetId?: string;

  @ApiPropertyOptional({ example: 'cmag4b4ph0000x5r7cover123' })
  @IsOptional()
  @IsString()
  coverImageAssetId?: string;

  @ApiPropertyOptional({
    example: 'Detailed PDF note for prelims and mains revision.',
  })
  @Transform(({ value }) => normalizeText(value))
  @IsOptional()
  @IsString()
  @MaxLength(400)
  shortDescription?: string;

  @ApiPropertyOptional({
    example: 'Covers constitutional history, Preamble, FRs, DPSPs, and PYQs.',
  })
  @Transform(({ value }) => normalizeText(value))
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiProperty({ enum: NoteAccessType, default: NoteAccessType.FREE })
  @IsEnum(NoteAccessType)
  accessType!: NoteAccessType;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  previewPageCount?: number;

  @ApiProperty({ example: 248 })
  @IsInt()
  @Min(1)
  pageCount!: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['cmag4topic001', 'cmag4topic002'],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  topicIds?: string[];
}

export class UpdateNoteDto extends PartialType(CreateNoteDto) {}

export class AdminListNotesQueryDto {
  @ApiPropertyOptional({ example: 'cmag4b4ph0000x5r7snyza123' })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({ example: 'cmag4topic001' })
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional({ enum: NoteStatus })
  @IsOptional()
  @IsEnum(NoteStatus)
  status?: NoteStatus;

  @ApiPropertyOptional({ enum: NoteAccessType })
  @IsOptional()
  @IsEnum(NoteAccessType)
  accessType?: NoteAccessType;

  @ApiPropertyOptional({ example: 'polity' })
  @Transform(({ value }) => normalizeText(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class ListPublishedNotesQueryDto {
  @ApiPropertyOptional({ example: 'cmag4b4ph0000x5r7snyza123' })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({ example: 'cmag4topic001' })
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional({ example: 'cmag4b4ph0000x5r7snyza456' })
  @IsOptional()
  @IsString()
  mediumId?: string;

  @ApiPropertyOptional({ example: 'marathon' })
  @Transform(({ value }) => normalizeText(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class UpdateNoteProgressDto {
  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(0)
  lastPageViewed!: number;
}

export class CreateNoteIndexEntryDto {
  @ApiPropertyOptional({ example: '1.2' })
  @Transform(({ value }) => normalizeText(value))
  @IsOptional()
  @IsString()
  @MaxLength(40)
  serialLabel?: string;

  @ApiProperty({ example: 'Fundamental Rights' })
  @Transform(({ value }) => normalizeText(value))
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  title!: string;

  @ApiPropertyOptional({ enum: MARATHI_FONT_HINT_VALUES, example: 'shree-dev' })
  @IsOptional()
  @IsString()
  @IsIn(MARATHI_FONT_HINT_VALUES)
  titleFontHint?: (typeof MARATHI_FONT_HINT_VALUES)[number];

  @ApiProperty({ example: 17 })
  @IsInt()
  @Min(1)
  pageNumber!: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  indentLevel?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}

export class UpdateNoteIndexEntryDto extends PartialType(
  CreateNoteIndexEntryDto,
) {}

export class UpsertNoteBookmarkDto {
  @ApiProperty({ example: 17 })
  @IsInt()
  @Min(1)
  pageNumber!: number;

  @ApiPropertyOptional({ example: 'Revise before test' })
  @Transform(({ value }) => normalizeText(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @ApiPropertyOptional({ example: 'cmag4index001' })
  @IsOptional()
  @IsString()
  noteIndexEntryId?: string;
}
