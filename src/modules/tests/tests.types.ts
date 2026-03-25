import {
  Prisma,
  QuestionDifficulty,
  QuestionType,
  TestAccessType,
} from '@prisma/client';
import { isTestLive } from './tests.utils';

const taxonomySummarySelect = {
  id: true,
  code: true,
  slug: true,
  name: true,
} satisfies Prisma.ExamTrackSelect;

export const testQuestionSourceSelect =
  Prisma.validator<Prisma.QuestionSelect>()({
    id: true,
    code: true,
    type: true,
    difficulty: true,
    statementJson: true,
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
    medium: {
      select: taxonomySummarySelect,
    },
    topic: {
      select: taxonomySummarySelect,
    },
  });

export const testQuestionSelect = Prisma.validator<Prisma.TestQuestionSelect>()(
  {
    id: true,
    questionId: true,
    orderIndex: true,
    positiveMarks: true,
    negativeMarks: true,
    question: {
      select: testQuestionSourceSelect,
    },
  },
);

export const testSummarySelect = Prisma.validator<Prisma.TestSelect>()({
  id: true,
  code: true,
  slug: true,
  title: true,
  shortDescription: true,
  instructionsJson: true,
  configJson: true,
  family: true,
  accessType: true,
  examTrackId: true,
  mediumId: true,
  subjectId: true,
  durationMinutes: true,
  maxAttempts: true,
  randomizeQuestionOrder: true,
  questionCount: true,
  maxScore: true,
  availableFrom: true,
  availableUntil: true,
  status: true,
  publishedAt: true,
  archivedAt: true,
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
});

export const testDetailSelect = Prisma.validator<Prisma.TestSelect>()({
  ...testSummarySelect,
  questions: {
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    select: testQuestionSelect,
  },
});

export const testAttemptQuestionSelect =
  Prisma.validator<Prisma.TestAttemptQuestionSelect>()({
    id: true,
    questionId: true,
    orderIndex: true,
    questionCodeSnapshot: true,
    questionTypeSnapshot: true,
    difficultySnapshot: true,
    examTrackIdSnapshot: true,
    mediumIdSnapshot: true,
    subjectIdSnapshot: true,
    topicIdSnapshot: true,
    positiveMarks: true,
    negativeMarks: true,
    questionSnapshotJson: true,
    latestSavedAnswerJson: true,
    finalAnswerJson: true,
    lastSavedAt: true,
    answeredAt: true,
    isCorrect: true,
    awardedMarks: true,
    correctAnswerJson: true,
    explanationJson: true,
  });

export const testAttemptSummarySelect =
  Prisma.validator<Prisma.TestAttemptSelect>()({
    id: true,
    testId: true,
    attemptNumber: true,
    status: true,
    durationMinutes: true,
    questionCount: true,
    answeredCount: true,
    correctCount: true,
    wrongCount: true,
    skippedCount: true,
    score: true,
    maxScore: true,
    percentage: true,
    timeTakenSeconds: true,
    startedAt: true,
    expiresAt: true,
    lastSavedAt: true,
    submittedAt: true,
    testSnapshotJson: true,
  });

export const testAttemptDetailSelect =
  Prisma.validator<Prisma.TestAttemptSelect>()({
    ...testAttemptSummarySelect,
    resultSummaryJson: true,
    resultBreakdownJson: true,
    questions: {
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      select: testAttemptQuestionSelect,
    },
  });

export type TestSummaryRecord = Prisma.TestGetPayload<{
  select: typeof testSummarySelect;
}>;

export type TestDetailRecord = Prisma.TestGetPayload<{
  select: typeof testDetailSelect;
}>;

export type TestAttemptSummaryRecord = Prisma.TestAttemptGetPayload<{
  select: typeof testAttemptSummarySelect;
}>;

export type TestAttemptDetailRecord = Prisma.TestAttemptGetPayload<{
  select: typeof testAttemptDetailSelect;
}>;

export type TestAccessSummary = {
  mode: 'FULL' | 'LOCKED';
  canAttempt: boolean;
  requiresEntitlement: boolean;
  reason: string | null;
};

