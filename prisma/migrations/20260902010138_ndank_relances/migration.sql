-- CreateEnum
CREATE TYPE "Cadence" AS ENUM ('HEBDOMADAIRE', 'MENSUEL', 'TRIMESTRIEL', 'ANNUEL');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "cadence" "Cadence" NOT NULL DEFAULT 'MENSUEL';

-- CreateTable
CREATE TABLE "SubscriptionReminder" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "canaux" TEXT[],
    "envoyeeLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionReminder_subscriptionId_idx" ON "SubscriptionReminder"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionReminder_subscriptionId_cle_key" ON "SubscriptionReminder"("subscriptionId", "cle");

-- AddForeignKey
ALTER TABLE "SubscriptionReminder" ADD CONSTRAINT "SubscriptionReminder_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
