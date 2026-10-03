-- ADS manager : archiver une publicité au lieu de la supprimer (demandé le 03/10).
-- Supprimer effaçait ses affichages et ses clics, que rien ne recrée.
-- Généré par prisma migrate diff (base d'ombre baobart_shadow, nommée en clair).

-- DropIndex
DROP INDEX "Ad_pausedAt_startsAt_endsAt_idx";

-- AlterTable
ALTER TABLE "Ad" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Ad_archivedAt_pausedAt_startsAt_endsAt_idx" ON "Ad"("archivedAt", "pausedAt", "startsAt", "endsAt");
