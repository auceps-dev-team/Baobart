/**
 * Libellés et règles partagés pour les types de licence (`LicenseType`).
 *
 * Source unique lue par la page `/licences` et le certificat de licence :
 * ajouter ou reformuler une condition ici met à jour les deux écrans d'un coup.
 */

/** Le titre du type COMMERCIAL (`prisma/seed.ts`), pour une ressource sans licence choisie. */
export const LICENCE_PAR_DEFAUT = "Licence commerciale";

/** La description du type COMMERCIAL (`prisma/seed.ts`), quand aucune licence n'est liée au produit. */
export const DESCRIPTION_LICENCE_PAR_DEFAUT =
  "Usage en clientèle et projets commerciaux, un projet à la fois. Pas de revente du fichier source.";

/** Les conditions booléennes du type COMMERCIAL (`prisma/seed.ts`). */
export const CONDITIONS_LICENCE_PAR_DEFAUT: Record<string, boolean> = {
  commercial: true,
  print: true,
  resale: false,
};

/** Les conditions rangées avec chaque type (`LicenseType.conditions`), dites en clair. */
export const CONDITIONS: Record<string, string> = {
  commercial: "projets commerciaux et travaux pour un client",
  print: "impression",
  edition: "édition (livres, magazines, affiches grand format)",
  broadcast: "diffusion (télévision, cinéma, plateformes vidéo)",
  merchandising: "produits dérivés (textile, objets)",
  resale: "revente du fichier tel quel",
};

export interface ConditionsLicence {
  permises: string[];
  interdites: string[];
}

/** Décompose le JSON `LicenseType.conditions` en deux listes lisibles. */
export function conditionsDeLicence(conditions: unknown): ConditionsLicence {
  const c =
    conditions && typeof conditions === "object" && !Array.isArray(conditions)
      ? (conditions as Record<string, unknown>)
      : {};
  const permises: string[] = [];
  const interdites: string[] = [];
  for (const [cle, libelle] of Object.entries(CONDITIONS)) {
    if (c[cle] === true) permises.push(libelle);
    else if (c[cle] === false) interdites.push(libelle);
  }
  return { permises, interdites };
}

