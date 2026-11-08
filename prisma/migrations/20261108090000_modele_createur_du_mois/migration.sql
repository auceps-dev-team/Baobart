-- Le courriel « 🎉 Tu es Créateur du mois » (SPEC_GAMIFICATION §5).
--
-- Décidé le 08/11/2026 : « Créateur du mois » est le seul mérite rangé en base
-- (UserBadge.validUntil), pour pouvoir s'annoncer quand on le gagne et porter
-- sa date de fin. Le passage quotidien /api/cron/merites le pose et l'annonce
-- (lib/badges/createur-du-mois.ts). Sa perte ne s'annonce pas : la maquette
-- des badges le demande.

-- AlterEnum
ALTER TYPE "EmailTemplate" ADD VALUE 'CREATEUR_DU_MOIS';
