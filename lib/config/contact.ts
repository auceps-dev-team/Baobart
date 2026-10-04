/**
 * Les adresses où l'on écrit à Baobart.
 *
 * Une seule pour l'instant, décidée le 04/10 : celle des données personnelles,
 * citée par la politique de cookies et la politique de confidentialité. La
 * maquette l'écrivait déjà (`privacy@baobart.africa`) ; les courriels, eux,
 * partent d'une autre adresse (`EMAIL_FROM`, `lib/email/pilotes.ts`), qui n'a
 * pas vocation à recevoir des demandes.
 *
 * Rangée ici plutôt que recopiée dans chaque page juridique : deux copies
 * finiraient par diverger, et une adresse fausse sur une page juridique envoie
 * les demandes dans le vide.
 */
export const ADRESSE_DONNEES_PERSONNELLES = "privacy@baobart.africa";
