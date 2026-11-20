import { RAILS_BAOBART } from "@/lib/payments/payout-schedule";
import { versE164 } from "@/lib/sms/numero";

/**
 * Règles du compte de versement.
 *
 * Module pur : ce qui décide qu'un numéro est acceptable se teste sans base.
 * L'enjeu est concret — un numéro mal saisi, et l'argent part chez quelqu'un
 * d'autre ou nulle part, et le créateur l'apprend une semaine plus tard.
 */

export type RefusCompte =
  | "RAIL_INCONNU"
  | "NUMERO_VIDE"
  | "NUMERO_INVALIDE"
  | "INDICATIF_MANQUANT"
  | "IBAN_INVALIDE"
  | "TITULAIRE_MANQUANT";

export interface VerdictCompte {
  accepte: boolean;
  refus?: RefusCompte;
  message?: string;
  /** Référence normalisée, prête à enregistrer. */
  reference?: string;
  method?: "MOBILE_MONEY" | "BANK";
}

const MESSAGES: Record<RefusCompte, string> = {
  RAIL_INCONNU: "Choisis un moyen de versement dans la liste.",
  NUMERO_VIDE: "Entre le numéro qui doit recevoir l'argent.",
  NUMERO_INVALIDE:
    "Ce numéro ne ressemble pas à un numéro de téléphone. Vérifie l'indicatif et les chiffres.",
  INDICATIF_MANQUANT:
    "Choisis le pays du numéro, ou écris-le avec son indicatif (+221, +225…) : Wave, Orange Money et MTN couvrent plusieurs pays, et sans lui l'opérateur ne sait pas où envoyer l'argent.",
  IBAN_INVALIDE:
    "Cet identifiant bancaire semble incomplet. Un IBAN fait entre 15 et 34 caractères.",
  TITULAIRE_MANQUANT:
    "Indique le nom du titulaire : un écart avec le nom du compte est le premier motif de rejet d'un virement.",
};

/**
 * Normalise un numéro de téléphone.
 *
 * Espaces, points et tirets tombent ; un `00` initial devient `+`. Les gens
 * écrivent leur numéro de dix façons, et refuser sur la mise en forme ferait
 * abandonner quelqu'un qui avait pourtant tapé le bon numéro.
 */
export function normaliserNumero(brut: string): string {
  const nettoye = brut.trim().replace(/[\s.\-()]/g, "");
  if (nettoye.startsWith("00")) return `+${nettoye.slice(2)}`;
  return nettoye;
}

/** Normalise un identifiant bancaire : majuscules, sans espaces. */
export function normaliserIban(brut: string): string {
  return brut.trim().replace(/\s+/g, "").toUpperCase();
}

export function verifierCompte(input: {
  provider: string;
  reference: string;
  titulaire?: string;
  /**
   * Le pays du numéro (ISO, « CI »), quand il est écrit sans indicatif. Q-22
   * (recette du 14/11/2026) : « 77 123 45 67 » passait sans qu'on sache s'il
   * était sénégalais ou ivoirien — Wave couvre les deux.
   */
  pays?: string;
}): VerdictCompte {
  const refus = (r: RefusCompte): VerdictCompte => ({
    accepte: false,
    refus: r,
    message: MESSAGES[r],
  });

  const rail = RAILS_BAOBART[input.provider];
  if (!rail) return refus("RAIL_INCONNU");

  const brut = input.reference.trim();
  if (brut.length === 0) return refus("NUMERO_VIDE");

  // Le nom du titulaire n'est demandé que pour un virement : un opérateur de
  // mobile money l'associe déjà au numéro, et le réclamer serait une friction
  // pour rien.
  const banque = input.provider === "bank";

  if (banque) {
    const iban = normaliserIban(brut);
    if (!/^[A-Z0-9]{15,34}$/.test(iban)) return refus("IBAN_INVALIDE");
    if (!input.titulaire || input.titulaire.trim().length < 2) {
      return refus("TITULAIRE_MANQUANT");
    }
    return { accepte: true, reference: iban, method: "BANK" };
  }

  // Un numéro national ne se devine pas : son pays le complète (indicatif,
  // zéro de tête selon le plan du pays — versE164, lib/sms/numero.ts). Sans
  // pays, on le refuse plutôt que d'envoyer l'argent au hasard.
  const international = brut.startsWith("+") || normaliserNumero(brut).startsWith("+");
  if (!international) {
    if (!input.pays) return refus("INDICATIF_MANQUANT");
    const e164 = versE164(brut, input.pays);
    if (!e164) return refus("NUMERO_INVALIDE");
    return { accepte: true, reference: e164, method: "MOBILE_MONEY" };
  }

  const numero = normaliserNumero(brut);

  // Huit chiffres au minimum : les numéros nationaux ouest-africains en font
  // huit ou neuf, et avec indicatif on monte à douze ou treize.
  if (!/^\+?\d{8,15}$/.test(numero)) return refus("NUMERO_INVALIDE");

  return { accepte: true, reference: numero, method: "MOBILE_MONEY" };
}

/** Rails proposés à l'écran, dans un ordre stable. */
export const RAILS_PROPOSES = Object.values(RAILS_BAOBART).map((r) => ({
  id: r.id,
  label: r.label,
}));
