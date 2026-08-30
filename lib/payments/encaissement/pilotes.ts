import "server-only";

import { journal } from "@/lib/observabilite/journal";
import {
  sceau,
  signaturesEgales,
  type NomPilote,
  type PiloteEncaissement,
} from "@/lib/payments/encaissement/contrat";
import { FLUTTERWAVE } from "@/lib/payments/encaissement/pilotes/flutterwave";
import { PAYSTACK } from "@/lib/payments/encaissement/pilotes/paystack";

/**
 * Le registre des opérateurs.
 *
 * Le contrat qu'ils tiennent vit dans `contrat.ts` ; les vrais opérateurs dans
 * `pilotes/`. Ici on ne fait que choisir, et refuser quand le choix ne tient
 * pas debout.
 */

// Réexportés pour que les appelants n'aient qu'un seul point d'entrée.
export {
  sceau,
  signaturesEgales,
  type DemandePaiement,
  type FaitPaiement,
  type NomPilote,
  type Ouverture,
  type PiloteEncaissement,
} from "@/lib/payments/encaissement/contrat";

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
  paystack: PAYSTACK,
  flutterwave: FLUTTERWAVE,
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
