import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TestAccessType,
  TestAttemptStatus,
  TestFamily,
  TestStatus,
} from '@prisma/client';
import {
  QuestionExamTrackSummaryDto,
  QuestionMediumSummaryDto,
  QuestionTaxonomySummaryDto,
} from '../../questions/dto/question-response.dto';

export class TestQuestionSourceSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  code!: string | null;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  difficulty!: string;

  @ApiProperty({ type: Object })
  statementJson!: Record<string, unknown>;

  @ApiProperty({ type: QuestionExamTrackSummaryDto })
  examTrack!: QuestionExamTrackSummaryDto;

  @ApiPropertyOptional({ type: QuestionMediumSummaryDto, nullable: true })
  medium!: QuestionMediumSummaryDto | null;

  @ApiProperty({ type: QuestionTaxonomySummaryDto })
  subject!: QuestionTaxonomySummaryDto;

  @ApiPropertyOptional({ type: QuestionTaxonomySummaryDto, nullable: true })
  topic!: QuestionTaxonomySummaryDto | null;
}

export class TestQuestionDefinitionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  questionId!: string;

  @ApiProperty()
  orderIndex!: number;

  @ApiProperty()
  positiveMarks!: number;

  @ApiProperty()
  negativeMarks!: number;

  @ApiProperty({ type: TestQuestionSourceSummaryDto })
  question!: TestQuestionSourceSummaryDto;
}

export class TestAccessSummaryResponseDto {
  @ApiProperty({ enum: ['FULL', 'LOCKED'] })
  mode!: 'FULL' | 'LOCKED';

  @ApiProperty()
  canAttempt!: boolean;

  @ApiProperty()
  requiresEntitlement!: boolean;

  @ApiPropertyOptional({ nullable: true })
  reason!: string | null;
}

export class TestSummaryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  code!: string | null;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  shortDescription!: string | null;

  @ApiProperty({ enum: TestFamily })
  family!: TestFamily;

  @ApiProperty({ enum: TestAccessType })
  accessType!: TestAccessType;

  @ApiPropertyOptional({ nullable: true })
  examTrackId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  mediumId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  subjectId!: string | null;

  @ApiProperty()
  durationMinutes!: number;

  @ApiProperty()
  maxAttempts!: number;

  @ApiProperty()
  randomizeQuestionOrder!: boolean;

  @ApiProperty()
  questionCount!: number;

  @ApiProperty()
  maxScore!: number;

  @ApiPropertyOptional({ nullable: true })
  availableFrom!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  availableUntil!: Date | null;

  @ApiProperty({ enum: TestStatus })
  status!: TestStatus;

  @ApiPropertyOptional({ nullable: true })
  publishedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  archivedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty()
  isLive!: boolean;

  @ApiPropertyOptional({ type: QuestionExamTrackSummaryDto, nullable: true })
  examTrack!: QuestionExamTrackSummaryDto | null;

  @ApiPropertyOptional({ type: QuestionMediumSummaryDto, nullable: true })
  medium!: QuestionMediumSummaryDto | null;

  @ApiPropertyOptional({ type: QuestionTaxonomySummaryDto, nullable: true })
  subject!: QuestionTaxonomySummaryDto | null;

  @ApiProperty({ type: TestAccessSummaryResponseDto })
  access!: TestAccessSummaryResponseDto;
}

export class AdminTestDetailResponseDto extends TestSummaryResponseDto {
  @ApiPropertyOptional({ type: Object, nullable: true })
  instructionsJson!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  configJson!: Record<string, unknown> | null;

  @ApiProperty({ type: [TestQuestionDefinitionResponseDto] })
  questions!: TestQuestionDefinitionResponseDto[];
}

export class StudentTestDetailResponseDto extends TestSummaryResponseDto {
  @ApiPropertyOptional({ type: Object, nullable: true })
  instructionsJson!: Record<string, unknown> | null;
}

export class TestsListResponseDto {
  @ApiProperty({ type: [TestSummaryResponseDto] })
  items!: TestSummaryResponseDto[];

  @ApiProperty()
  total!: number;
}

export class TestAttemptSnapshotResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  code!: string | null;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  shortDescription!: string | null;

  @ApiProperty({ enum: TestFamily })
  family!: TestFamily;

  @ApiProperty()
  durationMinutes!: number;

  @ApiProperty()
  questionCount!: number;

  @ApiProperty()
  maxScore!: number;

  @ApiPropertyOptional({ type: QuestionExamTrackSummaryDto, nullable: true })
  examTrack!: QuestionExamTrackSummaryDto | null;

  @ApiPropertyOptional({ type: QuestionMediumSummaryDto, nullable: true })
  medium!: QuestionMediumSummaryDto | null;

  @ApiPropertyOptional({ type: QuestionTaxonomySummaryDto, nullable: true })
  subject!: QuestionTaxonomySummaryDto | null;
}

export class TestAttemptQuestionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  questionId!: string;

  @ApiProperty()
  orderIndex!: number;

  @ApiProperty({ type: Object })
  questionSnapshot!: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object, nullable: true })
  latestSavedAnswerJson!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  finalAnswerJson!: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true })
  lastSavedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  answeredAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  isCorrect!: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  awardedMarks!: number | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  correctAnswerJson!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  explanationJson!: Record<string, unknown> | null;
}

export class TestAttemptSummaryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  testId!: string;

  @ApiProperty()
  attemptNumber!: number;

  @ApiProperty({ enum: TestAttemptStatus })
  status!: TestAttemptStatus;

  @ApiProperty()
  durationMinutes!: number;

  @ApiProperty()
  questionCount!: number;

  @ApiProperty()
  answeredCount!: number;

  @ApiProperty()
  correctCount!: number;

  @ApiProperty()
  wrongCount!: number;

  @ApiProperty()
  skippedCount!: number;

  @ApiProperty()
  score!: number;

  @ApiProperty()
  maxScore!: number;

  @ApiProperty()
  percentage!: number;

  @ApiPropertyOptional({ nullable: true })
  timeTakenSeconds!: number | null;

  @ApiProperty()
  startedAt!: Date;

  @ApiProperty()
  expiresAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  lastSavedAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  submittedAt!: Date | null;

  @ApiProperty({ type: TestAttemptSnapshotResponseDto })
  testSnapshot!: TestAttemptSnapshotResponseDto;
}

export class TestAttemptDetailResponseDto extends TestAttemptSummaryResponseDto {
  @ApiPropertyOptional({ type: Object, nullable: true })
  resultSummaryJson!: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  resultBreakdownJson!: Record<string, unknown> | null;

  @ApiProperty({ type: [TestAttemptQuestionResponseDto] })
  questions!: TestAttemptQuestionResponseDto[];
}

export class TestAttemptsListResponseDto {
  @ApiProperty({ type: [TestAttemptSummaryResponseDto] })
  items!: TestAttemptSummaryResponseDto[];

  @ApiProperty()
  total!: number;
}

export class SaveTestAttemptAnswerResponseDto {
  @ApiProperty()
  questionId!: string;

  @ApiProperty({ type: Object })
  answerJson!: Record<string, unknown>;

  @ApiProperty()
  lastSavedAt!: Date;

  @ApiProperty({ type: TestAttemptSummaryResponseDto })
  attempt!: TestAttemptSummaryResponseDto;
}
