-- ADS manager : les bannières de la mosaïque (demandé le 03/10).
-- Généré par prisma migrate diff (base d'ombre baobart_shadow, nommée en clair).

-- CreateEnum
CREATE TYPE "AdMediaKind" AS ENUM ('IMAGE', 'VIDEO');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "adId" TEXT;

-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mediaKind" "AdMediaKind" NOT NULL DEFAULT 'IMAGE',
    "imageUrl" TEXT NOT NULL,
    "imageWidth" INTEGER NOT NULL,
    "imageHeight" INTEGER NOT NULL,
    "videoUrl" TEXT,
    "linkUrl" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdDailyStat" (
    "adId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AdDailyStat_pkey" PRIMARY KEY ("adId","day")
);

-- CreateTable
CREATE TABLE "AdSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "minGap" INTEGER NOT NULL DEFAULT 4,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ad_pausedAt_startsAt_endsAt_idx" ON "Ad"("pausedAt", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Order_adId_idx" ON "Order"("adId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdDailyStat" ADD CONSTRAINT "AdDailyStat_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

