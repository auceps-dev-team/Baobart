import "server-only";

import sharp from "sharp";

import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";

import { xmpDe } from "./apercu";
import { deposerObjet, lireObjet, telechargerObjet } from "./storage";
import { gravureSansPertePossible, injecterXmp } from "./xmp";

/**
 * La provenance d'un fichier VENDU : la mention de droits dans le fichier livré,
 * et une copie de référence pour le vendeur en cas de litige.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS CHOSES DISTINCTES, TROIS DESTINATAIRES
 *
 *   — l'APERÇU public (800 px) porte auteur + © + opt-out IA — `apercu.ts` ;
 *   — le FICHIER LIVRÉ (l'original du créateur) reçoit la même mention, gravée
 *     SANS perte dans le conteneur (`xmp.ts`) : l'acheteur repart avec un
 *     fichier qui dit d'où il vient et qu'il n'est pas offert à l'IA ;
 *   — une COPIE DE RÉFÉRENCE, réduite et privée, porte EN PLUS la licence. Le
 *     vendeur la retrouve dans son tableau de bord et la compare à une copie
 *     trouvée dans la nature : « tu as utilisé mon produit autrement que ce que
 *     la licence prévoit ». L'acheteur ne la voit jamais.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON GRAVE SUR PLACE, AVEC UN GARDE-FOU
 *
 * Décidé le 17/10/2026 : pas de second exemplaire du fichier vendu (le
 * stockage doublerait). On remplace l'original par sa version gravée — mais
 * SEULEMENT si celle-ci se redécode correctement. Une gravure qui produirait un
 * fichier illisible laisse l'original intact : mieux vaut pas de mention qu'un
 * produit abîmé, et le vendeur n'a pas d'original de secours.
 */

/** Au-delà, on ne grave pas : charger le fichier en mémoire coûterait trop. L'original part intact. */
const POIDS_MAX_GRAVURE = 100 * 1024 * 1024;

/** La copie de référence : assez pour reconnaître l'œuvre, pas pour la réutiliser. */
const LARGEUR_REFERENCE = 1024;
const QUALITE_REFERENCE = 60;

/** La clé privée de la copie de référence — jamais sous le préfixe public. */
export function cleDeReference(mediaId: string): string {
  return `references/${mediaId}.webp`;
}

/** Le fichier gravé se redécode-t-il ? Le garde-fou avant de remplacer l'original. */
async function redecodable(image: Buffer): Promise<boolean> {
  try {
    await sharp(image).metadata();
    return true;
  } catch {
    return false;
  }
}

export interface IssueProvenance {
  /** Le fichier livré a-t-il reçu la mention de droits ? */
  grave: boolean;
  /** Une copie de référence a-t-elle été fabriquée ? */
  reference: boolean;
}

/**
 * Pose la provenance sur un fichier source image. Sans effet (tout à `false`)
 * sur un format non gravable, un fichier trop lourd, ou une source illisible —
 * la ressource reste vendable, simplement sans mention embarquée.
 */
export async function poserLaProvenance(input: {
  mediaId: string;
  s3Key: string;
  taille: number;
  contentType: string;
  pseudo: string | null;
  /** Le titre de la licence du produit, gravé dans la copie de référence. */
  licenceTitre: string | null;
}): Promise<IssueProvenance> {
  if (input.taille > POIDS_MAX_GRAVURE) return { grave: false, reference: false };

  const source = await telechargerObjet(input.s3Key, POIDS_MAX_GRAVURE);
  if (!source || !gravureSansPertePossible(source)) {
    return { grave: false, reference: false };
  }

  const issue: IssueProvenance = { grave: false, reference: false };

  // 1. Le fichier livré, gravé sur place, sans perte.
  const grave = injecterXmp(source, xmpDe(input.pseudo, { apercu: false }));
  if (grave && (await redecodable(grave))) {
    await deposerObjet({ cle: input.s3Key, corps: grave, contentType: input.contentType, prive: true });
    // Le checksum relu du stockage, pas supposé : les octets ont changé.
    const relu = await lireObjet(input.s3Key);
    await db.mediaAsset.update({
      where: { id: input.mediaId },
      data: { sizeBytes: grave.length, ...(relu ? { checksum: relu.etag } : {}) },
    });
    issue.grave = true;
  } else if (grave) {
    journal.avertissement("provenance : gravure illisible, original conservé", {
      media: input.mediaId,
    });
  }

  // 2. La copie de référence, réduite, privée, avec la licence.
  try {
    const reference = await sharp(grave ?? source)
      .rotate()
      .resize({ width: LARGEUR_REFERENCE, withoutEnlargement: true, fit: "inside" })
      .withXmp(xmpDe(input.pseudo, { apercu: false, licence: input.licenceTitre }))
      .webp({ quality: QUALITE_REFERENCE })
      .toBuffer();
    await deposerObjet({ cle: cleDeReference(input.mediaId), corps: reference, contentType: "image/webp", prive: true });
    issue.reference = true;
  } catch (cause) {

    journal.avertissement("provenance : copie de référence non produite", {
      media: input.mediaId,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
  }

  return issue;
}
