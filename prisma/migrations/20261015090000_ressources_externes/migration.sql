-- Ressources externes (v1.90.0) : un fichier vendu peut vivre ailleurs que
-- chez nous. Décidé le 15/10/2026 ; voir `ProductFile` dans schema.prisma.

-- AlterTable
ALTER TABLE "ProductFile" ADD COLUMN     "externalUrl" TEXT,
ALTER COLUMN "mediaId" DROP NOT NULL,
ALTER COLUMN "sizeBytes" DROP NOT NULL;

-- Chez nous ou ailleurs : exactement l'un des deux. Sans cette règle, une
-- ligne sans média ni lien se vendrait, et la route de téléchargement n'aurait
-- rien à servir à quelqu'un qui a payé.
ALTER TABLE "ProductFile"
  ADD CONSTRAINT "ProductFile_un_seul_emplacement"
  CHECK (num_nonnulls("mediaId", "externalUrl") = 1);

-- Un aperçu se montre à tout le monde depuis notre stockage public ; un lien
-- externe n'est servi qu'après achat. Les mêler n'a pas de sens.
ALTER TABLE "ProductFile"
  ADD CONSTRAINT "ProductFile_lien_externe_vendu"
  CHECK ("externalUrl" IS NULL OR "role" = 'SOURCE');

-- La taille ne manque que là où on ne l'a pas mesurée : chez les autres.
ALTER TABLE "ProductFile"
  ADD CONSTRAINT "ProductFile_taille_des_heberges"
  CHECK ("mediaId" IS NULL OR "sizeBytes" IS NOT NULL);

-- La validation applicative n'accepte que https (lib/products/lien-externe.ts).
-- Redit ici : une écriture qui la contournerait ne doit pas pouvoir rediriger
-- un acheteur vers javascript: ou http.
ALTER TABLE "ProductFile"
  ADD CONSTRAINT "ProductFile_lien_externe_https"
  CHECK ("externalUrl" IS NULL OR "externalUrl" LIKE 'https://%');
