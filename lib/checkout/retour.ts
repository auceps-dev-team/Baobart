import "server-only";

import { MESSAGES, type MotifRefus } from "@/lib/checkout/achat";
import { MESSAGES_MONTANT, type MotifMontant } from "@/lib/commerce/montant";
import { formatMoney } from "@/lib/i18n/money";

/**
 * Ce que dit la fiche au retour d'un achat.
 *
 * Le texte vient des tables du tunnel, jamais d'une copie. La fiche en tenait
 * une, qui avait perdu CODE_REFUSE, CHAMPS_INVALIDES et MONTANT_REFUSE :
 * l'acheteur revenait sur la fiche sans un mot (mesuré le 25/09, Qualitytest
 * P4.3, P5.1, P5.3, S21). Et la raison précise d'un montant refusé — trop
 * bas, mal écrit, pourboire trop haut — se perdait en route ; elle voyage
 * désormais dans l'URL avec le minimum.
 */

const TEXTE_OK =
  "Achat enregistré. Le téléchargement est ouvert, et le reçu part par courriel.";

/**
 * Le message à afficher, ou `null` pour un code inconnu.
 *
 * `Object.hasOwn` et non `in` : les paramètres viennent de l'URL, et
 * « toString » est « dans » n'importe quel objet.
 */
export function texteDuRetour(
  code: string,
  montant?: string,
  minimum?: string,
): string | null {
  if (code === "ok") return TEXTE_OK;
  if (!Object.hasOwn(MESSAGES, code)) return null;

  if (code === "MONTANT_REFUSE" && montant && Object.hasOwn(MESSAGES_MONTANT, montant)) {
    const plancher = Number(minimum);
    const precision =
      Number.isSafeInteger(plancher) && plancher > 0
        ? ` Le minimum est de ${formatMoney(plancher)}.`
        : "";
    return `${MESSAGES_MONTANT[montant as MotifMontant]}${precision}`;
  }

  return MESSAGES[code as MotifRefus];
}
