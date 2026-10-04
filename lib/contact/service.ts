import "server-only";

import type { ContactKind, ContactStatus } from "@prisma/client";

import { peut, type RolePlateforme } from "@/lib/auth/administration";
import type { MessageValide } from "@/lib/contact/regles";
import { db } from "@/lib/db";

/**
 * Les messages reçus par les formulaires Contact et Sponsoriser.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * QUI LIT QUOI
 *
 * Le support (`traiter_les_litiges` : « répondre à un ticket ») lit les
 * messages ; le marketing (`promouvoir_du_contenu` : « sponsoring ») lit les
 * demandes de sponsoring. Chacun ne voit que son genre — la porte de l'écran
 * s'ouvre à l'un ou l'autre pouvoir, la requête borne ce qu'on trouve derrière,
 * comme pour la file de modération.
 */

export function genresLusPar(role: RolePlateforme): ContactKind[] {
  const genres: ContactKind[] = [];
  if (peut(role, "traiter_les_litiges")) genres.push("CONTACT");
  if (peut(role, "promouvoir_du_contenu")) genres.push("SPONSOR");
  return genres;
}

export async function enregistrerMessage(message: MessageValide, expediteurId: string | null): Promise<{ id: string }> {
  return db.contactMessage.create({
    data: {
      kind: message.genre,
      senderId: expediteurId,
      name: message.nom,
      email: message.email,
      subject: message.sujet,
      body: message.corps,
      budget: message.budget,
    },
    select: { id: true },
  });
}

export interface MessageRecu {
  id: string;
  genre: ContactKind;
  statut: ContactStatus;
  nom: string;
  email: string;
  sujet: string;
  corps: string;
  budget: string | null;
  /** Le nom d'utilisateur de l'expéditeur, s'il était connecté. */
  compte: string | null;
  recuLe: Date;
  traiteLe: Date | null;
}

export async function boiteDeReception(input: {
  role: RolePlateforme;
  statut: ContactStatus;
  limite?: number;
}): Promise<MessageRecu[]> {
  const genres = genresLusPar(input.role);
  if (genres.length === 0) return [];

  const lignes = await db.contactMessage.findMany({
    where: { kind: { in: genres }, status: input.statut },
    orderBy: { createdAt: input.statut === "NEW" ? "asc" : "desc" },
    take: input.limite ?? 100,
    select: {
      id: true,
      kind: true,
      status: true,
      name: true,
      email: true,
      subject: true,
      body: true,
      budget: true,
      createdAt: true,
      handledAt: true,
      sender: { select: { profile: { select: { username: true } } } },
    },
  });

  return lignes.map((m) => ({
    id: m.id,
    genre: m.kind,
    statut: m.status,
    nom: m.name,
    email: m.email,
    sujet: m.subject,
    corps: m.body,
    budget: m.budget,
    compte: m.sender?.profile?.username ?? null,
    recuLe: m.createdAt,
    traiteLe: m.handledAt,
  }));
}

export type Traitement = { ok: true; genre: ContactKind } | { ok: false; motif: "INTROUVABLE" | "INTERDIT" | "DEJA_TRAITE" };

/**
 * Marque un message traité.
 *
 * Le genre se vérifie ici, pas seulement dans la page : un identifiant se
 * recopie, et le marketing ne doit pas pouvoir classer un message du support.
 * L'écriture est conditionnelle, comme pour les témoignages : deux personnes
 * qui cliquent ensemble, une seule l'emporte.
 */
export async function marquerTraite(input: { id: string; parId: string; role: RolePlateforme }): Promise<Traitement> {
  const message = await db.contactMessage.findUnique({ where: { id: input.id }, select: { kind: true } });
  if (!message) return { ok: false, motif: "INTROUVABLE" };
  if (!genresLusPar(input.role).includes(message.kind)) return { ok: false, motif: "INTERDIT" };

  const { count } = await db.contactMessage.updateMany({
    where: { id: input.id, status: "NEW" },
    data: { status: "HANDLED", handledById: input.parId, handledAt: new Date() },
  });
  return count === 1 ? { ok: true, genre: message.kind } : { ok: false, motif: "DEJA_TRAITE" };
}
