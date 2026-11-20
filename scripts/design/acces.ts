/**
 * Ouvrir les pages de l'application comme un compte de test, sans mot de passe.
 *
 * Mis en commun le 20/11/2026 entre `captures.ts` (les planches maquette |
 * application) et `revue-skills.ts` (la revue avec les skills Halo) : le même
 * procédé, écrit une seule fois. Il vient de `e2e/badges.spec.ts` — une
 * session écrite en base, dont seule l'empreinte SHA-256 du jeton est
 * gardée, posée dans le cookie `baobart_session`.
 *
 * Les comptes sont ceux de `pnpm comptes:test` ; leurs mots de passe vivent
 * dans `scripts/comptes-de-test.ts` et ne servent pas ici.
 */
import { createHash, randomBytes } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

import type { Compte } from "./ecrans";

export const EMAILS: Record<Compte, string> = {
  client: "client@baobart.test",
  createur: "createur@baobart.test",
  admin: "admin@baobart.test",
  agence: "agence@baobart.test",
};

/**
 * `tsx` compile en gardant les noms de fonctions, et enveloppe certaines dans
 * `__name(…)`. Une fonction envoyée à `page.evaluate` emporte l'appel, pas la
 * définition : « ReferenceError: __name is not defined » (mesuré le 14/11).
 */
export const NOMMER = { content: "window.__name = (f) => f;" };

/** Un visiteur qui a déjà répondu « refuser » : sans lui, la bannière des cookies couvre le bas de chaque page. */
export const COOKIE_CONSENTEMENT = { name: "bb_consentement", value: "v1.pub-non" };

/** Résout les segments `{…}` d'une route dans la base de développement. */
export async function resoudreParametres(db: PrismaClient, ids: Record<Compte, string>) {
  const premier = async (sql: string, ...valeurs: unknown[]): Promise<string | null> => {
    try {
      const lignes = await db.$queryRawUnsafe<{ v: string }[]>(sql, ...valeurs);
      return lignes[0]?.v ?? null;
    } catch (err) {
      return `!${(err as Error).message.split("\n").pop()}`;
    }
  };
  const p: Record<string, string | null> = {
    // Payant : /acheter renvoie un produit gratuit vers sa fiche (mesuré le 14/11 : la
    // première ressource publiée de la démo est gratuite, et « Paiement » capturait la fiche).
    produit: await premier(
      `select slug as v from "Product" where status = 'PUBLISHED' and price > 0 order by "createdAt" limit 1`,
    ),
    produitCreateur: await premier(`select id as v from "Product" where "sellerId" = $1 order by "createdAt" limit 1`, ids.createur),
    createur: await premier(`select username as v from "Profile" where "userId" = $1`, ids.createur),
    service: await premier(`select id as v from "ServiceOffer" limit 1`),
    job: await premier(`select id as v from "JobPosting" limit 1`),
    jobAgence: await premier(`select id as v from "JobPosting" where "recruiterId" = $1 limit 1`, ids.agence),
    commande: await premier(`select id as v from "Order" limit 1`),
    abonnement: await premier(`select id as v from "Subscription" where "userId" = $1 limit 1`, ids.agence),
    paiementAbonnement: await premier(`select id as v from "SubscriptionPayment" limit 1`),
    evenement: await premier(`select id as v from "Event" limit 1`),
    evenementPublic: await premier(`select id as v from "Event" limit 1`),
    publicite: await premier(`select id as v from "Ad" limit 1`),
    blog: await premier(`select slug as v from "BlogPost" limit 1`),
    articleAdmin: await premier(`select id as v from "BlogPost" limit 1`),
    communaute: await premier(`select slug as v from "Community" limit 1`),
    collection: null,
    jetonValide: null,
    jetonPerime: null,
  };
  return p;
}

export function construireUrl(
  route: string,
  p: Record<string, string | null>,
  base: string,
): { url: string } | { raison: string } {
  let manque: string | null = null;
  const chemin = route.replace(/\{(\w+)\}/g, (_, nom: string) => {
    const v = p[nom];
    if (v == null) manque ??= `aucune donnée de démonstration pour {${nom}}`;
    else if (v.startsWith("!")) manque ??= `requête {${nom}} en échec : ${v.slice(1)}`;
    return v ?? "";
  });
  return manque ? { raison: manque } : { url: base + chemin };
}

/** Une session de trois heures par compte. Les supprimer à la fin, même sur erreur : `fermerSessions`. */
export async function ouvrirSessions(db: PrismaClient, emails: Record<Compte, string> = EMAILS) {
  const sessions: string[] = [];
  const jetons = {} as Record<Compte, string>;
  const ids = {} as Record<Compte, string>;
  for (const [compte, email] of Object.entries(emails) as [Compte, string][]) {
    const u = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (!u) throw new Error(`Compte ${email} absent : lancer « pnpm comptes:test » d'abord.`);
    const jeton = randomBytes(32).toString("base64url");
    const s = await db.session.create({
      data: { userId: u.id, token: createHash("sha256").update(jeton).digest("hex"), expiresAt: new Date(Date.now() + 3 * 3_600_000) },
      select: { id: true },
    });
    sessions.push(s.id);
    jetons[compte] = jeton;
    ids[compte] = u.id;
  }
  return { sessions, jetons, ids };
}

export async function fermerSessions(db: PrismaClient, sessions: string[]) {
  if (sessions.length > 0) await db.session.deleteMany({ where: { id: { in: sessions } } });
}
