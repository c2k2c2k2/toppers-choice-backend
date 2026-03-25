import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  QuestionDifficulty,
  QuestionMediaUsage,
  QuestionStatus,
  QuestionType,
} from '@prisma/client';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
  IsInt,
} from 'class-validator';
import {
  normalizeOptionKey,
  normalizeOptionalCode,
  QUESTION_CODE_PATTERN,
  OPTION_KEY_PATTERN,
  normalizeOptionalText,
} from '../questions.utils';

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

export class QuestionOptionInputDto {
  @ApiProperty({ example: 'A' })
  @Transform(({ value }) => normalizeOptionKey(value))
  @IsString()
  @Matches(OPTION_KEY_PATTERN)
  @MaxLength(24)
  optionKey!: string;

  @ApiProperty({
    type: Object,
    example: {
      'mr-IN': {
        blocks: [{ type: 'paragraph', text: 'दिल्ली' }],
      },
    },
  })
  @IsObject()
  contentJson!: Record<string, unknown>;

  @ApiPropertyOptional({
    type: Object,
    example: { remark: 'capital-city option' },
  })
  @IsOptional()
  @IsObject()
  metaJson?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}

export class QuestionMediaReferenceInputDto {
  @ApiProperty({ example: 'cmag4questionasset001' })
  @IsString()
  fileAssetId!: string;

  @ApiProperty({ enum: QuestionMediaUsage })
  @IsEnum(QuestionMediaUsage)
  usage!: QuestionMediaUsage;

  @ApiPropertyOptional({ example: 'A' })
  @Transform(({ value }) => normalizeOptionKey(value))
  @IsOptional()
  @IsString()
  @Matches(OPTION_KEY_PATTERN)
  @MaxLength(24)
  optionKey?: string;

  @ApiPropertyOptional({ example: 'mr-IN' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(20)
  localeCode?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}

class QuestionMutationBaseDto {
  @ApiPropertyOptional({ example: 'geo-2026-0001' })
  @Transform(({ value }) => normalizeOptionalCode(value))
  @IsOptional()
  @IsString()
  @Matches(QUESTION_CODE_PATTERN)
  @MaxLength(80)
  code?: string;

  @ApiPropertyOptional({ example: 'cmag4medium001' })
  @IsOptional()
  @IsString()
  mediumId?: string;

  @ApiProperty({ example: 'cmag4subject001' })
  @IsString()
  subjectId!: string;

  @ApiPropertyOptional({ example: 'cmag4topic001' })
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiProperty({ enum: QuestionType })
  @IsEnum(QuestionType)
  type!: QuestionType;

  @ApiPropertyOptional({
    enum: QuestionDifficulty,
    default: QuestionDifficulty.MEDIUM,
  })
  @IsOptional()
  @IsEnum(QuestionDifficulty)
  difficulty?: QuestionDifficulty;

  @ApiProperty({
    type: Object,
    example: {
      'mr-IN': {
        blocks: [{ type: 'paragraph', text: 'भारताची राजधानी कोणती?' }],
      },
      'en-IN': {
        blocks: [{ type: 'paragraph', text: 'What is the capital of India?' }],
      },
    },
  })
  @IsObject()
  statementJson!: Record<string, unknown>;

  @ApiPropertyOptional({
    type: Object,
    example: {
      'mr-IN': {
        blocks: [{ type: 'paragraph', text: 'दिल्ली ही भारताची राजधानी आहे.' }],
      },
    },
  })
  @IsOptional()
  @IsObject()
  explanationJson?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: Object,
    example: { source: '2025 MPSC prelims', marks: 1 },
  })
  @IsOptional()
  @IsObject()
  metadataJson?: Record<string, unknown>;

  @ApiProperty({
    type: Object,
    example: { optionKeys: ['B'] },
    description:
      'For SINGLE_CHOICE/MULTIPLE_CHOICE use optionKeys. For TEXT_INPUT use acceptedAnswers.',
  })
  @IsObject()
  correctAnswerJson!: Record<string, unknown>;

  @ApiPropertyOptional({
    type: [QuestionOptionInputDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionInputDto)
  @ArrayUnique((item: QuestionOptionInputDto) => item.optionKey)
  options?: QuestionOptionInputDto[];

  @ApiPropertyOptional({
    type: [QuestionMediaReferenceInputDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionMediaReferenceInputDto)
  mediaReferences?: QuestionMediaReferenceInputDto[];
}

export class CreateQuestionDto extends QuestionMutationBaseDto {}

export class UpdateQuestionDto extends PartialType(CreateQuestionDto) {}

export class ListAdminQuestionsQueryDto {
  @ApiPropertyOptional({ example: 'cmag4subject001' })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({ example: 'cmag4topic001' })
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional({ example: 'cmag4medium001' })
  @IsOptional()
  @IsString()
  mediumId?: string;

  @ApiPropertyOptional({ example: 'cmag4track001' })
  @IsOptional()
  @IsString()
  examTrackId?: string;

  @ApiPropertyOptional({ enum: QuestionType })
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @ApiPropertyOptional({ enum: QuestionDifficulty })
  @IsOptional()
  @IsEnum(QuestionDifficulty)
  difficulty?: QuestionDifficulty;

  @ApiPropertyOptional({ enum: QuestionStatus })
  @IsOptional()
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;

  @ApiPropertyOptional({ example: true })
  @Transform(({ value }) => normalizeOptionalBoolean(value))
  @IsOptional()
  @IsBoolean()
  hasMedia?: boolean;

  @ApiPropertyOptional({ example: 'geo-2026' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class ListQuestionsQueryDto {
  @ApiPropertyOptional({ example: 'cmag4subject001' })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({ example: 'cmag4topic001' })
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional({ example: 'cmag4medium001' })
  @IsOptional()
  @IsString()
  mediumId?: string;

  @ApiPropertyOptional({ example: 'cmag4track001' })
  @IsOptional()
  @IsString()
  examTrackId?: string;

  @ApiPropertyOptional({ enum: QuestionType })
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @ApiPropertyOptional({ enum: QuestionDifficulty })
  @IsOptional()
  @IsEnum(QuestionDifficulty)
  difficulty?: QuestionDifficulty;

  @ApiPropertyOptional({ example: true })
  @Transform(({ value }) => normalizeOptionalBoolean(value))
  @IsOptional()
  @IsBoolean()
  hasMedia?: boolean;

  @ApiPropertyOptional({ example: 'capital' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
