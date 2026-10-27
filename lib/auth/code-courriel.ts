import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { EmailCodePurpose } from "@prisma/client";

import { egales, empreinteDe, genererCode, lireCode } from "@/lib/auth/telephone";
import { db } from "@/lib/db";
import { deposer } from "@/lib/email/outbox";

/**
 * Un code envoyé par courriel pour confirmer un geste sensible — aujourd'hui,
 * changer de compte de versement.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI UN COURRIEL
 *
 * Décidé le 23/10 : la double authentification reste obligatoire pour changer
 * de compte de versement (VULN-08, 18/10), mais on ne force personne à
 * installer une application TOTP. Le code part à l'adresse du compte. Celui
 * qui a volé une session n'a pas la boîte de son propriétaire : c'est ce
 * second canal qui fait du code un second facteur.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * REPRIS DE DEUX ENDROITS
 *
 * L'idée vient de MastodonAffiliate (`src/lib/otp.ts`, lu le 23/10) : six
 * chiffres tirés par `randomInt`, haché, dix minutes, une minute entre deux
 * envois, l'ancien code effacé au suivant, supprimé à l'usage.
 *
 * La mécanique vient d'ici, de `lib/auth/telephone.ts`, parce qu'elle tient ce
 * que celle de Mastodon ne tient pas : là-bas, aucun compteur d'essais par
 * code, seulement un plafond par adresse — qui change d'adresse essaie le
 * million de codes en dix minutes. Ici, cinq essais PAR CODE, réservés avant
 * la comparaison. Et là-bas, le code s'écrit dans la console en
 * développement ; ici, le pilote `console` ne journalise jamais le corps d'un
 * courriel (`lib/email/pilotes.ts`) — en développement, on le lit dans
 * `EmailOutbox.payload`.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QU'ON AJOUTE : LA CIBLE
 *
 * Le code ne vaut que pour le compte qu'il annonce. Le courriel dit « Wave ····
 * 2233 », et le code est lié à l'empreinte de ce compte : un escroc qui obtient
 * le code au téléphone (« c'est le support, donne-moi le code ») ne peut pas
 * s'en servir pour un autre numéro que celui que le propriétaire a lu.
 */

/** Quinze minutes : la file des courriels passe toutes les cinq (`vercel.json`). */
export const DUREE_CODE_COURRIEL_MS = 15 * 60_000;
export const ESSAIS_MAX_COURRIEL = 5;
export const ATTENTE_RENVOI_COURRIEL_MS = 60_000;
/** Une journée, comme les codes SMS : de quoi enquêter, pas davantage. */
const CONSERVATION_MS = 24 * 60 * 60_000;

/** L'empreinte de ce que le code autorise. Jamais la référence en clair en base. */
export function cibleDe(fournisseur: string, reference: string): string {
  return createHash("sha256").update(`${fournisseur}:${reference}`, "utf8").digest("hex");
}

/** « awa.diallo@gmail.com » → « a•••@gmail.com » : assez pour se reconnaître. */
export function adresseMasquee(adresse: string): string {
  const arobase = adresse.indexOf("@");
  if (arobase < 1) return "•••";
  return `${adresse[0]}•••${adresse.slice(arobase)}`;
}

export type EmissionCourriel =
  | { ok: true; vers: string; id: string; courrielId: string }
  | { ok: false; motif: "TROP_TOT" | "ENVOI_IMPOSSIBLE" };

/**
 * Fabrique un code, le range et dépose son courriel — dans une transaction :
 * un code sans courriel serait un code que personne ne connaît.
 *
 * Le courriel attend dans la file ; l'appelant l'envoie tout de suite après sa
 * réponse (`envoyerMaintenant`, lib/payments/actions.ts), sans le faire passer
 * derrière les messages en retard.
 */
