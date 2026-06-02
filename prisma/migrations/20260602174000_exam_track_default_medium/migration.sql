ALTER TABLE "exam_tracks" ADD COLUMN "defaultMediumId" TEXT;

ALTER TABLE "exam_tracks" ADD CONSTRAINT "exam_tracks_defaultMediumId_fkey" FOREIGN KEY ("defaultMediumId") REFERENCES "mediums"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "exam_tracks_siteId_defaultMediumId_idx" ON "exam_tracks"("siteId", "defaultMediumId");
