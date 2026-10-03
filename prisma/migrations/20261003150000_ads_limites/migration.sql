-- ADS manager : les limites contre le gonflage des compteurs, réglables depuis
-- l'écran (demandé le 03/10). Les défauts reprennent ceux de v1.71.0 pour le
-- débit (120 envois de vues, 30 clics par minute et par adresse), et posent un
-- plafond par adresse, par pub et par jour (20 affichages, 1 clic).
-- Généré par prisma migrate diff (base d'ombre baobart_shadow, nommée en clair).

-- AlterTable
ALTER TABLE "AdSettings" ADD COLUMN     "clicksPerMinute" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "maxClicksPerVisitorDay" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "maxViewsPerVisitorDay" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "viewsPerMinute" INTEGER NOT NULL DEFAULT 120;
