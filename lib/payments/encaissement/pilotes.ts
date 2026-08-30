import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { journal } from "@/lib/observabilite/journal";

/**
 * Ce qui parle vraiment aux opérateurs de paiement.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DEUX MOITIÉS QUI NE SE RESSEMBLENT PAS
 *
 * Encaisser du mobile money, ce n'est pas un appel qui rend un résultat. C'est
 * deux moitiés séparées par un temps indéterminé :
 *
 *   1. on **ouvre** un paiement chez l'opérateur, et on envoie l'acheteur
 *      chez lui — sur une page, ou vers une invite USSD sur son téléphone ;
 *   2. l'opérateur nous **rappelle**, plus tard, pour dire ce qui s'est passé.
 *
 * Entre les deux, l'acheteur peut fermer son navigateur, changer de réseau, ou
 * mettre huit minutes à taper son code. C'est pourquoi le retour du navigateur
 * ne fait jamais foi : il dit où l'acheteur a atterri, pas si l'argent est
 * arrivé. Seul le rappel de l'opérateur, authentifié, décide.
 *
 * Le reste du système ne sait pas quel opérateur est branché. Il demande une
 * ouverture, et reçoit plus tard un fait.
 */

export type NomPilote = "bac-a-sable" | "aucun";

/** Ce qu'on demande à l'opérateur d'encaisser. */
export interface DemandePaiement {
  /** Notre référence. C'est elle qu'on retrouvera dans le rappel. */
  reference: string;
  /** En unités mineures ISO 4217 — le franc CFA n'en a pas de sous-unité. */
  montant: number;
  devise: string;
  /** Le moyen visé : « om », « wave », « mtn », « moov ». */
  moyen: string;
  /** Où renvoyer l'acheteur une fois qu'il en a fini chez l'opérateur. */
  retour: string;
  /** Pour que l'opérateur pré-remplisse l'invite. */
  telephone?: string;
}

export type Ouverture =
  | {
      ok: true;
      /** Où envoyer l'acheteur. */
      redirection: string;
      /** Ce que l'opérateur appelle cette transaction, quand il le dit tout de suite. */
      referenceOperateur: string | null;
    }
  | { ok: false; message: string; definitif: boolean };

/** Ce qu'un rappel d'opérateur nous apprend, une fois traduit. */
export interface FaitPaiement {
  /** L'identifiant de l'événement chez l'opérateur — la clé anti-rejeu. */
  evenement: string;
  /** Notre référence, celle qu'on a envoyée à l'ouverture. */
  reference: string;
  /** La référence de la transaction chez l'opérateur. */
  referenceOperateur: string | null;
  /** Ce que l'opérateur affirme. */
  issue: "REUSSI" | "ECHOUE" | "EN_COURS";
  /** Le montant encaissé, pour le confronter au nôtre. */
  montant: number | null;
  devise: string | null;
}

export interface PiloteEncaissement {
  nom: NomPilote;
  /** Toutes ses variables sont-elles posées ? */
  configure(): boolean;
  ouvrir(demande: DemandePaiement): Promise<Ouverture>;
  /**
   * L'appel vient-il bien de l'opérateur ?
   *
   * Reçoit le corps **brut**. Une signature se vérifie sur les octets reçus :
   * relire un objet déjà décodé puis le ré-encoder change les espaces, l'ordre
   * des clés, l'échappement des accents — et la signature ne correspond plus.
   */
  authentifier(corpsBrut: string, entetes: Headers): boolean;
  /** Traduit le corps en fait. Rend `null` si ce n'est pas un événement connu. */
  lire(corpsBrut: string): FaitPaiement | null;
}

/**
 * Compare deux signatures sans révéler où elles divergent.
 *
 * Un `===` sur des chaînes s'arrête au premier octet différent. La durée de la
 * comparaison dit alors combien de caractères de tête sont bons, et une
 * signature se reconstitue octet par octet. `timingSafeEqual` prend le même
 * temps quel que soit l'endroit de l'écart.
 */
