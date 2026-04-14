import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FileAssetAccess,
  FileAssetPurpose,
  FileAssetStatus,
  QuestionDifficulty,
  QuestionMediaUsage,
  QuestionStatus,
  QuestionType,
} from '@prisma/client';

export class QuestionTaxonomySummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;
}

export class QuestionExamTrackSummaryDto extends QuestionTaxonomySummaryDto {}

export class QuestionMediumSummaryDto extends QuestionTaxonomySummaryDto {}

export class QuestionAssetSummaryDto {
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

export class QuestionOptionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  optionKey!: string;

  @ApiProperty()
  orderIndex!: number;

  @ApiProperty({ type: Object })
  contentJson!: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object, nullable: true })
  metaJson!: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class QuestionMediaReferenceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  fileAssetId!: string;

  @ApiProperty({ enum: QuestionMediaUsage })
  usage!: QuestionMediaUsage;

  @ApiPropertyOptional({ nullable: true })
  optionKey!: string | null;

  @ApiPropertyOptional({ nullable: true })
  localeCode!: string | null;

  @ApiProperty()
  orderIndex!: number;

  @ApiPropertyOptional({ nullable: true })
  createdAt?: Date;

  @ApiPropertyOptional({ nullable: true })
  updatedAt?: Date;

  @ApiProperty({ type: QuestionAssetSummaryDto })
  fileAsset!: QuestionAssetSummaryDto;
}

export class QuestionSummaryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  siteId!: string;

  @ApiPropertyOptional({ nullable: true })
  code!: string | null;

  @ApiPropertyOptional({ nullable: true })
  mediumId!: string | null;

  @ApiProperty()
  subjectId!: string;

  @ApiPropertyOptional({ nullable: true })
  topicId!: string | null;

  @ApiProperty()
  examTrackId!: string;

  @ApiProperty({ enum: QuestionType })
  type!: QuestionType;

  @ApiProperty({ enum: QuestionDifficulty })
  difficulty!: QuestionDifficulty;

  @ApiProperty({
    example:
      'Who presided over the Constituent Assembly while the Constitution was being drafted?',
  })
  statementPreviewText!: string;

  @ApiProperty()
  hasMedia!: boolean;

  @ApiProperty({ enum: QuestionStatus })
  status!: QuestionStatus;

  @ApiPropertyOptional({ nullable: true })
  publishedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  archivedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  optionCount!: number;

  @ApiProperty({ type: QuestionExamTrackSummaryDto })
  examTrack!: QuestionExamTrackSummaryDto;

  @ApiPropertyOptional({ type: QuestionMediumSummaryDto, nullable: true })
  medium!: QuestionMediumSummaryDto | null;

  @ApiProperty({ type: QuestionTaxonomySummaryDto })
  subject!: QuestionTaxonomySummaryDto;

  @ApiPropertyOptional({ type: QuestionTaxonomySummaryDto, nullable: true })
  topic!: QuestionTaxonomySummaryDto | null;
}

export class AdminQuestionDetailResponseDto extends QuestionSummaryResponseDto {
  @ApiProperty({ type: Object })
  statementJson!: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object, nullable: true })
  explanationJson!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  metadataJson!: Record<string, unknown> | null;

  @ApiProperty({ type: Object })
  correctAnswerJson!: Record<string, unknown>;

  @ApiProperty({ type: [QuestionOptionResponseDto] })
  options!: QuestionOptionResponseDto[];

  @ApiProperty({ type: [QuestionMediaReferenceResponseDto] })
  mediaReferences!: QuestionMediaReferenceResponseDto[];
}

export class StudentQuestionDetailResponseDto extends QuestionSummaryResponseDto {
  @ApiProperty({ type: Object })
  statementJson!: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object, nullable: true })
  metadataJson!: Record<string, unknown> | null;

  @ApiProperty({ type: [QuestionOptionResponseDto] })
  options!: QuestionOptionResponseDto[];

  @ApiProperty({ type: [QuestionMediaReferenceResponseDto] })
  mediaReferences!: QuestionMediaReferenceResponseDto[];
}

export class QuestionsListResponseDto {
  @ApiProperty({ type: [QuestionSummaryResponseDto] })
  items!: QuestionSummaryResponseDto[];

  @ApiProperty()
  total!: number;
}
