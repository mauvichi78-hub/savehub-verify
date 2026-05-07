-- AlterTable
ALTER TABLE "User" ADD COLUMN "whatsappWaId" TEXT;

-- CreateTable
CREATE TABLE "WhatsappLinkToken" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsappLinkToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WhatsappLinkToken_userId_idx" ON "WhatsappLinkToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_whatsappWaId_key" ON "User"("whatsappWaId");
