-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EmailTemplate" ADD VALUE 'COMMANDE_REMBOURSEE';
ALTER TYPE "EmailTemplate" ADD VALUE 'EVENEMENT_ANNULE';
ALTER TYPE "EmailTemplate" ADD VALUE 'VENTE_REALISEE';
ALTER TYPE "EmailTemplate" ADD VALUE 'CONTENU_PUBLIE';
ALTER TYPE "EmailTemplate" ADD VALUE 'CONTENU_REFUSE';
ALTER TYPE "EmailTemplate" ADD VALUE 'CANDIDATURE_RECUE';
ALTER TYPE "EmailTemplate" ADD VALUE 'INSCRIPTION_EVENEMENT';
ALTER TYPE "EmailTemplate" ADD VALUE 'NOUVEL_ABONNE';

