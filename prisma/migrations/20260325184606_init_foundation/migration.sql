-- CreateEnum
CREATE TYPE "SiteStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ConfigStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConfigVisibility" AS ENUM ('PUBLIC', 'INTERNAL');

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primaryDomain" TEXT,
    "defaultLocale" TEXT NOT NULL DEFAULT 'mr-IN',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "status" "SiteStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_config_versions" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "configKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ConfigStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "ConfigVisibility" NOT NULL DEFAULT 'INTERNAL',
    "configJson" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_config_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sites_code_key" ON "sites"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sites_slug_key" ON "sites"("slug");

-- CreateIndex
CREATE INDEX "sites_isDefault_status_idx" ON "sites"("isDefault", "status");

-- CreateIndex
CREATE INDEX "site_config_versions_siteId_configKey_status_idx" ON "site_config_versions"("siteId", "configKey", "status");

-- CreateIndex
CREATE INDEX "site_config_versions_siteId_visibility_status_idx" ON "site_config_versions"("siteId", "visibility", "status");

-- CreateIndex
CREATE UNIQUE INDEX "site_config_versions_siteId_configKey_version_key" ON "site_config_versions"("siteId", "configKey", "version");

-- AddForeignKey
ALTER TABLE "site_config_versions" ADD CONSTRAINT "site_config_versions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
