import "server-only";

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";

import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";

/**
 * WebAuthn — les clés d'accès, en second facteur.
 *
 * Traduit `webauthn_credential.rb` (antiwork/gumroad, MIT, lu comme
 * spécification), §3.6-A du plan de refonte.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI UNE DÉPENDANCE ICI, ALORS QUE TOTP N'EN A PAS
 *
 * `lib/auth/totp.ts` est écrit à la main, et le commentaire y explique
 * pourquoi : TOTP n'invente aucune primitive, et la RFC 6238 publie ses
 * vecteurs de test — la correction s'y prouve.
 *
 * WebAuthn n'offre ni l'un ni l'autre. Vérifier une réponse demande de lire du
 * CBOR, de décoder une clé publique COSE, de valider une chaîne d'attestation
 * et de comparer des empreintes de données client. Il n'existe pas de vecteurs
 * publiés à rejouer : la correction reposerait sur notre seule lecture de la
 * spécification, dans du code qui décide qui entre.
 *
 * `@simplewebauthn/server` est la bibliothèque de référence. C'est la douzième
 * dépendance d'exécution du projet, et elle est assumée.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * SECOND FACTEUR, PAS REMPLACEMENT DU MOT DE PASSE
 *
 * La spécification (§L) dit « 2FA indépendante » : une clé d'accès s'ajoute au
 * mot de passe, elle ne s'y substitue pas.
 *
 * Ce n'est pas de la timidité. Une connexion sans mot de passe déplace tout le
 * compte sur un appareil : le perdre, c'est perdre le compte, et le seul
 * recours serait un chemin de récupération par courriel — c'est-à-dire
 * exactement la faiblesse qu'on voulait retirer.
 *
 * Une clé d'accès entre donc là où un code TOTP entrerait : à l'écran de
 * vérification, après le mot de passe. Les deux cohabitent, et qui a les deux
 * choisit à chaque connexion.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE DÉFI VIT EN BASE, PAS DANS UN COOKIE
 *
 * Le défi est ce qui empêche le rejeu : le navigateur signe une valeur que
 * nous avons tirée, et nous vérifions que c'est bien celle-là. Le renvoyer au
 * client pour qu'il nous le représente laisserait l'attaquant choisir la
 * valeur qu'il signe — et la signature ne prouverait plus rien.
 */

/** Deux minutes : le temps de toucher un lecteur ou de déverrouiller un téléphone. */
const DUREE_DEFI_MS = 2 * 60 * 1000;

export const NOM_SITE = "Baobart";

/**
 * L'identifiant de partie de confiance : le **domaine**, sans protocole ni port.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * C'EST LUI QUI LIE UNE CLÉ À UN SITE
 *
 * Le navigateur refuse de présenter une clé enregistrée pour `baobart.com` à
 * un site qui dit s'appeler autrement. C'est ce qui rend l'hameçonnage
 * inopérant — et c'est aussi pourquoi se tromper ici casse tout en silence :
 * les clés déjà enregistrées cessent d'être proposées, sans erreur, avec un
 * navigateur qui dit simplement « aucune clé disponible ».
 *
 * Dérivé d'`APP_URL`, la même variable que les liens de courriel. En
 * développement, `localhost` — le seul domaine que la spécification autorise
 * en clair.
 */
export function identifiantDuSite(): string {
  const brut = process.env.APP_URL;
  if (!brut) return "localhost";

  try {
    return new URL(brut).hostname;
  } catch {
    return "localhost";
  }
}

/**
 * L'origine attendue : protocole, domaine et port.
 *
 * Distincte de l'identifiant : le navigateur envoie l'origine complète, et la
 * comparer telle quelle est ce qui attrape un site qui servirait la même page
 * sur un autre port.
 */
export function origineAttendue(): string {
  const brut = process.env.APP_URL;
  if (!brut) return "http://localhost:3100";

  try {
    return new URL(brut).origin;
  } catch {
    return "http://localhost:3100";
  }
}

type Usage = "enrolement" | "connexion";

async function poserDefi(
  challenge: string,
  usage: Usage,
  userId: string | null,
): Promise<void> {
  // Un seul défi en cours par personne et par usage : deux onglets ouverts ne
  // doivent pas laisser traîner un défi utilisable quand on a abandonné
  // l'autre.
  if (userId) {
    await db.webauthnChallenge.deleteMany({ where: { userId, usage } });
  }

  await db.webauthnChallenge.create({
    data: {
      challenge,
      usage,
      userId,
      expiresAt: new Date(Date.now() + DUREE_DEFI_MS),
    },
  });
}

/**
 * Consomme un défi, s'il est valable pour cet usage.
 *
 * Consommé, pas seulement lu : un défi rejouable permettrait de représenter la
 * même signature autant de fois qu'on veut pendant deux minutes.
 *
 * `usage` est vérifié, sinon un défi d'enrôlement — obtenu par quelqu'un de
 * connecté — servirait à la connexion.
 */
