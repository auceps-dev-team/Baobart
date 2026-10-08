-- CreateEnum
CREATE TYPE "PhoneCodePurpose" AS ENUM ('LOGIN', 'VERIFY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PhoneCode" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "purpose" "PhoneCodePurpose" NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhoneCode_phone_purpose_createdAt_idx" ON "PhoneCode"("phone", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "PhoneCode_userId_idx" ON "PhoneCode"("userId");

-- CreateIndex
CREATE INDEX "PhoneCode_expiresAt_idx" ON "PhoneCode"("expiresAt");

-- AddForeignKey
ALTER TABLE "PhoneCode" ADD CONSTRAINT "PhoneCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

