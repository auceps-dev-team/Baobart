-- « Vues de page » du profil public (MAQUETTES_A_FAIRE §F.2).
--
-- Un compteur dénormalisé, comme `followerCount` : jamais de COUNT() live sur
-- une vitrine (§3.9-H). Ce qui le fait monter — un visiteur, un profil, un
-- jour, sans robots — est dit dans `lib/createurs/vues.ts`. Zéro pour tout le
-- monde au départ : rien ne comptait avant, et l'on n'invente pas de passé.

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;
