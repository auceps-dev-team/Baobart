import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { db } from "@/lib/db";
import {
  ChiffrementIndisponibleError,
  chiffrementDisponible,
  chiffrerSecret,
  codeValide,
  deBase32,
  dechiffrerSecret,
  empreinteCodeSecours,
  enBase32,
  nouveauSecret,
  nouveauxCodesSecours,
  secretLisible,
  uriOtpauth,
} from "@/lib/auth/totp";
import { journal } from "@/lib/observabilite/journal";

/**
 * Double authentification — l'activation, le défi, la levée.
 *
 * `lib/auth/totp.ts` calcule ; ce module décide et écrit.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'ACTIVATION SE FAIT EN DEUX TEMPS, ET C'EST TOUT L'ENJEU
 *
 * Poser le secret et activer d'un seul geste fermerait le compte de qui a mal
 * recopié la clé : le compte exigerait des codes que l'application ne sait pas
 * produire, et personne ne pourrait plus entrer.
 *
 * D'où `commencerActivation` qui pose le secret sans activer, puis
 * `confirmerActivation` qui exige un code valable — la preuve que
 * l'application a bien enregistré la même chose que nous.
 *
 * `totpSecret` non nul ne veut donc PAS dire « protégé ». Seul `totpActiveLe`
 * le dit, et c'est la seule colonne que le reste du code doit lire.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE DÉFI VIT DANS SA PROPRE TABLE, PAS DANS UNE SESSION MARQUÉE
 *
 * Voir le commentaire de `TotpChallenge` dans le schéma : une session « en
 * attente » répondrait oui à tout le code qui demande « y a-t-il une
 * session ? », et le premier appel qui oublie de vérifier le drapeau ouvre le
 * compte sans second facteur, sans que rien ne plante.
 *
 * Tant que le défi n'est pas relevé, il n'existe aucune session du tout.
 */

/** Cinq minutes pour saisir six chiffres. Au-delà, on repasse par le mot de passe. */
const DUREE_DEFI_MS = 5 * 60 * 1000;

/**
 * Combien de codes faux avant d'abandonner le défi.
 *
 * Six chiffres font un million de possibilités, et la fenêtre de tolérance en
 * vaut trois : une chance sur trois cent mille par essai. Cinq essais par défi,
 * et un défi qui dure cinq minutes, rendent la recherche sans intérêt — sans
 * punir qui se trompe deux fois en recopiant.
 */
const ESSAIS_MAX = 5;

/**
 * Combien de temps un passage 2FA couvre les actions sensibles.
 *
 * Quinze minutes. Assez pour enchaîner un réglage de versement et une
 * confirmation ; trop court pour qu'un ordinateur laissé ouvert dans un
 * cybercafé serve une heure plus tard.
 */
export const FRAICHEUR_SENSIBLE_MS = 15 * 60 * 1000;

/** Le nom du cookie qui porte le défi en cours. */
export const COOKIE_DEFI = "baobart_2fa";

function empreinte(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

// ──────────────────────────────────────────────────────── activation ──

export interface DebutActivation {
  /** À recopier dans l'application, en groupes de quatre. */
  secretLisible: string;
  /** À ouvrir depuis un téléphone : l'application se configure seule. */
  uri: string;
}

/**
 * Pose un secret neuf, sans activer.
 *
 * Rejouable : recommencer avant d'avoir confirmé écrase le secret précédent.
 * C'est ce qu'on veut — quelqu'un qui a fermé l'onglet doit pouvoir repartir
 * de zéro, et un secret jamais confirmé ne protège rien.
 *
 * Refuse si la 2FA est **déjà active** : changer de secret sans repasser par
 * la désactivation permettrait à qui a volé une session de substituer sa
 * propre application.
 */
export async function commencerActivation(
  userId: string,
  courriel: string,
): Promise<DebutActivation> {
  if (!chiffrementDisponible()) throw new ChiffrementIndisponibleError();

  const compte = await db.user.findUnique({
    where: { id: userId },
    select: { totpActiveLe: true },
  });

  if (compte?.totpActiveLe) {
    throw new Error("La double authentification est déjà active sur ce compte.");
  }

  const secret = nouveauSecret();
  const base32 = enBase32(secret);

  await db.user.update({
    where: { id: userId },
    data: { totpSecret: chiffrerSecret(secret) },
  });

  return {
    secretLisible: secretLisible(base32),
    uri: uriOtpauth(base32, courriel),
  };
}

export type SuiteActivation =
  | { ok: true; codesSecours: string[] }
  | { ok: false; motif: "PAS_DE_SECRET" | "CODE_FAUX" | "DEJA_ACTIVE" };

/**
 * Confirme l'activation contre un code, et rend les codes de secours.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LES CODES DE SECOURS SONT RENDUS ICI, ET NULLE PART AILLEURS
 *
 * Ils sont stockés hachés : personne — pas même un administrateur — ne peut
 * les relire. C'est le seul instant où ils existent en clair, et l'écran doit
 * le dire franchement.
 *
 * Tout tient dans une transaction : un compte activé sans codes de secours
 * serait un compte qu'un téléphone perdu ferme définitivement.
 */
export async function confirmerActivation(
  userId: string,
  code: string,
): Promise<SuiteActivation> {
  const compte = await db.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpActiveLe: true },
  });

  if (compte?.totpActiveLe) return { ok: false, motif: "DEJA_ACTIVE" };
  if (!compte?.totpSecret) return { ok: false, motif: "PAS_DE_SECRET" };

  if (!codeValide(dechiffrerSecret(compte.totpSecret), code)) {
    return { ok: false, motif: "CODE_FAUX" };
  }

  const codes = nouveauxCodesSecours();

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { totpActiveLe: new Date() },
    });

    // Au cas où un lot précédent traînerait : on ne cumule pas deux jeux de
    // codes, sans quoi d'anciens papiers resteraient valables.
    await tx.totpRecoveryCode.deleteMany({ where: { userId } });

    await tx.totpRecoveryCode.createMany({
      data: codes.map((c) => ({ userId, codeHash: empreinteCodeSecours(c) })),
    });
  });

  journal.info("double authentification activée", { userId });

  return { ok: true, codesSecours: codes };
}

