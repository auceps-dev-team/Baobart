import type { BadgeCode } from "@prisma/client";

import { opposeDe, verdictPour, type BadgePro } from "@/lib/services/badges";

/**
 * Les statuts : ce que Baobart garantit d'un compte.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX FAMILLES QU'ON NE CONFOND PAS (Baobart Badges.dc.html)
 *
 * Un **statut** engage Baobart : nous affirmons avoir vérifié quelqu'un. Il
 * est accordé par une personne de l'administration, il ouvre un droit, et il
 * se perd par un retrait tracé. Jamais automatique : « c'est précisément la
 * case qu'un arnaqueur cocherait ».
 *
 * Un **mérite** constate une activité (ventes, ancienneté…). Il se calcule,
 * n'ouvre aucun droit, et n'a pas de bouton de retrait. Il vit ailleurs.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI CET ÉCRAN EXISTE (04/11/2026)
 *
 * Audit du 04/11 (`Doc/INVENTAIRE_FONCTIONNALITES_2026-11.md`, B1) : publier
 * un service exige Freelance ou Agence (`lib/cms/droits.ts`), et rien ne les
 * accordait — sinon le script des comptes de test. Personne ne pouvait donc
 * publier un service en production.
 *
 * « Identité vérifiée », cinquième statut de la maquette, n'est pas ici : il
 * se lit sur `User.kycStatus` et ne se pose pas à la main.
 */

export interface Statut {
  code: CodeStatut;
  nom: string;
  /** Comment on l'obtient — la phrase de la maquette. */
  comment: string;
  /** Le droit qu'il ouvre. */
  droit: string;
}

export type CodeStatut = "VERIFIED_CREATOR" | "FREELANCE" | "AGENCE" | "VERIFIED_RECRUITER";

export const STATUTS: readonly Statut[] = [
  {
    code: "VERIFIED_CREATOR",
    nom: "Créateur vérifié",
    comment: "Vérification manuelle par l'administration : pièce d'identité et cohérence du portfolio.",
    droit: "Mise en avant dans la grille, confiance affichée sur la vignette.",
  },
  {
    code: "FREELANCE",
    nom: "Freelance",
    comment: "Accordé par l'administration, puis conditionné à un abonnement actif.",
    droit: "Publier des services.",
  },
  {
    code: "AGENCE",
    nom: "Agence",
    comment: "Accordé après contrôle de l'entité, puis conditionné à un abonnement actif.",
    droit: "Publier des services, profil d'équipe.",
  },
  {
    code: "VERIFIED_RECRUITER",
    nom: "Recruteur vérifié",
    comment: "Contrôle de l'entité qui recrute : registre du commerce ou équivalent.",
    droit: "« Offre vérifiée » apparaît sur chacune de ses offres.",
  },
];

const PAR_CODE = new Map(STATUTS.map((s) => [s.code, s]));

export function statutDe(code: CodeStatut): Statut {
  return PAR_CODE.get(code)!;
}

/** Le nom d'un statut lu dans une trace — ou le code tel quel s'il a disparu. */
export function nomDuStatut(code: string): string {
  return PAR_CODE.get(code as CodeStatut)?.nom ?? code;
}

function estPro(code: CodeStatut): code is BadgePro {
  return code === "FREELANCE" || code === "AGENCE";
}

export type SensGeste = "ACCORDER" | "RETIRER";

export interface Geste {
  /** « ACCORDER:FREELANCE » — ce qui voyage par le formulaire. */
  cle: string;
  sens: SensGeste;
  code: CodeStatut;
  libelle: string;
}

/**
 * Ce que l'administration peut faire sur ce compte, d'après ce qu'il porte.
 *
 * Freelance et Agence s'excluent : sur un compte Agence, le geste n'est pas
 * « accorder Freelance » à côté, mais « passer en Freelance », qui retire
 * l'autre. La maquette demande un choix radio, pas deux cases.
 */
export function gestesSur(actuels: readonly BadgeCode[]): Geste[] {
  const gestes: Geste[] = [];
  for (const s of STATUTS) {
    if (actuels.includes(s.code)) {
      gestes.push({ cle: `RETIRER:${s.code}`, sens: "RETIRER", code: s.code, libelle: `Retirer « ${s.nom} »` });
      continue;
    }
    if (estPro(s.code)) {
      const verdict = verdictPour({ aPoser: s.code, badgesActuels: actuels });
      if (!verdict.ok) continue;
      gestes.push({
        cle: `ACCORDER:${s.code}`,
        sens: "ACCORDER",
        code: s.code,
        libelle: verdict.retirerAvant
          ? `Passer en ${s.nom} (retire ${statutDe(opposeDe(s.code)).nom})`
          : `Accorder « ${s.nom} »`,
      });
      continue;
    }
    gestes.push({ cle: `ACCORDER:${s.code}`, sens: "ACCORDER", code: s.code, libelle: `Accorder « ${s.nom} »` });
  }
  return gestes;
}

