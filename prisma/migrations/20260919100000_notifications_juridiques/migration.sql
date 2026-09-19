-- CreateEnum
CREATE TYPE "LegalNoticeState" AS ENUM ('RECUE', 'INCOMPLETE', 'RETRAIT_PROVISOIRE', 'CONTESTEE', 'RETIREE', 'RESTAUREE', 'CLASSEE');

-- CreateEnum
CREATE TYPE "LegalNoticeNotifierKind" AS ENUM ('PERSONNE_PHYSIQUE', 'PERSONNE_MORALE');

-- AlterEnum
ALTER TYPE "EmailTemplate" ADD VALUE 'RETRAIT_JURIDIQUE';

-- CreateTable
CREATE TABLE "LegalNotice" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "state" "LegalNoticeState" NOT NULL DEFAULT 'RECUE',
    "notifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifierKind" "LegalNoticeNotifierKind" NOT NULL,
    "notifierEmail" TEXT NOT NULL,
    "notifierName" TEXT NOT NULL,
    "notifierFirstNames" TEXT,
    "notifierProfession" TEXT,
    "notifierAddress" TEXT NOT NULL,
    "notifierNationality" TEXT,
    "notifierBirthDate" TIMESTAMP(3),
    "notifierBirthPlace" TEXT,
    "notifierLegalForm" TEXT,
    "notifierRepresentative" TEXT,
    "targetName" TEXT NOT NULL,
    "targetFirstNames" TEXT,
    "targetAddress" TEXT,
    "targetUserId" TEXT,
    "factsDescription" TEXT NOT NULL,
    "targetUrls" TEXT NOT NULL,
    "legalGrounds" TEXT NOT NULL,
    "priorContact" TEXT NOT NULL,
    "priorContactUnreachable" BOOLEAN NOT NULL DEFAULT false,
    "missingElements" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "replyDueAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalNoticeReply" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "contests" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalNoticeReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegalNotice_reference_key" ON "LegalNotice"("reference");

-- CreateIndex
CREATE INDEX "LegalNotice_state_notifiedAt_idx" ON "LegalNotice"("state", "notifiedAt");

-- CreateIndex
CREATE INDEX "LegalNotice_targetUserId_idx" ON "LegalNotice"("targetUserId");

-- CreateIndex
CREATE INDEX "LegalNoticeReply_noticeId_createdAt_idx" ON "LegalNoticeReply"("noticeId", "createdAt");

-- AddForeignKey
ALTER TABLE "LegalNoticeReply" ADD CONSTRAINT "LegalNoticeReply_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "LegalNotice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

