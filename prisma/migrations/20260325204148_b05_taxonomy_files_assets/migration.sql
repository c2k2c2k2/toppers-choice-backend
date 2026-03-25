-- CreateEnum
CREATE TYPE "CatalogVisibility" AS ENUM ('PUBLIC', 'AUTHENTICATED', 'INTERNAL');

-- CreateEnum
CREATE TYPE "FileAssetPurpose" AS ENUM ('NOTE_PDF', 'CMS_IMAGE', 'QUESTION_IMAGE', 'PROFILE_IMAGE', 'CONTENT_IMAGE', 'GENERIC_PDF', 'GENERIC_IMAGE');

-- CreateEnum
CREATE TYPE "FileAssetStatus" AS ENUM ('PENDING_UPLOAD', 'READY', 'REVOKED');

-- CreateEnum
CREATE TYPE "FileAssetAccess" AS ENUM ('PUBLIC', 'AUTHENTICATED', 'PROTECTED', 'ADMIN_ONLY');

-- CreateTable
CREATE TABLE "exam_tracks" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "visibility" "CatalogVisibility" NOT NULL DEFAULT 'PUBLIC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_tracks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mediums" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "visibility" "CatalogVisibility" NOT NULL DEFAULT 'PUBLIC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mediums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "examTrackId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "visibility" "CatalogVisibility" NOT NULL DEFAULT 'PUBLIC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "visibility" "CatalogVisibility" NOT NULL DEFAULT 'PUBLIC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "visibility" "CatalogVisibility" NOT NULL DEFAULT 'PUBLIC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_assets" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "confirmedByUserId" TEXT,
    "purpose" "FileAssetPurpose" NOT NULL,
    "accessLevel" "FileAssetAccess" NOT NULL DEFAULT 'PROTECTED',
    "status" "FileAssetStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "objectKey" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "extension" TEXT,
    "contentType" TEXT NOT NULL,
    "declaredSizeBytes" INTEGER,
    "sizeBytes" INTEGER,
    "checksumSha256" TEXT,
    "etag" TEXT,
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "uploadExpiresAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_asset_references" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "fileAssetId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "slot" TEXT,
    "accessLevel" "FileAssetAccess",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_asset_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exam_tracks_siteId_isActive_orderIndex_idx" ON "exam_tracks"("siteId", "isActive", "orderIndex");

-- CreateIndex
CREATE INDEX "exam_tracks_siteId_visibility_orderIndex_idx" ON "exam_tracks"("siteId", "visibility", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "exam_tracks_siteId_code_key" ON "exam_tracks"("siteId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "exam_tracks_siteId_slug_key" ON "exam_tracks"("siteId", "slug");

-- CreateIndex
CREATE INDEX "mediums_siteId_isActive_orderIndex_idx" ON "mediums"("siteId", "isActive", "orderIndex");

-- CreateIndex
CREATE INDEX "mediums_siteId_visibility_orderIndex_idx" ON "mediums"("siteId", "visibility", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "mediums_siteId_code_key" ON "mediums"("siteId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "mediums_siteId_slug_key" ON "mediums"("siteId", "slug");

-- CreateIndex
CREATE INDEX "subjects_siteId_examTrackId_isActive_orderIndex_idx" ON "subjects"("siteId", "examTrackId", "isActive", "orderIndex");

-- CreateIndex
CREATE INDEX "subjects_siteId_visibility_orderIndex_idx" ON "subjects"("siteId", "visibility", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_siteId_examTrackId_code_key" ON "subjects"("siteId", "examTrackId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_siteId_examTrackId_slug_key" ON "subjects"("siteId", "examTrackId", "slug");

-- CreateIndex
CREATE INDEX "topics_siteId_visibility_orderIndex_idx" ON "topics"("siteId", "visibility", "orderIndex");

-- CreateIndex
CREATE INDEX "topics_subjectId_parentId_orderIndex_idx" ON "topics"("subjectId", "parentId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "topics_siteId_subjectId_code_key" ON "topics"("siteId", "subjectId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "topics_siteId_subjectId_slug_key" ON "topics"("siteId", "subjectId", "slug");

-- CreateIndex
CREATE INDEX "tags_siteId_isActive_orderIndex_idx" ON "tags"("siteId", "isActive", "orderIndex");

-- CreateIndex
CREATE INDEX "tags_siteId_visibility_orderIndex_idx" ON "tags"("siteId", "visibility", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "tags_siteId_code_key" ON "tags"("siteId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "tags_siteId_slug_key" ON "tags"("siteId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "file_assets_objectKey_key" ON "file_assets"("objectKey");

-- CreateIndex
CREATE INDEX "file_assets_siteId_purpose_createdAt_idx" ON "file_assets"("siteId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "file_assets_siteId_status_createdAt_idx" ON "file_assets"("siteId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "file_assets_createdByUserId_createdAt_idx" ON "file_assets"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "file_asset_references_siteId_resourceType_resourceId_idx" ON "file_asset_references"("siteId", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "file_asset_references_fileAssetId_accessLevel_idx" ON "file_asset_references"("fileAssetId", "accessLevel");

-- CreateIndex
CREATE UNIQUE INDEX "file_asset_references_fileAssetId_resourceType_resourceId_s_key" ON "file_asset_references"("fileAssetId", "resourceType", "resourceId", "slot");

-- AddForeignKey
ALTER TABLE "exam_tracks" ADD CONSTRAINT "exam_tracks_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mediums" ADD CONSTRAINT "mediums_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_examTrackId_fkey" FOREIGN KEY ("examTrackId") REFERENCES "exam_tracks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_asset_references" ADD CONSTRAINT "file_asset_references_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_asset_references" ADD CONSTRAINT "file_asset_references_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "file_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
