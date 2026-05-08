-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "structure" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "hashtags" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "sourceCollectionId" TEXT,
    "sourceItemIds" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Idea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Idea_sourceCollectionId_fkey" FOREIGN KEY ("sourceCollectionId") REFERENCES "Collection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Idea_userId_createdAt_idx" ON "Idea"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Idea_userId_status_idx" ON "Idea"("userId", "status");

-- CreateIndex
CREATE INDEX "Idea_sourceCollectionId_idx" ON "Idea"("sourceCollectionId");
