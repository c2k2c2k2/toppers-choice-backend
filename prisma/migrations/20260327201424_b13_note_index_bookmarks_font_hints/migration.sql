-- CreateTable
CREATE TABLE "note_index_entries" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "serialLabel" TEXT,
    "title" TEXT NOT NULL,
    "titleFontHint" TEXT,
    "pageNumber" INTEGER NOT NULL,
    "indentLevel" INTEGER NOT NULL DEFAULT 0,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "note_index_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note_bookmarks" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "noteIndexEntryId" TEXT,
    "label" TEXT,
    "pageNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "note_bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "note_index_entries_siteId_noteId_orderIndex_idx" ON "note_index_entries"("siteId", "noteId", "orderIndex");

-- CreateIndex
CREATE INDEX "note_index_entries_noteId_pageNumber_idx" ON "note_index_entries"("noteId", "pageNumber");

-- CreateIndex
CREATE INDEX "note_bookmarks_siteId_userId_noteId_createdAt_idx" ON "note_bookmarks"("siteId", "userId", "noteId", "createdAt");

-- CreateIndex
CREATE INDEX "note_bookmarks_noteId_noteIndexEntryId_idx" ON "note_bookmarks"("noteId", "noteIndexEntryId");

-- AddForeignKey
ALTER TABLE "note_index_entries" ADD CONSTRAINT "note_index_entries_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_index_entries" ADD CONSTRAINT "note_index_entries_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_index_entries" ADD CONSTRAINT "note_index_entries_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_index_entries" ADD CONSTRAINT "note_index_entries_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_bookmarks" ADD CONSTRAINT "note_bookmarks_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_bookmarks" ADD CONSTRAINT "note_bookmarks_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_bookmarks" ADD CONSTRAINT "note_bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note_bookmarks" ADD CONSTRAINT "note_bookmarks_noteIndexEntryId_fkey" FOREIGN KEY ("noteIndexEntryId") REFERENCES "note_index_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
