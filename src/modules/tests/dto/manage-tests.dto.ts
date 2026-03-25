import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  TestAccessType,
  TestAttemptStatus,
  TestFamily,
  TestStatus,
} from '@prisma/client';
import {
  normalizeOptionalCode,
  normalizeOptionalText,
  slugifyTestValue,
  TEST_CODE_PATTERN,
} from '../tests.utils';

function normalizeOptionalInteger(value: unknown) {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }

  return value;
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

export class TestQuestionInputDto {
  @ApiProperty({ example: 'cmag4question001' })
  @IsString()
  questionId!: string;

  @ApiPropertyOptional({ example: 10 })
  @Transform(({ value }) => normalizeOptionalInteger(value))
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @ApiPropertyOptional({ example: 2 })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length > 0
      ? Number(value)
      : value,
  )
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  positiveMarks?: number;

  @ApiPropertyOptional({ example: 0.5 })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length > 0
      ? Number(value)
      : value,
  )
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  negativeMarks?: number;
}

class TestMutationBaseDto {
  @ApiPropertyOptional({ example: 'mpsc-mock-1' })
  @Transform(({ value }) => normalizeOptionalCode(value))
  @IsOptional()
  @IsString()
  @Matches(TEST_CODE_PATTERN)
  @MaxLength(80)
  code?: string;

  @ApiPropertyOptional({ example: 'mpsc-prelims-mock-test-1' })
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim().length > 0
      ? slugifyTestValue(value)
      : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;

  @ApiProperty({ example: 'MPSC Prelims Mock Test 1' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsString()
  @MaxLength(180)
  title!: string;

  @ApiPropertyOptional({
    example: 'Full-length mixed test for MPSC prelims preparation.',
  })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string;

  @ApiPropertyOptional({
    type: Object,
    example: {
      'mr-IN': {
        blocks: [{ type: 'paragraph', text: 'प्रथम सोपे प्रश्न सोडवा.' }],
      },
    },
  })
  @IsOptional()
  @IsObject()
  instructionsJson?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: Object,
    example: {
      ui: { showQuestionPalette: true },
    },
  })
  @IsOptional()
  @IsObject()
  configJson?: Record<string, unknown>;

  @ApiProperty({ enum: TestFamily })
  @IsEnum(TestFamily)
  family!: TestFamily;

  @ApiPropertyOptional({ enum: TestAccessType, default: TestAccessType.FREE })
  @IsOptional()
  @IsEnum(TestAccessType)
  accessType?: TestAccessType;

  @ApiPropertyOptional({ example: 'cmag4track001' })
  @IsOptional()
  @IsString()
  examTrackId?: string;

  @ApiPropertyOptional({ example: 'cmag4medium001' })
  @IsOptional()
  @IsString()
  mediumId?: string;

  @ApiPropertyOptional({ example: 'cmag4subject001' })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiProperty({ example: 90 })
  @Transform(({ value }) => normalizeOptionalInteger(value))
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes!: number;

  @ApiPropertyOptional({ example: 1 })
  @Transform(({ value }) => normalizeOptionalInteger(value))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxAttempts?: number;

  @ApiPropertyOptional({ example: false })
  @Transform(({ value }) => normalizeOptionalBoolean(value))
  @IsOptional()
  @IsBoolean()
  randomizeQuestionOrder?: boolean;

  @ApiPropertyOptional({ example: '2026-03-26T09:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  availableFrom?: string;

  @ApiPropertyOptional({ example: '2026-03-31T18:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  availableUntil?: string;

  @ApiProperty({ type: [TestQuestionInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestQuestionInputDto)
  @ArrayMinSize(1)
  @ArrayUnique((item: TestQuestionInputDto) => item.questionId)
  questions!: TestQuestionInputDto[];
}

export class CreateTestDto extends TestMutationBaseDto {}

export class UpdateTestDto extends PartialType(CreateTestDto) {}

export class ListAdminTestsQueryDto {
  @ApiPropertyOptional({ enum: TestFamily })
  @IsOptional()
  @IsEnum(TestFamily)
  family?: TestFamily;

  @ApiPropertyOptional({ enum: TestStatus })
  @IsOptional()
  @IsEnum(TestStatus)
  status?: TestStatus;

  @ApiPropertyOptional({ example: 'cmag4track001' })
  @IsOptional()
  @IsString()
  examTrackId?: string;

  @ApiPropertyOptional({ example: 'cmag4medium001' })
  @IsOptional()
  @IsString()
  mediumId?: string;

  @ApiPropertyOptional({ example: 'cmag4subject001' })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({ example: 'mock test 1' })
  @Transform(({ value }) => normalizeOptionalText(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}

export class ListPublishedTestsQueryDto {
  @ApiPropertyOptional({ enum: TestFamily })
  @IsOptional()
  @IsEnum(TestFamily)
  family?: TestFamily;

  @ApiPropertyOptional({ enum: TestAccessType })
  @IsOptional()
  @IsEnum(TestAccessType)
  accessType?: TestAccessType;

  @ApiPropertyOptional({ example: 'cmag4track001' })
  @IsOptional()
  @IsString()
  examTrackId?: string;

  @ApiPropertyOptional({ example: 'cmag4medium001' })
  @IsOptional()
  @IsString()
  mediumId?: string;

  @ApiPropertyOptional({ example: 'cmag4subject001' })
  @IsOptional()
  @IsString()
  subjectId?: string;
}

export class ListTestAttemptsQueryDto {
  @ApiPropertyOptional({ example: 'cmag4test001' })
  @IsOptional()
  @IsString()
  testId?: string;

  @ApiPropertyOptional({ enum: TestAttemptStatus })
  @IsOptional()
  @IsEnum(TestAttemptStatus)
  status?: TestAttemptStatus;

  @ApiPropertyOptional({ example: 20 })
  @Transform(({ value }) => normalizeOptionalInteger(value))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class SaveTestAttemptAnswerDto {
  @ApiProperty({ example: 'cmag4question001' })
  @IsString()
  questionId!: string;

  @ApiProperty({
    type: Object,
    example: {
      optionKeys: ['B'],
    },
  })
  @IsObject()
  answerJson!: Record<string, unknown>;
}
