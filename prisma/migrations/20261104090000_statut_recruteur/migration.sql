-- Le statut « Recruteur vérifié » (Baobart Badges.dc.html, E.1).
--
-- Les statuts sont accordés par l'administration depuis
-- /dashboard/systeme/statuts. Les quatre autres codes existaient déjà dans
-- l'énumération ; celui-ci manquait. « Identité vérifiée » n'a pas de code :
-- il se lit sur `User.kycStatus`, il ne se pose pas.

-- AlterEnum
ALTER TYPE "BadgeCode" ADD VALUE 'VERIFIED_RECRUITER';
