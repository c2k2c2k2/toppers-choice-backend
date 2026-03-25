-- CreateEnum
CREATE TYPE "PracticeMode" AS ENUM ('TOPIC_WISE', 'MIXED');

-- CreateEnum
CREATE TYPE "PracticeSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "PracticeQuestionEventType" AS ENUM ('SERVED', 'SAVED', 'ANSWERED', 'REVEALED');

-- CreateTable
CREATE TABLE "practice_sessions" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authSessionId" TEXT,
    "mode" "PracticeMode" NOT NULL,
    "status" "PracticeSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "examTrackId" TEXT,
    "mediumId" TEXT,
    "subjectId" TEXT,
    "topicId" TEXT,
    "difficulty" "QuestionDifficulty",
    "questionCountTarget" INTEGER NOT NULL DEFAULT 20,
    "configJson" JSONB,
    "servedCount" INTEGER NOT NULL DEFAULT 0,
    "answeredCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "revealedCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_session_questions" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "practiceSessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "servedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latestSavedAnswerJson" JSONB,
    "lastSavedAt" TIMESTAMP(3),
    "answerJson" JSONB,
    "answeredAt" TIMESTAMP(3),
    "isCorrect" BOOLEAN,
    "revealedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practice_session_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_question_events" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "practiceSessionId" TEXT NOT NULL,
    "practiceSessionQuestionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "eventType" "PracticeQuestionEventType" NOT NULL,
    "answerJson" JSONB,
    "isCorrect" BOOLEAN,
    "responseTimeMs" INTEGER,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practice_question_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_question_practice_states" (
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "seenCount" INTEGER NOT NULL DEFAULT 0,
    "answerCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "revealCount" INTEGER NOT NULL DEFAULT 0,
    "lastIsCorrect" BOOLEAN,
    "lastServedAt" TIMESTAMP(3),
    "lastAnsweredAt" TIMESTAMP(3),
    "lastRevealedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_question_practice_states_pkey" PRIMARY KEY ("questionId","userId")
);

-- CreateTable
CREATE TABLE "user_subject_practice_progress" (
    "subjectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "servedCount" INTEGER NOT NULL DEFAULT 0,
    "answeredCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "revealCount" INTEGER NOT NULL DEFAULT 0,
    "accuracyPercent" INTEGER NOT NULL DEFAULT 0,
    "lastPracticedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_subject_practice_progress_pkey" PRIMARY KEY ("subjectId","userId")
);

-- CreateTable
CREATE TABLE "user_topic_practice_progress" (
    "topicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "servedCount" INTEGER NOT NULL DEFAULT 0,
    "answeredCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "revealCount" INTEGER NOT NULL DEFAULT 0,
    "accuracyPercent" INTEGER NOT NULL DEFAULT 0,
    "lastPracticedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_topic_practice_progress_pkey" PRIMARY KEY ("topicId","userId")
);

