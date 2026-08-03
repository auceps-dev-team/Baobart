import "server-only";

import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { promisify } from "node:util";

/**
 * Hachage des mots de passe.
 *
 * On utilise **scrypt**, fourni par Node lui-même : pas de dépendance native à
 * compiler, et une fonction conçue pour être coûteuse en mémoire — donc chère à
 * attaquer par force brute, même avec du matériel dédié.
 *
 * Format stocké : `scrypt$N$r$p$sel$empreinte`, tout en hexadécimal. Les
 * paramètres voyagent avec l'empreinte : le jour où on les durcit, les anciens
 * mots de passe restent vérifiables et se remettent à niveau à la connexion
 * suivante.
 */

// `promisify` perd la surcharge à options de scrypt : on la redonne à la main,
// sinon TypeScript croit que la fonction n'accepte que trois arguments.
const scryptAsync = promisify(scrypt) as (
  motDePasse: string | Buffer,
  sel: string | Buffer,
  longueur: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/** Coût mémoire. 2^16 ≈ 64 Mio par vérification. */
const N = 16_384;
const R = 8;
const P = 1;
const LONGUEUR_CLE = 64;
const LONGUEUR_SEL = 16;

import { LONGUEUR_MOT_DE_PASSE_MIN } from "@/lib/auth/strength";

export { LONGUEUR_MOT_DE_PASSE_MIN };

export class MotDePasseTropCourtError extends Error {
  constructor() {
    super(
      `Le mot de passe doit faire au moins ${LONGUEUR_MOT_DE_PASSE_MIN} caractères.`,
    );
    this.name = "MotDePasseTropCourtError";
  }
}

export async function hacherMotDePasse(motDePasse: string): Promise<string> {
  if (motDePasse.length < LONGUEUR_MOT_DE_PASSE_MIN) {
    throw new MotDePasseTropCourtError();
  }

  const sel = randomBytes(LONGUEUR_SEL);
  const empreinte = await scryptAsync(motDePasse, sel, LONGUEUR_CLE, {
    N,
    r: R,
    p: P,
    // Node refuse scrypt au-delà de 32 Mio par défaut ; N=16384 en demande ~64.
    maxmem: 128 * 1024 * 1024,
  });

  return [
    "scrypt",
    N,
    R,
    P,
    sel.toString("hex"),
    empreinte.toString("hex"),
  ].join("$");
}

/**
 * Vérifie un mot de passe contre une empreinte stockée.
 *
 * Renvoie `false` plutôt que de lever quand l'empreinte est illisible : une
 * ligne corrompue ne doit pas faire tomber la connexion en erreur serveur, ce
 * qui distinguerait ce compte des autres.
 */
export async function verifierMotDePasse(
  motDePasse: string,
  stocke: string | null,
): Promise<boolean> {
  if (!stocke) return false;

  const parties = stocke.split("$");
  if (parties.length !== 6 || parties[0] !== "scrypt") return false;

  const [, nBrut, rBrut, pBrut, selHex, empreinteHex] = parties as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];

  const n = Number(nBrut);
  const r = Number(rBrut);
  const p = Number(pBrut);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }

  let attendu: Buffer;
  try {
    attendu = Buffer.from(empreinteHex, "hex");
  } catch {
    return false;
  }
  if (attendu.length === 0) return false;

  const calcule = await scryptAsync(
    motDePasse,
    Buffer.from(selHex, "hex"),
    attendu.length,
    { N: n, r, p, maxmem: 128 * 1024 * 1024 },
  );

  // Comparaison à temps constant : comparer octet par octet laisserait fuiter
  // la longueur du préfixe correct, et donc de quoi deviner l'empreinte.
  return timingSafeEqual(calcule, attendu);
}
