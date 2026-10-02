-- AlterEnum
-- L'avis aux inscrits quand une annulation est levée. Il n'existait pas : un
-- inscrit qui avait appris l'annulation n'apprenait jamais que l'événement
-- revenait (mesuré le 25/09, Qualitytest S6).
ALTER TYPE "EmailTemplate" ADD VALUE 'EVENEMENT_MAINTENU';
