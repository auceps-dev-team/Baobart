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

/**
 * De quel sens circule l'argent.
 *
 * Un opérateur n'a qu'une adresse de rappel. Il y envoie donc TOUT : les
 * paiements entrants, les virements sortants, et quantité d'événements qui ne
 * nous regardent pas. Sans ce marqueur, un virement réussi serait cherché parmi
 * les commandes — et n'y étant pas, refusé comme « commande introuvable ».
 */
export type SensDeLArgent = "ENCAISSEMENT" | "VERSEMENT";

/** Ce qu'un rappel d'opérateur nous apprend, une fois traduit. */
export interface FaitPaiement {
  sens: SensDeLArgent;
  /** L'identifiant de l'événement chez l'opérateur — la clé anti-rejeu. */
  evenement: string;
  /** Notre référence, celle qu'on a envoyée à l'ouverture. */
  reference: string;
  /** La référence de la transaction chez l'opérateur. */
  referenceOperateur: string | null;
  /**
   * Ce que l'opérateur affirme.
   *
   * `RETOURNE` n'existe que pour les virements : l'argent est parti puis
   * revenu, souvent parce que le compte du bénéficiaire n'existe plus. Ce
   * n'est pas un échec — l'ordre a bien été exécuté —, et les deux ne se
   * traitent pas pareil.
   */
  issue: "REUSSI" | "ECHOUE" | "EN_COURS" | "RETOURNE";
  /** Le montant encaissé, pour le confronter au nôtre. */
  montant: number | null;
  devise: string | null;
}

/** Le bénéficiaire d'un virement, tel qu'on le connaît. */
export interface Beneficiaire {
  /** Le nom du titulaire, tel que l'opérateur le connaît. */
  nom: string;
  /** Numéro mobile money, ou identifiant bancaire. */
  compte: string;
  /** Notre rail : « om », « wave », « mtn », « moov », « bank ». */
  moyen: string;
  devise: string;
}

export interface OrdreVersement {
  /** Notre référence — l'identifiant du versement. C'est elle qui revient. */
  reference: string;
  /** Le bénéficiaire chez l'opérateur, obtenu une fois puis réutilisé. */
  beneficiaire: string;
  /** En unités mineures ISO 4217. */
  montant: number;
  devise: string;
  /** Ce que le créateur lira sur son relevé. */
  motif: string;
}

export type Inscription =
  | { ok: true; reference: string }
  | { ok: false; message: string; definitif: boolean };

export type Envoi =
  | {
      ok: true;
      /** Le code de l'ordre chez l'opérateur, à citer en cas de réclamation. */
      referenceOperateur: string;
    }
  | {
      ok: false;
      message: string;
      definitif: boolean;
      /**
       * L'opérateur exige un code à usage unique tapé par un humain.
       *
       * ────────────────────────────────────────────────────────────────────
       * CE CAS N'EST PAS UNE PANNE, C'EST UN RÉGLAGE
       *
       * Paystack peut exiger un code envoyé au propriétaire du compte pour
       * chaque virement. Tant que ce réglage est actif, **aucun versement
       * automatique n'est possible** — et aucune quantité de code n'y changera
       * quoi que ce soit. Il se désactive sur leur tableau de bord.
       *
       * On le distingue d'un échec ordinaire parce que le remède est
       * entièrement différent : il n'y a rien à réessayer, il y a un réglage à
       * changer.
       */
      otpRequis?: boolean;
    };

/**
 * La moitié sortante : envoyer de l'argent, au lieu d'en recevoir.
 *
 * Facultative. Un opérateur peut très bien encaisser sans savoir verser, et
 * c'est le cas de notre bac à sable comme de Flutterwave aujourd'hui.
 */
export interface PiloteVersement {
  /** Enregistre le bénéficiaire chez l'opérateur, une fois pour toutes. */
  inscrire(beneficiaire: Beneficiaire): Promise<Inscription>;
  /** Ordonne le virement. L'argent part ; le rappel dira s'il est arrivé. */
  ordonner(ordre: OrdreVersement): Promise<Envoi>;
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
  /**
   * Traduit le corps en fait.
   *
   * Trois issues, et la distinction compte :
   *
   *   — un **fait**, qu'on va appliquer ;
   *   — `"HORS_SUJET"` : authentique, mais rien à faire ici. Un opérateur
   *     envoie ses litiges, ses remboursements et ses factures sur la même
   *     adresse. Leur répondre par une erreur les ferait rejouer sans fin, et
   *     remplirait le journal des refus au point d'y noyer un vrai secret
   *     décalé ;
   *   — `null` : illisible. Là, c'est une panne de configuration chez lui, et
   *     il faut la lui faire remonter.
   */
  lire(corpsBrut: string): FaitPaiement | "HORS_SUJET" | null;

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

  /** La moitié sortante, quand l'opérateur sait aussi verser. */
  versements?: PiloteVersement;

  /**
   * Rend l'argent à l'acheteur.
   *
   * ──────────────────────────────────────────────────────────────────────────
   * SANS CET APPEL, UN REMBOURSEMENT N'EN EST PAS UN
   *
   * Écrire au grand livre débite le vendeur ; cela ne rend rien à l'acheteur.
   * Tant que l'opérateur n'a pas reçu l'ordre, l'argent est chez lui, et le
   * « remboursement » n'est qu'une écriture comptable — invisible en
   * simulation, catastrophique en production : le créateur perd sa vente et
   * l'acheteur n'est pas remboursé.
   *
   * Facultatif : tous les opérateurs n'ont pas de point de remboursement, et
   * le bac à sable n'en a pas besoin. Absent, la vente ne peut pas être
   * remboursée par l'interface — ce qui vaut mieux que de faire croire qu'elle
   * l'a été.
   */
  rembourser?(demande: DemandeRemboursement): Promise<Remboursement>;
}

export interface DemandeRemboursement {
  /** La transaction chez l'opérateur — pas notre identifiant de commande. */
  referenceOperateur: string;
  /** En unités mineures ISO 4217. Peut être partiel. */
  montant: number;
  devise: string;
  /** Ce que l'acheteur lira. */
  motifClient: string;
  /** Ce qu'on retrouvera dans le tableau de bord de l'opérateur. */
  motifInterne: string;
}

export type Remboursement =
  | { ok: true; referenceOperateur: string | null }
  | { ok: false; message: string; definitif: boolean };

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
