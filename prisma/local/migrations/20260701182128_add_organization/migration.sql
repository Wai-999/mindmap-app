-- CreateTable
CREATE TABLE "folders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "folders_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "tags_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mindmap_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mindmapId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mindmap_versions_mindmapId_fkey" FOREIGN KEY ("mindmapId") REFERENCES "mindmaps" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_MindmapToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_MindmapToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "mindmaps" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_MindmapToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_mindmaps" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT 'Untitled Mindmap',
    "content" TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
    "contentVersion" INTEGER NOT NULL DEFAULT 1,
    "thumbnail" TEXT,
    "ownerId" TEXT NOT NULL,
    "folderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mindmaps_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mindmaps_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "folders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_mindmaps" ("content", "contentVersion", "createdAt", "id", "ownerId", "thumbnail", "title", "updatedAt") SELECT "content", "contentVersion", "createdAt", "id", "ownerId", "thumbnail", "title", "updatedAt" FROM "mindmaps";
DROP TABLE "mindmaps";
ALTER TABLE "new_mindmaps" RENAME TO "mindmaps";
CREATE INDEX "mindmaps_ownerId_idx" ON "mindmaps"("ownerId");
CREATE INDEX "mindmaps_folderId_idx" ON "mindmaps"("folderId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "folders_ownerId_idx" ON "folders"("ownerId");

-- CreateIndex
CREATE INDEX "tags_ownerId_idx" ON "tags"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_ownerId_name_key" ON "tags"("ownerId", "name");

-- CreateIndex
CREATE INDEX "mindmap_versions_mindmapId_createdAt_idx" ON "mindmap_versions"("mindmapId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "_MindmapToTag_AB_unique" ON "_MindmapToTag"("A", "B");

-- CreateIndex
CREATE INDEX "_MindmapToTag_B_index" ON "_MindmapToTag"("B");
