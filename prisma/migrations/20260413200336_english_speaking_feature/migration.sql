-- CreateEnum
CREATE TYPE "EnglishSpeakingLanguage" AS ENUM ('HINDI', 'MARATHI', 'ENGLISH');

-- CreateEnum
CREATE TYPE "EnglishSpeakingAudioStatus" AS ENUM ('NOT_GENERATED', 'PREVIEW_READY', 'FINALIZED', 'FAILED');

-- AlterEnum
ALTER TYPE "FileAssetPurpose" ADD VALUE 'CONTENT_AUDIO';

-- CreateTable
CREATE TABLE "english_speaking_topics" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "CatalogVisibility" NOT NULL DEFAULT 'AUTHENTICATED',
    "accessType" "ContentAccessType" NOT NULL DEFAULT 'FREE',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "english_speaking_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "english_speaking_sentences" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "hindiText" TEXT NOT NULL,
    "marathiText" TEXT NOT NULL,
    "englishText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "english_speaking_sentences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "english_speaking_sentence_audios" (
    "id" TEXT NOT NULL,
    "sentenceId" TEXT NOT NULL,
    "language" "EnglishSpeakingLanguage" NOT NULL,
    "previewFileAssetId" TEXT,
    "finalizedFileAssetId" TEXT,
    "voiceId" TEXT,
    "modelId" TEXT,
    "outputFormat" TEXT,
    "textHash" TEXT,
    "status" "EnglishSpeakingAudioStatus" NOT NULL DEFAULT 'NOT_GENERATED',
    "lastError" TEXT,
    "generatedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "english_speaking_sentence_audios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "english_speaking_topics_siteId_status_publishedAt_idx" ON "english_speaking_topics"("siteId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "english_speaking_topics_siteId_visibility_status_publishedA_idx" ON "english_speaking_topics"("siteId", "visibility", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "english_speaking_topics_siteId_accessType_status_idx" ON "english_speaking_topics"("siteId", "accessType", "status");

-- CreateIndex
CREATE INDEX "english_speaking_topics_siteId_orderIndex_idx" ON "english_speaking_topics"("siteId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "english_speaking_topics_siteId_slug_key" ON "english_speaking_topics"("siteId", "slug");

-- CreateIndex
CREATE INDEX "english_speaking_sentences_topicId_orderIndex_idx" ON "english_speaking_sentences"("topicId", "orderIndex");

-- CreateIndex
CREATE INDEX "english_speaking_sentence_audios_previewFileAssetId_idx" ON "english_speaking_sentence_audios"("previewFileAssetId");

-- CreateIndex
CREATE INDEX "english_speaking_sentence_audios_finalizedFileAssetId_idx" ON "english_speaking_sentence_audios"("finalizedFileAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "english_speaking_sentence_audios_sentenceId_language_key" ON "english_speaking_sentence_audios"("sentenceId", "language");

-- AddForeignKey
ALTER TABLE "english_speaking_topics" ADD CONSTRAINT "english_speaking_topics_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "english_speaking_sentences" ADD CONSTRAINT "english_speaking_sentences_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "english_speaking_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "english_speaking_sentence_audios" ADD CONSTRAINT "english_speaking_sentence_audios_sentenceId_fkey" FOREIGN KEY ("sentenceId") REFERENCES "english_speaking_sentences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
