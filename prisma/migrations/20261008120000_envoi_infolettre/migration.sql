-- CreateEnum
CREATE TYPE "NewsletterIssueStatus" AS ENUM ('DRAFT', 'SENT');

-- AlterEnum
ALTER TYPE "EmailTemplate" ADD VALUE 'INFOLETTRE';

-- CreateTable
CREATE TABLE "NewsletterIssue" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "NewsletterIssueStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "sentById" TEXT,
    "sentAt" TIMESTAMP(3),
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsletterIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NewsletterIssue_status_createdAt_idx" ON "NewsletterIssue"("status", "createdAt");

