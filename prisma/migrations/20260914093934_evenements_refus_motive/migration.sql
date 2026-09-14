-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderatorId" TEXT,
ADD COLUMN     "refusedReason" TEXT;
