import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PracticeMode,
  PracticeSessionStatus,
  QuestionDifficulty,
} from '@prisma/client';
import {
  QuestionExamTrackSummaryDto,
  QuestionMediumSummaryDto,
  QuestionTaxonomySummaryDto,
  StudentQuestionDetailResponseDto,
} from '../../questions/dto/question-response.dto';

export class PracticeSessionSummaryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: PracticeMode })
  mode!: PracticeMode;

  @ApiProperty({ enum: PracticeSessionStatus })
  status!: PracticeSessionStatus;

  @ApiPropertyOptional({ nullable: true })
  examTrackId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  mediumId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  subjectId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  topicId!: string | null;

  @ApiPropertyOptional({ enum: QuestionDifficulty, nullable: true })
  difficulty!: QuestionDifficulty | null;

  @ApiProperty()
  questionCountTarget!: number;

  @ApiProperty({ type: Object, nullable: true })
  configJson!: Record<string, unknown> | null;

  @ApiProperty()
  servedCount!: number;

  @ApiProperty()
  answeredCount!: number;

  @ApiProperty()
  correctCount!: number;

  @ApiProperty()
  wrongCount!: number;

  @ApiProperty()
  revealedCount!: number;

  @ApiProperty()
  accuracyPercent!: number;

  @ApiProperty()
  startedAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  lastActivityAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  endedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional({ type: QuestionExamTrackSummaryDto, nullable: true })
  examTrack!: QuestionExamTrackSummaryDto | null;

  @ApiPropertyOptional({ type: QuestionMediumSummaryDto, nullable: true })
  medium!: QuestionMediumSummaryDto | null;

  @ApiPropertyOptional({ type: QuestionTaxonomySummaryDto, nullable: true })
  subject!: QuestionTaxonomySummaryDto | null;

  @ApiPropertyOptional({ type: QuestionTaxonomySummaryDto, nullable: true })
  topic!: QuestionTaxonomySummaryDto | null;
}

export class PracticeSessionQuestionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  questionId!: string;

  @ApiProperty()
  orderIndex!: number;

  @ApiProperty()
  servedAt!: Date;

  @ApiPropertyOptional({ type: Object, nullable: true })
  latestSavedAnswerJson!: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true })
  lastSavedAt!: Date | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  answerJson!: Record<string, unknown> | null;

  @ApiPropertyOptional({ nullable: true })
  answeredAt!: Date | null;

  @ApiPropertyOptional({ nullable: true })
  isCorrect!: boolean | null;

  @ApiPropertyOptional({ nullable: true })
  revealedAt!: Date | null;

  @ApiProperty({ type: StudentQuestionDetailResponseDto })
  question!: StudentQuestionDetailResponseDto;
}

export class PracticeSessionDetailResponseDto extends PracticeSessionSummaryResponseDto {
  @ApiProperty({ type: [PracticeSessionQuestionResponseDto] })
  questions!: PracticeSessionQuestionResponseDto[];
}

export class PracticeSessionsListResponseDto {
  @ApiProperty({ type: [PracticeSessionSummaryResponseDto] })
  items!: PracticeSessionSummaryResponseDto[];

  @ApiProperty()
  total!: number;
}

export class PracticeQuestionBatchResponseDto {
  @ApiProperty({ type: PracticeSessionSummaryResponseDto })
  session!: PracticeSessionSummaryResponseDto;

  @ApiProperty({ type: [PracticeSessionQuestionResponseDto] })
  items!: PracticeSessionQuestionResponseDto[];

  @ApiProperty()
  hasMore!: boolean;
}

export class PracticeSaveResultResponseDto {
  @ApiProperty()
  questionId!: string;

  @ApiProperty({ type: Object })
  answerJson!: Record<string, unknown>;

  @ApiProperty()
  lastSavedAt!: Date;

  @ApiProperty({ type: PracticeSessionSummaryResponseDto })
  session!: PracticeSessionSummaryResponseDto;
}

export class PracticeAnswerResultResponseDto {
  @ApiProperty()
  questionId!: string;

  @ApiProperty({ type: Object })
  answerJson!: Record<string, unknown>;

  @ApiProperty()
  isCorrect!: boolean;

  @ApiProperty()
  answeredAt!: Date;

  @ApiProperty({ type: PracticeSessionSummaryResponseDto })
  session!: PracticeSessionSummaryResponseDto;
}

