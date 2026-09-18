"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import { sessionCourante } from "@/lib/auth/session";
import {
  MESSAGES_ECHEC_COLLECTION,
  attacher,
  detacher,
} from "@/lib/forum/collections";
import {
  MESSAGES_ECHEC_FIL,
  ecrireDansLeFil,
  prevenirDUneAdhesion,
  retirerDuFil,
  signalerDansLeFil,
  type SuiteFil,
} from "@/lib/forum/fil";
import { contexteDe } from "@/lib/forum/queries";
import { MESSAGES_ECHEC, quitter, rejoindre, ouvrirCommunaute } from "@/lib/forum/redaction";
import {
  basculerLaCommunaute,
  leverLeSignalement,
  retirerParLaPlateforme,
  type Origine,
} from "@/lib/forum/signalements";

/**
 * Les gestes des communautés, depuis le navigateur.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE FICHIER NE DÉCIDE RIEN
 *
 * Il fait trois choses, toujours dans le même ordre : retrouver qui parle,
 * recalculer le contexte **depuis le slug**, puis passer la main avec les
 * droits ainsi obtenus.
 *
 * Le point important est le deuxième. Les identifiants viennent du formulaire,
 * donc du navigateur, donc de n'importe qui : l'identifiant de communauté
 * qu'on recevrait dans un champ caché ne prouverait rien. Le slug de l'URL n'en
 * prouve pas davantage — mais il repasse par `contexteDe`, qui refait le calcul
 * d'accès à partir de la base. Ce qui traverse ensuite est vrai.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES GESTES DE SUJET NE SONT PLUS EXPOSÉS
 *
 * `ouvrirUnSujet`, `repondreAUnSujet`, `epinglerUnSujet`, `verrouillerUnSujet`
 * ont disparu de ce fichier. Leur code vit toujours dans `redaction.ts`, mais
 * il n'a plus d'écran : la maquette dessine un fil plat, pas un forum à
 * rubriques (voir l'en-tête de `lib/forum/fil.ts`).
 *
 * Les retirer d'ici n'est pas cosmétique. **Chaque export d'un module
 * « use server » est une URL que le navigateur peut appeler**, avec les
 * arguments qu'il veut. Laisser ces quatre-là exposés maintiendrait ouverte une
 * façon d'écrire dans un produit qu'on n'affiche plus et que personne ne
 * surveille.
 */

export type EtatFormulaire =
  | { ok: true }
  | { ok: false; message: string; champ?: string };

const DECONNECTE: EtatFormulaire = {
  ok: false,
  message: "Connecte-toi pour participer.",
};

const INTROUVABLE: EtatFormulaire = {
  ok: false,
  message: "Cette communauté n'existe pas, ou elle n'est plus ouverte.",
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
    },
  });

  if (!suite.ok) {
    if (suite.motif === "REFUS") {
      return { ok: false, champ: suite.refus.champ, message: suite.refus.message };
    }
    return { ok: false, message: MESSAGES_ECHEC[suite.motif] };
  }

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

  if (!suite.ok) {
    if (suite.motif === "REFUS") {
      return { ok: false, champ: suite.refus.champ, message: suite.refus.message };
    }
    return { ok: false, message: MESSAGES_ECHEC[suite.motif] };
  }

  // Après l'adhésion, et sans bloquer dessus : on est entré, même si la cloche
  // des administrateurs ne sonne pas.
  await prevenirDUneAdhesion({
    communauteId: ctx.communaute.id,
    communauteNom: ctx.communaute.nom,
    communauteSlug: slug,
    createurId: ctx.communaute.createurId,
    arrivantId: qui.id,
    arrivantNom: qui.nom,
  });

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

  if (!suite.ok) {
    if (suite.motif === "REFUS") {
      return { ok: false, champ: suite.refus.champ, message: suite.refus.message };
    }
    return { ok: false, message: MESSAGES_ECHEC[suite.motif] };
  }

  revalidatePath(`/communautes/${slug}`);
  revalidatePath("/communautes");
  return { ok: true };
}

// ═════════════════════════════════════════════════════════════════════ le fil ══

export async function ecrireDansLeFilDe(
  slug: string,
  _precedent: EtatFormulaire | null,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const qui = await sessionCourante();
  if (!qui) return DECONNECTE;

  const ctx = await contexteDe(slug, qui);
  if (!ctx) return INTROUVABLE;

  const suite = await ecrireDansLeFil({
    communauteId: ctx.communaute.id,
    communauteNom: ctx.communaute.nom,
    communauteSlug: slug,
    auteurId: qui.id,
    auteurNom: qui.nom,
    droits: ctx.droits,
    saisie: { corps: texte(donnees, "corps") },
  });

  if (!suite.ok) return echecDuFil(suite);

  revalidatePath(`/communautes/${slug}`);
  return { ok: true };
}

export async function retirerDuFilDe(
  slug: string,
  messageId: string,
): Promise<EtatFormulaire> {
  const qui = await sessionCourante();
  if (!qui) return DECONNECTE;

  const ctx = await contexteDe(slug, qui);
  if (!ctx) return INTROUVABLE;

  const suite = await retirerDuFil({
    communauteId: ctx.communaute.id,
    messageId,
    parId: qui.id,
    droits: ctx.droits,
  });

  if (!suite.ok) return echecDuFil(suite);

  revalidatePath(`/communautes/${slug}`);
  return { ok: true };
}

