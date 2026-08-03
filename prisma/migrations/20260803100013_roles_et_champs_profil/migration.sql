-- CreateEnum
CREATE TYPE "IntentionCompte" AS ENUM ('ACHETEUR', 'CREATEUR');

-- AlterEnum
ALTER TYPE "TeamRole" ADD VALUE 'OWNER';

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "behance" TEXT,
ADD COLUMN     "dailyRate" INTEGER,
ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "openToCommissions" TEXT,
ADD COLUMN     "portfolioUrl" TEXT,
ADD COLUMN     "speciality" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "intention" "IntentionCompte" NOT NULL DEFAULT 'ACHETEUR';

-- CreateTable
CREATE TABLE "BillingInfo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "region" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingInfo_userId_key" ON "BillingInfo"("userId");

-- AddForeignKey
ALTER TABLE "BillingInfo" ADD CONSTRAINT "BillingInfo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