function asRecord(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function parseAttemptSnapshot(value: Prisma.JsonValue) {
  return (asRecord(value) ?? {}) as {
    id?: string;
    code?: string | null;
    slug?: string;
    title?: string;
    shortDescription?: string | null;
    family?: string;
    durationMinutes?: number;
    questionCount?: number;
    maxScore?: number;
    examTrack?: Record<string, unknown> | null;
    medium?: Record<string, unknown> | null;
    subject?: Record<string, unknown> | null;
  };
}

export function mapTestSummary(
  record: TestSummaryRecord,
  access: TestAccessSummary = getAdminTestAccessSummary(),
) {
  return {
    id: record.id,
    code: record.code,
    slug: record.slug,
    title: record.title,
    shortDescription: record.shortDescription,
    family: record.family,
    accessType: record.accessType,
    examTrackId: record.examTrackId,
    mediumId: record.mediumId,
    subjectId: record.subjectId,
    durationMinutes: record.durationMinutes,
    maxAttempts: record.maxAttempts,
    randomizeQuestionOrder: record.randomizeQuestionOrder,
    questionCount: record.questionCount,
    maxScore: record.maxScore,
    availableFrom: record.availableFrom,
    availableUntil: record.availableUntil,
    status: record.status,
    publishedAt: record.publishedAt,
    archivedAt: record.archivedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    isLive: isTestLive(
      record.status,
      record.publishedAt,
      record.availableFrom,
      record.availableUntil,
    ),
    examTrack: record.examTrack,
    medium: record.medium,
    subject: record.subject,
    access,
  };
}

export function mapAdminTestDetail(record: TestDetailRecord) {
  return {
    ...mapTestSummary(record, getAdminTestAccessSummary()),
    instructionsJson: asRecord(record.instructionsJson),
    configJson: asRecord(record.configJson),
    questions: record.questions.map((item) => ({
      id: item.id,
      questionId: item.questionId,
      orderIndex: item.orderIndex,
      positiveMarks: item.positiveMarks,
      negativeMarks: item.negativeMarks,
      question: {
        id: item.question.id,
        code: item.question.code,
        type: item.question.type,
        difficulty: item.question.difficulty,
        statementJson: item.question.statementJson,
        examTrack: item.question.subject.examTrack,
        medium: item.question.medium,
        subject: {
          id: item.question.subject.id,
          code: item.question.subject.code,
          slug: item.question.subject.slug,
          name: item.question.subject.name,
        },
        topic: item.question.topic,
      },
    })),
  };
}

export function mapStudentTestDetail(
  record: TestSummaryRecord,
  access: TestAccessSummary,
) {
  return {
    ...mapTestSummary(record, access),
    instructionsJson: asRecord(record.instructionsJson),
  };
}

export function getAdminTestAccessSummary(): TestAccessSummary {
  return {
    mode: 'FULL',
    canAttempt: true,
    requiresEntitlement: false,
    reason: null,
  };
}

export function getFreeTestAccessSummary(): TestAccessSummary {
  return {
    mode: 'FULL',
    canAttempt: true,
    requiresEntitlement: false,
    reason: null,
  };
}

export function getPremiumTestAccessSummary(
  allowed: boolean,
  reason: string | null,
): TestAccessSummary {
  return {
    mode: allowed ? 'FULL' : 'LOCKED',
    canAttempt: allowed,
    requiresEntitlement: true,
    reason: allowed ? null : reason,
  };
}

export function mapTestAttemptSummary(record: TestAttemptSummaryRecord) {
  const snapshot = parseAttemptSnapshot(record.testSnapshotJson);

  return {
    id: record.id,
    testId: record.testId,
    attemptNumber: record.attemptNumber,
    status: record.status,
    durationMinutes: record.durationMinutes,
    questionCount: record.questionCount,
    answeredCount: record.answeredCount,
    correctCount: record.correctCount,
    wrongCount: record.wrongCount,
    skippedCount: record.skippedCount,
    score: record.score,
    maxScore: record.maxScore,
    percentage: record.percentage,
    timeTakenSeconds: record.timeTakenSeconds,
    startedAt: record.startedAt,
    expiresAt: record.expiresAt,
    lastSavedAt: record.lastSavedAt,
    submittedAt: record.submittedAt,
    testSnapshot: {
      id: snapshot.id ?? record.testId,
      code: snapshot.code ?? null,
      slug: snapshot.slug ?? '',
      title: snapshot.title ?? '',
      shortDescription: snapshot.shortDescription ?? null,
      family: snapshot.family ?? 'MIXED',
      durationMinutes: snapshot.durationMinutes ?? record.durationMinutes,
      questionCount: snapshot.questionCount ?? record.questionCount,
      maxScore: snapshot.maxScore ?? record.maxScore,
      examTrack: snapshot.examTrack ?? null,
      medium: snapshot.medium ?? null,
      subject: snapshot.subject ?? null,
    },
  };
}

export function mapTestAttemptQuestion(
  record: TestAttemptDetailRecord['questions'][number],
  revealReview: boolean,
) {
  return {
    id: record.id,
    questionId: record.questionId,
    orderIndex: record.orderIndex,
    questionSnapshot: asRecord(record.questionSnapshotJson) ?? {},
    latestSavedAnswerJson: asRecord(record.latestSavedAnswerJson),
    finalAnswerJson: asRecord(record.finalAnswerJson),
    lastSavedAt: record.lastSavedAt,
    answeredAt: record.answeredAt,
    isCorrect: revealReview ? record.isCorrect : null,
    awardedMarks: revealReview ? record.awardedMarks : null,
    correctAnswerJson: revealReview ? asRecord(record.correctAnswerJson) : null,
    explanationJson: revealReview ? asRecord(record.explanationJson) : null,
  };
}

export function mapTestAttemptDetail(record: TestAttemptDetailRecord) {
  const revealReview = record.status !== 'ACTIVE';

  return {
    ...mapTestAttemptSummary(record),
    resultSummaryJson: asRecord(record.resultSummaryJson),
    resultBreakdownJson: asRecord(record.resultBreakdownJson),
    questions: record.questions.map((item) =>
      mapTestAttemptQuestion(item, revealReview),
    ),
  };
}

export type TestAttemptQuestionSnapshot = {
  id: string;
  code: string | null;
  type: QuestionType;
  difficulty: QuestionDifficulty;
  statementJson: Record<string, unknown>;
  metadataJson: Record<string, unknown> | null;
  options: unknown[];
  mediaReferences: unknown[];
  examTrack: Record<string, unknown>;
  medium: Record<string, unknown> | null;
  subject: Record<string, unknown>;
  topic: Record<string, unknown> | null;
};
