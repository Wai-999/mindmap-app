-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mindmapId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attachments_mindmapId_fkey" FOREIGN KEY ("mindmapId") REFERENCES "mindmaps" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "attachments_mindmapId_idx" ON "attachments"("mindmapId");

-- CreateIndex
CREATE INDEX "attachments_mindmapId_nodeId_idx" ON "attachments"("mindmapId", "nodeId");
