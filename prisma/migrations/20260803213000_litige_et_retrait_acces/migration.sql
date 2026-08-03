-- Un paiement contesté auprès de la banque et un accès coupé par le vendeur
-- sont deux façons de perdre le droit de télécharger, distinctes du
-- remboursement. Sans elles, un acheteur qui conteste sa transaction garde son
-- fichier pour toujours.
ALTER TABLE "OrderItem" ADD COLUMN "chargebackAt" TIMESTAMP(3);
ALTER TABLE "OrderItem" ADD COLUMN "chargebackReversedAt" TIMESTAMP(3);
ALTER TABLE "OrderItem" ADD COLUMN "accessRevokedAt" TIMESTAMP(3);

-- Une contestation ne peut pas être tranchée avant d'avoir été ouverte.
ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_litige_coherent"
  CHECK ("chargebackReversedAt" IS NULL OR "chargebackAt" IS NOT NULL);

-- Retrouver les lignes en litige d'un vendeur doit rester bon marché.
CREATE INDEX "OrderItem_chargebackAt_idx" ON "OrderItem"("chargebackAt");
