/*
  Warnings:

  - You are about to drop the column `status` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `EventRegistration` table. All the data in the column will be lost.
  - Added the required column `description` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Event` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Event_status_startsAt_idx";

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "status",
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "coverUrl" TEXT,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "state" "ContentState" NOT NULL DEFAULT 'BROUILLON',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "EventRegistration" DROP COLUMN "status";

-- CreateIndex
CREATE INDEX "Event_state_startsAt_idx" ON "Event"("state", "startsAt");

-- CreateIndex
CREATE INDEX "Event_organizerId_startsAt_idx" ON "Event"("organizerId", "startsAt");

-- CreateIndex
CREATE INDEX "EventRegistration_userId_createdAt_idx" ON "EventRegistration"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
