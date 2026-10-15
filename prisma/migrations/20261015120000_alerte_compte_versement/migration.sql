-- Alerte de sécurité au changement de compte de versement (v1.91.0).
--
-- Un seul ajout : la valeur d'enum qui manquait à `EmailTemplate`. Sans elle,
-- le dépôt du courriel échouerait en production sur « invalid input value for
-- enum », et le test qui compare `MODELES` à l'enum casserait.
ALTER TYPE "EmailTemplate" ADD VALUE 'COMPTE_VERSEMENT_MODIFIE';
