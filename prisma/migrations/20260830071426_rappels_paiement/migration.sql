-- CreateEnum
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'REJECTED');

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventRef" TEXT NOT NULL,
    "providerRef" TEXT,
    "payload" JSONB NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_status_receivedAt_idx" ON "PaymentWebhookEvent"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_providerRef_idx" ON "PaymentWebhookEvent"("providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_eventRef_key" ON "PaymentWebhookEvent"("provider", "eventRef");
