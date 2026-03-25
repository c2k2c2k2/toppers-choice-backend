-- CreateEnum
CREATE TYPE "ContentFamily" AS ENUM ('CAREER_GUIDANCE', 'INTERVIEW_GUIDANCE', 'ENGLISH_SPEAKING', 'CURRENT_AFFAIRS', 'MONTHLY_UPDATE');

-- CreateEnum
CREATE TYPE "ContentFormat" AS ENUM ('ARTICLE', 'LESSON', 'FEED_ITEM');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContentAccessType" AS ENUM ('FREE', 'PREMIUM');

-- CreateTable
CREATE TABLE "content_entries" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "family" "ContentFamily" NOT NULL,
    "format" "ContentFormat" NOT NULL DEFAULT 'ARTICLE',
    "visibility" "CatalogVisibility" NOT NULL DEFAULT 'PUBLIC',
    "accessType" "ContentAccessType" NOT NULL DEFAULT 'FREE',
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "bodyJson" JSONB NOT NULL,
    "metaJson" JSONB,
    "coverImageAssetId" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "featuredOrderIndex" INTEGER,
    "readingTimeMinutes" INTEGER,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_entry_exam_tracks" (
    "contentEntryId" TEXT NOT NULL,
    "examTrackId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_entry_exam_tracks_pkey" PRIMARY KEY ("contentEntryId","examTrackId")
);

-- CreateTable
CREATE TABLE "content_entry_mediums" (
    "contentEntryId" TEXT NOT NULL,
    "mediumId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_entry_mediums_pkey" PRIMARY KEY ("contentEntryId","mediumId")
);

-- CreateTable
CREATE TABLE "content_attachments" (
    "id" TEXT NOT NULL,
    "contentEntryId" TEXT NOT NULL,
    "fileAssetId" TEXT NOT NULL,
    "label" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_entries_siteId_family_status_publishedAt_idx" ON "content_entries"("siteId", "family", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "content_entries_siteId_visibility_status_publishedAt_idx" ON "content_entries"("siteId", "visibility", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "content_entries_siteId_accessType_status_idx" ON "content_entries"("siteId", "accessType", "status");

-- CreateIndex
CREATE INDEX "content_entries_siteId_isFeatured_featuredOrderIndex_idx" ON "content_entries"("siteId", "isFeatured", "featuredOrderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "content_entries_siteId_slug_key" ON "content_entries"("siteId", "slug");

-- CreateIndex
CREATE INDEX "content_entry_exam_tracks_examTrackId_idx" ON "content_entry_exam_tracks"("examTrackId");

-- CreateIndex
CREATE INDEX "content_entry_mediums_mediumId_idx" ON "content_entry_mediums"("mediumId");

-- CreateIndex
CREATE INDEX "content_attachments_fileAssetId_idx" ON "content_attachments"("fileAssetId");

-- CreateIndex
CREATE INDEX "content_attachments_contentEntryId_orderIndex_idx" ON "content_attachments"("contentEntryId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "content_attachments_contentEntryId_fileAssetId_key" ON "content_attachments"("contentEntryId", "fileAssetId");

-- AddForeignKey
ALTER TABLE "content_entries" ADD CONSTRAINT "content_entries_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_entries" ADD CONSTRAINT "content_entries_coverImageAssetId_fkey" FOREIGN KEY ("coverImageAssetId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_entries" ADD CONSTRAINT "content_entries_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_entries" ADD CONSTRAINT "content_entries_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_entries" ADD CONSTRAINT "content_entries_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_entry_exam_tracks" ADD CONSTRAINT "content_entry_exam_tracks_contentEntryId_fkey" FOREIGN KEY ("contentEntryId") REFERENCES "content_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_entry_exam_tracks" ADD CONSTRAINT "content_entry_exam_tracks_examTrackId_fkey" FOREIGN KEY ("examTrackId") REFERENCES "exam_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_entry_mediums" ADD CONSTRAINT "content_entry_mediums_contentEntryId_fkey" FOREIGN KEY ("contentEntryId") REFERENCES "content_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_entry_mediums" ADD CONSTRAINT "content_entry_mediums_mediumId_fkey" FOREIGN KEY ("mediumId") REFERENCES "mediums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_attachments" ADD CONSTRAINT "content_attachments_contentEntryId_fkey" FOREIGN KEY ("contentEntryId") REFERENCES "content_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_attachments" ADD CONSTRAINT "content_attachments_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "file_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
