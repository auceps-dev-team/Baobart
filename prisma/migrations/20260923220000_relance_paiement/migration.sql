-- ============================================================================
-- LE `DROP TABLE` CI-DESSOUS EST SUR, ET VOICI POURQUOI
--
-- `SentAbandonedCartEmail` portait un `cartId`. Elle n'a jamais eu ni lecteur
-- ni ecrivain : verifie par recherche dans `lib/`, `app/` et `prisma/`, et
-- comptee a zero ligne dans la base de developpement le 23 septembre 2026.
--
-- Elle ne pouvait pas en avoir : `Cart` n'est ecrit nulle part non plus. On
-- achete une ressource a la fois depuis sa fiche, il n'y a pas d'etape
-- « panier » a abandonner.
--
-- Ce qui s'abandonne reellement est un paiement mobile money ouvert, et c'est
-- ce que `RelancePaiement` suit. Renommer plutot qu'ajouter evite de laisser
-- derriere une table morte que quelqu'un croira devoir remplir.
--
-- Si cette migration devait tourner sur une base ou la table contient des
-- lignes, il faudrait les exporter d'abord — mais elles n'auraient ete ecrites
-- par aucun code de ce depot.
-- ============================================================================

-- DropTable
DROP TABLE "SentAbandonedCartEmail";

-- CreateTable
CREATE TABLE "RelancePaiement" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "converted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RelancePaiement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RelancePaiement_orderId_key" ON "RelancePaiement"("orderId");

-- CreateIndex
CREATE INDEX "RelancePaiement_sentAt_idx" ON "RelancePaiement"("sentAt");

