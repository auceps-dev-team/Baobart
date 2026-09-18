import "server-only";

import { consigner, ressource } from "@/lib/admin/audit";
import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";

import type { Droits } from "@/lib/forum/acces";
import {
  validerCommunaute,
  validerMessage,
  validerSujet,
  type Refus,
  type SaisieCommunaute,
  type SaisieMessage,
  type SaisieSujet,
} from "@/lib/forum/validation";

/**
 * Écrire dans le forum.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CHAQUE ÉCRITURE PREND LES DROITS, ET LES REVÉRIFIE
 *
 * Même dessin que les lectures : l'appelant passe l'objet `Droits` obtenu par
 * `contexteDe`, et ce module refuse si la permission manque.
 *
 * Ce n'est pas une garde de plus « au cas où » — c'est **la** garde. Les
 * écrans n'en portent aucune : cacher un bouton ne ferme rien, et un module
 * « use server » expose chacun de ses exports au navigateur.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES COMPTEURS SONT DÉNORMALISÉS, DONC ILS SE TIENNENT À JOUR ICI
 *
 * `memberCount` et `repliesCount` existent pour éviter un `COUNT` à chaque
 * affichage de liste. Le prix est qu'ils peuvent diverger — et la seule façon
 * de l'éviter est de les bouger dans la **même transaction** que le fait
 * qu'ils comptent.
 *
 * Un `increment` plutôt qu'une relecture : deux personnes qui répondent en
 * même temps perdraient un point si l'on lisait avant d'écrire.
 */

export type Echec =
  | { motif: "REFUS"; refus: Refus }
  | { motif: "INTERDIT" }
  | { motif: "INTROUVABLE" }
  | { motif: "VERROUILLE" }
  | { motif: "DEJA_MEMBRE" };

export type Suite<T = object> = ({ ok: true } & T) | ({ ok: false } & Echec);

export const MESSAGES_ECHEC: Record<Echec["motif"], string> = {
  REFUS: "",
  INTERDIT: "Tu n'as pas le droit de faire ça ici.",
  INTROUVABLE: "Ça n'existe plus.",
  VERROUILLE: "Ce sujet est verrouillé : on n'y répond plus.",
  DEJA_MEMBRE: "Tu es déjà membre.",
};

// ══════════════════════════════════════════════════════════════ la communauté ══

/**
 * Ouvrir une communauté.
 *
 * Son créateur en devient membre ADMIN dans la même transaction. Sans cette
 * ligne, il administrerait par `creatorId` — ce que `droitsSur` prévoit — mais
 * n'apparaîtrait pas dans sa propre liste de membres, et `memberCount`
 * afficherait zéro sur un espace qui en a un.
 */
export async function ouvrirCommunaute(input: {
  createurId: string;
  saisie: SaisieCommunaute;
}): Promise<Suite<{ slug: string }>> {
  const verdict = validerCommunaute(input.saisie);
  if (!verdict.ok) return { ok: false, motif: "REFUS", refus: verdict.refus };

  const c = verdict.valeur;

  const cree = await db.$transaction(async (tx) => {
    const communaute = await tx.community.create({
      data: {
        creatorId: input.createurId,
        name: c.nom,
        slug: await slugDisponible(c.slug, tx),
        description: c.description,
        visibility: c.visibilite,
        memberCount: 1,
      },
      select: { id: true, slug: true },
    });

    await tx.communityMembership.create({
      data: {
        communityId: communaute.id,
        userId: input.createurId,
        role: "ADMIN",
      },
    });

    // Une rubrique par défaut : un forum sans rubrique n'accepte aucun sujet,
    // et son créateur se retrouverait devant un espace où il ne peut rien
    // faire sans comprendre pourquoi.
    await tx.forumCategory.create({
      data: { communityId: communaute.id, name: "Général", slug: "general" },
    });

    return communaute;
  });

  journal.info("communauté ouverte", { communaute: cree.id });

  return { ok: true, slug: cree.slug };
}

