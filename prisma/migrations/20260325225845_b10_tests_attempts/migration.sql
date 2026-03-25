-- CreateEnum
CREATE TYPE "TestFamily" AS ENUM ('SUBJECT_WISE', 'MIXED', 'EXAM_STYLE');

-- CreateEnum
CREATE TYPE "TestStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TestAttemptStatus" AS ENUM ('ACTIVE', 'SUBMITTED', 'AUTO_SUBMITTED');

-- CreateTable
CREATE TABLE "tests" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "code" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT,
    "instructionsJson" JSONB,
    "configJson" JSONB,
    "family" "TestFamily" NOT NULL,
    "examTrackId" TEXT,
    "mediumId" TEXT,
    "subjectId" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "maxAttempts" INTEGER NOT NULL DEFAULT 1,
    "randomizeQuestionOrder" BOOLEAN NOT NULL DEFAULT false,
    "questionCount" INTEGER NOT NULL DEFAULT 0,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "availableFrom" TIMESTAMP(3),
    "availableUntil" TIMESTAMP(3),
    "status" "TestStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_questions" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "positiveMarks" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "negativeMarks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_attempts" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authSessionId" TEXT,
    "attemptNumber" INTEGER NOT NULL,
    "status" "TestAttemptStatus" NOT NULL DEFAULT 'ACTIVE',
    "testSnapshotJson" JSONB NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "answeredCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "percentage" INTEGER NOT NULL DEFAULT 0,
    "timeTakenSeconds" INTEGER,
    "resultSummaryJson" JSONB,
    "resultBreakdownJson" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSavedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_attempt_questions" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "testAttemptId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "questionCodeSnapshot" TEXT,
    "questionTypeSnapshot" "QuestionType" NOT NULL,
    "difficultySnapshot" "QuestionDifficulty" NOT NULL,
    "examTrackIdSnapshot" TEXT NOT NULL,
    "mediumIdSnapshot" TEXT,
    "subjectIdSnapshot" TEXT NOT NULL,
    "topicIdSnapshot" TEXT,
    "positiveMarks" DOUBLE PRECISION NOT NULL,
    "negativeMarks" DOUBLE PRECISION NOT NULL,
    "questionSnapshotJson" JSONB NOT NULL,
    "correctAnswerJson" JSONB NOT NULL,
    "explanationJson" JSONB,
    "latestSavedAnswerJson" JSONB,
    "finalAnswerJson" JSONB,
    "lastSavedAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "isCorrect" BOOLEAN,
    "awardedMarks" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "test_attempt_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tests_siteId_family_status_publishedAt_idx" ON "tests"("siteId", "family", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "tests_siteId_subjectId_status_publishedAt_idx" ON "tests"("siteId", "subjectId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "tests_siteId_examTrackId_status_publishedAt_idx" ON "tests"("siteId", "examTrackId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "tests_siteId_availableFrom_availableUntil_status_idx" ON "tests"("siteId", "availableFrom", "availableUntil", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tests_siteId_code_key" ON "tests"("siteId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "tests_siteId_slug_key" ON "tests"("siteId", "slug");

-- CreateIndex
CREATE INDEX "test_questions_siteId_questionId_idx" ON "test_questions"("siteId", "questionId");

-- CreateIndex
CREATE INDEX "test_questions_testId_orderIndex_idx" ON "test_questions"("testId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "test_questions_testId_questionId_key" ON "test_questions"("testId", "questionId");

-- CreateIndex
CREATE INDEX "test_attempts_siteId_userId_startedAt_idx" ON "test_attempts"("siteId", "userId", "startedAt");

-- CreateIndex
CREATE INDEX "test_attempts_siteId_testId_status_startedAt_idx" ON "test_attempts"("siteId", "testId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "test_attempts_siteId_userId_status_expiresAt_idx" ON "test_attempts"("siteId", "userId", "status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "test_attempts_testId_userId_attemptNumber_key" ON "test_attempts"("testId", "userId", "attemptNumber");

-- CreateIndex
CREATE INDEX "test_attempt_questions_siteId_questionId_idx" ON "test_attempt_questions"("siteId", "questionId");

-- CreateIndex
CREATE INDEX "test_attempt_questions_siteId_subjectIdSnapshot_idx" ON "test_attempt_questions"("siteId", "subjectIdSnapshot");

-- CreateIndex
CREATE INDEX "test_attempt_questions_siteId_topicIdSnapshot_idx" ON "test_attempt_questions"("siteId", "topicIdSnapshot");

-- CreateIndex
CREATE INDEX "test_attempt_questions_testAttemptId_orderIndex_idx" ON "test_attempt_questions"("testAttemptId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "test_attempt_questions_testAttemptId_questionId_key" ON "test_attempt_questions"("testAttemptId", "questionId");

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_examTrackId_fkey" FOREIGN KEY ("examTrackId") REFERENCES "exam_tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_mediumId_fkey" FOREIGN KEY ("mediumId") REFERENCES "mediums"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tests" ADD CONSTRAINT "tests_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempts" ADD CONSTRAINT "test_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempt_questions" ADD CONSTRAINT "test_attempt_questions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempt_questions" ADD CONSTRAINT "test_attempt_questions_testAttemptId_fkey" FOREIGN KEY ("testAttemptId") REFERENCES "test_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempt_questions" ADD CONSTRAINT "test_attempt_questions_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_attempt_questions" ADD CONSTRAINT "test_attempt_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
