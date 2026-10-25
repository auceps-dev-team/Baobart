-- Le code par courriel pour changer de compte de versement (23/10).
--
-- La double authentification est obligatoire pour ce geste depuis le 18/10
-- (VULN-08) ; sans application TOTP, le code arrive par courriel. Mécanique
-- de PhoneCode — empreinte salée, essais comptés, un seul code vivant — plus
-- la cible : l'empreinte du compte que le code autorise
-- (lib/auth/code-courriel.ts).

-- CreateEnum
CREATE TYPE "EmailCodePurpose" AS ENUM ('PAYOUT_ACCOUNT');

-- AlterEnum
ALTER TYPE "EmailTemplate" ADD VALUE 'CODE_COMPTE_VERSEMENT';

-- CreateTable
CREATE TABLE "EmailCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "EmailCodePurpose" NOT NULL,
    "target" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailCode_userId_purpose_createdAt_idx" ON "EmailCode"("userId", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "EmailCode_createdAt_idx" ON "EmailCode"("createdAt");

-- AddForeignKey
ALTER TABLE "EmailCode" ADD CONSTRAINT "EmailCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

