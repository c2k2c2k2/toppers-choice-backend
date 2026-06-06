ALTER TYPE "TokenPurpose" ADD VALUE IF NOT EXISTS 'EMAIL_VERIFICATION';

ALTER TYPE "FileAssetPurpose" ADD VALUE IF NOT EXISTS 'FEEDBACK_ATTACHMENT';

CREATE TYPE "FeedbackCategory" AS ENUM ('FEEDBACK', 'COMPLAINT', 'SUGGESTION', 'BUG');

CREATE TYPE "FeedbackStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED');

CREATE TYPE "FeedbackPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

ALTER TABLE "users"
  ADD COLUMN "profileImageFileAssetId" TEXT;

CREATE TABLE "feedback_tickets" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "userId" TEXT,
  "category" "FeedbackCategory" NOT NULL DEFAULT 'FEEDBACK',
  "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "FeedbackPriority" NOT NULL DEFAULT 'NORMAL',
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "pageUrl" TEXT,
  "pageTitle" TEXT,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "contextJson" JSONB,
  "adminNote" TEXT,
  "assignedToUserId" TEXT,
  "resolvedByUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "feedback_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feedback_attachments" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "feedbackTicketId" TEXT NOT NULL,
  "fileAssetId" TEXT NOT NULL,
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "feedback_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "users_profileImageFileAssetId_idx" ON "users"("profileImageFileAssetId");
CREATE INDEX "feedback_tickets_siteId_status_createdAt_idx" ON "feedback_tickets"("siteId", "status", "createdAt");
CREATE INDEX "feedback_tickets_siteId_category_createdAt_idx" ON "feedback_tickets"("siteId", "category", "createdAt");
CREATE INDEX "feedback_tickets_siteId_userId_createdAt_idx" ON "feedback_tickets"("siteId", "userId", "createdAt");
CREATE INDEX "feedback_attachments_siteId_createdAt_idx" ON "feedback_attachments"("siteId", "createdAt");
CREATE INDEX "feedback_attachments_fileAssetId_idx" ON "feedback_attachments"("fileAssetId");
CREATE UNIQUE INDEX "feedback_attachments_feedbackTicketId_fileAssetId_key" ON "feedback_attachments"("feedbackTicketId", "fileAssetId");

ALTER TABLE "users"
  ADD CONSTRAINT "users_profileImageFileAssetId_fkey"
  FOREIGN KEY ("profileImageFileAssetId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "feedback_tickets"
  ADD CONSTRAINT "feedback_tickets_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "feedback_tickets"
  ADD CONSTRAINT "feedback_tickets_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "feedback_tickets"
  ADD CONSTRAINT "feedback_tickets_assignedToUserId_fkey"
  FOREIGN KEY ("assignedToUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "feedback_tickets"
  ADD CONSTRAINT "feedback_tickets_resolvedByUserId_fkey"
  FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "feedback_attachments"
  ADD CONSTRAINT "feedback_attachments_siteId_fkey"
  FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "feedback_attachments"
  ADD CONSTRAINT "feedback_attachments_feedbackTicketId_fkey"
  FOREIGN KEY ("feedbackTicketId") REFERENCES "feedback_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "feedback_attachments"
  ADD CONSTRAINT "feedback_attachments_fileAssetId_fkey"
  FOREIGN KEY ("fileAssetId") REFERENCES "file_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
