import "server-only";

import { urlDuSite } from "@/lib/config/site";
import { db } from "@/lib/db";
import { deposer } from "@/lib/email/outbox";
import { jetonDeDesinscription } from "@/lib/infolettre/service";
import { journal } from "@/lib/observabilite/journal";

/**
 * L'envoi d'un numéro de la lettre d'information.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUI EST DÉCIDÉ, ET CE QUI NE L'EST PAS
 *
 * Décidé le 05/10 : l'équipe (le marketing — `promouvoir_du_contenu`, dont la
 * définition dit « infolettres ») écrit un numéro et l'envoie aux adresses
 * CONFIRMÉES, et à elles seules. Chaque courriel porte son lien de
 * désinscription, signé (`jetonDeDesinscription`).
 *
 * Le numéro passe par la file des courriels (`deposer`), comme tout le reste :
 * elle porte déjà les reprises, le recul progressif et la supervision. Elle
 * vide vingt messages par passage : mille abonnés demandent cinquante passages,
 * et c'est voulu — un envoi en rafale est ce qui fait classer un expéditeur en
 * indésirable.
 *
 * Pas de HTML, pas de pixel de suivi : ni ouverture ni clic n'est mesuré.
 */

export const SUJET_MIN = 3;
export const SUJET_MAX = 150;
export const CORPS_MIN = 20;
export const CORPS_MAX = 20_000;

export type Saisie = { ok: true; sujet: string; corps: string } | { ok: false; message: string };

export function validerNumero(sujetBrut: string, corpsBrut: string): Saisie {
  const sujet = sujetBrut.trim().replace(/\s+/g, " ");
  const corps = corpsBrut.trim();
  if (sujet.length < SUJET_MIN || sujet.length > SUJET_MAX) return { ok: false, message: `Un objet entre ${SUJET_MIN} et ${SUJET_MAX} caractères.` };
  if (corps.length < CORPS_MIN || corps.length > CORPS_MAX) return { ok: false, message: `Un texte entre ${CORPS_MIN} et ${CORPS_MAX} caractères.` };
  return { ok: true, sujet, corps };
}

export async function enregistrerNumero(input: { id?: string; sujet: string; corps: string; parId: string }): Promise<{ ok: true; id: string } | { ok: false; motif: "DEJA_ENVOYE" | "INTROUVABLE" }> {
  if (!input.id) {
    const cree = await db.newsletterIssue.create({ data: { subject: input.sujet, body: input.corps, createdById: input.parId }, select: { id: true } });
    return { ok: true, id: cree.id };
  }
  // Un numéro envoyé ne se réécrit pas : ce qui est parti doit pouvoir se relire tel quel.
  const { count } = await db.newsletterIssue.updateMany({ where: { id: input.id, status: "DRAFT" }, data: { subject: input.sujet, body: input.corps } });
  if (count === 1) return { ok: true, id: input.id };
  return (await db.newsletterIssue.count({ where: { id: input.id } })) === 0 ? { ok: false, motif: "INTROUVABLE" } : { ok: false, motif: "DEJA_ENVOYE" };
}

export async function numeros(limite = 50) {
  return db.newsletterIssue.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: limite,
    select: { id: true, subject: true, body: true, status: true, sentAt: true, recipients: true, createdAt: true },
  });
}

export type Envoi =
  | { ok: true; destinataires: number }
  | { ok: false; motif: "INTROUVABLE" | "DEJA_ENVOYE" | "SITE_NON_CONFIGURE" | "AUCUN_ABONNE" };

function base(): string | null {
  return urlDuSite();
}

/** Un essai à l'adresse de qui écrit, avant d'envoyer à tous. */
export async function envoyerUnEssai(input: { id: string; adresse: string }): Promise<Envoi> {
  const numero = await db.newsletterIssue.findUnique({ where: { id: input.id }, select: { subject: true, body: true } });
  if (!numero) return { ok: false, motif: "INTROUVABLE" };
  const site = base();
  if (!site) return { ok: false, motif: "SITE_NON_CONFIGURE" };

  await deposer({
    cle: `infolettre-essai-${input.id}-${Date.now()}`,
    destinataire: input.adresse,
    modele: "INFOLETTRE",
    // L'essai n'a pas d'abonné derrière lui : son lien mène à la page, sans jeton.
    charge: { sujet: `[Essai] ${numero.subject}`, corps: numero.body, desinscrire: `${site}/infolettre/desinscription` },
  });
  return { ok: true, destinataires: 1 };
}

/**
 * Envoie un numéro à toutes les adresses confirmées.
 *
 * Le numéro passe d'abord DRAFT → SENT par une écriture conditionnelle : deux
 * clics, ou deux membres de l'équipe, n'envoient qu'une fois. Les dépôts
 * portent une clé par numéro et par abonné : une reprise après une panne ne
 * double personne.
 */
export async function envoyerNumero(input: { id: string; parId: string; maintenant?: Date }): Promise<Envoi> {
  const site = base();
  if (!site || jetonDeDesinscription("verification") === null) {
    journal.erreur("lettre impossible à envoyer : APP_URL ou AUTH_SECRET absente", {});
    return { ok: false, motif: "SITE_NON_CONFIGURE" };
  }
  const numero = await db.newsletterIssue.findUnique({ where: { id: input.id }, select: { id: true, subject: true, body: true, status: true } });
  if (!numero) return { ok: false, motif: "INTROUVABLE" };
  if (numero.status !== "DRAFT") return { ok: false, motif: "DEJA_ENVOYE" };

  const confirmes = await db.newsletterSubscriber.count({ where: { status: "CONFIRMED" } });
  if (confirmes === 0) return { ok: false, motif: "AUCUN_ABONNE" };

  const { count } = await db.newsletterIssue.updateMany({
    where: { id: numero.id, status: "DRAFT" },
    data: { status: "SENT", sentAt: input.maintenant ?? new Date(), sentById: input.parId },
  });
  if (count !== 1) return { ok: false, motif: "DEJA_ENVOYE" };

  const destinataires = await deposerPourLesAbonnes({ id: numero.id, sujet: numero.subject, corps: numero.body, site });
  await db.newsletterIssue.update({ where: { id: numero.id }, data: { recipients: destinataires } });
  journal.info("lettre envoyée", { numero: numero.id, destinataires });
  return { ok: true, destinataires };
}

async function deposerPourLesAbonnes(n: { id: string; sujet: string; corps: string; site: string }): Promise<number> {
  let deposes = 0;
  let curseur: string | undefined;
  for (;;) {
    const lot = await db.newsletterSubscriber.findMany({
      where: { status: "CONFIRMED" },
      orderBy: { id: "asc" },
      take: 200,
      ...(curseur ? { skip: 1, cursor: { id: curseur } } : {}),
      select: { id: true, email: true },
    });
    if (lot.length === 0) break;
    for (const a of lot) {
      const jeton = jetonDeDesinscription(a.id)!;
      const r = await deposer({
        cle: `infolettre-${n.id}-${a.id}`,
        destinataire: a.email,
        modele: "INFOLETTRE",
        charge: { sujet: n.sujet, corps: n.corps, desinscrire: `${n.site}/infolettre/desinscription?jeton=${jeton}` },
      });
      // Un doublon est un dépôt déjà fait (une reprise) : il compte.
      if (r.depose || r.motif === "doublon") deposes += 1;
    }
    curseur = lot[lot.length - 1]!.id;
  }
  return deposes;
}

/** Le nombre d'adresses à qui un numéro partirait maintenant. */
export async function destinatairesPossibles(): Promise<number> {
  return db.newsletterSubscriber.count({ where: { status: "CONFIRMED" } });
}