-- CreateIndex
CREATE INDEX "practice_sessions_siteId_userId_status_startedAt_idx" ON "practice_sessions"("siteId", "userId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "practice_sessions_siteId_mode_status_startedAt_idx" ON "practice_sessions"("siteId", "mode", "status", "startedAt");

-- CreateIndex
CREATE INDEX "practice_sessions_siteId_subjectId_status_startedAt_idx" ON "practice_sessions"("siteId", "subjectId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "practice_sessions_siteId_topicId_status_startedAt_idx" ON "practice_sessions"("siteId", "topicId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "practice_session_questions_siteId_userId_servedAt_idx" ON "practice_session_questions"("siteId", "userId", "servedAt");

-- CreateIndex
CREATE INDEX "practice_session_questions_practiceSessionId_orderIndex_idx" ON "practice_session_questions"("practiceSessionId", "orderIndex");

-- CreateIndex
CREATE INDEX "practice_session_questions_questionId_idx" ON "practice_session_questions"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "practice_session_questions_practiceSessionId_questionId_key" ON "practice_session_questions"("practiceSessionId", "questionId");

-- CreateIndex
CREATE INDEX "practice_question_events_siteId_userId_createdAt_idx" ON "practice_question_events"("siteId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "practice_question_events_practiceSessionId_createdAt_idx" ON "practice_question_events"("practiceSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "practice_question_events_practiceSessionQuestionId_createdA_idx" ON "practice_question_events"("practiceSessionQuestionId", "createdAt");

-- CreateIndex
CREATE INDEX "practice_question_events_siteId_questionId_createdAt_idx" ON "practice_question_events"("siteId", "questionId", "createdAt");

-- CreateIndex
CREATE INDEX "practice_question_events_siteId_eventType_createdAt_idx" ON "practice_question_events"("siteId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "user_question_practice_states_siteId_userId_lastAnsweredAt_idx" ON "user_question_practice_states"("siteId", "userId", "lastAnsweredAt");

-- CreateIndex
CREATE INDEX "user_question_practice_states_siteId_userId_wrongCount_idx" ON "user_question_practice_states"("siteId", "userId", "wrongCount");

-- CreateIndex
CREATE INDEX "user_question_practice_states_siteId_userId_revealCount_idx" ON "user_question_practice_states"("siteId", "userId", "revealCount");

-- CreateIndex
CREATE INDEX "user_subject_practice_progress_siteId_userId_lastPracticedA_idx" ON "user_subject_practice_progress"("siteId", "userId", "lastPracticedAt");

-- CreateIndex
CREATE INDEX "user_subject_practice_progress_siteId_subjectId_accuracyPer_idx" ON "user_subject_practice_progress"("siteId", "subjectId", "accuracyPercent");

-- CreateIndex
CREATE INDEX "user_topic_practice_progress_siteId_userId_lastPracticedAt_idx" ON "user_topic_practice_progress"("siteId", "userId", "lastPracticedAt");

-- CreateIndex
CREATE INDEX "user_topic_practice_progress_siteId_subjectId_userId_accura_idx" ON "user_topic_practice_progress"("siteId", "subjectId", "userId", "accuracyPercent");

-- AddForeignKey
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_examTrackId_fkey" FOREIGN KEY ("examTrackId") REFERENCES "exam_tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_mediumId_fkey" FOREIGN KEY ("mediumId") REFERENCES "mediums"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_session_questions" ADD CONSTRAINT "practice_session_questions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_session_questions" ADD CONSTRAINT "practice_session_questions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_session_questions" ADD CONSTRAINT "practice_session_questions_practiceSessionId_fkey" FOREIGN KEY ("practiceSessionId") REFERENCES "practice_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_session_questions" ADD CONSTRAINT "practice_session_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_question_events" ADD CONSTRAINT "practice_question_events_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_question_events" ADD CONSTRAINT "practice_question_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_question_events" ADD CONSTRAINT "practice_question_events_practiceSessionId_fkey" FOREIGN KEY ("practiceSessionId") REFERENCES "practice_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_question_events" ADD CONSTRAINT "practice_question_events_practiceSessionQuestionId_fkey" FOREIGN KEY ("practiceSessionQuestionId") REFERENCES "practice_session_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_question_events" ADD CONSTRAINT "practice_question_events_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_question_practice_states" ADD CONSTRAINT "user_question_practice_states_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_question_practice_states" ADD CONSTRAINT "user_question_practice_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_question_practice_states" ADD CONSTRAINT "user_question_practice_states_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_subject_practice_progress" ADD CONSTRAINT "user_subject_practice_progress_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_subject_practice_progress" ADD CONSTRAINT "user_subject_practice_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_subject_practice_progress" ADD CONSTRAINT "user_subject_practice_progress_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_topic_practice_progress" ADD CONSTRAINT "user_topic_practice_progress_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_topic_practice_progress" ADD CONSTRAINT "user_topic_practice_progress_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_topic_practice_progress" ADD CONSTRAINT "user_topic_practice_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_topic_practice_progress" ADD CONSTRAINT "user_topic_practice_progress_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