export class PracticeRevealResultResponseDto {
  @ApiProperty()
  questionId!: string;

  @ApiProperty()
  revealedAt!: Date;

  @ApiProperty({ type: Object })
  correctAnswerJson!: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object, nullable: true })
  explanationJson!: Record<string, unknown> | null;

  @ApiProperty({ type: PracticeSessionSummaryResponseDto })
  session!: PracticeSessionSummaryResponseDto;
}

export class PracticeSubjectProgressResponseDto {
  @ApiProperty({ type: QuestionExamTrackSummaryDto })
  examTrack!: QuestionExamTrackSummaryDto;

  @ApiProperty({ type: QuestionTaxonomySummaryDto })
  subject!: QuestionTaxonomySummaryDto;

  @ApiProperty()
  servedCount!: number;

  @ApiProperty()
  answeredCount!: number;

  @ApiProperty()
  correctCount!: number;

  @ApiProperty()
  wrongCount!: number;

  @ApiProperty()
  revealCount!: number;

  @ApiProperty()
  accuracyPercent!: number;

  @ApiPropertyOptional({ nullable: true })
  lastPracticedAt!: Date | null;
}

export class PracticeSubjectProgressListResponseDto {
  @ApiProperty({ type: [PracticeSubjectProgressResponseDto] })
  items!: PracticeSubjectProgressResponseDto[];
}

export class PracticeTopicProgressResponseDto {
  @ApiProperty({ type: QuestionExamTrackSummaryDto })
  examTrack!: QuestionExamTrackSummaryDto;

  @ApiProperty({ type: QuestionTaxonomySummaryDto })
  subject!: QuestionTaxonomySummaryDto;

  @ApiProperty({ type: QuestionTaxonomySummaryDto })
  topic!: QuestionTaxonomySummaryDto;

  @ApiProperty()
  servedCount!: number;

  @ApiProperty()
  answeredCount!: number;

  @ApiProperty()
  correctCount!: number;

  @ApiProperty()
  wrongCount!: number;

  @ApiProperty()
  revealCount!: number;

  @ApiProperty()
  accuracyPercent!: number;

  @ApiPropertyOptional({ nullable: true })
  lastPracticedAt!: Date | null;
}

export class PracticeTopicProgressListResponseDto {
  @ApiProperty({ type: [PracticeTopicProgressResponseDto] })
  items!: PracticeTopicProgressResponseDto[];
}

export class PracticeWeakQuestionResponseDto {
  @ApiProperty()
  questionId!: string;

  @ApiPropertyOptional({ nullable: true })
  code!: string | null;

  @ApiProperty({ type: Object })
  statementJson!: Record<string, unknown>;

  @ApiProperty({ enum: QuestionDifficulty })
  difficulty!: QuestionDifficulty;

  @ApiProperty({ type: QuestionExamTrackSummaryDto })
  examTrack!: QuestionExamTrackSummaryDto;

  @ApiProperty({ type: QuestionTaxonomySummaryDto })
  subject!: QuestionTaxonomySummaryDto;

  @ApiPropertyOptional({ type: QuestionTaxonomySummaryDto, nullable: true })
  topic!: QuestionTaxonomySummaryDto | null;

  @ApiProperty()
  answerCount!: number;

  @ApiProperty()
  correctCount!: number;

  @ApiProperty()
  wrongCount!: number;

  @ApiProperty()
  revealCount!: number;

  @ApiProperty()
  accuracyPercent!: number;

  @ApiPropertyOptional({ nullable: true })
  lastAnsweredAt!: Date | null;
}

export class PracticeWeakQuestionsResponseDto {
  @ApiProperty({ type: [PracticeWeakQuestionResponseDto] })
  items!: PracticeWeakQuestionResponseDto[];

  @ApiProperty()
  total!: number;
}

export class PracticeTrendPointResponseDto {
  @ApiProperty()
  date!: string;

  @ApiProperty()
  servedCount!: number;

  @ApiProperty()
  savedCount!: number;

  @ApiProperty()
  answeredCount!: number;

  @ApiProperty()
  correctCount!: number;

  @ApiProperty()
  wrongCount!: number;

  @ApiProperty()
  revealedCount!: number;
}

export class PracticeTrendsResponseDto {
  @ApiProperty()
  days!: number;

  @ApiProperty({ type: [PracticeTrendPointResponseDto] })
  items!: PracticeTrendPointResponseDto[];
}
