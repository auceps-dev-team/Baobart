/**
 * Ce qu'on accepte d'une candidature — validation pure, sans base ni réseau.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE CV N'EST PAS UNE IMAGE, ET NE PASSE PAS PAR L'URL SIGNÉE
 *
 * Les fichiers de produits passent par `UploadReservation` : le client obtient
 * une URL présignée et écrit directement au stockage. C'est efficace pour un
 * fichier de quarante mégaoctets qu'on ne relira jamais, et c'est un mauvais
 * choix pour un CV.
 *
 * Sur une URL signée, personne ne contrôle ce qui atterrit — le client peut
 * déposer n'importe quel document de la taille qu'il veut. Sur un CV de
 * quelques centaines de kilo-octets, on préfère le faire passer par le serveur
 * pour le vérifier avant l'écriture.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE TYPE SE VÉRIFIE AUX MAGIC BYTES, PAS À L'EXTENSION
 *
 * `.pdf` dans le nom ne prouve rien : n'importe quel fichier peut être renommé.
 * Le vrai contrôle est sur les cinq premiers octets — un PDF commence par
 * « %PDF- ». C'est vérifié dans `depotAcceptable`, à partir du buffer reçu.
 */

export const CV_TAILLE_MAX = 5 * 1_048_576;
export const MESSAGE_MAX = 4_000;

/** Ce qu'on lit du formulaire, brut. */
export interface Saisie {
  message: string;
  /** La taille et le nom viennent du navigateur — on ne les croit pas. */
  cvNom: string;
  cvOctets: number;
  cvType: string;
}

export type Champ = "message" | "cv";
export interface Refus {
  champ: Champ;
  message: string;
}

export type Verdict =
  | { ok: true; message: string; cvExtension: "pdf" }
  | { ok: false; refus: Refus };

/**
 * Vérifie ce que le formulaire promet, avant de lire le fichier.
 *
 * Le message est facultatif — mais borné. Sans borne, un candidat qui tape à
 * côté envoie un roman ; et un envoi automatisé remplirait la base sans être
 * arrêté par l'unicité, puisqu'un même contenu ne se répète pas.
 */
export function valider(saisie: Saisie): Verdict {
  const message = saisie.message.trim();
  if (message.length > MESSAGE_MAX) {
    return refus("message", "Le message d'accompagnement est trop long.");
  }

  if (!saisie.cvNom || saisie.cvOctets === 0) {
    return refus("cv", "Joins ton CV au format PDF.");
  }

  if (saisie.cvOctets > CV_TAILLE_MAX) {
    // 5 Mo suffit pour un CV illustré ; au-delà, le fichier est probablement un
    // portfolio, qui n'a pas sa place ici — la fiche a un lien portfolio pour
    // ça.
    return refus("cv", "Ton CV dépasse 5 Mo. Réduis-le, ou joins un lien vers ton portfolio à la place.");
  }

  // Le nom finit par `.pdf` ? C'est faible, mais ça écarte les erreurs franches
  // sans lire le fichier. Le vrai contrôle est sur les magic bytes, plus bas.
  if (!/\.pdf$/i.test(saisie.cvNom)) {
    return refus("cv", "Seul le PDF est accepté.");
  }

  // Le navigateur envoie `application/pdf` — on l'accepte, mais on ne lui fait
  // pas confiance. La vérification sur les octets suit dans `depotAcceptable`.
  if (saisie.cvType && saisie.cvType !== "application/pdf") {
    return refus("cv", "Seul le PDF est accepté.");
  }

  return { ok: true, message, cvExtension: "pdf" };
}

/**
 * Le fichier commence-t-il vraiment par les magic bytes d'un PDF ?
 *
 * `%PDF-` en ASCII, soit `25 50 44 46 2d`. C'est le seul contrôle qui ne se
 * contourne pas en renommant le fichier.
 */
export function depotAcceptable(premiersOctets: Uint8Array): boolean {
  if (premiersOctets.length < 5) return false;
  return (
    premiersOctets[0] === 0x25 &&
    premiersOctets[1] === 0x50 &&
    premiersOctets[2] === 0x44 &&
    premiersOctets[3] === 0x46 &&
    premiersOctets[4] === 0x2d
  );
}

function refus(champ: Champ, message: string): Verdict {
  return { ok: false, refus: { champ, message } };
}
