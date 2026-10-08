import "server-only";

import { cookies } from "next/headers";

import { COOKIE_DEFI, ouvrirDefi } from "@/lib/auth/deux-facteurs";
import { journal } from "@/lib/observabilite/journal";
import {
  CHAMP_LEURRE,
  CHAMP_OUVERTURE,
  evaluerUnGeste,
} from "@/lib/securite/antibot";
import { adresseCourante } from "@/lib/securite/blocklist";

/**
 * Ce que les formulaires d'authentification partagent : les messages de refus,
 * le verdict anti-bot, les identités confrontées à la liste de blocage et le
 * cookie du défi de 2FA.
 *
 * Ils vivaient dans `lib/auth/actions.ts`, qui est un module « use server » :
 * il ne peut exporter que des actions asynchrones, et la connexion par
 * téléphone (`actions-telephone.ts`) en a besoin à l'identique. Les recopier
 * aurait fait diverger, au premier changement, deux formulaires qui doivent
 * répondre pareil.
 */

/** Ce que les formulaires d'authentification rendent. */
export interface EtatGeste {
  erreur?: string;
}

/**
 * Le refus opposé à une identité bloquée.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IL NE DIT PAS CE QUI A BLOQUÉ, ET C'EST VOULU
 *
 * « Votre adresse IP est bloquée » apprend à la personne qu'il suffit de
 * changer de réseau ; « votre courriel est bloqué » qu'il suffit d'en prendre
 * un autre. Le blocage a une valeur exactement tant qu'on ignore lequel des
 * deux a joué.
 *
 * Le journal, lui, le dit — c'est à l'écran d'administration qu'on a besoin de
 * le savoir, pas dans le formulaire.
 *
 * Message distinct de `MESSAGE_IDENTIFIANTS` : refuser un compte bloqué avec
 * « adresse ou mot de passe incorrect » enverrait la personne réinitialiser un
 * mot de passe qui fonctionne très bien, et le support chercherait un défaut
 * de connexion là où il y a une décision.
 */
export const MESSAGE_BLOQUE =
  "Ce compte ne peut pas être utilisé. Écris-nous si tu penses que c'est une erreur.";

/**
 * Le verdict anti-bot pour ce formulaire.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LE MESSAGE EST CELUI D'UNE LIMITE, PAS D'UNE ACCUSATION
 *
 * Aucun des trois signaux n'est certain. Un remplisseur automatique un peu
 * zélé, un navigateur exotique, un score mal calibré : il y aura des refus
 * injustes, et la personne en face n'a alors rien fait de mal.
 *
 * « Réessaie dans un instant » est vrai pour elle et sans intérêt pour un
 * robot. « Nous pensons que vous êtes un robot » serait faux une fois sur dix
 * et vexant les dix fois.
 *
 * Le motif, lui, part au journal : c'est là qu'on a besoin de savoir lequel
 * des trois a joué.
 */
export async function verdictAntiBot(
  donnees: FormData,
  action: string,
  /**
   * Le délai minimum ne vaut que là où quelqu'un tape vraiment.
   *
   * À l'inscription, on remplit six champs : deux secondes sont impossibles.
   * À la connexion, un gestionnaire de mots de passe remplit et valide en un
   * clin d'œil — appliquer le même plancher refuserait des connexions
   * parfaitement réelles, tous les jours, sans que personne ne fasse le lien.
   */
  avecDelai: boolean,
): Promise<EtatGeste | null> {
  const verdict = await evaluerUnGeste({
    action,
    leurre: String(donnees.get(CHAMP_LEURRE) ?? ""),
    ouvertLe: avecDelai ? String(donnees.get(CHAMP_OUVERTURE) ?? "") : null,
  });

  if (verdict.laisserPasser) return null;

  journal.info("geste refusé par l'anti-bot", {
    action,
    motif: verdict.motif,
    score: verdict.score,
  });

  return { erreur: "Quelque chose a coincé. Réessaie dans un instant." };
}

/**
 * Ce qu'on répond quand la limite est atteinte.
 *
 * Le même texte partout, et il ne dit **rien** de ce qui a été tenté : ni si
 * l'adresse existe, ni combien d'essais restent. Annoncer « il vous reste deux
 * essais » indiquerait à un attaquant qu'il est sur la bonne piste, et lui
 * donnerait le rythme exact auquel repartir.
 */
export function tropDEssais(secondes: number): EtatGeste {
  const minutes = Math.max(1, Math.ceil(secondes / 60));
  return {
    erreur: `Trop de tentatives. Réessaie dans ${minutes} minute${minutes > 1 ? "s" : ""}.`,
  };
}

/**
 * Les identités de cette tentative qui pourraient être bloquées.
 *
 * L'adresse n'entre dans la liste que si on en a une : sans ce filtre, on
 * appellerait `estBloque("IP", "")`, et une ligne vide posée par accident dans
 * la table bloquerait alors **tout le monde**.
 *
 * Partagée par le mot de passe et le téléphone : la connexion par SMS ne
 * regardait que le numéro et l'adresse, et un compte dont le COURRIEL était
 * bloqué entrait par son téléphone (relevé à la relecture du 08/10/2026).
 */
export async function identitesDe(qui: { email?: string | null; telephone?: string | null }) {
  const adresse = await adresseCourante();

  return [
    ...(qui.email ? [{ type: "EMAIL" as const, valeur: qui.email }] : []),
    ...(qui.telephone ? [{ type: "PHONE" as const, valeur: qui.telephone }] : []),
    ...(adresse ? [{ type: "IP" as const, valeur: adresse }] : []),
  ];
}

/**
 * Ouvre le défi de 2FA et pose son cookie — le même, quel que soit le premier
 * facteur (mot de passe ou code SMS).
 */
export async function poserDefi(compteId: string): Promise<void> {
  const jeton = await ouvrirDefi(compteId);
  const magasin = await cookies();

  magasin.set(COOKIE_DEFI, jeton, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // Cinq minutes, comme le défi. Un cookie qui survivrait au défi ne
    // donnerait rien, mais laisserait croire à une session en cours.
    maxAge: 300,
  });
}
