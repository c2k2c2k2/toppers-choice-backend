-- CreateEnum
CREATE TYPE "NoteStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NoteAccessType" AS ENUM ('FREE', 'PREVIEWABLE_PREMIUM', 'PREMIUM_ONLY');

-- CreateEnum
CREATE TYPE "NoteViewSessionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NoteViewAccessMode" AS ENUM ('FULL', 'PREVIEW');

-- CreateEnum
CREATE TYPE "NoteAccessLogEventType" AS ENUM ('VIEW_SESSION_CREATED', 'WATERMARK_FETCHED', 'CONTENT_STREAMED', 'PROGRESS_UPDATED');

-- CreateEnum
CREATE TYPE "SecuritySignalSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "mediumId" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT,
    "fullFileAssetId" TEXT NOT NULL,
    "previewFileAssetId" TEXT,
    "coverImageAssetId" TEXT,
    "accessType" "NoteAccessType" NOT NULL DEFAULT 'FREE',
    "previewPageCount" INTEGER,
    "pageCount" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "NoteStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_topics" (
    "noteId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_topics_pkey" PRIMARY KEY ("noteId","topicId")
);

-- CreateTable
CREATE TABLE "note_view_sessions" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authSessionId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" "NoteViewSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "accessMode" "NoteViewAccessMode" NOT NULL,
    "previewPageCount" INTEGER,
    "watermarkSeed" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "lastAccessedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "note_view_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_progress" (
    "siteId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastPageViewed" INTEGER NOT NULL DEFAULT 0,
    "maxPageViewed" INTEGER NOT NULL DEFAULT 0,
    "completionPercent" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "note_progress_pkey" PRIMARY KEY ("noteId","userId")
);

-- CreateTable
CREATE TABLE "note_access_logs" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT,
    "noteViewSessionId" TEXT,
    "eventType" "NoteAccessLogEventType" NOT NULL,
    "rangeStart" INTEGER,
    "rangeEnd" INTEGER,
    "bytesServed" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_security_signals" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT,
    "noteViewSessionId" TEXT,
    "signalKey" TEXT NOT NULL,
    "severity" "SecuritySignalSeverity" NOT NULL DEFAULT 'LOW',
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_security_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notes_siteId_status_orderIndex_idx" ON "notes"("siteId", "status", "orderIndex");

-- CreateIndex
CREATE INDEX "notes_siteId_subjectId_status_orderIndex_idx" ON "notes"("siteId", "subjectId", "status", "orderIndex");

-- CreateIndex
CREATE INDEX "notes_siteId_accessType_status_idx" ON "notes"("siteId", "accessType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "notes_siteId_slug_key" ON "notes"("siteId", "slug");

-- CreateIndex
CREATE INDEX "note_topics_topicId_idx" ON "note_topics"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "note_view_sessions_tokenHash_key" ON "note_view_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "note_view_sessions_siteId_noteId_userId_createdAt_idx" ON "note_view_sessions"("siteId", "noteId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "note_view_sessions_siteId_status_expiresAt_idx" ON "note_view_sessions"("siteId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "note_progress_siteId_userId_lastViewedAt_idx" ON "note_progress"("siteId", "userId", "lastViewedAt");

-- CreateIndex
CREATE INDEX "note_access_logs_siteId_noteId_createdAt_idx" ON "note_access_logs"("siteId", "noteId", "createdAt");

-- CreateIndex
CREATE INDEX "note_access_logs_siteId_userId_createdAt_idx" ON "note_access_logs"("siteId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "note_access_logs_noteViewSessionId_createdAt_idx" ON "note_access_logs"("noteViewSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "note_security_signals_siteId_noteId_createdAt_idx" ON "note_security_signals"("siteId", "noteId", "createdAt");

-- CreateIndex
CREATE INDEX "note_security_signals_siteId_signalKey_createdAt_idx" ON "note_security_signals"("siteId", "signalKey", "createdAt");

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_mediumId_fkey" FOREIGN KEY ("mediumId") REFERENCES "mediums"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_fullFileAssetId_fkey" FOREIGN KEY ("fullFileAssetId") REFERENCES "file_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_previewFileAssetId_fkey" FOREIGN KEY ("previewFileAssetId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_coverImageAssetId_fkey" FOREIGN KEY ("coverImageAssetId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_topics" ADD CONSTRAINT "note_topics_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_topics" ADD CONSTRAINT "note_topics_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_view_sessions" ADD CONSTRAINT "note_view_sessions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_view_sessions" ADD CONSTRAINT "note_view_sessions_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_view_sessions" ADD CONSTRAINT "note_view_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_progress" ADD CONSTRAINT "note_progress_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_progress" ADD CONSTRAINT "note_progress_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_progress" ADD CONSTRAINT "note_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_access_logs" ADD CONSTRAINT "note_access_logs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_access_logs" ADD CONSTRAINT "note_access_logs_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_access_logs" ADD CONSTRAINT "note_access_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_access_logs" ADD CONSTRAINT "note_access_logs_noteViewSessionId_fkey" FOREIGN KEY ("noteViewSessionId") REFERENCES "note_view_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_security_signals" ADD CONSTRAINT "note_security_signals_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_security_signals" ADD CONSTRAINT "note_security_signals_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_security_signals" ADD CONSTRAINT "note_security_signals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_security_signals" ADD CONSTRAINT "note_security_signals_noteViewSessionId_fkey" FOREIGN KEY ("noteViewSessionId") REFERENCES "note_view_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
