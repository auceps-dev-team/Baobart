-- AlterTable
ALTER TABLE "BlockedObject" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "BlockedObject_userId_idx" ON "BlockedObject"("userId");

