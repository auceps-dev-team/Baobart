-- AlterTable
ALTER TABLE "CommunityChatMessage" ADD COLUMN     "isFlagged" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "CommunityChatMessage_isFlagged_createdAt_idx" ON "CommunityChatMessage"("isFlagged", "createdAt");

