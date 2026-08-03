-- Sans la référence rendue par l'opérateur, une réclamation de créateur
-- (« je n'ai rien reçu ») n'a aucune prise : rien ne relie notre versement à
-- un ordre chez lui.
ALTER TABLE "Payout" ADD COLUMN "providerRef" TEXT;
CREATE INDEX "Payout_providerRef_idx" ON "Payout"("providerRef");
