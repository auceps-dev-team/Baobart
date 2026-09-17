-- AlterTable
ALTER TABLE "BlogPost" ADD COLUMN     "scheduledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "BlogPost_state_scheduledAt_idx" ON "BlogPost"("state", "scheduledAt");

