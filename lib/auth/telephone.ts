import "server-only";

import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { Prisma, type PhoneCodePurpose } from "@prisma/client";

import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";
import { masquer } from "@/lib/sms/numero";
import { envoyerSms, piloteSms } from "@/lib/sms/pilotes";

/**
 * Les codes envoyés par SMS : se connecter par téléphone, prouver un numéro.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI LE TÉLÉPHONE, ET POURQUOI SEULEMENT UN NUMÉRO PROUVÉ
 *
 * `SPEC_AUTH_INTEGRATIONS` en fait le mode principal en Afrique de l'Ouest :
 * beaucoup de gens n'ont pas de compte Google « propre », tous ont un numéro.
 *
 * Mais un numéro n'ouvre un compte que s'il a été **prouvé** par un code, une
 * fois, depuis ce compte (`User.phoneVerifiedAt`). Sans cette preuve, un
 * numéro tapé par erreur — ou exprès — dans le profil de quelqu'un donnerait
 * au vrai titulaire de la ligne les clés d'un compte qui n'est pas le sien.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUI BORNE UNE ATTAQUE
 *
 * Six chiffres, c'est un million de possibilités : trop peu pour résister à un
 * essai illimité, assez pour cinq essais. D'où, empilés :
 *
 *   — **cinq essais par code**, réservés AVANT la comparaison et dans le
 *     `WHERE` : cent requêtes parallèles sur le même code n'obtiennent que
 *     cinq comparaisons, pas cent ;
 *   — **dix minutes** de validité, et un seul code vivant par numéro et par
 *     but — le suivant périme le précédent ;
 *   — **une minute** entre deux envois au même numéro, et les quotas par
 *     adresse et par numéro des actions (`lib/securite/limites.ts`) : sans
 *     eux, le formulaire servirait à arroser de SMS un numéro tiers, à nos
 *     frais ;
 *   — l'**empreinte** seule en base, comparée en temps constant.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUE CE MODULE NE FAIT PAS
 *
 *   — il n'ouvre pas de session et ne juge pas la 2FA : c'est l'action de
 *     connexion qui le fait, avec les mêmes règles que le mot de passe ;
 *   — il ne crée pas de compte : le schéma exige une adresse. On se connecte
 *     par téléphone à un compte qui existe déjà et dont le numéro est prouvé.
 */

/** Dix minutes : le temps de recevoir un SMS lent, pas celui de l'oublier. */
export const DUREE_CODE_MS = 10 * 60_000;

/** Cinq codes faux, et celui-ci est brûlé. */
export const ESSAIS_MAX = 5;

/** Entre deux envois au même numéro, pour le même but. */
export const ATTENTE_RENVOI_MS = 60_000;

/** Une journée : au-delà, une ligne de code ne sert plus même à enquêter. */
const CONSERVATION_MS = 24 * 60 * 60_000;

