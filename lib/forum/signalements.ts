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
 * Un message de communauté n'a rien de tout ça. Il paraît immédiatement — une
 * conversation qu'il faudrait faire valider ligne à ligne n'est plus une
 * conversation — et le signalement arrive **après**. Le faire entrer de force
 * dans `ContentState` demanderait de lui inventer un état qu'il n'a pas, et
 * mêlerait dans une même liste des objets qui n'appellent pas la même
 * décision : « publier ou refuser » d'un côté, « laisser ou retirer » de
 * l'autre.
 *
 * La maquette tranche dans le même sens : `Baobart Dashboard.dc.html` dessine
 * **deux entrées distinctes** dans la navigation d'administration —
 * `a_moderation` « File de modération » et `a_signalements` « Signalements &
 * DMCA ». Deux files, et la seconde renvoie vers la première.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * C'EST ICI, ET SEULEMENT ICI, QU'UN MODÉRATEUR DE PLATEFORME LIT UNE FERMÉE
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
  /**
   * D'où vient le message.
   *
   * « fil » est le flux plat d'une communauté — celui que dessine la maquette.
   * « forum » est un message de sujet ; ses écrans ne sont plus branchés, mais
   * les messages déjà écrits restent modérables. Les retirer de cette file
   * ferait disparaître des signalements sans décision.
   */
  origine: "fil" | "forum";
  corps: string;
  auteur: string;
  auteurId: string;
  ecritLe: Date;
  /** Absents pour un message de fil : il n'y a pas de sujet. */
  sujetId: string | null;
  sujetTitre: string | null;
  communauteSlug: string;
  communauteNom: string;
  communauteFermee: boolean;
}

export type Origine = MessageSignale["origine"];

/**
 * Les messages signalés, du plus ancien au plus récent.
 *
 * Une file se vide du plus ancien : trier à l'envers ferait vieillir
 * indéfiniment ceux du bas pendant que les nouveaux passent devant.
 */
export async function messagesSignales(limite = 100): Promise<MessageSignale[]> {
  // Deux tables, une seule file. Elles se lisent en parallèle puis se
  // fusionnent sur la date : un modérateur traite « ce qui a été signalé »,
  // pas « ce qui a été signalé dans telle table ».
  const [duFil, duForum] = await Promise.all([
    messagesDeFilSignales(limite),
    messagesDeForumSignales(limite),
  ]);

  return [...duFil, ...duForum]
    .sort((a, b) => a.ecritLe.getTime() - b.ecritLe.getTime())
    .slice(0, limite);
}

async function messagesDeFilSignales(limite: number): Promise<MessageSignale[]> {
  const lignes = await db.communityChatMessage.findMany({
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
      community: { select: { slug: true, name: true, status: true } },
    },
  });

  return lignes.map((m) => ({
    id: m.id,
    origine: "fil" as const,
    corps: m.body,
    auteur: m.author.profile?.displayName ?? m.author.email,
    auteurId: m.authorId,
    ecritLe: m.createdAt,
    sujetId: null,
    sujetTitre: null,
    communauteSlug: m.community.slug,
    communauteNom: m.community.name,
    communauteFermee: m.community.status !== "active",
  }));
}

async function messagesDeForumSignales(limite: number): Promise<MessageSignale[]> {
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
                select: { slug: true, name: true, status: true },
              },
            },
          },
        },
      },
    },
  });

  return lignes.map((p) => ({
    id: p.id,
    origine: "forum" as const,
    corps: p.body,
    auteur: p.author.profile?.displayName ?? p.author.email,
    auteurId: p.authorId,
    ecritLe: p.createdAt,
    sujetId: p.topic.id,
    sujetTitre: p.topic.title,
    communauteSlug: p.topic.category.community.slug,
    communauteNom: p.topic.category.community.name,
    communauteFermee: p.topic.category.community.status !== "active",
  }));
}

/**
 * Le signalement ne tenait pas : on lève le drapeau, le message reste.
 *
 * L'origine vient de la file, et elle voyage avec l'identifiant — un message
 * de fil et un message de forum vivent dans deux tables, et rien ne garantit
 * que leurs identifiants ne se croisent jamais.
 *
 * Le geste est consigné comme les autres. Un signalement écarté est une
 * décision autant qu'un message retiré — et c'est celle qu'on aura besoin de
 * retrouver le jour où quelqu'un demandera pourquoi rien n'a été fait.
 */
