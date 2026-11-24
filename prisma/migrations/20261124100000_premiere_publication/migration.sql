-- ============================================================================
-- LOT 5b — « Suivre les détails » : la date de PREMIÈRE publication
--
-- Le fil des créateurs suivis annonce « Kofi a publié… » : il lui faut la date
-- à laquelle une ressource est passée en ligne. `Product` n'en gardait aucune
-- (lu le 24/11/2026 dans `prisma/schema.prisma`).
-- ============================================================================

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "firstPublishedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "followFeedSeenAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Product_sellerId_firstPublishedAt_idx" ON "Product"("sellerId", "firstPublishedAt");

-- ============================================================================
-- LE RATTRAPAGE DE L'EXISTANT — une approximation, dite comme telle
--
-- La vraie date de mise en ligne n'a jamais été enregistrée : on prend la date
-- de création. Ne reçoivent une date que les ressources qui ont été en ligne
-- au moins une fois, d'après ce que la base en garde :
--   - celles qui le sont ;
--   - celles qui ont été vendues (on n'achète que ce qui est en ligne) ;
--   - celles qu'une sanction de risque a archivées (`lib/domain/risque.ts`
--     n'archive que des ressources PUBLISHED) ;
--   - celles qu'un retrait juridique doit rendre à l'état PUBLISHED.
-- Un brouillon jamais publié garde NULL : le jour où il paraît, le déclencheur
-- lui donne sa vraie date.
-- ============================================================================
UPDATE "Product" AS p
SET "firstPublishedAt" = p."createdAt"
WHERE p."status" = 'PUBLISHED'
   OR p."salesCount" > 0
   OR p."archivedByRiskAt" IS NOT NULL
   OR EXISTS (
        SELECT 1 FROM "LegalSuspension" AS l
        WHERE l."productId" = p."id" AND l."previousStatus" = 'PUBLISHED'
      );

-- ============================================================================
-- LE DÉCLENCHEUR
--
-- Huit chemins écrivent l'état PUBLISHED (lu le 24/11) : la publication par le
-- créateur, la levée d'une sanction de risque, la levée d'un retrait juridique,
-- et cinq scripts ou jeux de démonstration. Une écriture dans le code en
-- oublierait — la raison écrite de `20260802141946_garde_fous_argent` : « une
-- invariante qui ne vit que dans le code applicatif finit toujours par être
-- contournée par un script ». Ici, la base la tient seule.
--
-- Deux règles :
--   1. Une ligne qui est PUBLISHED sans date en reçoit une (l'heure de la
--      transaction). Une date fournie à l'insertion est respectée : un script
--      de démonstration peut dater ses ressources dans le passé.
--   2. Une date posée ne change plus, ni ne s'efface : dépublier puis
--      republier ne réannonce pas la ressource dans le fil de ses abonnés.
-- ============================================================================
CREATE OR REPLACE FUNCTION baobart_product_first_published()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."firstPublishedAt" IS NOT NULL THEN
    NEW."firstPublishedAt" := OLD."firstPublishedAt";
  END IF;
  IF NEW."status" = 'PUBLISHED' AND NEW."firstPublishedAt" IS NULL THEN
    NEW."firstPublishedAt" := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_first_published
BEFORE INSERT OR UPDATE ON "Product"
FOR EACH ROW EXECUTE FUNCTION baobart_product_first_published();
