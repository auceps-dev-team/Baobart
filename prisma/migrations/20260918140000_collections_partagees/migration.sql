-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "communityId" TEXT;
-- CreateIndex
CREATE INDEX "Board_communityId_createdAt_idx" ON "Board"("communityId", "createdAt");
-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;
