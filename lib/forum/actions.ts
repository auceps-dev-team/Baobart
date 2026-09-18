"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import { sessionCourante } from "@/lib/auth/session";
import { contexteDe } from "@/lib/forum/queries";
import {
  leverLeSignalement,
  retirerParLaPlateforme,
} from "@/lib/forum/signalements";
import {
  MESSAGES_ECHEC,
  basculerEpingle,
  basculerVerrou,
  ouvrirCommunaute,
  ouvrirSujet,
  quitter,
  rejoindre,
  repondre,
  retirerMessage,
  signalerMessage,
  type Suite,
} from "@/lib/forum/redaction";

/**
 * Les gestes du forum, depuis le navigateur.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE FICHIER NE DÉCIDE RIEN
 *
 * Il fait trois choses, toujours dans le même ordre : retrouver qui parle,
 * recalculer le contexte **depuis le slug**, puis passer la main à
 * `redaction.ts` avec les droits ainsi obtenus.
 *
 * Le point important est le deuxième. Les identifiants viennent du formulaire,
 * donc du navigateur, donc de n'importe qui : l'identifiant de communauté
 * qu'on recevrait dans un champ caché ne prouverait rien. Le slug de l'URL
 * n'en prouve pas davantage — mais il repasse par `contexteDe`, qui refait le
 * calcul d'accès à partir de la base. Ce qui traverse ensuite est vrai.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * « INTROUVABLE » RECOUVRE DEUX CHOSES, ET CELA RESTE VOLONTAIRE
 *
 * Un espace sur invitation qu'on ne connaît pas rend le même message qu'un
 * espace qui n'existe pas. Les distinguer apprendrait son existence à qui tape
 * une adresse au hasard — c'est la règle posée dans `queries.ts`, et les
 * actions ne la contournent pas au prétexte d'un meilleur message d'erreur.
 */

export type EtatFormulaire =
  | { ok: true }
  | { ok: false; message: string; champ?: string };

/** L'échec commun à tous les gestes : personne n'est connecté. */
const DECONNECTE: EtatFormulaire = {
  ok: false,
  message: "Connecte-toi pour participer.",
};

const INTROUVABLE: EtatFormulaire = {
  ok: false,
  message: "Cette communauté n'existe pas, ou elle ne t'est pas ouverte.",
};

// ══════════════════════════════════════════════════════════════ la communauté ══

export async function ouvrirUneCommunaute(
  _precedent: EtatFormulaire | null,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const qui = await sessionCourante();
  if (!qui) return DECONNECTE;

  const suite = await ouvrirCommunaute({
    createurId: qui.id,
    saisie: {
      nom: texte(donnees, "nom"),
      description: texte(donnees, "description"),
      visibilite: texte(donnees, "visibilite"),
    },
  });

  if (!suite.ok) return echec(suite);

  revalidatePath("/communautes");
  redirect(`/communautes/${suite.slug}`);
}

export async function rejoindreUneCommunaute(
  slug: string,
): Promise<EtatFormulaire> {
  const qui = await sessionCourante();
  if (!qui) return DECONNECTE;

  const ctx = await contexteDe(slug, qui);
  if (!ctx) return INTROUVABLE;

  const suite = await rejoindre({
    communauteId: ctx.communaute.id,
    userId: qui.id,
    droits: ctx.droits,
    visibilite: ctx.communaute.visibilite,
  });

  if (!suite.ok) return echec(suite);

  revalidatePath(`/communautes/${slug}`);
  revalidatePath("/communautes");
  return { ok: true };
}