export function signaturesEgales(attendue: string, recue: string): boolean {
  const a = Buffer.from(attendue, "utf8");
  const b = Buffer.from(recue, "utf8");
  // `timingSafeEqual` exige des longueurs égales. Une longueur différente est
  // de toute façon un refus, et elle n'apprend rien qu'on cache.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** HMAC-SHA256 en hexadécimal — la forme qu'attendent la plupart des opérateurs. */
export function sceau(secret: string, corps: string): string {
  return createHmac("sha256", secret).update(corps, "utf8").digest("hex");
}

// ──────────────────────────────────────────────────────────── bac à sable ──

/**
 * Le bac à sable : la chaîne entière, sans opérateur.
 *
 * Il n'y a rien de faux ici sauf l'argent. L'ouverture rend une redirection
 * vers un écran à nous ; le rappel arrive vraiment sur la route de webhook,
 * signé avec `PAYMENTS_SANDBOX_SECRET`, et suit exactement le même chemin
 * qu'un rappel d'Orange Money. C'est ce qui permet d'éprouver le rejeu, la
 * signature invalide et le montant qui ne correspond pas — trois choses qu'un
 * simple `if (simulation)` posé au milieu du code d'achat ne peut pas montrer.
 *
 * Il refuse de se configurer sans secret : un bac à sable dont le webhook
 * accepte tout n'éprouve pas le webhook.
 */
const BAC_A_SABLE: PiloteEncaissement = {
  nom: "bac-a-sable",

  configure() {
    return (process.env.PAYMENTS_SANDBOX_SECRET ?? "").trim().length >= 16;
  },

  async ouvrir(demande) {
    journal.avertissement("paiement ouvert en bac à sable — aucun argent réel", {
      reference: demande.reference,
      moyen: demande.moyen,
    });

    const url = new URL(`${demande.retour}`);
    url.searchParams.set("bac", demande.reference);
    return {
      ok: true,
      redirection: url.toString(),
      referenceOperateur: `sandbox-${demande.reference}`,
    };
  },

  authentifier(corpsBrut, entetes) {
    const secret = (process.env.PAYMENTS_SANDBOX_SECRET ?? "").trim();
    if (secret.length < 16) return false;

    const recue = entetes.get("x-baobart-signature");
    if (!recue) return false;

    return signaturesEgales(sceau(secret, corpsBrut), recue);
  },

  lire(corpsBrut) {
    let brut: unknown;
    try {
      brut = JSON.parse(corpsBrut);
    } catch {
      return null;
    }

    if (typeof brut !== "object" || brut === null) return null;
    const o = brut as Record<string, unknown>;

    const evenement = typeof o.event === "string" ? o.event : null;
    const reference = typeof o.reference === "string" ? o.reference : null;
    const issue = typeof o.status === "string" ? o.status : null;

    if (!evenement || !reference) return null;
    if (issue !== "REUSSI" && issue !== "ECHOUE" && issue !== "EN_COURS") {
      return null;
    }

    return {
      evenement,
      reference,
      referenceOperateur:
        typeof o.operatorRef === "string" ? o.operatorRef : null,
      issue,
      montant: typeof o.amount === "number" ? o.amount : null,
      devise: typeof o.currency === "string" ? o.currency : null,
    };
  },
};

/**
 * Aucun opérateur branché.
 *
 * Refuse d'ouvrir plutôt que de laisser croire. Un paiement qui « s'ouvre »
 * sans opérateur envoie l'acheteur nulle part et laisse une commande en cours
 * qui n'aboutira jamais.
 */
const AUCUN: PiloteEncaissement = {
  nom: "aucun",
  configure: () => true,
  async ouvrir() {
    return {
      ok: false,
      message: "Aucun opérateur de paiement n'est configuré.",
      definitif: true,
    };
  },
  // Ne rien accepter : sans opérateur, tout appel entrant est un inconnu.
  authentifier: () => false,
  lire: () => null,
};

const PILOTES: Record<NomPilote, PiloteEncaissement> = {
  "bac-a-sable": BAC_A_SABLE,
  aucun: AUCUN,
};

/**
 * Le pilote actif, choisi par `PAYMENTS_DRIVER`.
 *
 * Un nom inconnu ou mal configuré retombe sur « aucun ». On préfère un refus
 * franc à un opérateur à moitié branché : le second encaisse peut-être, mais
 * personne ne sait dire si l'argent est arrivé.
 */
export function piloteCourant(): PiloteEncaissement {
  const nom = (process.env.PAYMENTS_DRIVER ?? "").trim().toLowerCase();

  const pilote = (PILOTES as Record<string, PiloteEncaissement | undefined>)[nom];
  if (!pilote) return AUCUN;
  if (!pilote.configure()) return AUCUN;
  return pilote;
}

/** Retrouve un pilote par son nom, sans passer par l'environnement. */
export function piloteNomme(nom: string): PiloteEncaissement | null {
  return (PILOTES as Record<string, PiloteEncaissement | undefined>)[nom] ?? null;
}

export const POUR_TESTS = { BAC_A_SABLE, AUCUN };