/**
 * Rejoindre une communauté.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PUBLIQUE ET PRIVÉE N'ADHÈRENT PAS PAREIL — ET POURTANT SI, POUR L'INSTANT
 *
 * Une communauté publique s'ouvre à qui la demande. Une privée devrait passer
 * par une validation de ses administrateurs.
 *
 * Cette validation n'existe pas encore : il n'y a pas de table de demandes. En
 * attendant, **adhérer est refusé sur une privée** plutôt qu'accordé
 * automatiquement. Accorder serait transformer « privée » en « publique avec
 * une étape de plus », ce qui viderait le réglage de son sens sans que
 * personne ne s'en aperçoive.
 *
 * Le bouton de l'écran dit donc « sur invitation » et ne mène nulle part. Un
 * manque visible vaut mieux qu'une porte ouverte discrètement.
 */
export async function rejoindre(input: {
  communauteId: string;
  userId: string;
  droits: Droits;
  visibilite: string;
}): Promise<Suite> {
  if (!input.droits.demanderAAdherer) return { ok: false, motif: "INTERDIT" };
  if (input.visibilite !== "PUBLIC") return { ok: false, motif: "INTERDIT" };

  try {
    await db.$transaction(async (tx) => {
      await tx.communityMembership.create({
        data: { communityId: input.communauteId, userId: input.userId },
      });
      await tx.community.update({
        where: { id: input.communauteId },
        data: { memberCount: { increment: 1 } },
      });
    });
  } catch (cause) {
    // L'unicité a parlé : on était déjà membre. Ce n'est pas une erreur, et
    // surtout le compteur ne doit pas avoir bougé — d'où la transaction.
    if (estCollisionUnique(cause)) return { ok: false, motif: "DEJA_MEMBRE" };
    throw cause;
  }

  return { ok: true };
}

/**
 * Quitter une communauté.
 *
 * Son créateur ne peut pas partir : il resterait administrateur par
 * `creatorId` tout en étant absent de ses propres membres. Fermer l'espace est
 * le geste qui correspond, et il est explicite.
 */
export async function quitter(input: {
  communauteId: string;
  userId: string;
  createurId: string;
}): Promise<Suite> {
  if (input.userId === input.createurId) return { ok: false, motif: "INTERDIT" };

  const parti = await db.$transaction(async (tx) => {
    const efface = await tx.communityMembership.deleteMany({
      where: { communityId: input.communauteId, userId: input.userId },
    });

    if (efface.count !== 1) return false;

    await tx.community.update({
      where: { id: input.communauteId },
      // `GREATEST` en esprit : un compteur ne descend pas sous zéro. Prisma
      // n'a pas de `greatest`, et la condition dans le `WHERE` fait le même
      // travail — elle n'écrit rien quand il est déjà à zéro.
      data: { memberCount: { decrement: 1 } },
    });

    return true;
  });

  return parti ? { ok: true } : { ok: false, motif: "INTROUVABLE" };
}

// ═══════════════════════════════════════════════════════════ sujets et messages ══

/** Ouvre un sujet, avec son premier message. */
export async function ouvrirSujet(input: {
  communauteId: string;
  categorieId: string;
  auteurId: string;
  droits: Droits;
  saisie: SaisieSujet;
}): Promise<Suite<{ sujetId: string }>> {
  if (!input.droits.ecrire) return { ok: false, motif: "INTERDIT" };

  const verdict = validerSujet(input.saisie);
  if (!verdict.ok) return { ok: false, motif: "REFUS", refus: verdict.refus };

  // La rubrique doit appartenir à CETTE communauté. L'identifiant vient du
  // formulaire : sans ce contrôle, on ouvrirait un sujet chez le voisin.
  const categorie = await db.forumCategory.findFirst({
    where: { id: input.categorieId, communityId: input.communauteId },
    select: { id: true },
  });

  if (!categorie) return { ok: false, motif: "INTROUVABLE" };

  const sujet = await db.$transaction(async (tx) => {
    const t = await tx.forumTopic.create({
      data: {
        categoryId: categorie.id,
        authorId: input.auteurId,
        title: verdict.valeur.titre,
      },
      select: { id: true },
    });

    await tx.forumPost.create({
      data: {
        topicId: t.id,
        authorId: input.auteurId,
        body: verdict.valeur.corps,
      },
    });

    return t;
  });

  // `repliesCount` reste à zéro : le premier message n'est pas une réponse,
  // c'est le sujet lui-même. Le compter ferait afficher « 1 réponse » sur un
  // sujet auquel personne n'a répondu.
  return { ok: true, sujetId: sujet.id };
}

