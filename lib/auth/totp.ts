import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

/**
 * TOTP — RFC 6238, écrit ici plutôt qu'installé.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI PAS UNE BIBLIOTHÈQUE
 *
 * Le projet a onze dépendances d'exécution. En ajouter une pour soixante
 * lignes de HMAC se paie ailleurs : une surface de plus à mettre à jour, une
 * de plus à auditer, une de plus qui peut disparaître.
 *
 * Et surtout, l'argument habituel — « la cryptographie ne s'écrit pas à la
 * main » — ne s'applique pas ici. TOTP n'invente aucune primitive : c'est un
 * HMAC-SHA1 de `node:crypto` sur un compteur de temps, plus une troncature
 * décrite noir sur blanc dans la RFC. Et la RFC **publie ses vecteurs de
 * test** : la correction n'est pas une opinion, elle se prouve.
 *
 * `totp.test.ts` rejoue ces vecteurs. Si un jour ils tombent, c'est ce code
 * qui a tort, pas eux.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * SHA-1, ET C'EST VOULU
 *
 * SHA-1 est cassé pour les signatures ; il ne l'est pas en HMAC, et surtout,
 * c'est ce que lisent Google Authenticator, Authy, 1Password et les autres.
 * Passer à SHA-256 « pour faire mieux » produirait des codes qu'aucune
 * application n'affiche — une amélioration qui casse tout, sans rien gagner
 * sur une clé de 160 bits qui vit trente secondes.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE SECRET EST CHIFFRÉ EN BASE, ET SANS CLÉ ON REFUSE
 *
 * Un secret TOTP est un secret **partagé** : qui l'a peut fabriquer les codes.
 * Une fuite de la base seule — un export oublié, une sauvegarde mal rangée —
 * suffirait donc à contourner la double authentification de tout le monde.
 *
 * D'où le chiffrement AES-256-GCM avec une clé d'environnement.
 *
 * Et d'où le refus quand la clé manque : `activerTotp` échoue franchement au
 * lieu d'écrire en clair. Un repli silencieux serait la pire des trois
 * options — la fonctionnalité aurait l'air en place, l'écran dirait « activé »,
 * et la protection annoncée n'existerait pas.
 */

// ─────────────────────────────────────────────────────────────── base32 ──

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Base32 RFC 4648, sans remplissage.
 *
 * C'est l'encodage qu'attendent les applications d'authentification, et le
 * seul qu'un humain puisse recopier sans se tromper — pas de casse à
 * distinguer, pas de `0`/`O` ni de `1`/`l`.
 */
