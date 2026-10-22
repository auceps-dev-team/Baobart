-- La réservation d'un remboursement en cours (VULN-02, audit du 18/10).
--
-- Deux demandes simultanées passaient toutes deux le contrôle « jumeau » avant
-- que l'opérateur ait répondu : l'argent pouvait partir deux fois. Le verrou
-- posé le 18/10 tenait en mémoire, et entre instances seulement avec Redis.
-- Celui-ci tient dans la base : un UPDATE conditionnel sur cette colonne, que
-- PostgreSQL n'accorde qu'à une requête (lib/ventes/remboursement.ts). Nul
-- pour toutes les lignes existantes : aucune n'a de remboursement en cours.

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "refundLockedUntil" TIMESTAMP(3);