/** Répond à un sujet. */
export async function repondre(input: {
  communauteId: string;
  sujetId: string;
  auteurId: string;
  droits: Droits;
  saisie: SaisieMessage;
}): Promise<Suite<{ messageId: string }>> {
  if (!input.droits.ecrire) return { ok: false, motif: "INTERDIT" };

  const verdict = validerMessage(input.saisie);
  if (!verdict.ok) return { ok: false, motif: "REFUS", refus: verdict.refus };

  const sujet = await db.forumTopic.findFirst({
    where: {
      id: input.sujetId,
      category: { communityId: input.communauteId },
    },
    select: { id: true, isLocked: true },
  });

  if (!sujet) return { ok: false, motif: "INTROUVABLE" };

  // Un modérateur non plus ne répond pas à un sujet verrouillé. Verrouiller
  // veut dire « la conversation est close » ; se réserver le dernier mot
  // transformerait le geste en avantage.
  if (sujet.isLocked) return { ok: false, motif: "VERROUILLE" };

  const message = await db.$transaction(async (tx) => {
    const p = await tx.forumPost.create({
      data: {
        topicId: sujet.id,
        authorId: input.auteurId,
        body: verdict.valeur.corps,
      },
      select: { id: true },
    });

    await tx.forumTopic.update({
      where: { id: sujet.id },
      data: { repliesCount: { increment: 1 } },
    });

    return p;
  });

  return { ok: true, messageId: message.id };
}

/**
 * Retire un message.
 *
 * Son auteur retire le sien à tout moment ; un modérateur retire celui des
 * autres. Les deux chemins mènent à la même suppression, et c'est voulu — un
 * message « masqué » qui reste en base finit par ressortir d'une requête qu'on
 * n'avait pas prévue.
 */
export async function retirerMessage(input: {
  communauteId: string;
  messageId: string;
  parId: string;
  droits: Droits;
}): Promise<Suite> {
  const message = await db.forumPost.findFirst({
    where: {
      id: input.messageId,
      topic: { category: { communityId: input.communauteId } },
    },
    select: { id: true, authorId: true, topicId: true },
  });

  if (!message) return { ok: false, motif: "INTROUVABLE" };

  const sien = message.authorId === input.parId;
  if (!sien && !input.droits.moderer) return { ok: false, motif: "INTERDIT" };

  await db.$transaction(async (tx) => {
    await tx.forumPost.delete({ where: { id: message.id } });

    // Le compteur suit. `decrement` sans plancher irait sous zéro si le
    // compteur avait déjà divergé ; la condition l'en empêche.
    await tx.forumTopic.updateMany({
      where: { id: message.topicId, repliesCount: { gt: 0 } },
      data: { repliesCount: { decrement: 1 } },
    });
  });

  if (!sien) {
    // Consigné seulement quand quelqu'un retire le message d'un autre :
    // effacer le sien n'engage personne, et noyer l'audit sous ces lignes
    // ferait perdre celles qui comptent.
    await consigner({
      acteurId: input.parId,
      action: "contenu.retirer",
      ressource: ressource("forum-message", message.id),
      details: { auteur: message.authorId },
    });
  }

  return { ok: true };
}

// ══════════════════════════════════════════════════════════════ la modération ══

/** Épingle ou désépingle un sujet. */
export async function basculerEpingle(input: {
  communauteId: string;
  sujetId: string;
  droits: Droits;
}): Promise<Suite<{ epingle: boolean }>> {
  return basculerSurSujet(input, "isPinned");
}

/** Verrouille ou déverrouille un sujet. */
export async function basculerVerrou(input: {
  communauteId: string;
  sujetId: string;
  droits: Droits;
}): Promise<Suite<{ epingle: boolean }>> {
  return basculerSurSujet(input, "isLocked");
}

