import "server-only";

import { consigner, ressource } from "@/lib/admin/audit";
import { db } from "@/lib/db";
import { notifier } from "@/lib/notifications/aiguilleur";

import type { Droits } from "@/lib/forum/acces";
import type { Contexte } from "@/lib/forum/queries";
import { validerMessage, type Refus } from "@/lib/forum/validation";

/**
 * Le fil d'une communauté.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * C'EST LA MAQUETTE QUI A DÉCIDÉ DE CETTE FORME
 *
 * `Baobart Design/Baobart Accueil.dc.html`, section `#collab` — « Vos espaces
 * d'équipe ». Elle montre un flux plat : `{{ c.who }}`, `{{ c.when }}`,
 * `{{ c.text }}`, et une zone « Écrire un commentaire… » avec « Envoyer ».
 *
 * Pas de rubrique, pas de titre, pas de réponse à une réponse. La promesse qui
 * l'accompagne dit pourquoi : « Likes, collections partagées, commentaires au
 * bon endroit. Fini les captures d'écran par WhatsApp. » Ce qu'elle remplace,
 * c'est un groupe WhatsApp — pas un forum.
 *
 * `ForumCategory` → `ForumTopic` → `ForumPost` existent toujours, et leur code
 * aussi. Ils n'ont simplement plus d'écran : aucune maquette ne les dessine, et
 * la maquette fait foi. Les garder coûte une table vide ; les supprimer
 * coûterait de les réécrire le jour où une maquette arrive.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * MÊME RÈGLE D'ACCÈS QUE LE RESTE
 *
 * Lire demande `lire`, écrire demande `ecrire` — c'est-à-dire l'appartenance,
 * même dans une communauté ouverte. Ce qui distingue une communauté d'un
 * espace de commentaires : on y entre, et l'on peut en sortir quelqu'un.
 */

export type EchecFil =
  | { motif: "REFUS"; refus: Refus }
  | { motif: "INTERDIT" }
  | { motif: "INTROUVABLE" };

export type SuiteFil<T = object> = ({ ok: true } & T) | ({ ok: false } & EchecFil);

export const MESSAGES_ECHEC_FIL: Record<EchecFil["motif"], string> = {
  REFUS: "",
  INTERDIT: "Rejoins cette communauté pour écrire ici.",
  INTROUVABLE: "Ce message n'existe plus.",
};

export interface MessageDuFil {
  id: string;
  corps: string;
  auteur: string;
  auteurId: string;
  auteurUsername: string | null;
  signale: boolean;
  ecritLe: Date;
}

// ══════════════════════════════════════════════════════════════════ lecture ══

/**
 * Le fil, du plus ancien au plus récent.
 *
 * C'est l'ordre d'une conversation : la dernière ligne est en bas, là où la
 * zone de saisie l'attend. La maquette le montre ainsi, et c'est aussi ce que
 * fait le groupe WhatsApp qu'elle remplace.
 *
 * La limite porte sur les messages **les plus récents** — on prend les 200
 * derniers, puis on les remet à l'endroit. Prendre les 200 premiers
 * afficherait le début d'une conversation de trois ans.
 */
export async function filDe(
  contexte: Contexte,
  limite = 200,
): Promise<MessageDuFil[]> {
  if (!contexte.droits.lire) return [];

  const lignes = await db.communityChatMessage.findMany({
    where: { communityId: contexte.communaute.id },
    orderBy: { createdAt: "desc" },
    take: Math.min(limite, 500),
    select: {
      id: true,
      body: true,
      authorId: true,
      isFlagged: true,
      createdAt: true,
      author: {
        select: {
          email: true,
          profile: { select: { displayName: true, username: true } },
        },
      },
    },
  });

  return lignes.reverse().map((m) => ({
    id: m.id,
    corps: m.body,
    auteur: m.author.profile?.displayName ?? m.author.email,
    auteurId: m.authorId,
    auteurUsername: m.author.profile?.username ?? null,
    signale: m.isFlagged,
    ecritLe: m.createdAt,
  }));
}

// ══════════════════════════════════════════════════════════════════ écriture ══

/**
 * Écrire dans le fil.
 *
 * L'avis aux autres membres part **après** la transaction, et son échec ne
 * remonte pas : un message écrit est écrit, même si la cloche ne sonne pas.
 * C'est l'inverse du reçu d'achat, qui s'écrit DANS la transaction du paiement
 * parce qu'une preuve perdue ne se rattrape pas.
 */
export async function ecrireDansLeFil(input: {
  communauteId: string;
  communauteNom: string;
  communauteSlug: string;
  auteurId: string;
  auteurNom: string;
  droits: Droits;
  saisie: { corps: string };
}): Promise<SuiteFil<{ messageId: string }>> {
  if (!input.droits.ecrire) return { ok: false, motif: "INTERDIT" };

  const verdict = validerMessage({ corps: input.saisie.corps });
  if (!verdict.ok) return { ok: false, motif: "REFUS", refus: verdict.refus };

  const message = await db.communityChatMessage.create({
    data: {
      communityId: input.communauteId,
      authorId: input.auteurId,
      body: verdict.valeur.corps,
    },
    select: { id: true },
  });

  await prevenirLesMembres(input);

  return { ok: true, messageId: message.id };
}

/**
 * Retirer un message du fil.
 *
 * Son auteur retire le sien, un modérateur retire celui des autres. Supprimé,
 * pas masqué : un message « caché » qui reste en base finit par ressortir
 * d'une requête qu'on n'avait pas prévue.
 */