export async function leverLeSignalement(input: {
  messageId: string;
  origine: Origine;
  parId: string;
}): Promise<{ ok: boolean }> {
  const ecrit =
    input.origine === "fil"
      ? await db.communityChatMessage.updateMany({
          where: { id: input.messageId, isFlagged: true },
          data: { isFlagged: false },
        })
      : await db.forumPost.updateMany({
          where: { id: input.messageId, isFlagged: true },
          data: { isFlagged: false },
        });

  if (ecrit.count !== 1) return { ok: false };

  await consigner({
    acteurId: input.parId,
    action: "contenu.approuver",
    ressource: ressource(`${input.origine}-message`, input.messageId),
    details: { geste: "signalement levé" },
  });

  return { ok: true };
}

/**
 * Le message part.
 *
 * Supprimé, pas masqué : un message « caché » qui reste en base finit par
 * ressortir d'une requête qu'on n'avait pas prévue.
 *
 * Un message de forum entraîne le compteur de réponses de son sujet, dans la
 * même transaction. Un message de fil n'en a aucun : le fil se compte en le
 * lisant, ce qui est l'avantage de sa forme plate.
 */
export async function retirerParLaPlateforme(input: {
  messageId: string;
  origine: Origine;
  parId: string;
}): Promise<{ ok: boolean }> {
  const auteurId =
    input.origine === "fil"
      ? await retirerDuFilParLaPlateforme(input.messageId)
      : await retirerDuForumParLaPlateforme(input.messageId);

  if (auteurId === null) return { ok: false };

  await consigner({
    acteurId: input.parId,
    action: "contenu.retirer",
    ressource: ressource(`${input.origine}-message`, input.messageId),
    details: { auteur: auteurId, geste: "retrait par la plateforme" },
  });

  return { ok: true };
}

/** Rend l'auteur du message retiré, ou `null` s'il n'existait plus. */
async function retirerDuFilParLaPlateforme(id: string): Promise<string | null> {
  const message = await db.communityChatMessage.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });
  if (!message) return null;

  await db.communityChatMessage.delete({ where: { id: message.id } });
  return message.authorId;
}

async function retirerDuForumParLaPlateforme(id: string): Promise<string | null> {
  const message = await db.forumPost.findUnique({
    where: { id },
    select: { id: true, authorId: true, topicId: true },
  });
  if (!message) return null;

  await db.$transaction(async (tx) => {
    await tx.forumPost.delete({ where: { id: message.id } });
    await tx.forumTopic.updateMany({
      where: { id: message.topicId, repliesCount: { gt: 0 } },
      data: { repliesCount: { decrement: 1 } },
    });
  });

  return message.authorId;
}

// ═════════════════════════════════════════════ modérer la communauté entière ══

/**
 * Fermer une communauté, ou la rouvrir.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * FERMER N'EFFACE RIEN
 *
 * `status` passe à « closed », et `droitsSur` rend alors RIEN à tout le monde —
 * membres et créateur compris. Les messages restent en base : une communauté
 * fermée pour enquête doit pouvoir être relue, et rouverte si l'enquête ne
 * donne rien.
 *
 * Seul `agir_sur_l_exploitation` voit encore l'intérieur. Il faut bien que
 * quelqu'un puisse constater ce qu'on a fermé.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE MOTIF EST OBLIGATOIRE, ET C'EST LA MAQUETTE QUI L'EXIGE
 *
 * `Baobart Dashboard.dc.html`, écran `a_membres_risque` : « Chaque geste exige
 * un motif écrit avant validation, et laisse une ligne que personne ne peut
 * effacer. » La règle vaut ici pour la même raison : fermer l'espace de deux
 * cents personnes sans dire pourquoi est une décision qu'on ne pourra pas
 * expliquer six mois plus tard.
 */
const MOTIF_MIN = 8;

export type SuiteBascule =
  | { ok: true; fermee: boolean }
  | { ok: false; message: string };

