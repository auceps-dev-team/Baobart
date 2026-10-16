import "server-only";

import { createHmac } from "node:crypto";

import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";
import { DUREE_PLAFOND_MS, secretDuPlafond } from "@/lib/publicites/plafond";
import { piloteLimite } from "@/lib/securite/pilotes";

/**
 * Les vues d'un profil public — l'indicateur « vues de page » de la maquette.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES TROIS CHOIX QUE MAQUETTES_A_FAIRE §F.2 DEMANDAIT
 *
 * **Compter quoi.** Une vue par visiteur, par profil et par jour. Rafraîchir
 * la page ne fait rien monter ; revenir le lendemain, si.
 *
 * **Ne pas écrire à chaque requête.** La base n'est écrite qu'à la première
 * vue d'un visiteur dans la journée : le nombre d'écritures suit le nombre de
 * visiteurs, pas celui des pages servies. Ce n'est pas un regroupement dans
 * le temps — il faudrait une file (Redis) vidée par un passage planifié, et
 * les pilotes de `lib/securite/pilotes.ts` ne savent qu'incrémenter et lire.
 * À dix mille visiteurs par jour sur un profil, c'est une écriture toutes les
 * neuf secondes : PostgreSQL ne s'en aperçoit pas.
 *
 * **Les robots.** La vue part du navigateur (`navigator.sendBeacon`), après
 * l'affichage : un robot qui lit le HTML sans exécuter le script ne compte
 * pas. Ceux qui l'exécutent et se nomment (Googlebot, aperçus de liens…) sont
 * écartés par leur `User-Agent`. Reste ce qui se déguise en navigateur, et
 * qu'aucun filtre ne voit : le plafond par adresse et par profil le borne.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * AUCUN IDENTIFIANT POSÉ SUR LE VISITEUR
 *
 * Pas de cookie : le blog l'écrit (`compterUneLecture`), ce projet ne pose pas
 * d'identifiant sur ses visiteurs. Le visiteur se reconnaît le temps d'une
 * journée par une empreinte — compte, ou adresse et navigateur —, calculée
 * avec le secret du site ET le jour, gardée 26 heures dans le compteur, jamais
 * en base. Le lendemain, la même personne produit une autre empreinte : on ne
 * peut pas la suivre d'un jour à l'autre. C'est le procédé des bannières
 * (`lib/publicites/plafond.ts`), dont on reprend le secret et la durée.
 *
 * Quand on ne peut pas reconnaître le visiteur — pas de secret, pas
 * d'adresse, compteur en panne —, on ne compte pas. Compter sans pouvoir
 * dédoublonner ferait monter le chiffre à chaque rafraîchissement : un
 * chiffre trop bas dit moins, un chiffre gonflé ment.
 */

/**
 * Combien de visiteurs différents une même adresse peut faire compter, par
 * profil et par jour. Une adresse est souvent partagée — un bureau, un
 * opérateur mobile qui met des milliers d'abonnés derrière quelques adresses.
 * Vingt laisse passer un bureau entier ; un script qui change de navigateur à
 * chaque envoi s'arrête là.
 */
export const VISITEURS_PAR_ADRESSE = 20;

const ROBOTS =
  /bot|crawl|spider|slurp|archiver|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|skype|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|httpclient|axios|node-fetch|go-http|java\//i;

/** Un `User-Agent` qui se déclare automate — ou pas de `User-Agent` du tout. */
export function estUnRobot(ua: string | null): boolean {
  return !ua || ua.trim().length === 0 || ROBOTS.test(ua);
}

/** Le jour, en temps universel : la même borne pour tout le monde. */
export function jourDe(quand: Date): string {
  return quand.toISOString().slice(0, 10);
}

/**
 * Une empreinte qui ne dit rien sans le secret, et change chaque jour.
 * Exportée pour les tests ; l'appelant normal passe par `compterUneVue`.
 */
export function empreinte(secret: string, jour: string, ...morceaux: string[]): string {
  return createHmac("sha256", `${secret}|${jour}`).update(morceaux.join("|")).digest("hex").slice(0, 32);
}

export type IssueVue = "comptee" | "deja" | "ignoree";

export async function compterUneVue(input: {
  profilId: string;
  /** Le compte du visiteur, s'il est connecté. */
  visiteurId: string | null;
  adresse: string | null;
  ua: string | null;
  maintenant?: Date;
}): Promise<IssueVue> {
  if (estUnRobot(input.ua)) return "ignoree";

  const secret = secretDuPlafond();
  if (!secret) return "ignoree";

  // Connecté : le compte suffit, où qu'il se connecte. Sinon, l'adresse ET
  // le navigateur — l'adresse seule confondrait tout un bureau.
  const sujet = input.visiteurId
    ? `compte:${input.visiteurId}`
    : input.adresse
      ? `adresse:${input.adresse}|${input.ua}`
      : null;
  if (!sujet) return "ignoree";

  const jour = jourDe(input.maintenant ?? new Date());
  const pilote = piloteLimite();

  const deja = await pilote.compter(`vue:profil:${jour}:${empreinte(secret, jour, sujet, input.profilId)}`, DUREE_PLAFOND_MS);
  if (deja === null) return "ignoree";
  if (deja > 1) return "deja";

  if (!input.visiteurId && input.adresse) {
    const parAdresse = await pilote.compter(
      `vue:profil:adresse:${jour}:${empreinte(secret, jour, input.adresse, input.profilId)}`,
      DUREE_PLAFOND_MS,
    );
    if (parAdresse === null || parAdresse > VISITEURS_PAR_ADRESSE) return "ignoree";
  }

  try {
    // L'addition faite par PostgreSQL, jamais lire puis écrire : deux vues
    // simultanées n'en feraient qu'une.
    await db.profile.updateMany({ where: { id: input.profilId }, data: { viewCount: { increment: 1 } } });
    return "comptee";
  } catch (cause) {
    journal.erreur("vue de profil non comptée", {
      profil: input.profilId,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    return "ignoree";
  }
}