export async function retirerDuFil(input: {
  communauteId: string;
  messageId: string;
  parId: string;
  droits: Droits;
}): Promise<SuiteFil> {
  const message = await db.communityChatMessage.findFirst({
    where: { id: input.messageId, communityId: input.communauteId },
    select: { id: true, authorId: true },
  });

  if (!message) return { ok: false, motif: "INTROUVABLE" };

  const sien = message.authorId === input.parId;
  if (!sien && !input.droits.moderer) return { ok: false, motif: "INTERDIT" };

  await db.communityChatMessage.delete({ where: { id: message.id } });

  if (!sien) {
    // Consigné seulement quand on retire le message d'un autre : effacer le
    // sien n'engage personne, et noyer l'audit sous ces lignes ferait perdre
    // celles qui comptent.
    await consigner({
      acteurId: input.parId,
      action: "contenu.retirer",
      ressource: ressource("fil-message", message.id),
      details: { auteur: message.authorId },
    });
  }

  return { ok: true };
}

/**
 * Signaler un message du fil.
 *
 * Il ne disparaît pas et ne change pas de place : il reste dans le fil,
 * marqué. C'est ce drapeau qui le fait remonter dans « Signalements & DMCA »,
 * et c'est la seule chose qui donne à un modérateur de la plateforme le droit
 * de le lire.
 */
export async function signalerDansLeFil(input: {
  communauteId: string;
  messageId: string;
  parId: string;
  droits: Droits;
}): Promise<SuiteFil> {
  if (!input.droits.lire) return { ok: false, motif: "INTERDIT" };

  const ecrit = await db.communityChatMessage.updateMany({
    where: {
      id: input.messageId,
      communityId: input.communauteId,
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
    ressource: ressource("fil-message", input.messageId),
    details: { geste: "signalement" },
  });

  return { ok: true };
}

// ════════════════════════════════════════════════════════════════════ l'avis ══

/**
 * Prévenir les membres, une fois par jour et par personne.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA CLÉ D'IDEMPOTENCE SERT DE LIMITEUR, ET C'EST SON MEILLEUR USAGE ICI
 *
 * Un avis par message transformerait la cloche en compteur de bavardage : dix
 * personnes qui discutent un après-midi, et c'est quarante lignes. Une cloche
 * qu'on n'ouvre plus ne prévient de rien — y compris des avis qui comptent,
 * comme un versement.
 *
 * `fil-<communaute>-<personne>-<jour>` : le second message du jour retombe sur
 * la même clé, l'unicité le refuse, et l'aiguilleur rend « doublon » sans que
 * ce soit une erreur. Aucune table de comptage, aucun travail périodique — la
 * contrainte qui empêche les rejeux fait aussi le limiteur.
 *
 * Ce que ça coûte : le texte de l'avis est celui du PREMIER message du jour.
 * Il dit donc « du nouveau dans X », pas « X a écrit ceci » — annoncer un
 * message précis serait mentir sur les suivants.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'AUTEUR N'EST PAS PRÉVENU DE SON PROPRE MESSAGE
 *
 * Évident à dire, facile à oublier : `userId: { not: auteurId }` dans la
 * requête, et non un filtre après coup — une communauté de deux cents membres
 * ne doit pas rapatrier la ligne de l'auteur pour la jeter.
 */
async function prevenirLesMembres(input: {
  communauteId: string;
  communauteNom: string;
  communauteSlug: string;
  auteurId: string;
  auteurNom: string;
}): Promise<void> {
  const jour = new Date().toISOString().slice(0, 10);

  const membres = await db.communityMembership.findMany({
    where: { communityId: input.communauteId, userId: { not: input.auteurId } },
    select: { userId: true },
    take: 500,
  });

  for (const membre of membres) {
    await notifier({
      destinataireId: membre.userId,
      evenement: "COMMUNAUTE_NOUVEAU_MESSAGE",
      cle: `fil-${input.communauteId}-${membre.userId}-${jour}`,
      titre: `Du nouveau dans « ${input.communauteNom} »`,
      corps: `${input.auteurNom} a écrit dans le fil.`,
      lien: `/communautes/${input.communauteSlug}`,
    });
  }
}

/**
 * Prévenir les administrateurs qu'on vient d'entrer.
 *
 * Volume faible — on ne rejoint une communauté qu'une fois — donc pas de
 * limiteur. Aux administrateurs seulement : prévenir deux cents membres que le
 * deux cent unième est arrivé n'apprend rien à personne.
 */
export async function prevenirDUneAdhesion(input: {
  communauteId: string;
  communauteNom: string;
  communauteSlug: string;
  createurId: string;
  arrivantId: string;
  arrivantNom: string;
}): Promise<void> {
  const administrateurs = await db.communityMembership.findMany({
    where: {
      communityId: input.communauteId,
      role: "ADMIN",
      userId: { not: input.arrivantId },
    },
    select: { userId: true },
  });

  // Le créateur administre son espace même sans ligne d'appartenance — voir
  // `droitsSur`. Le `Set` évite de le prévenir deux fois quand il en a une.
  const aPrevenir = new Set(administrateurs.map((a) => a.userId));
  if (input.createurId !== input.arrivantId) aPrevenir.add(input.createurId);

  for (const userId of aPrevenir) {
    await notifier({
      destinataireId: userId,
      evenement: "COMMUNAUTE_NOUVEAU_MEMBRE",
      cle: `adhesion-${input.communauteId}-${input.arrivantId}`,
      titre: `${input.arrivantNom} a rejoint « ${input.communauteNom} »`,
      corps: "Un membre de plus dans ton espace.",
      lien: `/communautes/${input.communauteSlug}`,
    });
  }
}
