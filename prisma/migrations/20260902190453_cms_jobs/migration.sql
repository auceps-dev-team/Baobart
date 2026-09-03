/*
  Warnings:

  - You are about to drop the column `status` on the `JobPosting` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `JobPosting` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ContentState" AS ENUM ('BROUILLON', 'SOUMIS', 'PUBLIE', 'REFUSE', 'RETIRE');

-- CreateEnum
CREATE TYPE "ApplyMode" AS ENUM ('BAOBART', 'EXTERNE');

-- DropIndex
DROP INDEX "JobPosting_recruiterId_idx";

-- DropIndex
DROP INDEX "JobPosting_status_createdAt_idx";

-- AlterTable
ALTER TABLE "JobPosting" DROP COLUMN "status",
ADD COLUMN     "applyMode" "ApplyMode" NOT NULL DEFAULT 'BAOBART',
ADD COLUMN     "applyUrl" TEXT,
ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderatorId" TEXT,
ADD COLUMN     "refusedReason" TEXT,
ADD COLUMN     "state" "ContentState" NOT NULL DEFAULT 'BROUILLON',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT,
    "mediaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobApplication_userId_createdAt_idx" ON "JobApplication"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_jobId_userId_key" ON "JobApplication"("jobId", "userId");

-- CreateIndex
CREATE INDEX "JobPosting_state_deadline_createdAt_idx" ON "JobPosting"("state", "deadline", "createdAt");

-- CreateIndex
CREATE INDEX "JobPosting_recruiterId_createdAt_idx" ON "JobPosting"("recruiterId", "createdAt");

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