async function consommerDefi(
  challenge: string,
  usage: Usage,
): Promise<{ userId: string | null } | null> {
  const defi = await db.webauthnChallenge.findUnique({
    where: { challenge },
    select: { id: true, userId: true, usage: true, expiresAt: true },
  });

  if (!defi) return null;

  await db.webauthnChallenge.delete({ where: { id: defi.id } });

  if (defi.usage !== usage) return null;
  if (defi.expiresAt.getTime() <= Date.now()) return null;

  return { userId: defi.userId };
}

// ─────────────────────────────────────────────────────── enrôlement ──

/**
 * Les options d'enrôlement, à passer au navigateur.
 *
 * `excludeCredentials` porte les clés déjà enregistrées : sans lui, le même
 * appareil s'enregistrerait deux fois, et la liste du profil montrerait deux
 * lignes pour une seule clé — qu'on ne saurait plus distinguer pour en retirer
 * une.
 */
export async function optionsEnrolement(
  userId: string,
  courriel: string,
  nomAffiche: string,
) {
  const existantes = await db.passkey.findMany({
    where: { userId },
    select: { credentialId: true, transports: true },
  });

  const options = await generateRegistrationOptions({
    rpName: NOM_SITE,
    rpID: identifiantDuSite(),
    userName: courriel,
    userDisplayName: nomAffiche,
    // La clé reste sur l'appareil : c'est ce qui permet de s'en servir sans
    // taper quoi que ce soit, et ce que font les gestionnaires modernes.
    attestationType: "none",
    excludeCredentials: existantes.map((c) => ({
      id: c.credentialId,
      transports: transportsDe(c.transports),
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await poserDefi(options.challenge, "enrolement", userId);

  return options;
}

export type SuiteEnrolement =
  | { ok: true; passkeyId: string }
  | { ok: false; motif: "DEFI_INCONNU" | "REPONSE_REFUSEE" | "DEJA_ENREGISTREE" };

/** Vérifie la réponse du navigateur et enregistre la clé. */
export async function finirEnrolement(
  userId: string,
  reponse: RegistrationResponseJSON,
  libelle: string | null,
): Promise<SuiteEnrolement> {
  const defi = await consommerDefi(
    reponse.response.clientDataJSON
      ? defiDepuisClientData(reponse.response.clientDataJSON)
      : "",
    "enrolement",
  );

  // Le défi doit appartenir à qui se présente : sinon quelqu'un de connecté
  // pourrait rattacher sa clé au compte d'un autre en réutilisant son défi.
  if (!defi || defi.userId !== userId) {
    return { ok: false, motif: "DEFI_INCONNU" };
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: reponse,
      expectedChallenge: defiDepuisClientData(reponse.response.clientDataJSON),
      expectedOrigin: origineAttendue(),
      expectedRPID: identifiantDuSite(),
      requireUserVerification: false,
    });
  } catch (cause) {
    journal.info("enrôlement de clé refusé", {
      userId,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    return { ok: false, motif: "REPONSE_REFUSEE" };
  }

  if (!verification.verified || !verification.registrationInfo) {
    return { ok: false, motif: "REPONSE_REFUSEE" };
  }

  const { credential } = verification.registrationInfo;

  const deja = await db.passkey.findUnique({
    where: { credentialId: credential.id },
    select: { id: true },
  });
  if (deja) return { ok: false, motif: "DEJA_ENREGISTREE" };

  const clef = await db.passkey.create({
    data: {
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports?.join(",") ?? null,
      label: libelle?.trim() || null,
    },
    select: { id: true },
  });

  journal.info("clé d'accès enregistrée", { userId });

  return { ok: true, passkeyId: clef.id };
}

// ───────────────────────────────────────────────────────── connexion ──

/**
 * Les options de connexion pour un compte donné.
 *
 * `allowCredentials` restreint aux clés de cette personne : on sait déjà qui
 * elle est, puisqu'elle vient de donner son mot de passe. Laisser la liste
 * vide ferait proposer n'importe quelle clé du domaine, y compris celle d'un
 * autre compte — qui échouerait ensuite, sans que rien ne dise pourquoi.
 */
export async function optionsConnexion(userId: string) {
  const clefs = await db.passkey.findMany({
    where: { userId },
    select: { credentialId: true, transports: true },
  });

  if (clefs.length === 0) return null;

  const options = await generateAuthenticationOptions({
    rpID: identifiantDuSite(),
    allowCredentials: clefs.map((c) => ({
      id: c.credentialId,
      transports: transportsDe(c.transports),
    })),
    userVerification: "preferred",
  });

  await poserDefi(options.challenge, "connexion", userId);

  return options;
}

export type SuiteConnexion =
  | { ok: true; userId: string }
  | {
      ok: false;
      motif: "DEFI_INCONNU" | "CLE_INCONNUE" | "REPONSE_REFUSEE" | "COMPTEUR_RECULE";
    };

/**
 * Vérifie une réponse d'authentification.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LE COMPTEUR QUI RECULE EST LE SEUL SIGNAL DE CLONAGE
 *
 * L'authentificateur incrémente un compteur à chaque usage. S'il revient en
 * arrière, deux exemplaires de la clé existent — et la spécification dit de
 * refuser.
 *
 * Mais beaucoup d'authentificateurs modernes, dont ceux d'Apple et de Google,
 * le laissent à zéro en permanence : exiger une progression stricte les
 * refuserait tous. On ne refuse donc que la **régression**, jamais l'égalité.
 */
export async function verifierConnexion(
  reponse: AuthenticationResponseJSON,
): Promise<SuiteConnexion> {
  const defi = await consommerDefi(
    defiDepuisClientData(reponse.response.clientDataJSON),
    "connexion",
  );

  if (!defi) return { ok: false, motif: "DEFI_INCONNU" };

  const clef = await db.passkey.findUnique({
    where: { credentialId: reponse.id },
    select: { id: true, userId: true, publicKey: true, counter: true },
  });

  if (!clef) return { ok: false, motif: "CLE_INCONNUE" };

  // La clé présentée doit être celle du compte pour qui le défi a été posé.
  if (defi.userId && defi.userId !== clef.userId) {
    return { ok: false, motif: "CLE_INCONNUE" };
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: reponse,
      expectedChallenge: defiDepuisClientData(reponse.response.clientDataJSON),
      expectedOrigin: origineAttendue(),
      expectedRPID: identifiantDuSite(),
      credential: {
        id: reponse.id,
        publicKey: new Uint8Array(Buffer.from(clef.publicKey, "base64url")),
        counter: clef.counter,
      },
      requireUserVerification: false,
    });
  } catch (cause) {
    journal.info("connexion par clé refusée", {
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    return { ok: false, motif: "REPONSE_REFUSEE" };
  }

  if (!verification.verified) return { ok: false, motif: "REPONSE_REFUSEE" };

  const nouveau = verification.authenticationInfo.newCounter;

  if (nouveau < clef.counter) {
    // Deux exemplaires de la clé existent. On refuse, et on le crie : c'est
    // l'un des rares signaux de compromission que WebAuthn donne.
    journal.erreur("compteur de clé d'accès en recul — clonage possible", {
      userId: clef.userId,
      ancien: clef.counter,
      nouveau,
    });
    return { ok: false, motif: "COMPTEUR_RECULE" };
  }

  await db.passkey.update({
    where: { id: clef.id },
    data: { counter: nouveau, lastUsedAt: new Date() },
  });

  return { ok: true, userId: clef.userId };
}

// ───────────────────────────────────────────────────────── lectures ──

export interface CleAffichee {
  id: string;
  libelle: string;
  ajouteeLe: Date;
  utiliseeLe: Date | null;
}

export async function listerLesCles(userId: string): Promise<CleAffichee[]> {
  const clefs = await db.passkey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, createdAt: true, lastUsedAt: true },
  });

  return clefs.map((c) => ({
    id: c.id,
    libelle: c.label ?? "Clé sans nom",
    ajouteeLe: c.createdAt,
    utiliseeLe: c.lastUsedAt,
  }));
}

/**
 * Retire une clé.
 *
 * `deleteMany` avec le `userId` dans le `WHERE`, et non `delete` par
 * identifiant : sans cela, connaître l'identifiant d'une clé suffirait à
 * retirer celle de quelqu'un d'autre.
 */
export async function retirerUneCle(
  userId: string,
  passkeyId: string,
): Promise<boolean> {
  const { count } = await db.passkey.deleteMany({
    where: { id: passkeyId, userId },
  });

  return count > 0;
}

/** Les défis périmés, pour le ménage de nuit. */
export async function purgerDefisWebauthn(): Promise<number> {
  const { count } = await db.webauthnChallenge.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  return count;
}

// ──────────────────────────────────────────────────────── utilitaires ──

/**
 * Le défi contenu dans les données client signées.
 *
 * Il y est en base64url, tel que nous l'avions émis. On le relit de là plutôt
 * que de le redemander au client : c'est la valeur qui a réellement été
 * signée, et c'est celle-là qu'il faut retrouver en base.
 */
function defiDepuisClientData(clientDataJSON: string): string {
  try {
    const brut = Buffer.from(clientDataJSON, "base64url").toString("utf8");
    const donnees = JSON.parse(brut) as { challenge?: string };
    return donnees.challenge ?? "";
  } catch {
    return "";
  }
}

type Transport = NonNullable<
  Parameters<typeof generateAuthenticationOptions>[0]["allowCredentials"]
>[number]["transports"];

function transportsDe(brut: string | null): Transport {
  if (!brut) return undefined;
  return brut.split(",").filter(Boolean) as Transport;
}
