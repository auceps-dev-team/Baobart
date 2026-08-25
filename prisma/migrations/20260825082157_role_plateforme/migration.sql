-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('MEMBER', 'ADMIN', 'SUPER_ADMIN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "platformRole" "PlatformRole" NOT NULL DEFAULT 'MEMBER';

-- CreateIndex
CREATE INDEX "User_platformRole_idx" ON "User"("platformRole");