/**
 * Relit une clé reçue du navigateur. Seuls les sens et les codes connus
 * passent : une action serveur est joignable sans l'écran, et une clé forgée
 * ne doit pas poser un mérite, ni un code qui n'existe pas.
 */
export function lireGeste(cle: string): { sens: SensGeste; code: CodeStatut } | null {
  const [sens, code] = cle.split(":");
  if (sens !== "ACCORDER" && sens !== "RETIRER") return null;
  if (!PAR_CODE.has(code as CodeStatut)) return null;
  return { sens, code: code as CodeStatut };
}

export function estCodeStatut(code: BadgeCode): code is CodeStatut {
  return PAR_CODE.has(code as CodeStatut);
}

// ════════════════════════════════════════════════════════════════════════════
// L'AFFICHAGE : L'ÉCUSSON
//
// « La forme le dit avant le texte — écusson pour ce que nous garantissons,
// jeton rond pour ce que les chiffres constatent. » Ajouté le 05/11/2026
// (lot 2) : jusque-là, un statut accordé ne s'affichait nulle part.

/** Les quatre statuts rangés, plus « Identité vérifiée », lu sur le KYC. */
export type CodeEcusson = CodeStatut | "KYC_VERIFIED";

export interface Ecusson {
  code: CodeEcusson;
  nom: string;
  glyphe: string;
  fond: string;
  /**
   * Freelance ou Agence sans abonnement ouvert : « le droit se referme —
   * rien de ce qui est déjà publié n'est effacé. Le badge passe en
   * “dormant”, visuellement grisé et sans son bandeau noir. »
   */
  dormant: boolean;
}

/** Ordre et couleurs de la maquette (`STATUTS`, Baobart Badges.dc.html). */
const APPARENCE: ReadonlyArray<{ code: CodeEcusson; nom: string; glyphe: string; fond: string }> = [
  { code: "VERIFIED_CREATOR", nom: "Créateur vérifié", glyphe: "✓", fond: "#FFD84A" },
  { code: "FREELANCE", nom: "Freelance", glyphe: "F", fond: "#C9A8F5" },
  { code: "AGENCE", nom: "Agence", glyphe: "A", fond: "#C9A8F5" },
  { code: "VERIFIED_RECRUITER", nom: "Recruteur vérifié", glyphe: "R", fond: "#FFD84A" },
  { code: "KYC_VERIFIED", nom: "Identité vérifiée", glyphe: "ID", fond: "#B9E8C0" },
];

/**
 * Tous les écussons d'un compte, dans l'ordre de la maquette. « Les statuts
 * ne sont jamais tronqués : ils sont cinq au maximum et ils engagent Baobart. »
 */
export function ecussonsDuCompte(compte: {
  statuts: readonly BadgeCode[];
  identiteVerifiee: boolean;
  /** L'abonnement est ouvert (`lireQualifications`). */
  abonnementOuvert: boolean;
}): Ecusson[] {
  return APPARENCE.filter((a) =>
    a.code === "KYC_VERIFIED" ? compte.identiteVerifiee : compte.statuts.includes(a.code),
  ).map((a) => ({
    ...a,
    dormant: (a.code === "FREELANCE" || a.code === "AGENCE") && !compte.abonnementOuvert,
  }));
}

/**
 * L'écusson d'une vignette : un seul, ou aucun.
 *
 * « Il répond à “peut-on lui faire confiance”. » Deux statuts y répondent :
 * Créateur vérifié, puis Identité vérifiée. Freelance et Agence disent ce
 * qu'on a le droit de publier, pas qu'on est fiable — et ils peuvent dormir,
 * ce que la vignette ne sait pas lire sans une requête par carte.
 */
export function ecussonDeVignette(compte: {
  statuts: readonly BadgeCode[];
  identiteVerifiee: boolean;
}): Pick<Ecusson, "nom" | "glyphe" | "fond"> | null {
  const code: CodeEcusson | null = compte.statuts.includes("VERIFIED_CREATOR")
    ? "VERIFIED_CREATOR"
    : compte.identiteVerifiee
      ? "KYC_VERIFIED"
      : null;
  if (!code) return null;
  const { nom, glyphe, fond } = APPARENCE.find((a) => a.code === code)!;
  return { nom, glyphe, fond };
}