export async function emettreCodeCourriel(input: {
  userId: string;
  but: EmailCodePurpose;
  cible: string;
  /** Ce que le courriel annonce : « Wave — ···· 2233 ». */
  destination: string;
  maintenant?: Date;
}): Promise<EmissionCourriel> {
  const maintenant = input.maintenant ?? new Date();

  const compte = await db.user.findUnique({
    where: { id: input.userId },
    select: { email: true, profile: { select: { displayName: true } } },
  });
  if (!compte) return { ok: false, motif: "ENVOI_IMPOSSIBLE" };

  const dernier = await db.emailCode.findFirst({
    where: { userId: input.userId, purpose: input.but },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (dernier && maintenant.getTime() - dernier.createdAt.getTime() < ATTENTE_RENVOI_COURRIEL_MS) {
    return { ok: false, motif: "TROP_TOT" };
  }

  const code = genererCode();
  const sel = randomBytes(16).toString("hex");

  const ligne = await db.$transaction(async (tx) => {
    // Un seul code vivant par compte et par but : le précédent ne doit pas
    // rester valable dans une boîte qu'on a cessé de surveiller.
    await tx.emailCode.updateMany({
      where: { userId: input.userId, purpose: input.but, usedAt: null },
      data: { usedAt: maintenant },
    });
    const cree = await tx.emailCode.create({
      data: {
        userId: input.userId,
        purpose: input.but,
        target: input.cible,
        codeHash: empreinteDe(sel, code),
        salt: sel,
        expiresAt: new Date(maintenant.getTime() + DUREE_CODE_COURRIEL_MS),
        createdAt: maintenant,
      },
      select: { id: true },
    });
    const depot = await deposer(
      {
        cle: `courriel:code-versement-${cree.id}`,
        destinataire: compte.email,
        modele: "CODE_COMPTE_VERSEMENT",
        charge: {
          nom: compte.profile?.displayName ?? compte.email,
          codeSecret: code,
          destination: input.destination,
          minutes: DUREE_CODE_COURRIEL_MS / 60_000,
        },
      },
      tx,
    );
    // Lever annule la transaction : pas de code rangé sans son courriel.
    if (!depot.depose) throw new DepotRefuse();
    return { id: cree.id, courrielId: depot.id };
  }).catch((cause) => {
    if (cause instanceof DepotRefuse) return null;
    throw cause;
  });

  if (!ligne) return { ok: false, motif: "ENVOI_IMPOSSIBLE" };
  return { ok: true, vers: adresseMasquee(compte.email), id: ligne.id, courrielId: ligne.courrielId };
}

class DepotRefuse extends Error {}

export type VerificationCourriel =
  | { ok: true }
  | { ok: false; motif: "INVALIDE" | "EXPIRE" | "TROP_D_ESSAIS" | "AUTRE_COMPTE" };

/**
 * Le code présenté est-il le bon, et pour CE compte ?
 *
 * Même ordre que `verifierCode` (lib/auth/telephone.ts) : l'essai est réservé
 * dans le `WHERE` avant d'être jugé, et le bon code est consommé dans le
 * `WHERE` — deux envois du même code ne valent qu'un changement.
 */
export async function verifierCodeCourriel(input: {
  userId: string;
  but: EmailCodePurpose;
  cible: string;
  saisie: string;
  maintenant?: Date;
}): Promise<VerificationCourriel> {
  const maintenant = input.maintenant ?? new Date();

  const ligne = await db.emailCode.findFirst({
    where: { userId: input.userId, purpose: input.but, usedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, target: true, codeHash: true, salt: true, expiresAt: true, attempts: true },
  });
  if (!ligne) return { ok: false, motif: "INVALIDE" };

  if (ligne.expiresAt.getTime() <= maintenant.getTime()) {
    await db.emailCode.update({ where: { id: ligne.id }, data: { usedAt: maintenant } });
    return { ok: false, motif: "EXPIRE" };
  }

  const reserve = await db.emailCode.updateMany({
    where: { id: ligne.id, usedAt: null, attempts: { lt: ESSAIS_MAX_COURRIEL } },
    data: { attempts: { increment: 1 } },
  });
  if (reserve.count === 0) {
    await db.emailCode.updateMany({ where: { id: ligne.id, usedAt: null }, data: { usedAt: maintenant } });
    return { ok: false, motif: "TROP_D_ESSAIS" };
  }

  const code = lireCode(input.saisie);
  const bon = code !== null && egales(empreinteDe(ligne.salt, code), ligne.codeHash);

  if (!bon) {
    if (ligne.attempts + 1 >= ESSAIS_MAX_COURRIEL) {
      await db.emailCode.updateMany({ where: { id: ligne.id, usedAt: null }, data: { usedAt: maintenant } });
      return { ok: false, motif: "TROP_D_ESSAIS" };
    }
    return { ok: false, motif: "INVALIDE" };
  }

  // Le bon code, pour un autre compte que celui annoncé : il est brûlé. Celui
  // qui le présente a changé le numéro après l'avoir demandé — ou n'est pas
  // celui qui l'a lu.
  if (!egales(ligne.target, input.cible)) {
    await db.emailCode.updateMany({ where: { id: ligne.id, usedAt: null }, data: { usedAt: maintenant } });
    return { ok: false, motif: "AUTRE_COMPTE" };
  }

  const consomme = await db.emailCode.updateMany({
    where: { id: ligne.id, usedAt: null },
    data: { usedAt: maintenant },
  });
  return consomme.count === 1 ? { ok: true } : { ok: false, motif: "INVALIDE" };
}

/** Le ménage du passage de sécurité. */
export async function purgerCodesCourriel(maintenant = new Date()): Promise<number> {
  const { count } = await db.emailCode.deleteMany({
    where: { createdAt: { lt: new Date(maintenant.getTime() - CONSERVATION_MS) } },
  });
  return count;
}
