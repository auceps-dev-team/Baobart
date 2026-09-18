import "server-only";

import { consigner, ressource } from "@/lib/admin/audit";
import { db } from "@/lib/db";

/**
 * Les messages signalés, et ce qu'on en fait.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI CE N'EST PAS LA FILE DE MODÉRATION
 *
 * `lib/cms/moderation.ts` sert les quatre CMS : un contenu y attend une
 * décision **avant** de paraître, et son état vaut BROUILLON, SOUMIS, PUBLIÉ,
 * REFUSÉ ou RETIRÉ.
 *
 * Un message de forum n'a rien de tout ça. Il paraît immédiatement — une
 * conversation qu'il faudrait faire valider ligne à ligne n'est plus une
 * conversation — et le signalement arrive **après**. Le faire entrer de force
 * dans `ContentState` demanderait de lui inventer un état qu'il n'a pas, et
 * mêlerait dans une même liste des objets qui n'appellent pas la même
 * décision : « publier ou refuser » d'un côté, « laisser ou retirer » de
 * l'autre.
 *
 * Deux files, donc, et la seconde renvoie vers la première.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * C'EST ICI, ET SEULEMENT ICI, QU'UN MODÉRATEUR DE PLATEFORME LIT UNE PRIVÉE
 *
 * `acces.ts` lui donne exactement ce qu'un inconnu obtient : il ne se promène
 * pas dans les communautés fermées. Le drapeau est la seule chose qui ouvre —
 * et il n'ouvre qu'un message, celui qu'on a signalé, jamais le fil autour.
 *
 * Le nom de la communauté accompagne le message, parce qu'un modérateur ne
 * peut pas juger « ça ne se dit pas ici » sans savoir où est « ici ».
 */

export interface MessageSignale {
  id: string;
  corps: string;
  auteur: string;
  auteurId: string;
  ecritLe: Date;
  sujetId: string;
  sujetTitre: string;
  communauteSlug: string;
  communauteNom: string;
  communautePrivee: boolean;
}

/**
 * Les messages signalés, du plus ancien au plus récent.
 *
 * Une file se vide du plus ancien : trier à l'envers ferait vieillir
 * indéfiniment ceux du bas pendant que les nouveaux passent devant.
 */
export async function messagesSignales(limite = 100): Promise<MessageSignale[]> {
  const lignes = await db.forumPost.findMany({
    where: { isFlagged: true },
    orderBy: { createdAt: "asc" },
    take: limite,
    select: {
      id: true,
      body: true,
      authorId: true,
      createdAt: true,
      author: {
        select: { email: true, profile: { select: { displayName: true } } },
      },
      topic: {
        select: {
          id: true,
          title: true,
          category: {
            select: {
              community: {
                select: { slug: true, name: true, visibility: true },
              },
            },
          },
        },
      },
    },
  });

  return lignes.map((p) => ({
    id: p.id,
    corps: p.body,
    auteur: p.author.profile?.displayName ?? p.author.email,
    auteurId: p.authorId,
    ecritLe: p.createdAt,
    sujetId: p.topic.id,
    sujetTitre: p.topic.title,
    communauteSlug: p.topic.category.community.slug,
    communauteNom: p.topic.category.community.name,
    communautePrivee: p.topic.category.community.visibility !== "PUBLIC",
  }));
}

/**
 * Le signalement ne tenait pas : on lève le drapeau, le message reste.
 *
 * Le geste est consigné comme les autres. Un signalement écarté est une
 * décision autant qu'un message retiré — et c'est celle qu'on aura besoin de
 * retrouver le jour où quelqu'un demandera pourquoi rien n'a été fait.
 */
export async function leverLeSignalement(input: {
  messageId: string;
  parId: string;
}): Promise<{ ok: boolean }> {
  const ecrit = await db.forumPost.updateMany({
    where: { id: input.messageId, isFlagged: true },
    data: { isFlagged: false },
  });

  if (ecrit.count !== 1) return { ok: false };

  await consigner({
    acteurId: input.parId,
    action: "contenu.approuver",
    ressource: ressource("forum-message", input.messageId),
    details: { geste: "signalement levé" },
  });

  return { ok: true };
}

/**
 * Le message part.
 *
 * Supprimé, pas masqué : un message « caché » qui reste en base finit par
 * ressortir d'une requête qu'on n'avait pas prévue. Le compteur de réponses du
 * sujet suit dans la même transaction.
 */
export async function retirerParLaPlateforme(input: {
  messageId: string;
  parId: string;
}): Promise<{ ok: boolean }> {
  const message = await db.forumPost.findUnique({
    where: { id: input.messageId },
    select: { id: true, authorId: true, topicId: true },
  });

  if (!message) return { ok: false };

  await db.$transaction(async (tx) => {
    await tx.forumPost.delete({ where: { id: message.id } });
    await tx.forumTopic.updateMany({
      where: { id: message.topicId, repliesCount: { gt: 0 } },
      data: { repliesCount: { decrement: 1 } },
    });
  });

  await consigner({
    acteurId: input.parId,
    action: "contenu.retirer",
    ressource: ressource("forum-message", message.id),
    details: { auteur: message.authorId, geste: "retrait par la plateforme" },
  });

  return { ok: true };
}