export async function quitterUneCommunaute(
  slug: string,
): Promise<EtatFormulaire> {
  const qui = await sessionCourante();
  if (!qui) return DECONNECTE;

  const ctx = await contexteDe(slug, qui);
  if (!ctx) return INTROUVABLE;

  const suite = await quitter({
    communauteId: ctx.communaute.id,
    userId: qui.id,
    createurId: ctx.communaute.createurId,
  });

  if (!suite.ok) return echec(suite);

  revalidatePath(`/communautes/${slug}`);
  revalidatePath("/communautes");
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════ sujets et messages ══

export async function ouvrirUnSujet(
  slug: string,
  categorieId: string,
  _precedent: EtatFormulaire | null,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const qui = await sessionCourante();
  if (!qui) return DECONNECTE;

  const ctx = await contexteDe(slug, qui);
  if (!ctx) return INTROUVABLE;

  const suite = await ouvrirSujet({
    communauteId: ctx.communaute.id,
    categorieId,
    auteurId: qui.id,
    droits: ctx.droits,
    saisie: { titre: texte(donnees, "titre"), corps: texte(donnees, "corps") },
  });

  if (!suite.ok) return echec(suite);

  revalidatePath(`/communautes/${slug}`);
  redirect(`/communautes/${slug}/sujets/${suite.sujetId}`);
}

export async function repondreAUnSujet(
  slug: string,
  sujetId: string,
  _precedent: EtatFormulaire | null,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const qui = await sessionCourante();
  if (!qui) return DECONNECTE;

  const ctx = await contexteDe(slug, qui);
  if (!ctx) return INTROUVABLE;

  const suite = await repondre({
    communauteId: ctx.communaute.id,
    sujetId,
    auteurId: qui.id,
    droits: ctx.droits,
    saisie: { corps: texte(donnees, "corps") },
  });

  if (!suite.ok) return echec(suite);

  revalidatePath(`/communautes/${slug}/sujets/${sujetId}`);
  return { ok: true };
}

export async function retirerUnMessage(
  slug: string,
  messageId: string,
  sujetId: string,
): Promise<EtatFormulaire> {
  const qui = await sessionCourante();
  if (!qui) return DECONNECTE;

  const ctx = await contexteDe(slug, qui);
  if (!ctx) return INTROUVABLE;

  const suite = await retirerMessage({
    communauteId: ctx.communaute.id,
    messageId,
    parId: qui.id,
    droits: ctx.droits,
  });

  if (!suite.ok) return echec(suite);

  revalidatePath(`/communautes/${slug}/sujets/${sujetId}`);
  return { ok: true };
}

export async function signalerUnMessage(
  slug: string,
  messageId: string,
  sujetId: string,
): Promise<EtatFormulaire> {
  const qui = await sessionCourante();
  if (!qui) return DECONNECTE;

  const ctx = await contexteDe(slug, qui);
  if (!ctx) return INTROUVABLE;

  const suite = await signalerMessage({
    communauteId: ctx.communaute.id,
    messageId,
    parId: qui.id,
    droits: ctx.droits,
  });

  // Un message déjà signalé rend « INTROUVABLE ». On le dit comme un succès :
  // la personne a fait ce qu'elle voulait faire, et lui répondre « ça n'existe
  // pas » sur un message qu'elle a sous les yeux ne lui apprendrait rien de
  // vrai.
  if (!suite.ok && suite.motif === "INTROUVABLE") {
    revalidatePath(`/communautes/${slug}/sujets/${sujetId}`);
    return { ok: true };
  }

  if (!suite.ok) return echec(suite);

  revalidatePath(`/communautes/${slug}/sujets/${sujetId}`);
  return { ok: true };
}

// ══════════════════════════════════════════════════════════════ la modération ══

export async function epinglerUnSujet(
  slug: string,
  sujetId: string,
): Promise<EtatFormulaire> {
  return bascule(slug, sujetId, basculerEpingle);
}

export async function verrouillerUnSujet(
  slug: string,
  sujetId: string,
): Promise<EtatFormulaire> {
  return bascule(slug, sujetId, basculerVerrou);
}

async function bascule(
  slug: string,
  sujetId: string,
  geste: (input: {
    communauteId: string;
    sujetId: string;
    droits: Parameters<typeof basculerEpingle>[0]["droits"];
  }) => Promise<Suite<{ epingle: boolean }>>,
): Promise<EtatFormulaire> {
  const qui = await sessionCourante();
  if (!qui) return DECONNECTE;

  const ctx = await contexteDe(slug, qui);
  if (!ctx) return INTROUVABLE;

  const suite = await geste({
    communauteId: ctx.communaute.id,
    sujetId,
    droits: ctx.droits,
  });

  if (!suite.ok) return echec(suite);

  revalidatePath(`/communautes/${slug}`);
  revalidatePath(`/communautes/${slug}/sujets/${sujetId}`);
  return { ok: true };
}

// ═══════════════════════════════════════════════ la modération de plateforme ══

/**
 * Les deux décisions prises depuis `/dashboard/moderation/signalements`.
 *
 * Elles ne passent pas par `contexteDe` : un modérateur de la plateforme n'est
 * membre de rien, et son droit ne vient pas de la communauté mais du pouvoir
 * `moderer_le_contenu`. C'est la seule porte qui ouvre un message d'espace
 * fermé, et elle n'ouvre que le message signalé.
 */
export async function leverUnSignalement(
  messageId: string,
): Promise<EtatFormulaire> {
  const qui = await exigerLePouvoir("moderer_le_contenu");

  const suite = await leverLeSignalement({ messageId, parId: qui.id });
  if (!suite.ok) return { ok: false, message: "Ce signalement n'existe plus." };

  revalidatePath("/dashboard/moderation/signalements");
  return { ok: true };
}

export async function retirerUnMessageSignale(
  messageId: string,
): Promise<EtatFormulaire> {
  const qui = await exigerLePouvoir("moderer_le_contenu");

  const suite = await retirerParLaPlateforme({ messageId, parId: qui.id });
  if (!suite.ok) return { ok: false, message: "Ce message n'existe plus." };

  revalidatePath("/dashboard/moderation/signalements");
  return { ok: true };
}

// ════════════════════════════════════════════════════════════════════ outils ══

/** Traduit un échec de `redaction.ts` en quelque chose d'affichable. */
function echec(suite: Extract<Suite<object>, { ok: false }>): EtatFormulaire {
  if (suite.motif === "REFUS") {
    return { ok: false, champ: suite.refus.champ, message: suite.refus.message };
  }
  return { ok: false, message: MESSAGES_ECHEC[suite.motif] };
}

function texte(donnees: FormData, champ: string): string {
  const valeur = donnees.get(champ);
  return typeof valeur === "string" ? valeur : "";
}
