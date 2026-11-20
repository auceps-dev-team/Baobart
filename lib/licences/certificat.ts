import { resteAToi, type LigneAchetee } from "@/lib/dashboard/bibliotheque-regles";
import { encaisseDe } from "@/lib/domain/encaisse";
import {
  CONDITIONS_LICENCE_PAR_DEFAUT,
  DESCRIPTION_LICENCE_PAR_DEFAUT,
  LICENCE_PAR_DEFAUT,
  conditionsDeLicence,
  type ConditionsLicence,
} from "@/lib/licences/conditions";

/**
 * Règles pures du certificat de licence imprimable.
 *
 * Pas d'accès base ici : le format du numéro, la liste des conditions et la
 * déduction du motif de révocation se vérifient indépendamment de Prisma.
 */

export type MotifRevocation = "remboursé" | "contesté" | "accès retiré";

export interface LicenceCertificat extends ConditionsLicence {
  titre: string;
  description: string;
}

/**
 * Numéro déterministe, non secret : `LC-` + année d'achat UTC + 8 derniers
 * caractères alphanumériques de la ligne d'achat (`OrderItem.id`) en majuscules.
 * Exemple de la spec : `LC-2026-XXXXXXXX`.
 */
export function numeroDeCertificat(orderItemId: string, acheteLe: Date): string {
  const annee = acheteLe.getUTCFullYear();
  const suffixe = orderItemId
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-8)
    .toUpperCase()
    .padStart(8, "0");
  return `LC-${annee}-${suffixe}`;
}

/** Numéro court de commande, identique à l'historique des achats (`#XXXXXX`). */
export function numeroCommandeCourt(orderId: string): string {
  return `#${orderId.slice(-6).toUpperCase()}`;
}

/**
 * Formate le type de licence du produit pour le certificat, avec repli sur
 * la licence commerciale par défaut lorsque le créateur n'en a pas choisi.
 */
export function formaterLicenceCertificat(
  licenseType: {
    title: string;
    description: string;
    conditions: unknown;
  } | null,
): LicenceCertificat {
  const titre = licenseType?.title ?? LICENCE_PAR_DEFAUT;
  const description = licenseType?.description ?? DESCRIPTION_LICENCE_PAR_DEFAUT;
  const rawConditions = licenseType ? licenseType.conditions : CONDITIONS_LICENCE_PAR_DEFAUT;
  const { permises, interdites } = conditionsDeLicence(rawConditions);
  return { titre, description, permises, interdites };
}

/**
 * Pourquoi une ligne d'achat aboutie n'ouvre-t-elle plus ses droits ?
 * Délègue le verdict principal à `resteAToi` et en extrait les motifs précis
 * (`remboursé`, `contesté`, `accès retiré`) pour l'en-tête du certificat.
 */
export function motifsRevocation(ligne: LigneAchetee): MotifRevocation[] {
  if (resteAToi(ligne)) return [];
  const motifs: MotifRevocation[] = [];
  const totalPaye = encaisseDe(ligne);
  if (totalPaye > 0 && ligne.refundedAmount >= totalPaye) motifs.push("remboursé");
  if (ligne.chargebackAt !== null && ligne.chargebackReversedAt === null) motifs.push("contesté");
  if (ligne.accessRevokedAt !== null) motifs.push("accès retiré");
  return motifs;
}

