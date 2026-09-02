import { replier, segments } from "@/lib/sms/gsm7";
import type { Message } from "@/lib/ndank/ports";

/**
 * La relance d'abonnement, écrite pour un SMS.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI CE TEXTE N'EST PAS CELUI DU COURRIEL
 *
 * Le moteur transmet des faits, pas des phrases — c'est tout l'intérêt de
 * `Message`. Le courriel peut s'étendre, expliquer, mettre en page. Le SMS
 * arrive au milieu d'autre chose, se lit en deux secondes, et se paie au
 * segment.
 *
 * Trois choses seulement doivent y tenir : **ce qui va se passer**, **combien**,
 * et **où valider**. Tout le reste est du segment payé pour rien.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE LIEN EST DERNIER, ET IL EST ENTIER
 *
 * Beaucoup de téléphones ne rendent cliquable qu'une URL bien détachée. On la
 * met à la fin, précédée d'un espace, jamais suivie d'un point — un point collé
 * à une URL finit dans le lien sur la moitié des combinés, et la page ouvre sur
 * une 404 au moment précis où l'on demande de payer.
 */

/**
 * Le texte, déjà replié sur l'alphabet GSM.
 *
 * `montant` arrive formaté par l'hôte et contient une espace fine insécable :
 * `replier` la remplace, faute de quoi chaque relance coûterait le double.
 */
export function texteRelance(message: Message): string {
  const nom = message.destinataire.trim();
  const bonjour = nom.length > 0 ? `${nom}, ` : "";

  const corps = message.dernier
    ? `${bonjour}ton accès ${message.offre} est suspendu. Réactive-le pour ${message.montant} :`
    : message.joursRestants <= 0
      ? `${bonjour}ton abonnement ${message.offre} arrive à échéance. Renouvelle pour ${message.montant} :`
      : `${bonjour}ton abonnement ${message.offre} expire dans ${message.joursRestants} jour${message.joursRestants > 1 ? "s" : ""}. Renouvelle pour ${message.montant} :`;

  // Pas de point final : il se collerait au lien.
  return replier(`${corps} ${message.lien}`);
}

/** Ce que ce texte coûtera, pour le journal. */
export function coutRelance(texte: string): number {
  return segments(texte);
}
