import { Prisma } from '@prisma/client';
import {
  mapStudentQuestionDetail,
  questionSelect,
} from '../questions/questions.types';
import { calculateAccuracyPercent } from './practice.utils';

const taxonomySummarySelect = {
  id: true,
  code: true,
  slug: true,
  name: true,
} satisfies Prisma.ExamTrackSelect;

export const practiceSessionSummarySelect =
  Prisma.validator<Prisma.PracticeSessionSelect>()({
    id: true,
    mode: true,
    status: true,
    examTrackId: true,
    mediumId: true,
    subjectId: true,
    topicId: true,
    difficulty: true,
    questionCountTarget: true,
    configJson: true,
    servedCount: true,
    answeredCount: true,
    correctCount: true,
    wrongCount: true,
    revealedCount: true,
    startedAt: true,
    lastActivityAt: true,
    endedAt: true,
    createdAt: true,
    updatedAt: true,
    examTrack: {
      select: taxonomySummarySelect,
    },
    medium: {
      select: taxonomySummarySelect,
    },
    subject: {
      select: taxonomySummarySelect,
    },
    topic: {
      select: taxonomySummarySelect,
    },
  });

export const practiceSessionQuestionSelect =
  Prisma.validator<Prisma.PracticeSessionQuestionSelect>()({
    id: true,
    questionId: true,
    orderIndex: true,
    servedAt: true,
    latestSavedAnswerJson: true,
    lastSavedAt: true,
    answerJson: true,
    answeredAt: true,
    isCorrect: true,
    revealedAt: true,
    createdAt: true,
    updatedAt: true,
    question: {
      select: questionSelect,
    },
  });

export const practiceSessionDetailSelect =
  Prisma.validator<Prisma.PracticeSessionSelect>()({
    ...practiceSessionSummarySelect,
    practiceQuestions: {
      orderBy: [{ orderIndex: 'asc' }, { servedAt: 'asc' }],
      select: practiceSessionQuestionSelect,
    },
  });

export const subjectPracticeProgressSelect =
  Prisma.validator<Prisma.UserSubjectPracticeProgressSelect>()({
    servedCount: true,
    answeredCount: true,
    correctCount: true,
    wrongCount: true,
    revealCount: true,
    accuracyPercent: true,
    lastPracticedAt: true,
    subject: {
      select: {
        id: true,
        code: true,
        slug: true,
        name: true,
        examTrack: {
          select: taxonomySummarySelect,
        },
      },
    },
  });

export const topicPracticeProgressSelect =
  Prisma.validator<Prisma.UserTopicPracticeProgressSelect>()({
    servedCount: true,
    answeredCount: true,
    correctCount: true,
    wrongCount: true,
    revealCount: true,
    accuracyPercent: true,
    lastPracticedAt: true,
    subject: {
      select: {
        id: true,
        code: true,
        slug: true,
        name: true,
        examTrack: {
          select: taxonomySummarySelect,
        },
      },
    },
    topic: {
      select: taxonomySummarySelect,
    },
  });

export type PracticeSessionSummaryRecord = Prisma.PracticeSessionGetPayload<{
  select: typeof practiceSessionSummarySelect;
}>;

export type PracticeSessionQuestionRecord =
  Prisma.PracticeSessionQuestionGetPayload<{
    select: typeof practiceSessionQuestionSelect;
  }>;

export type PracticeSessionDetailRecord = Prisma.PracticeSessionGetPayload<{
  select: typeof practiceSessionDetailSelect;
}>;

export type SubjectPracticeProgressRecord =
  Prisma.UserSubjectPracticeProgressGetPayload<{
    select: typeof subjectPracticeProgressSelect;
  }>;

export type TopicPracticeProgressRecord =
  Prisma.UserTopicPracticeProgressGetPayload<{
    select: typeof topicPracticeProgressSelect;
  }>;

export function mapPracticeSessionSummary(
  record: PracticeSessionSummaryRecord,
) {
  return {
    id: record.id,
    mode: record.mode,
    status: record.status,
    examTrackId: record.examTrackId,
    mediumId: record.mediumId,
    subjectId: record.subjectId,
    topicId: record.topicId,
    difficulty: record.difficulty,
    questionCountTarget: record.questionCountTarget,
    configJson:
      record.configJson && typeof record.configJson === 'object'
        ? (record.configJson as Record<string, unknown>)
        : null,
    servedCount: record.servedCount,
    answeredCount: record.answeredCount,
    correctCount: record.correctCount,
    wrongCount: record.wrongCount,
    revealedCount: record.revealedCount,
    accuracyPercent: calculateAccuracyPercent(
      record.correctCount,
      record.answeredCount,
    ),
    startedAt: record.startedAt,
    lastActivityAt: record.lastActivityAt,
    endedAt: record.endedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    examTrack: record.examTrack,
    medium: record.medium,
    subject: record.subject,
    topic: record.topic,
  };
}

export function mapPracticeSessionQuestion(
  record: PracticeSessionQuestionRecord,
) {
  return {
    id: record.id,
    questionId: record.questionId,
    orderIndex: record.orderIndex,
    servedAt: record.servedAt,
    latestSavedAnswerJson:
      record.latestSavedAnswerJson &&
      typeof record.latestSavedAnswerJson === 'object'
        ? (record.latestSavedAnswerJson as Record<string, unknown>)
        : null,
    lastSavedAt: record.lastSavedAt,
    answerJson:
      record.answerJson && typeof record.answerJson === 'object'
        ? (record.answerJson as Record<string, unknown>)
        : null,
    answeredAt: record.answeredAt,
    isCorrect: record.isCorrect,
    revealedAt: record.revealedAt,
    question: mapStudentQuestionDetail(record.question),
  };
}

export function mapPracticeSessionDetail(record: PracticeSessionDetailRecord) {
  return {
    ...mapPracticeSessionSummary(record),
    questions: record.practiceQuestions.map((item) =>
      mapPracticeSessionQuestion(item),
    ),
  };
}

export function mapSubjectPracticeProgress(
  record: SubjectPracticeProgressRecord,
) {
  return {
    examTrack: record.subject.examTrack,
    subject: {
      id: record.subject.id,
      code: record.subject.code,
      slug: record.subject.slug,
      name: record.subject.name,
    },
    servedCount: record.servedCount,
    answeredCount: record.answeredCount,
    correctCount: record.correctCount,
    wrongCount: record.wrongCount,
    revealCount: record.revealCount,
    accuracyPercent: calculateAccuracyPercent(
      record.correctCount,
      record.answeredCount,
    ),
    lastPracticedAt: record.lastPracticedAt,
  };
}

export function mapTopicPracticeProgress(record: TopicPracticeProgressRecord) {
  return {
    examTrack: record.subject.examTrack,
    subject: {
      id: record.subject.id,
      code: record.subject.code,
      slug: record.subject.slug,
      name: record.subject.name,
    },
    topic: record.topic,
    servedCount: record.servedCount,
    answeredCount: record.answeredCount,
    correctCount: record.correctCount,
    wrongCount: record.wrongCount,
    revealCount: record.revealCount,
    accuracyPercent: calculateAccuracyPercent(
      record.correctCount,
      record.answeredCount,
    ),
    lastPracticedAt: record.lastPracticedAt,
  };
}
