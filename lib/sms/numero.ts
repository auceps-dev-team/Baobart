/**
 * Mettre un numéro sous la forme que les opérateurs attendent.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * C'EST ICI QU'UN SMS SE PERD SANS BRUIT
 *
 * Un opérateur veut du E.164 : un `+`, l'indicatif du pays, le numéro, sans
 * espace ni tiret. Les gens, eux, écrivent « 07 00 00 00 00 », « 0700000000 »,
 * « 00225 07 00 00 00 00 » ou « +225 07-00-00-00-00 ». Envoyer l'un de ces
 * quatre tels quels ne produit pas d'erreur visible : le message est refusé
 * quelque part et personne ne s'en aperçoit — sauf l'abonné, qui perd son accès
 * sans avoir été prévenu.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON NORMALISE, ON NE VALIDE PAS
 *
 * La tentation est de vérifier la longueur par pays. C'est un piège : les plans
 * de numérotation changent — la Côte d'Ivoire est passée à dix chiffres en 2021,
 * et une règle écrite en dur ce jour-là aurait refusé tous les nouveaux numéros.
 *
 * On se contente donc de mettre en forme, et l'on écarte seulement ce qui ne
 * peut être un numéro pour personne. C'est l'opérateur qui tranche la validité :
 * il connaît les plans, nous non.
 */

import { PAYS } from "@/lib/payments/rails";

/**
 * Les indicatifs des pays desservis.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DÉRIVÉS, JAMAIS RECOPIÉS
 *
 * `PAYS` est la table qui décide où Baobart vend. Écrire ici une seconde liste
 * d'indicatifs créerait un décalage silencieux : le jour où l'on ouvre le Togo
 * côté paiement, ses abonnés auraient un numéro impossible à mettre en forme,
 * donc aucun SMS, donc un accès coupé sans avertissement — et rien dans le code
 * ne dirait pourquoi.
 *
 * On dérive donc, et le décalage devient impossible.
 */
export const INDICATIFS: Record<string, string> = Object.fromEntries(
  PAYS.map((p) => [p.code, p.indicatif.replace(/^\+/, "")]),
);

/** Ce qu'il faut faire du zéro de tête, pays par pays. Voir `Pays`. */
const ZERO_DE_TETE: Record<string, "garder" | "retirer"> = Object.fromEntries(
  PAYS.map((p) => [p.code, p.zeroDeTete]),
);

/** Bornes larges, celles de la recommandation E.164 elle-même. */
const MIN_CHIFFRES = 8;
const MAX_CHIFFRES = 15;

/**
 * Rend un numéro en E.164, ou `null` si c'est hors de portée.
 *
 * `paysParDefaut` sert quand le numéro n'annonce pas son pays. Sans lui, un
 * numéro local est inutilisable — et le deviner à partir de ses premiers
 * chiffres marche jusqu'au jour où deux pays partagent un préfixe.
 */
export function versE164(brut: string, paysParDefaut: string): string | null {
  const propre = brut.trim();
  if (propre.length === 0) return null;

  // Ce qui n'est ni un chiffre, ni un `+` de tête, est du décor : espaces,
  // tirets, points, parenthèses. On les retire sans se demander pourquoi.
  const chiffres = propre.replace(/[^\d]/g, "");
  if (chiffres.length === 0) return null;

  const indicatif = INDICATIFS[paysParDefaut];

  // Déjà international, sous l'une de ses deux écritures.
  if (propre.startsWith("+")) {
    return borne(`+${chiffres}`);
  }
  if (chiffres.startsWith("00")) {
    return borne(`+${chiffres.slice(2)}`);
  }

  // Sans indicatif connu, on ne peut rien préfixer sans inventer.
  if (!indicatif) return null;

  // Déjà préfixé de son indicatif, mais sans le `+` : « 2250700000000 ».
  if (chiffres.startsWith(indicatif)) {
    return borne(`+${chiffres}`);
  }

  // Numéro local. Le sort du zéro de tête dépend du plan de numérotation, et
  // la table le dit pays par pays :
  //
  //   — au Ghana c'est un préfixe interurbain, il tombe ;
  //   — en Côte d'Ivoire et au Bénin c'est un chiffre du numéro, il reste.
  //
  // Le retirer partout — la règle qu'on écrit d'instinct — casse précisément
  // notre marché principal, et sans bruit : le message part vers un numéro qui
  // n'existe pas, et il est facturé.
  //
  // Un seul zéro, jamais une série : « 00 » a déjà été traité plus haut, et
  // « 000… » n'est un numéro nulle part.
  const local =
    ZERO_DE_TETE[paysParDefaut] === "retirer"
      ? chiffres.replace(/^0/, "")
      : chiffres;

  if (local.length === 0 || /^0+$/.test(local)) return null;

  return borne(`+${indicatif}${local}`);
}

function borne(e164: string): string | null {
  const chiffres = e164.length - 1;
  if (chiffres < MIN_CHIFFRES || chiffres > MAX_CHIFFRES) return null;

  // Aucun indicatif de pays ne commence par zéro. « +07… » vient forcément
  // d'une forme mal comprise — typiquement « 0700000000 » pris pour un
  // « 00 » international — et l'envoyer serait payer pour rien.
  if (e164.startsWith("+0")) return null;

  return e164;
}

/**
 * Une écriture lisible, pour les écrans et les journaux.
 *
 * Les quatre derniers chiffres seulement. Un numéro complet dans un agrégateur
 * de journaux y reste des mois, consultable par qui a l'accès — et c'est une
 * donnée personnelle qu'on n'a aucune raison d'y laisser.
 */
export function masquer(e164: string): string {
  if (e164.length <= 4) return "····";
  return `···· ${e164.slice(-4)}`;
}
