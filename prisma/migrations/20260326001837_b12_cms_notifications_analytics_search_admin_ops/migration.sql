-- CreateEnum
CREATE TYPE "CmsRecordStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CmsBannerPlacement" AS ENUM ('LANDING_HOME', 'STUDENT_HOME', 'COMMON');

-- CreateEnum
CREATE TYPE "CmsSectionSurface" AS ENUM ('LANDING_HOME', 'STUDENT_HOME');

-- CreateEnum
CREATE TYPE "CmsSectionType" AS ENUM ('RICH_TEXT', 'CONTENT_FEED', 'PLAN_HIGHLIGHTS', 'CTA_GROUP');

-- CreateEnum
CREATE TYPE "CmsAnnouncementLevel" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationTemplateStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NotificationBroadcastStatus" AS ENUM ('DRAFT', 'QUEUED', 'SENT', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationMessageStatus" AS ENUM ('PENDING', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationAudienceType" AS ENUM ('ALL_STUDENTS', 'ALL_ADMINS', 'USER_IDS', 'ACTIVE_SUBSCRIBERS');

-- CreateEnum
CREATE TYPE "IdempotencyRecordStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "cms_pages" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "bodyJson" JSONB NOT NULL,
    "seoJson" JSONB,
    "visibility" "CatalogVisibility" NOT NULL DEFAULT 'PUBLIC',
    "coverImageAssetId" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "CmsRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_banners" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "placement" "CmsBannerPlacement" NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "body" TEXT,
    "ctaLabel" TEXT,
    "ctaHref" TEXT,
    "imageAssetId" TEXT,
    "visibility" "CatalogVisibility" NOT NULL DEFAULT 'PUBLIC',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "metaJson" JSONB,
    "status" "CmsRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_announcements" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkLabel" TEXT,
    "linkHref" TEXT,
    "level" "CmsAnnouncementLevel" NOT NULL DEFAULT 'INFO',
    "visibility" "CatalogVisibility" NOT NULL DEFAULT 'PUBLIC',
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "metaJson" JSONB,
    "status" "CmsRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_sections" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "surface" "CmsSectionSurface" NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "type" "CmsSectionType" NOT NULL,
    "bodyJson" JSONB,
    "configJson" JSONB,
    "imageAssetId" TEXT,
    "visibility" "CatalogVisibility" NOT NULL DEFAULT 'PUBLIC',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "CmsRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "subjectTemplate" TEXT,
    "titleTemplate" TEXT NOT NULL,
    "bodyTemplate" TEXT NOT NULL,
    "metaJson" JSONB,
    "status" "NotificationTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_broadcasts" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "templateId" TEXT,
    "audienceType" "NotificationAudienceType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "filtersJson" JSONB,
    "payloadJson" JSONB,
    "scheduledAt" TIMESTAMP(3),
    "dispatchedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "status" "NotificationBroadcastStatus" NOT NULL DEFAULT 'DRAFT',
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "readCount" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "dispatchedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_messages" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT,
    "broadcastId" TEXT,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payloadJson" JSONB,
    "status" "NotificationMessageStatus" NOT NULL DEFAULT 'PENDING',
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "siteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("userId","channel")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "userId" TEXT,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "IdempotencyRecordStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "responseJson" JSONB,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "errorCode" TEXT,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cms_pages_siteId_status_visibility_publishedAt_idx" ON "cms_pages"("siteId", "status", "visibility", "publishedAt");

-- CreateIndex
CREATE INDEX "cms_pages_siteId_orderIndex_createdAt_idx" ON "cms_pages"("siteId", "orderIndex", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "cms_pages_siteId_slug_key" ON "cms_pages"("siteId", "slug");

-- CreateIndex
CREATE INDEX "cms_banners_siteId_placement_status_visibility_orderIndex_idx" ON "cms_banners"("siteId", "placement", "status", "visibility", "orderIndex");

-- CreateIndex
CREATE INDEX "cms_banners_siteId_startsAt_endsAt_publishedAt_idx" ON "cms_banners"("siteId", "startsAt", "endsAt", "publishedAt");

-- CreateIndex
CREATE INDEX "cms_announcements_siteId_status_visibility_isPinned_orderIn_idx" ON "cms_announcements"("siteId", "status", "visibility", "isPinned", "orderIndex");

-- CreateIndex
CREATE INDEX "cms_announcements_siteId_startsAt_endsAt_publishedAt_idx" ON "cms_announcements"("siteId", "startsAt", "endsAt", "publishedAt");

-- CreateIndex
CREATE INDEX "cms_sections_siteId_surface_status_visibility_orderIndex_idx" ON "cms_sections"("siteId", "surface", "status", "visibility", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "cms_sections_siteId_surface_code_key" ON "cms_sections"("siteId", "surface", "code");

-- CreateIndex
CREATE INDEX "notification_templates_siteId_channel_status_name_idx" ON "notification_templates"("siteId", "channel", "status", "name");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_siteId_key_key" ON "notification_templates"("siteId", "key");

-- CreateIndex
CREATE INDEX "notification_broadcasts_siteId_status_createdAt_idx" ON "notification_broadcasts"("siteId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "notification_broadcasts_siteId_audienceType_status_dispatch_idx" ON "notification_broadcasts"("siteId", "audienceType", "status", "dispatchedAt");

-- CreateIndex
CREATE INDEX "notification_messages_siteId_userId_status_createdAt_idx" ON "notification_messages"("siteId", "userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "notification_messages_siteId_broadcastId_createdAt_idx" ON "notification_messages"("siteId", "broadcastId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_preferences_siteId_channel_isEnabled_idx" ON "notification_preferences"("siteId", "channel", "isEnabled");

-- CreateIndex
CREATE INDEX "idempotency_records_siteId_status_createdAt_idx" ON "idempotency_records"("siteId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "idempotency_records_siteId_userId_createdAt_idx" ON "idempotency_records"("siteId", "userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_siteId_scope_key_key" ON "idempotency_records"("siteId", "scope", "key");

-- AddForeignKey
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_coverImageAssetId_fkey" FOREIGN KEY ("coverImageAssetId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_pages" ADD CONSTRAINT "cms_pages_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_banners" ADD CONSTRAINT "cms_banners_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_banners" ADD CONSTRAINT "cms_banners_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_banners" ADD CONSTRAINT "cms_banners_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_banners" ADD CONSTRAINT "cms_banners_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_banners" ADD CONSTRAINT "cms_banners_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_announcements" ADD CONSTRAINT "cms_announcements_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_announcements" ADD CONSTRAINT "cms_announcements_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_announcements" ADD CONSTRAINT "cms_announcements_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_announcements" ADD CONSTRAINT "cms_announcements_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_sections" ADD CONSTRAINT "cms_sections_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_sections" ADD CONSTRAINT "cms_sections_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_sections" ADD CONSTRAINT "cms_sections_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_sections" ADD CONSTRAINT "cms_sections_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_sections" ADD CONSTRAINT "cms_sections_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_broadcasts" ADD CONSTRAINT "notification_broadcasts_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_broadcasts" ADD CONSTRAINT "notification_broadcasts_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_broadcasts" ADD CONSTRAINT "notification_broadcasts_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_broadcasts" ADD CONSTRAINT "notification_broadcasts_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_broadcasts" ADD CONSTRAINT "notification_broadcasts_dispatchedByUserId_fkey" FOREIGN KEY ("dispatchedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_messages" ADD CONSTRAINT "notification_messages_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_messages" ADD CONSTRAINT "notification_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_messages" ADD CONSTRAINT "notification_messages_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_messages" ADD CONSTRAINT "notification_messages_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "notification_broadcasts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
