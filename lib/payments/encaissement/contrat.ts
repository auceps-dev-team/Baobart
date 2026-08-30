import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Le contrat que doit tenir un opérateur de paiement.
 *
 * Séparé du registre pour une raison mécanique : chaque pilote a besoin de ces
 * types, et le registre a besoin de chaque pilote. Les laisser dans le même
 * fichier ferait tourner les imports en rond.
 */

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

export type NomPilote = "bac-a-sable" | "paystack" | "flutterwave" | "aucun";

/** Ce qu'on demande à l'opérateur d'encaisser. */
export interface DemandePaiement {
  /** Notre référence. C'est elle qu'on retrouvera dans le rappel. */
  reference: string;
  /** En unités mineures ISO 4217 — le franc CFA n'en a pas de sous-unité. */
  montant: number;
  devise: string;
  /**
   * Le rail visé : « om », « wave », « mtn », « moov ».
   *
   * **Consultatif.** Les agrégateurs présentent leur propre page et y montrent
   * les moyens que le compte marchand a activés pour cette devise. Leur
   * imposer un canal qu'ils n'offrent pas dans ce pays donnerait un écran de
   * paiement vide — pire qu'un choix un peu large.
   */
  moyen: string;
  /** Où renvoyer l'acheteur une fois qu'il en a fini chez l'opérateur. */
  retour: string;
  /**
   * L'adresse de l'acheteur.
   *
   * Paystack l'exige, et c'est elle qui rattache la transaction à un client
   * dans leur tableau de bord. Elle sort de la session, jamais du formulaire.
   */
  email: string;
  /** Pour que l'opérateur pré-remplisse l'invite. */
  telephone?: string;
  nom?: string;
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

  /**
   * Demande à l'opérateur ce qu'il en est, au lieu de croire ce qu'il envoie.
   *
   * ──────────────────────────────────────────────────────────────────────────
   * CE QUE LA SIGNATURE NE PROUVE PAS
   *
   * Une signature valide prouve que le message vient de l'opérateur — tant que
   * le secret n'a pas fui. Un secret dérobé permet de forger un rappel signé,
   * annonçant un paiement qui n'a jamais eu lieu, sur une commande réelle.
   *
   * Cet appel-ci ferme cette porte : il interroge le serveur de l'opérateur.
   * Personne ne peut lui faire dire qu'une transaction a réussi quand elle n'a
   * pas eu lieu.
   *
   * Facultatif : tous les opérateurs n'offrent pas de point de vérification, et
   * le bac à sable n'en a pas besoin. Absent, on se contente de la signature.
   */
  confirmer?(
    reference: string,
  ): Promise<{ confirme: boolean; montant: number | null; devise: string | null }>;
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
