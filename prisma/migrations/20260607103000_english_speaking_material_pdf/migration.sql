CREATE TABLE "english_speaking_materials" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "notesFileAssetId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "english_speaking_materials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "english_speaking_materials_siteId_key" ON "english_speaking_materials"("siteId");
CREATE INDEX "english_speaking_materials_notesFileAssetId_idx" ON "english_speaking_materials"("notesFileAssetId");
CREATE INDEX "english_speaking_materials_updatedByUserId_idx" ON "english_speaking_materials"("updatedByUserId");

ALTER TABLE "english_speaking_materials" ADD CONSTRAINT "english_speaking_materials_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "english_speaking_materials" ADD CONSTRAINT "english_speaking_materials_notesFileAssetId_fkey" FOREIGN KEY ("notesFileAssetId") REFERENCES "file_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "english_speaking_materials" ADD CONSTRAINT "english_speaking_materials_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