async function basculerSurSujet(
  input: { communauteId: string; sujetId: string; droits: Droits },
  champ: "isPinned" | "isLocked",
): Promise<Suite<{ epingle: boolean }>> {
  if (!input.droits.moderer) return { ok: false, motif: "INTERDIT" };

  const sujet = await db.forumTopic.findFirst({
    where: {
      id: input.sujetId,
      category: { communityId: input.communauteId },
    },
    select: { id: true, isPinned: true, isLocked: true },
  });

  if (!sujet) return { ok: false, motif: "INTROUVABLE" };

  const apres = !sujet[champ];

  // La valeur d'avant est dans le `WHERE` : deux modérateurs qui cliquent en
  // même temps ne doivent pas se renvoyer l'état l'un à l'autre.
  const ecrit = await db.forumTopic.updateMany({
    where: { id: sujet.id, [champ]: sujet[champ] },
    data: { [champ]: apres },
  });

  if (ecrit.count !== 1) return { ok: false, motif: "INTROUVABLE" };

  return { ok: true, epingle: apres };
}

/**
 * Signaler un message.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * SIGNALER N'EST PAS MODÉRER
 *
 * Le message ne disparaît pas, et ne change pas de place : il reste dans le
 * fil, marqué. Le masquer ferait disparaître le contexte d'une conversation
 * dont les réponses citent souvent ce qu'on a signalé.
 *
 * C'est ce drapeau qui donne à un modérateur de la plateforme le droit de
 * lire — voir l'en-tête d'`acces.ts` : il ne se promène pas dans les
 * communautés privées, il répond à un signalement.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL FAUT POUVOIR LIRE POUR SIGNALER
 *
 * Sinon on signalerait à l'aveugle le message d'une communauté qu'on ne voit
 * pas — ce qui serait un moyen commode d'apprendre qu'elle existe.
 */
export async function signalerMessage(input: {
  communauteId: string;
  messageId: string;
  parId: string;
  droits: Droits;
}): Promise<Suite> {
  if (!input.droits.lire) return { ok: false, motif: "INTERDIT" };

  const ecrit = await db.forumPost.updateMany({
    where: {
      id: input.messageId,
      topic: { category: { communityId: input.communauteId } },
      // Déjà signalé : on n'écrit rien et l'on ne consigne pas une seconde
      // fois. Le premier signalement suffit à le faire remonter.
      isFlagged: false,
    },
    data: { isFlagged: true },
  });

  if (ecrit.count !== 1) return { ok: false, motif: "INTROUVABLE" };

  await consigner({
    acteurId: input.parId,
    action: "contenu.refuser",
    ressource: ressource("forum-message", input.messageId),
    details: { geste: "signalement" },
  });

  return { ok: true };
}

// ════════════════════════════════════════════════════════════════════ outils ══

type ClientTransaction = { community: { findUnique: typeof db.community.findUnique } };

/**
 * Les adresses que `/communautes/<slug>` ne peut pas rendre.
 *
 * `app/communautes/nouvelle/` est un segment statique : Next.js le résout
 * avant `[slug]`. Une communauté nommée « Nouvelle » se créerait donc sans
 * erreur, et son adresse afficherait le formulaire de création à la place —
 * un succès silencieux, celui qui ne se corrige jamais parce que personne ne
 * le voit.
 *
 * Elle prend « nouvelle-2 ». Refuser le nom serait plus bruyant sans être plus
 * utile : personne n'appelle sa communauté « Nouvelle » exprès.
 */
const RESERVES = new Set(["nouvelle"]);

/** Slug unique : on suffixe tant que le précédent est pris. */
async function slugDisponible(
  base: string,
  client: ClientTransaction,
): Promise<string> {
  const racine = base.length > 0 ? base : "communaute";

  for (let i = 0; i < 50; i += 1) {
    const candidat = i === 0 ? racine : `${racine}-${i + 1}`;
    if (RESERVES.has(candidat)) continue;
    const pris = await client.community.findUnique({
      where: { slug: candidat },
      select: { id: true },
    });
    if (!pris) return candidat;
  }

  return `${racine}-${Date.now()}`;
}

function estCollisionUnique(cause: unknown): boolean {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    (cause as { code?: unknown }).code === "P2002"
  );
}