export async function basculerLaCommunaute(input: {
  communauteId: string;
  parId: string;
  motif: string;
}): Promise<SuiteBascule> {
  const motif = input.motif.trim();
  if (motif.length < MOTIF_MIN) {
    return {
      ok: false,
      message: `Écris un motif d'au moins ${MOTIF_MIN} caractères : il restera au journal.`,
    };
  }

  const communaute = await db.community.findUnique({
    where: { id: input.communauteId },
    select: { id: true, status: true },
  });
  if (!communaute) return { ok: false, message: "Cette communauté n'existe plus." };

  const ferme = communaute.status === "active";

  // L'état d'avant est dans le `WHERE` : deux administrateurs qui tranchent en
  // même temps ne doivent pas se renvoyer l'état l'un à l'autre.
  const ecrit = await db.community.updateMany({
    where: { id: communaute.id, status: communaute.status },
    data: { status: ferme ? "closed" : "active" },
  });

  if (ecrit.count !== 1) {
    return { ok: false, message: "Quelqu'un vient de trancher avant toi." };
  }

  await consigner({
    acteurId: input.parId,
    action: ferme ? "contenu.retirer" : "contenu.publier",
    ressource: ressource("communaute", communaute.id),
    details: { geste: ferme ? "fermeture" : "réouverture", motif },
  });

  return { ok: true, fermee: ferme };
}

export interface LigneCommunauteAdmin {
  id: string;
  slug: string;
  nom: string;
  membres: number;
  messages: number;
  signales: number;
  fermee: boolean;
  creeeLe: Date;
}

/**
 * Toutes les communautés, ouvertes et fermées.
 *
 * Contrairement à `listerCommunautes`, aucune clause d'accès : c'est la vue de
 * l'administration, et une communauté qu'elle ne verrait pas serait une
 * communauté qu'elle ne peut pas fermer.
 *
 * Les plus signalées en tête, puis les plus peuplées : une file se trie par ce
 * qui appelle une décision, pas par ordre alphabétique.
 */
export async function communautesPourLAdministration(
  limite = 100,
): Promise<LigneCommunauteAdmin[]> {
  const lignes = await db.community.findMany({
    take: limite,
    orderBy: [{ memberCount: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      memberCount: true,
      createdAt: true,
      _count: { select: { chatMessages: true } },
      chatMessages: { where: { isFlagged: true }, select: { id: true } },
    },
  });

  return lignes
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      nom: c.name,
      membres: c.memberCount,
      messages: c._count.chatMessages,
      signales: c.chatMessages.length,
      fermee: c.status !== "active",
      creeeLe: c.createdAt,
    }))
    .sort((a, b) => b.signales - a.signales || b.membres - a.membres);
}

export interface Indicateurs {
  signalesEnAttente: number;
  communautesOuvertes: number;
  communautesFermees: number;
  tranchesSur90Jours: number;
}

/**
 * Les quatre indicateurs de l'écran, tous mesurés.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA MAQUETTE EN DESSINE QUATRE, DONT DEUX QU'ON NE SAIT PAS COMPTER
 *
 * `a_signalements` montre « Dossiers ouverts », « Retraits provisoires »,
 * « Classés sans suite » et « Comptes suspendus ». Les deux premiers décrivent
 * une procédure DMCA — retrait provisoire sous 48 h, droit de réponse de dix
 * jours — dont **rien n'existe en base**.
 *
 * Les afficher à zéro ferait croire que la procédure tourne et qu'elle est
 * vide. C'est le pire des trois choix : mentir sans qu'on puisse s'en
 * apercevoir.
 *
 * On garde donc la forme — quatre tuiles, même disposition — et on y met ce
 * qu'on sait compter. L'écart avec la maquette est écrit **à l'écran**, sous
 * les tuiles, plutôt que caché dans ce commentaire.
 */
export async function indicateurs(): Promise<Indicateurs> {
  const ilYA90Jours = new Date(Date.now() - 90 * 86_400_000);

  const [fil, forum, ouvertes, fermees, tranches] = await Promise.all([
    db.communityChatMessage.count({ where: { isFlagged: true } }),
    db.forumPost.count({ where: { isFlagged: true } }),
    db.community.count({ where: { status: "active" } }),
    db.community.count({ where: { status: { not: "active" } } }),
    db.auditLog.count({
      where: {
        createdAt: { gte: ilYA90Jours },
        action: { in: ["contenu.approuver", "contenu.retirer"] },
        OR: [
          { resource: { startsWith: "fil-message" } },
          { resource: { startsWith: "forum-message" } },
        ],
      },
    }),
  ]);

  return {
    signalesEnAttente: fil + forum,
    communautesOuvertes: ouvertes,
    communautesFermees: fermees,
    tranchesSur90Jours: tranches,
  };
}
