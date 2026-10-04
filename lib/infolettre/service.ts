import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { urlDuSite } from "@/lib/config/site";
import { db } from "@/lib/db";
import { deposer } from "@/lib/email/outbox";
import { adressePlausible } from "@/lib/email/pilotes";
import { journal } from "@/lib/observabilite/journal";

/**
 * La lettre d'information : inscription confirmée par courriel (double opt-in).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS GESTES, ET AUCUN ENVOI DE LETTRE
 *
 * Décidé le 04/10 : « vraie inscription ». On enregistre l'adresse, on envoie
 * un lien de confirmation, et l'adresse ne compte qu'une fois ce lien suivi.
 * La désinscription se fait par un lien, sans compte. L'envoi des lettres
 * elles-mêmes n'est PAS construit : `abonnesConfirmes` dit à qui l'on
 * pourrait écrire, rien n'écrit.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA MÊME RÉPONSE POUR TOUT LE MONDE
 *
 * Comme `demanderReinitialisation` : « déjà inscrite » ne se dit pas. Le
 * formulaire deviendrait un moyen de savoir si une adresse est chez nous.
 */

export const VALIDITE_JOURS = 7;
/** Une adresse en attente ne reçoit pas un second lien avant ce délai. */
export const RELANCE_MIN_MS = 10 * 60_000;
const OCTETS = 32;

function empreinte(jeton: string): string {
  return createHash("sha256").update(jeton, "utf8").digest("hex");
}

function jeton(): string {
  return randomBytes(OCTETS).toString("base64url");
}

export type Inscription = { fait: true } | { fait: false; motif: "adresse_invalide" | "site_non_configure" };

export async function inscrire(brute: string, now: Date = new Date()): Promise<Inscription> {
  const email = brute.trim().toLowerCase();
  if (!adressePlausible(email)) return { fait: false, motif: "adresse_invalide" };

  const base = urlDuSite();
  if (!base) {
    journal.erreur("inscription à la lettre impossible : APP_URL absente", {});
    return { fait: false, motif: "site_non_configure" };
  }

  const existante = await db.newsletterSubscriber.findUnique({
    where: { email },
    select: { status: true, updatedAt: true },
  });

  // Déjà confirmée : rien à envoyer, et rien à dire.
  if (existante?.status === "CONFIRMED") return { fait: true };

  // En attente depuis peu : le premier lien vaut encore. Renvoyer à chaque
  // clic ferait du formulaire un moyen d'inonder une boîte.
  if (existante?.status === "PENDING" && now.getTime() - existante.updatedAt.getTime() < RELANCE_MIN_MS) {
    return { fait: true };
  }

  const confirmer = jeton();
  const desinscrire = jeton();
  const donnees = {
    status: "PENDING" as const,
    confirmTokenHash: empreinte(confirmer),
    unsubscribeTokenHash: empreinte(desinscrire),
    confirmExpiresAt: new Date(now.getTime() + VALIDITE_JOURS * 86_400_000),
    confirmedAt: null,
    unsubscribedAt: null,
  };

  await db.$transaction(async (tx) => {
    await tx.newsletterSubscriber.upsert({ where: { email }, create: { email, ...donnees }, update: donnees });
    await deposer(
      {
        cle: `infolettre-${empreinte(confirmer).slice(0, 32)}`,
        destinataire: email,
        modele: "INFOLETTRE_CONFIRMATION",
        charge: {
          confirmer: `${base}/infolettre/confirmer?jeton=${confirmer}`,
          desinscrire: `${base}/infolettre/desinscription?jeton=${desinscrire}`,
          jours: VALIDITE_JOURS,
        },
      },
      tx,
    );
  });

  return { fait: true };
}

export type Confirmation = { ok: true } | { ok: false; motif: "INCONNU" | "EXPIRE" | "DESINSCRITE" };

/**
 * Confirme une inscription.
 *
 * Appelée par un bouton, pas à l'ouverture du lien : les antivirus de
 * messagerie ouvrent les liens d'un courriel pour les inspecter, et une
 * confirmation au simple chargement inscrirait des gens qui n'ont rien
 * cliqué — exactement ce que le double opt-in existe pour empêcher.
 */
export async function confirmer(jetonClair: string, now: Date = new Date()): Promise<Confirmation> {
  if (jetonClair.length < 16 || jetonClair.length > 256) return { ok: false, motif: "INCONNU" };

  const ligne = await db.newsletterSubscriber.findUnique({
    where: { confirmTokenHash: empreinte(jetonClair) },
    select: { id: true, status: true, confirmExpiresAt: true },
  });
  if (!ligne) return { ok: false, motif: "INCONNU" };
  if (ligne.status === "CONFIRMED") return { ok: true };
  // Un vieux lien ne réinscrit pas qui s'est désinscrit depuis.
  if (ligne.status === "UNSUBSCRIBED") return { ok: false, motif: "DESINSCRITE" };
  if (ligne.confirmExpiresAt.getTime() <= now.getTime()) return { ok: false, motif: "EXPIRE" };

  await db.newsletterSubscriber.updateMany({
    where: { id: ligne.id, status: "PENDING" },
    data: { status: "CONFIRMED", confirmedAt: now },
  });
  return { ok: true };
}

export type Desinscription = { ok: true } | { ok: false; motif: "INCONNU" };

export async function desinscrire(jetonClair: string, now: Date = new Date()): Promise<Desinscription> {
  if (jetonClair.length < 16 || jetonClair.length > 256) return { ok: false, motif: "INCONNU" };

  const { count } = await db.newsletterSubscriber.updateMany({
    where: { unsubscribeTokenHash: empreinte(jetonClair) },
    data: { status: "UNSUBSCRIBED", unsubscribedAt: now },
  });
  return count === 1 ? { ok: true } : { ok: false, motif: "INCONNU" };
}

/** Le nombre d'adresses confirmées — à qui une lettre pourrait partir. */
export async function abonnesConfirmes(): Promise<number> {
  return db.newsletterSubscriber.count({ where: { status: "CONFIRMED" } });
}
