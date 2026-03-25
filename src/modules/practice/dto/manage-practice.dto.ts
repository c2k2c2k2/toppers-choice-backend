import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PracticeMode,
  PracticeSessionStatus,
  QuestionDifficulty,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

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

export class StartPracticeSessionDto {
  @ApiProperty({ enum: PracticeMode })
  @IsEnum(PracticeMode)
  mode!: PracticeMode;

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

  @ApiPropertyOptional({ example: 'cmag4topic001' })
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional({ enum: QuestionDifficulty })
  @IsOptional()
  @IsEnum(QuestionDifficulty)
  difficulty?: QuestionDifficulty;

  @ApiPropertyOptional({ example: 20 })
  @Transform(({ value }) => normalizeOptionalInteger(value))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  questionCount?: number;
}

export class ListPracticeSessionsQueryDto {
  @ApiPropertyOptional({ enum: PracticeSessionStatus })
  @IsOptional()
  @IsEnum(PracticeSessionStatus)
  status?: PracticeSessionStatus;

  @ApiPropertyOptional({ example: 20 })
  @Transform(({ value }) => normalizeOptionalInteger(value))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class GetNextPracticeQuestionsQueryDto {
  @ApiPropertyOptional({ example: 10 })
  @Transform(({ value }) => normalizeOptionalInteger(value))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  batchSize?: number;
}

class PracticeAnswerMutationBaseDto {
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

export class SavePracticeAnswerDto extends PracticeAnswerMutationBaseDto {}

export class SubmitPracticeAnswerDto extends PracticeAnswerMutationBaseDto {
  @ApiPropertyOptional({ example: 8200 })
  @Transform(({ value }) => normalizeOptionalInteger(value))
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3_600_000)
  responseTimeMs?: number;
}

export class RevealPracticeQuestionDto {
  @ApiProperty({ example: 'cmag4question001' })
  @IsString()
  questionId!: string;
}

export class EndPracticeSessionDto {
  @ApiPropertyOptional({ example: false })
  @Transform(({ value }) => normalizeOptionalBoolean(value))
  @IsOptional()
  @IsBoolean()
  abandon?: boolean;
}

export class ListSubjectPracticeProgressQueryDto {
  @ApiPropertyOptional({ example: 'cmag4track001' })
  @IsOptional()
  @IsString()
  examTrackId?: string;
}

export class ListTopicPracticeProgressQueryDto {
  @ApiPropertyOptional({ example: 'cmag4track001' })
  @IsOptional()
  @IsString()
  examTrackId?: string;

  @ApiPropertyOptional({ example: 'cmag4subject001' })
  @IsOptional()
  @IsString()
  subjectId?: string;
}

export class ListWeakPracticeQuestionsQueryDto {
  @ApiPropertyOptional({ example: 'cmag4subject001' })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({ example: 'cmag4topic001' })
  @IsOptional()
  @IsString()
  topicId?: string;

  @ApiPropertyOptional({ example: 20 })
  @Transform(({ value }) => normalizeOptionalInteger(value))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ListPracticeTrendsQueryDto {
  @ApiPropertyOptional({ example: 7 })
  @Transform(({ value }) => normalizeOptionalInteger(value))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  days?: number;
}