export function genererCode(): string {
  // `randomInt` et non `Math.random` : ce code vaut un mot de passe.
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function empreinteDe(sel: string, code: string): string {
  return createHash("sha256").update(`${sel}:${code}`, "utf8").digest("hex");
}

function egales(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** « 482 913 », « 482-913 » : on garde les chiffres, et il en faut six. */
export function lireCode(saisie: string): string | null {
  const chiffres = saisie.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(chiffres) ? chiffres : null;
}

/**
 * Peut-on émettre un code par SMS ici ?
 *
 * Non sans opérateur, évidemment. Et non par le pilote `console` en
 * production : il écrit le texte du SMS dans le journal, donc le code — et
 * quiconque lit les journaux entrerait dans le compte. En développement, c'est
 * précisément ce qu'on veut : lire le code dans le terminal.
 */
export function codesParSmsPossibles(env: NodeJS.ProcessEnv = process.env): boolean {
  const pilote = piloteSms();
  if (pilote.nom === "aucun") return false;
  if (pilote.nom === "console" && env.NODE_ENV === "production") return false;
  return true;
}

export function texteDuCode(code: string, but: PhoneCodePurpose): string {
  // Court et en GSM-7 après repli (`envoyerSms` retire les accents) : un seul
  // segment facturé. Le rappel « ne le donne à personne » vise l'escroquerie
  // la plus courante, celle du faux support qui demande le code au téléphone.
  return but === "LOGIN"
    ? `Baobart : ton code de connexion est ${code}. Il expire dans 10 minutes. Ne le donne à personne, même à l'équipe Baobart.`
    : `Baobart : ton code pour vérifier ce numéro est ${code}. Il expire dans 10 minutes.`;
}

export type Emission =
  | { ok: true }
  | { ok: false; motif: "INDISPONIBLE" | "TROP_TOT" | "ENVOI_ECHOUE" };

/**
 * Fabrique un code, le range, et l'envoie.
 *
 * Le numéro est attendu en E.164 : l'appelant l'a mis en forme, et c'est sous
 * cette forme qu'il est cherché ensuite.
 */
export async function emettreCode(input: {
  userId: string;
  telephone: string;
  but: PhoneCodePurpose;
  maintenant?: Date;
}): Promise<Emission> {
  if (!codesParSmsPossibles()) return { ok: false, motif: "INDISPONIBLE" };

  const maintenant = input.maintenant ?? new Date();

  const dernier = await db.phoneCode.findFirst({
    where: { phone: input.telephone, purpose: input.but },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (dernier && maintenant.getTime() - dernier.createdAt.getTime() < ATTENTE_RENVOI_MS) {
    return { ok: false, motif: "TROP_TOT" };
  }

  const code = genererCode();
  const sel = randomBytes(16).toString("hex");

  const ligne = await db.$transaction(async (tx) => {
    // Un seul code vivant par numéro et par but : le précédent ne doit pas
    // rester valable dans une boîte de SMS qu'on a cessé de surveiller.
    await tx.phoneCode.updateMany({
      where: { phone: input.telephone, purpose: input.but, usedAt: null },
      data: { usedAt: maintenant },
    });
    return tx.phoneCode.create({
      data: {
        phone: input.telephone,
        purpose: input.but,
        userId: input.userId,
        codeHash: empreinteDe(sel, code),
        salt: sel,
        expiresAt: new Date(maintenant.getTime() + DUREE_CODE_MS),
        createdAt: maintenant,
      },
      select: { id: true },
    });
  });

  const verdict = await envoyerSms({
    numero: input.telephone,
    // Le numéro est déjà en E.164 : le pays ne sert pas, mais `envoyerSms` le
    // veut pour les numéros locaux.
    pays: "CI",
    texte: texteDuCode(code, input.but),
    // Un code arrivé après son expiration ne sert à rien : la passerelle qui
    // sait garder une file (`smsgate`) le jette au lieu de l'envoyer en retard.
    validiteS: DUREE_CODE_MS / 1000,
  });

  if (!verdict.ok) {
    // Un code qu'on n'a pas pu envoyer ne doit pas rester valable : personne
    // ne le connaît, sauf le journal d'un pilote de développement.
    await db.phoneCode.update({ where: { id: ligne.id }, data: { usedAt: maintenant } });
    journal.erreur("code SMS non envoyé", {
      vers: masquer(input.telephone),
      but: input.but,
      motif: verdict.motif,
    });
    return { ok: false, motif: "ENVOI_ECHOUE" };
  }

  return { ok: true };
}

export type Verification =
  | { ok: true; userId: string }
  | { ok: false; motif: "INVALIDE" | "EXPIRE" | "TROP_D_ESSAIS" };

/**
 * Le code présenté est-il le bon ?
 *
 * `userId` restreint la recherche au compte attendu — pour la vérification
 * d'un numéro depuis une session, où le code doit appartenir à CE compte.
 */
export async function verifierCode(input: {
  telephone: string;
  but: PhoneCodePurpose;
  saisie: string;
  userId?: string;
  maintenant?: Date;
}): Promise<Verification> {
  const maintenant = input.maintenant ?? new Date();

  const ligne = await db.phoneCode.findFirst({
    where: {
      phone: input.telephone,
      purpose: input.but,
      usedAt: null,
      ...(input.userId ? { userId: input.userId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, userId: true, codeHash: true, salt: true, expiresAt: true, attempts: true },
  });

  if (!ligne) return { ok: false, motif: "INVALIDE" };

  if (ligne.expiresAt.getTime() <= maintenant.getTime()) {
    await db.phoneCode.update({ where: { id: ligne.id }, data: { usedAt: maintenant } });
    return { ok: false, motif: "EXPIRE" };
  }

  // ── L'essai est réservé AVANT d'être jugé ─────────────────────────────────
  //
  // Comparer d'abord puis compter laisserait cent requêtes parallèles lire
  // `attempts = 0` et comparer chacune : cent essais sur un code qui n'en
  // permet que cinq. Réserver dans le `WHERE` rend le décompte atomique.
  const reserve = await db.phoneCode.updateMany({
    where: { id: ligne.id, usedAt: null, attempts: { lt: ESSAIS_MAX } },
    data: { attempts: { increment: 1 } },
  });
  if (reserve.count === 0) {
    await db.phoneCode.updateMany({
      where: { id: ligne.id, usedAt: null },
      data: { usedAt: maintenant },
    });
    return { ok: false, motif: "TROP_D_ESSAIS" };
  }

  const code = lireCode(input.saisie);
  const bon = code !== null && egales(empreinteDe(ligne.salt, code), ligne.codeHash);

  if (!bon) {
    if (ligne.attempts + 1 >= ESSAIS_MAX) {
      await db.phoneCode.updateMany({
        where: { id: ligne.id, usedAt: null },
        data: { usedAt: maintenant },
      });
      return { ok: false, motif: "TROP_D_ESSAIS" };
    }
    return { ok: false, motif: "INVALIDE" };
  }

  // Consommé dans le `WHERE` : deux envois du même bon code ne valent qu'une
  // connexion.
  const consomme = await db.phoneCode.updateMany({
    where: { id: ligne.id, usedAt: null },
    data: { usedAt: maintenant },
  });
  if (consomme.count !== 1) return { ok: false, motif: "INVALIDE" };

  return { ok: true, userId: ligne.userId };
}

/** Le compte auquel ce numéro, PROUVÉ, ouvre la porte. */
export async function compteDuTelephone(telephone: string) {
  return db.user.findFirst({
    where: { phone: telephone, phoneVerifiedAt: { not: null } },
    select: {
      id: true,
      suspendedAt: true,
      totpActiveLe: true,
      _count: { select: { passkeys: true } },
    },
  });
}

export type Rattachement = { ok: true } | { ok: false; motif: "DEJA_PRIS" };

/**
 * Rattache un numéro, que le compte vient de prouver, à ce compte.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA PREUVE L'EMPORTE SUR UNE SIMPLE SAISIE
 *
 * Un autre compte qui porte ce numéro SANS l'avoir prouvé (une donnée
 * ancienne, une saisie d'administration) le perd au profit de celui qui vient
 * de recevoir le code : c'est lui le titulaire de la ligne. Un autre compte qui
 * l'a prouvé le garde — deux comptes ne peuvent pas partager une porte.
 */
export async function rattacherTelephone(
  userId: string,
  telephone: string,
  maintenant = new Date(),
): Promise<Rattachement> {
  try {
    return await db.$transaction(async (tx) => {
      const porteur = await tx.user.findUnique({
        where: { phone: telephone },
        select: { id: true, phoneVerifiedAt: true },
      });

      if (porteur && porteur.id !== userId) {
        if (porteur.phoneVerifiedAt) return { ok: false, motif: "DEJA_PRIS" } as const;
        await tx.user.update({
          where: { id: porteur.id },
          data: { phone: null, phoneVerifiedAt: null },
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: { phone: telephone, phoneVerifiedAt: maintenant },
      });
      return { ok: true } as const;
    });
  } catch (cause) {
    // Deux comptes qui prouvent le même numéro au même instant : la
    // contrainte d'unicité tranche, et le second perd.
    if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002") {
      return { ok: false, motif: "DEJA_PRIS" };
    }
    throw cause;
  }
}

/** Le numéro quitte le compte : il ne sert plus ni aux relances, ni à entrer. */
export async function retirerTelephone(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { phone: null, phoneVerifiedAt: null },
  });
  // Un code en cours pour ce compte ne doit pas survivre au retrait.
  await db.phoneCode.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
}

/** Le ménage du passage de sécurité. */
export async function purgerCodesTelephone(maintenant = new Date()): Promise<number> {
  const { count } = await db.phoneCode.deleteMany({
    where: { createdAt: { lt: new Date(maintenant.getTime() - CONSERVATION_MS) } },
  });
  return count;
}