/**
 * Coupe la double authentification.
 *
 * Exige un code valable ou un code de secours : sans cela, qui a volé une
 * session la désactiverait d'un clic, et la protection ne vaudrait que contre
 * quelqu'un qui n'y a pas pensé.
 */
export async function desactiver(
  userId: string,
  code: string,
): Promise<boolean> {
  const accepte = await verifierCodeOuSecours(userId, code);
  if (!accepte) return false;

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { totpSecret: null, totpActiveLe: null },
    });
    await tx.totpRecoveryCode.deleteMany({ where: { userId } });
    await tx.totpChallenge.deleteMany({ where: { userId } });
    // Les sessions gardent leur `totpValideLe` : il ne sert plus à rien, et
    // l'effacer déconnecterait quelqu'un qui vient de prouver qui il est.
  });

  journal.info("double authentification désactivée", { userId });

  return true;
}

/** Remet un lot de codes de secours, en invalidant l'ancien. */
export async function regenererCodesSecours(
  userId: string,
): Promise<string[]> {
  const codes = nouveauxCodesSecours();

  await db.$transaction(async (tx) => {
    await tx.totpRecoveryCode.deleteMany({ where: { userId } });
    await tx.totpRecoveryCode.createMany({
      data: codes.map((c) => ({ userId, codeHash: empreinteCodeSecours(c) })),
    });
  });

  return codes;
}

// ────────────────────────────────────────────────────────────── défi ──

/**
 * Ouvre un défi et rend le jeton à poser en cookie.
 *
 * Le jeton est rendu en clair et stocké haché — même règle que les sessions et
 * les réinitialisations : une fuite de la base ne doit pas permettre de
 * reprendre un défi en cours.
 */
export async function ouvrirDefi(userId: string): Promise<string> {
  const jeton = randomBytes(32).toString("base64url");

  // Un seul défi à la fois : deux onglets de connexion ne doivent pas laisser
  // traîner un défi utilisable quand on a abandonné l'autre.
  await db.totpChallenge.deleteMany({ where: { userId } });

  await db.totpChallenge.create({
    data: {
      userId,
      token: empreinte(jeton),
      expiresAt: new Date(Date.now() + DUREE_DEFI_MS),
    },
  });

  return jeton;
}

export type SuiteDefi =
  | { ok: true; userId: string }
  | { ok: false; motif: "DEFI_INCONNU" | "DEFI_EXPIRE" | "TROP_D_ESSAIS" | "CODE_FAUX" };

/**
 * Relève un défi.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LE DÉFI EST CONSOMMÉ DÈS QU'IL RÉUSSIT
 *
 * Sinon le même jeton rouvrirait une session autant de fois qu'on veut pendant
 * cinq minutes — y compris depuis une autre machine, si le cookie a fuité.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * L'EXPIRATION SE LIT, ELLE NE SE BALAIE PAS
 *
 * Même règle que la liste de blocage : un défi périmé est refusé à la lecture,
 * qu'un ménage soit passé ou non.
 */