export async function signalerDansLeFilDe(
  slug: string,
  messageId: string,
): Promise<EtatFormulaire> {
  const qui = await sessionCourante();
  if (!qui) return DECONNECTE;

  const ctx = await contexteDe(slug, qui);
  if (!ctx) return INTROUVABLE;

  const suite = await signalerDansLeFil({
    communauteId: ctx.communaute.id,
    messageId,
    parId: qui.id,
    droits: ctx.droits,
  });

  // Un message déjà signalé rend « INTROUVABLE ». On le dit comme un succès :
  // la personne a fait ce qu'elle voulait faire, et lui répondre « ça n'existe
  // pas » sur un message qu'elle a sous les yeux ne lui apprendrait rien de
  // vrai.
  if (!suite.ok && suite.motif !== "INTROUVABLE") return echecDuFil(suite);

  revalidatePath(`/communautes/${slug}`);
  return { ok: true };
}

// ════════════════════════════════════════════════════════════ les collections ══

/**
 * Partager une collection avec la communauté, ou l'en retirer.
 *
 * Le propriétaire est vérifié dans `collections.ts`, pas ici : une collection
 * privée attachée devient lisible par tous les membres, et c'est le genre de
 * garde qu'on ne met pas dans une couche qu'on peut contourner en appelant le
 * module « use server » directement.
 */
export async function partagerUneCollection(
  slug: string,
  boardId: string,
): Promise<EtatFormulaire> {
  const qui = await sessionCourante();
  if (!qui) return DECONNECTE;

  const ctx = await contexteDe(slug, qui);
  if (!ctx) return INTROUVABLE;

  const suite = await attacher({
    boardId,
    communauteId: ctx.communaute.id,
    parId: qui.id,
    droits: ctx.droits,
  });

  if (!suite.ok) {
    return { ok: false, message: MESSAGES_ECHEC_COLLECTION[suite.motif] };
  }

  revalidatePath(`/communautes/${slug}`);
  revalidatePath("/dashboard/collections");
  return { ok: true };
}

export async function retirerUneCollection(
  slug: string,
  boardId: string,
): Promise<EtatFormulaire> {
  const qui = await sessionCourante();
  if (!qui) return DECONNECTE;

  const ctx = await contexteDe(slug, qui);
  if (!ctx) return INTROUVABLE;

  const suite = await detacher({
    boardId,
    communauteId: ctx.communaute.id,
    parId: qui.id,
    droits: ctx.droits,
  });

  if (!suite.ok) {
    return { ok: false, message: MESSAGES_ECHEC_COLLECTION[suite.motif] };
  }

  revalidatePath(`/communautes/${slug}`);
  revalidatePath("/dashboard/collections");
  return { ok: true };
}

// ═══════════════════════════════════════════════ la modération de plateforme ══

/**
 * Les décisions prises depuis `/dashboard/signalements`.
 *
 * Elles ne passent pas par `contexteDe` : un modérateur de la plateforme n'est
 * membre de rien, et son droit ne vient pas de la communauté mais du pouvoir
 * `moderer_le_contenu`. C'est la seule porte qui ouvre un message d'espace
 * fermé, et elle n'ouvre que le message signalé.
 */
export async function leverUnSignalement(
  messageId: string,
  origine: Origine,
): Promise<EtatFormulaire> {
  const qui = await exigerLePouvoir("moderer_le_contenu");

  const suite = await leverLeSignalement({ messageId, origine, parId: qui.id });
  if (!suite.ok) return { ok: false, message: "Ce signalement n'existe plus." };

  revalidatePath("/dashboard/signalements");
  return { ok: true };
}

export async function retirerUnMessageSignale(
  messageId: string,
  origine: Origine,
): Promise<EtatFormulaire> {
  const qui = await exigerLePouvoir("moderer_le_contenu");

  const suite = await retirerParLaPlateforme({ messageId, origine, parId: qui.id });
  if (!suite.ok) return { ok: false, message: "Ce message n'existe plus." };

  revalidatePath("/dashboard/signalements");
  return { ok: true };
}

/**
 * Fermer ou rouvrir une communauté entière.
 *
 * Le motif est exigé par `basculerLaCommunaute`, pas ici : une garde posée
 * dans l'action serait contournable par un appel direct au module
 * « use server », et c'est précisément ce geste-là qu'on ne veut pas voir
 * s'exécuter sans trace.
 */
export async function basculerUneCommunaute(
  communauteId: string,
  motif: string,
): Promise<EtatFormulaire> {
  const qui = await exigerLePouvoir("moderer_le_contenu");

  const suite = await basculerLaCommunaute({
    communauteId,
    parId: qui.id,
    motif,
  });

  if (!suite.ok) return { ok: false, message: suite.message };

  revalidatePath("/dashboard/signalements");
  revalidatePath("/communautes");
  return { ok: true };
}

// ════════════════════════════════════════════════════════════════════ outils ══

function echecDuFil(suite: Extract<SuiteFil<object>, { ok: false }>): EtatFormulaire {
  if (suite.motif === "REFUS") {
    return { ok: false, champ: suite.refus.champ, message: suite.refus.message };
  }
  return { ok: false, message: MESSAGES_ECHEC_FIL[suite.motif] };
}

function texte(donnees: FormData, champ: string): string {
  const valeur = donnees.get(champ);
  return typeof valeur === "string" ? valeur : "";
}
