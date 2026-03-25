-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TEXT_INPUT');

-- CreateEnum
CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "QuestionMediaUsage" AS ENUM ('STATEMENT', 'OPTION', 'EXPLANATION');

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "code" TEXT,
    "mediumId" TEXT,
    "subjectId" TEXT NOT NULL,
    "topicId" TEXT,
    "type" "QuestionType" NOT NULL,
    "difficulty" "QuestionDifficulty" NOT NULL DEFAULT 'MEDIUM',
    "statementJson" JSONB NOT NULL,
    "explanationJson" JSONB,
    "metadataJson" JSONB,
    "correctAnswerJson" JSONB NOT NULL,
    "searchText" TEXT NOT NULL,
    "hasMedia" BOOLEAN NOT NULL DEFAULT false,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "optionKey" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "contentJson" JSONB NOT NULL,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_media_references" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "fileAssetId" TEXT NOT NULL,
    "usage" "QuestionMediaUsage" NOT NULL,
    "optionKey" TEXT,
    "localeCode" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_media_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "questions_siteId_status_createdAt_idx" ON "questions"("siteId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "questions_siteId_difficulty_status_idx" ON "questions"("siteId", "difficulty", "status");

-- CreateIndex
CREATE INDEX "questions_siteId_mediumId_status_idx" ON "questions"("siteId", "mediumId", "status");

-- CreateIndex
CREATE INDEX "questions_siteId_subjectId_status_idx" ON "questions"("siteId", "subjectId", "status");

-- CreateIndex
CREATE INDEX "questions_siteId_topicId_status_idx" ON "questions"("siteId", "topicId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "questions_siteId_code_key" ON "questions"("siteId", "code");

-- CreateIndex
CREATE INDEX "question_options_questionId_orderIndex_idx" ON "question_options"("questionId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_questionId_optionKey_key" ON "question_options"("questionId", "optionKey");

-- CreateIndex
CREATE INDEX "question_media_references_fileAssetId_idx" ON "question_media_references"("fileAssetId");

-- CreateIndex
CREATE INDEX "question_media_references_questionId_usage_orderIndex_idx" ON "question_media_references"("questionId", "usage", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "question_media_references_questionId_fileAssetId_usage_opti_key" ON "question_media_references"("questionId", "fileAssetId", "usage", "optionKey", "localeCode");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_mediumId_fkey" FOREIGN KEY ("mediumId") REFERENCES "mediums"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_media_references" ADD CONSTRAINT "question_media_references_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_media_references" ADD CONSTRAINT "question_media_references_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "file_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