export function enBase32(octets: Buffer): string {
  let bits = 0;
  let valeur = 0;
  let sortie = "";

  for (const octet of octets) {
    valeur = (valeur << 8) | octet;
    bits += 8;

    while (bits >= 5) {
      sortie += ALPHABET[(valeur >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) sortie += ALPHABET[(valeur << (5 - bits)) & 31];

  return sortie;
}

/** L'inverse. Tolère les espaces et les minuscules : on recopie à la main. */
export function deBase32(texte: string): Buffer {
  const propre = texte.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let valeur = 0;
  const octets: number[] = [];

  for (const caractere of propre) {
    const index = ALPHABET.indexOf(caractere);
    if (index === -1) throw new Error(`Caractère base32 invalide : ${caractere}`);

    valeur = (valeur << 5) | index;
    bits += 5;

    if (bits >= 8) {
      octets.push((valeur >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(octets);
}

// ────────────────────────────────────────────────────────────────── totp ──

/** Trente secondes : la valeur que toutes les applications supposent. */
export const PAS_SECONDES = 30;

/** Six chiffres, idem. */
export const CHIFFRES = 6;

/**
 * La tolérance, en pas de temps.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UN PAS EN ARRIÈRE, UN EN AVANT
 *
 * L'horloge du téléphone n'est pas la nôtre, et lire six chiffres puis les
 * taper prend quelques secondes — assez pour franchir une frontière de pas.
 * Sans tolérance, une personne sur dix échoue sans rien comprendre et
 * réessaie, ce qui ne change rien.
 *
 * Deux pas ou plus élargiraient la fenêtre à plus de deux minutes, et un code
 * lu par-dessus l'épaule resterait valable tout ce temps. Un pas de chaque
 * côté est le compromis que recommande la RFC.
 */
export const TOLERANCE_PAS = 1;

/** Le code attendu à un instant donné. */
export function codeA(secret: Buffer, instantMs: number): string {
  const compteur = Math.floor(instantMs / 1000 / PAS_SECONDES);

  const tampon = Buffer.alloc(8);
  // Un compteur de temps tient largement dans 32 bits signés jusqu'en 2038 ;
  // on écrit quand même les 64 bits, parce que la RFC les demande et qu'un
  // raccourci ici se paierait en codes faux ce jour-là.
  tampon.writeUInt32BE(Math.floor(compteur / 2 ** 32), 0);
  tampon.writeUInt32BE(compteur >>> 0, 4);

  const empreinte = createHmac("sha1", secret).update(tampon).digest();

  // Troncature dynamique, RFC 4226 §5.3 : les quatre bits de poids faible du
  // dernier octet désignent où lire.
  const decalage = empreinte[empreinte.length - 1]! & 0x0f;
  const binaire =
    ((empreinte[decalage]! & 0x7f) << 24) |
    (empreinte[decalage + 1]! << 16) |
    (empreinte[decalage + 2]! << 8) |
    empreinte[decalage + 3]!;

  return String(binaire % 10 ** CHIFFRES).padStart(CHIFFRES, "0");
}

/**
 * Ce code est-il valable maintenant ?
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA COMPARAISON EST À DURÉE CONSTANTE
 *
 * Six chiffres, c'est un million de possibilités — assez peu pour qu'une fuite
 * de temps de comparaison compte, si l'on peut essayer vite. La limitation de
 * débit s'en charge par ailleurs, mais les deux ne se remplacent pas.
 */
export function codeValide(
  secret: Buffer,
  code: string,
  instantMs = Date.now(),
): boolean {
  const propose = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(propose)) return false;

  for (let pas = -TOLERANCE_PAS; pas <= TOLERANCE_PAS; pas += 1) {
    const attendu = codeA(secret, instantMs + pas * PAS_SECONDES * 1000);

    if (
      timingSafeEqual(Buffer.from(attendu, "utf8"), Buffer.from(propose, "utf8"))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * L'URI que lit une application d'authentification.
 *
 * `issuer` apparaît deux fois — dans le chemin et en paramètre — et ce n'est
 * pas une maladresse : les applications anciennes lisent le chemin, les
 * récentes le paramètre, et celles qui lisent les deux vérifient qu'ils
 * concordent.
 */
export function uriOtpauth(secretBase32: string, compte: string): string {
  const editeur = "Baobart";
  const etiquette = encodeURIComponent(`${editeur}:${compte}`);

  const parametres = new URLSearchParams({
    secret: secretBase32,
    issuer: editeur,
    algorithm: "SHA1",
    digits: String(CHIFFRES),
    period: String(PAS_SECONDES),
  });

  return `otpauth://totp/${etiquette}?${parametres.toString()}`;
}

/** Un secret neuf. Vingt octets — la taille que recommande la RFC 4226. */
export function nouveauSecret(): Buffer {
  return randomBytes(20);
}

/** Le secret, découpé en groupes de quatre pour être recopié à la main. */
export function secretLisible(secretBase32: string): string {
  return secretBase32.replace(/(.{4})/g, "$1 ").trim();
}

// ────────────────────────────────────────────────────── chiffrement ──

/**
 * La clé de chiffrement des secrets, dérivée de l'environnement.
 *
 * `scrypt` et non la valeur brute : la variable contient une phrase choisie
 * par un humain, pas trente-deux octets aléatoires. L'employer telle quelle
 * comme clé AES donnerait une clé de la force de la phrase.
 *
 * Le sel est fixe et public. C'est acceptable ici — il n'y a qu'une clé, elle
 * ne se devine pas par comparaison avec d'autres, et un sel variable
 * obligerait à le stocker à côté sans rien protéger de plus.
 */
function cleDeChiffrement(): Buffer | null {
  const phrase = process.env.TOTP_ENCRYPTION_KEY;
  if (!phrase || phrase.length < 16) return null;

  return scryptSync(phrase, "baobart:totp:v1", 32);
}

/** La double authentification peut-elle être proposée ? */
export function chiffrementDisponible(): boolean {
  return cleDeChiffrement() !== null;
}

/**
 * Levée quand la clé manque.
 *
 * Une classe d'erreur et non un `null` : l'appelant doit distinguer « cette
 * personne n'a pas de 2FA » de « la plateforme ne sait pas en stocker ». Les
 * deux rendraient `null`, et seul le second est une panne de configuration
 * qu'il faut crier.
 */
export class ChiffrementIndisponibleError extends Error {
  constructor() {
    super(
      "TOTP_ENCRYPTION_KEY absente ou trop courte : la double authentification " +
        "ne peut pas être activée. Poser une phrase d'au moins seize caractères.",
    );
    this.name = "ChiffrementIndisponibleError";
  }
}

/**
 * Chiffre un secret pour la base.
 *
 * AES-256-GCM : le mode donne l'authentification en plus de la confidentialité.
 * Sans elle, un secret modifié en base serait déchiffré en n'importe quoi, et
 * la double authentification refuserait tous les codes sans qu'on sache
 * pourquoi.
 *
 * Format : `nonce:tag:chiffré`, en hexadécimal. Lisible dans un dump, ce qui
 * évite de se demander si la colonne est chiffrée ou non.
 */
export function chiffrerSecret(secret: Buffer): string {
  const cle = cleDeChiffrement();
  if (!cle) throw new ChiffrementIndisponibleError();

  const nonce = randomBytes(12);
  const chiffreur = createCipheriv("aes-256-gcm", cle, nonce);
  const chiffre = Buffer.concat([chiffreur.update(secret), chiffreur.final()]);

  return [
    nonce.toString("hex"),
    chiffreur.getAuthTag().toString("hex"),
    chiffre.toString("hex"),
  ].join(":");
}

/** L'inverse. Lève si la clé manque ou si le contenu a été touché. */
export function dechiffrerSecret(stocke: string): Buffer {
  const cle = cleDeChiffrement();
  if (!cle) throw new ChiffrementIndisponibleError();

  const [nonceHex, tagHex, chiffreHex] = stocke.split(":");
  if (!nonceHex || !tagHex || !chiffreHex) {
    throw new Error("Secret TOTP illisible : format inattendu.");
  }

  const dechiffreur = createDecipheriv(
    "aes-256-gcm",
    cle,
    Buffer.from(nonceHex, "hex"),
  );
  dechiffreur.setAuthTag(Buffer.from(tagHex, "hex"));

  return Buffer.concat([
    dechiffreur.update(Buffer.from(chiffreHex, "hex")),
    dechiffreur.final(),
  ]);
}

// ──────────────────────────────────────────────── codes de secours ──

/** Combien de codes de secours on remet. */
export const NOMBRE_CODES_SECOURS = 8;

/**
 * Un lot de codes de secours, en clair.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ILS NE SONT MONTRÉS QU'UNE FOIS
 *
 * C'est la seule chose qui sépare quelqu'un qui perd son téléphone d'un compte
 * définitivement fermé. Ils sont stockés hachés : nous ne pouvons pas les
 * réafficher, et c'est exactement ce qu'on veut — un support technique capable
 * de lire les codes de secours de quelqu'un est une porte dérobée.
 *
 * Format `xxxx-xxxx` en base32 : dix caractères sans ambiguïté, recopiables
 * depuis un bout de papier.
 */
export function nouveauxCodesSecours(): string[] {
  return Array.from({ length: NOMBRE_CODES_SECOURS }, () => {
    const brut = enBase32(randomBytes(5)).slice(0, 8);
    return `${brut.slice(0, 4)}-${brut.slice(4)}`;
  });
}

/**
 * L'empreinte d'un code de secours.
 *
 * SHA-256 et non scrypt : un code de secours fait quarante bits tirés au
 * hasard, il n'y a rien à ralentir. Le raisonnement est celui de
 * `PasswordReset` — voir le commentaire du schéma.
 */
export function empreinteCodeSecours(code: string): string {
  return createHmac("sha256", "baobart:secours:v1")
    .update(code.toUpperCase().replace(/[\s-]/g, ""))
    .digest("hex");
}