export async function releverDefi(
  jeton: string,
  code: string,
): Promise<SuiteDefi> {
  const defi = await db.totpChallenge.findUnique({
    where: { token: empreinte(jeton) },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      attempts: true,
      user: { select: { totpSecret: true, totpActiveLe: true } },
    },
  });

  if (!defi) return { ok: false, motif: "DEFI_INCONNU" };

  if (defi.expiresAt.getTime() <= Date.now()) {
    await db.totpChallenge.delete({ where: { id: defi.id } });
    return { ok: false, motif: "DEFI_EXPIRE" };
  }

  if (defi.attempts >= ESSAIS_MAX) {
    return { ok: false, motif: "TROP_D_ESSAIS" };
  }

  if (!defi.user.totpActiveLe || !defi.user.totpSecret) {
    // La 2FA a été coupée pendant le défi. On refuse plutôt que d'ouvrir : le
    // mot de passe seul a déjà été donné il y a cinq minutes, et l'on ne sait
    // pas qui a coupé.
    await db.totpChallenge.delete({ where: { id: defi.id } });
    return { ok: false, motif: "DEFI_INCONNU" };
  }

  const bon =
    codeValide(dechiffrerSecret(defi.user.totpSecret), code) ||
    (await consommerCodeSecours(defi.userId, code));

  if (!bon) {
    // `increment` et non une lecture suivie d'une écriture : deux tentatives
    // simultanées compteraient pour une seule.
    await db.totpChallenge.update({
      where: { id: defi.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, motif: "CODE_FAUX" };
  }

  await db.totpChallenge.delete({ where: { id: defi.id } });

  return { ok: true, userId: defi.userId };
}

/** Les défis périmés, pour le ménage de nuit. */
export async function purgerDefisExpires(): Promise<number> {
  const { count } = await db.totpChallenge.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  return count;
}

// ───────────────────────────────────────────────────────── lectures ──

/**
 * Consomme un code de secours, s'il en existe un qui corresponde.
 *
 * `updateMany` avec `usedAt: null` dans le `WHERE` : c'est ce qui rend l'usage
 * unique même si deux requêtes arrivent ensemble. Lire puis écrire laisserait
 * les deux réussir.
 */
async function consommerCodeSecours(
  userId: string,
  code: string,
): Promise<boolean> {
  if (!/^[A-Za-z2-7\s-]{8,12}$/.test(code)) return false;

  const { count } = await db.totpRecoveryCode.updateMany({
    where: { userId, codeHash: empreinteCodeSecours(code), usedAt: null },
    data: { usedAt: new Date() },
  });

  if (count > 0) {
    journal.info("code de secours consommé", { userId });
  }

  return count > 0;
}

/** Un code TOTP ou un code de secours valable ? */
export async function verifierCodeOuSecours(
  userId: string,
  code: string,
): Promise<boolean> {
  const compte = await db.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true, totpActiveLe: true },
  });

  if (!compte?.totpActiveLe || !compte.totpSecret) return false;

  if (codeValide(dechiffrerSecret(compte.totpSecret), code)) return true;

  return consommerCodeSecours(userId, code);
}

export interface EtatDeuxFacteurs {
  active: boolean;
  /** Un secret posé mais jamais confirmé : l'activation est à finir. */
  enAttente: boolean;
  codesSecoursRestants: number;
  /** Faux quand `TOTP_ENCRYPTION_KEY` manque : on ne peut rien activer. */
  disponible: boolean;
}

export async function etatDeuxFacteurs(
  userId: string,
): Promise<EtatDeuxFacteurs> {
  const [compte, restants] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { totpSecret: true, totpActiveLe: true },
    }),
    db.totpRecoveryCode.count({ where: { userId, usedAt: null } }),
  ]);

  return {
    active: Boolean(compte?.totpActiveLe),
    enAttente: Boolean(compte?.totpSecret && !compte.totpActiveLe),
    codesSecoursRestants: restants,
    disponible: chiffrementDisponible(),
  };
}

/**
 * Cette session a-t-elle franchi la 2FA assez récemment ?
 *
 * ────────────────────────────────────────────────────────────────────────────
 * RÉPOND « OUI » QUAND LA 2FA N'EST PAS ACTIVE, ET C'EST DÉLIBÉRÉ
 *
 * La garde exige un second facteur **récent** de qui en a un. Elle n'impose pas
 * d'en avoir un : ce serait fermer les versements à tout le monde du jour où
 * elle est posée.
 *
 * La spécification dit « un accès social ne contourne jamais la 2FA pour les
 * actions sensibles » — elle parle de qui a une 2FA. Rendre la 2FA
 * obligatoire pour vendre est une décision de produit, pas une garde
 * technique, et elle ne se prend pas dans cette fonction.
 */
export async function deuxFacteursRecent(
  sessionId: string,
  maintenant = Date.now(),
): Promise<boolean> {
  const session = await db.session.findUnique({
    where: { id: sessionId },
    select: {
      totpValideLe: true,
      user: { select: { totpActiveLe: true } },
    },
  });

  if (!session) return false;
  if (!session.user.totpActiveLe) return true;
  if (!session.totpValideLe) return false;

  return maintenant - session.totpValideLe.getTime() <= FRAICHEUR_SENSIBLE_MS;
}

/** Note qu'une session vient de franchir la 2FA. */
export async function noterPassage(sessionId: string): Promise<void> {
  await db.session.update({
    where: { id: sessionId },
    data: { totpValideLe: new Date() },
  });
}

/** Le secret n'est jamais rendu ; seul l'appelant qui l'a créé le voit. */
export function verifierFormatCode(code: string): boolean {
  const propre = code.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(propre) || /^[A-Za-z2-7]{8}$/.test(propre);
}

/** Réexporté pour que les tests n'aient pas à connaître deux modules. */
export { deBase32 };
