import "server-only";

import { createHmac } from "node:crypto";

import {
  CURRENCIES,
  fromMinorUnits,
  toMinorUnits,
  type Currency,
} from "@/lib/i18n/money";
import { journal } from "@/lib/observabilite/journal";
import {
  signaturesEgales,
  type DemandePaiement,
  type FaitPaiement,
  type PiloteEncaissement,
} from "@/lib/payments/encaissement/contrat";

/**
 * Flutterwave (API v4).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QUI LE DISTINGUE DE PAYSTACK
 *
 * Trois choses, et chacune coûte du code.
 *
 * **L'authentification est un échange OAuth**, pas une clé statique. On troque
 * un `client_id` et un `client_secret` contre un jeton qui vit **dix minutes**.
 * D'où le petit cache ci-dessous : sans lui, chaque achat paierait un
 * aller-retour supplémentaire, et une panne de leur serveur d'identité
 * bloquerait la caisse plus souvent que nécessaire.
 *
 * **Ouvrir un paiement prend trois appels** au lieu d'un : créer le client,
 * créer le moyen de paiement, créer la charge. Les deux premiers échouent
 * rarement mais peuvent échouer, et il faut alors s'arrêter avant d'avoir
 * ouvert quoi que ce soit.
 *
 * **Les montants sont en unités principales**, décimales comprises — l'inverse
 * de Paystack. Cinq mille francs se déclarent `5000`, et cinquante euros
 * `50.00`. C'est notre `fromMinorUnits` qui fait le travail.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QUI N'A PAS PU ÊTRE VÉRIFIÉ
 *
 * La documentation publique de la v4 ne dit pas quelles devises ni quels
 * réseaux mobile money sont ouverts en zone franc CFA — elle renvoie à une page
 * de support. Le pilote n'impose donc **aucune liste de devises** : il envoie
 * la nôtre et laisse Flutterwave refuser s'il ne sait pas la traiter. Inventer
 * une liste ici reviendrait à fermer des pays au hasard.
 */

const IDENTITE =
  "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token";

/** Sandbox par défaut : on ne bascule en production que sur décision explicite. */
function base(): string {
  const env = (process.env.FLUTTERWAVE_ENV ?? "sandbox").trim().toLowerCase();
  return env === "production"
    ? "https://api.flutterwave.com"
    : "https://developersandbox-api.flutterwave.com";
}

/**
 * Nos rails vers les réseaux que Flutterwave nomme.
 *
 * Wave n'y figure pas : la documentation v4 ne le liste pas parmi les réseaux
 * de `mobile_money`. Le laisser tomber sur MTN enverrait l'acheteur vers un
 * opérateur qui n'est pas le sien — mieux vaut n'en imposer aucun et laisser
 * Flutterwave choisir d'après le numéro.
 */
const RESEAUX: Record<string, string> = {
  mtn: "MTN",
  om: "ORANGE",
  moov: "MOOV",
};

// ───────────────────────────────────────────────────────── jeton d'accès ──

let jetonEnCache: { valeur: string; expireA: number } | null = null;

/**
 * Le jeton d'accès, renouvelé une minute avant son terme.
 *
 * La marge n'est pas de la coquetterie : un jeton qui expire pendant le vol
 * produit un 401 au milieu d'un achat, et l'acheteur voit un refus qui n'a
 * aucune raison d'être.
 */
async function jeton(): Promise<string | null> {
  if (jetonEnCache && jetonEnCache.expireA > Date.now()) {
    return jetonEnCache.valeur;
  }

  const id = (process.env.FLUTTERWAVE_CLIENT_ID ?? "").trim();
  const secret = (process.env.FLUTTERWAVE_CLIENT_SECRET ?? "").trim();
  if (!id || !secret) return null;

  try {
    const reponse = await fetch(IDENTITE, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: id,
        client_secret: secret,
        grant_type: "client_credentials",
      }),
    });

    const lu = (await reponse.json().catch(() => null)) as {
      access_token?: string;
      expires_in?: number;
    } | null;

    if (!reponse.ok || !lu?.access_token) {
      journal.erreur("Flutterwave refuse le jeton d'accès", {
        code: reponse.status,
      });
      return null;
    }

    const duree = typeof lu.expires_in === "number" ? lu.expires_in : 600;
    jetonEnCache = {
      valeur: lu.access_token,
      expireA: Date.now() + Math.max(duree - 60, 30) * 1000,
    };
    return jetonEnCache.valeur;
  } catch (cause) {
    journal.erreur("serveur d'identité Flutterwave injoignable", {
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    return null;
  }
}

/** Vidé par les tests, et le jour où l'on tourne les identifiants. */
export function oublierJeton(): void {
  jetonEnCache = null;
}

async function appeler(
  chemin: string,
  corps: unknown,
  acces: string,
): Promise<{ ok: boolean; code: number; data: Record<string, unknown> | null }> {
  const reponse = await fetch(`${base()}${chemin}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${acces}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(corps),
  });

  const lu = (await reponse.json().catch(() => null)) as {
    status?: string;
    data?: Record<string, unknown>;
  } | null;

  return {
    ok: reponse.ok && lu?.status !== "failed" && lu?.data !== undefined,
    code: reponse.status,
    data: lu?.data ?? null,
  };
}

/**
 * La référence Baobart adaptée à leur format.
 *
 * Flutterwave n'accepte que 6 à 42 caractères alphanumériques. Nos identifiants
 * de commande sont des `cuid` — alphanumériques et de bonne taille — mais on
 * filtre quand même : le jour où le générateur change, l'ouverture échouerait
 * pour une raison que personne ne devinerait.
 */
export function referencePour(reference: string): string {
  const propre = reference.replace(/[^a-zA-Z0-9]/g, "");
  return propre.slice(0, 42).padEnd(6, "0");
}

async function ouvrirChezFlutterwave(demande: DemandePaiement) {
  const acces = await jeton();
  if (!acces) {
    return {
      ok: false as const,
      message: "Flutterwave n'a pas délivré de jeton d'accès.",
      definitif: false,
    };
  }

  // 1. Le client.
  const client = await appeler(
    "/customers",
    {
      email: demande.email,
      ...(demande.nom ? { name: { first: demande.nom } } : {}),
      ...(demande.telephone
        ? { phone: { number: demande.telephone } }
        : {}),
    },
    acces,
  );

  if (!client.ok || typeof client.data?.id !== "string") {
    return {
      ok: false as const,
      message: "Flutterwave a refusé la création du client.",
      definitif: client.code < 500,
    };
  }

  // 2. Le moyen de paiement. Sans numéro de téléphone, on ne peut pas déclarer
  //    de mobile money : on laisse Flutterwave présenter ce qu'il a.
  const reseau = RESEAUX[demande.moyen];
  const moyen = await appeler(
    "/payment-methods",
    demande.telephone && reseau
      ? {
          type: "mobile_money",
          mobile_money: {
            network: reseau,
            phone_number: demande.telephone,
          },
        }
      : { type: "card" },
    acces,
  );

  if (!moyen.ok || typeof moyen.data?.id !== "string") {
    return {
      ok: false as const,
      message: "Flutterwave a refusé le moyen de paiement.",
      definitif: moyen.code < 500,
    };
  }

  // 3. La charge.
  const charge = await appeler(
    "/charges",
    {
      customer_id: client.data.id,
      payment_method_id: moyen.data.id,
      amount: fromMinorUnits(demande.montant, demande.devise as Currency),
      currency: demande.devise,
      reference: referencePour(demande.reference),
      redirect_url: demande.retour,
    },
    acces,
  );

  if (!charge.ok || charge.data === null) {
    return {
      ok: false as const,
      message: "Flutterwave a refusé la charge.",
      definitif: charge.code < 500,
    };
  }

  // `next_action` dit ce que l'acheteur doit faire : suivre un lien, ou taper
  // un code sur son téléphone. Sans lien, on n'a nulle part où l'envoyer.
  const suite = charge.data.next_action as
    | { type?: string; redirect_url?: { url?: string } | string }
    | undefined;

  const lien =
    typeof suite?.redirect_url === "string"
      ? suite.redirect_url
      : suite?.redirect_url?.url;

  if (!lien) {
    return {
      ok: false as const,
      message:
        "Flutterwave n'a proposé aucune page de paiement pour ce moyen. L'invite part peut-être sur le téléphone — ce parcours n'est pas encore géré.",
      definitif: true,
    };
  }

  return {
    ok: true as const,
    redirection: lien,
    referenceOperateur:
      typeof charge.data.id === "string" ? charge.data.id : null,
  };
}

export const FLUTTERWAVE: PiloteEncaissement = {
  nom: "flutterwave",

  configure() {
    return (
      (process.env.FLUTTERWAVE_CLIENT_ID ?? "").trim().length > 0 &&
      (process.env.FLUTTERWAVE_CLIENT_SECRET ?? "").trim().length > 0 &&
      (process.env.FLUTTERWAVE_SECRET_HASH ?? "").trim().length >= 16
    );
  },

  async ouvrir(demande) {
    try {
      return await ouvrirChezFlutterwave(demande);
    } catch (cause) {
      journal.erreur("Flutterwave injoignable", {
        reference: demande.reference,
        cause: cause instanceof Error ? cause.message : String(cause),
      });
      return {
        ok: false,
        message: "Flutterwave est injoignable.",
        definitif: false,
      };
    }
  },

  authentifier(corpsBrut, entetes) {
    const secret = (process.env.FLUTTERWAVE_SECRET_HASH ?? "").trim();
    if (secret.length < 16) return false;

    const recue = entetes.get("flutterwave-signature");
    if (!recue) return false;

    // HMAC-SHA256 sur les octets reçus, rendu en base64 — et non en
    // hexadécimal comme Paystack. Se tromper de forme ici donne un refus
    // permanent que rien n'explique.
    const attendue = createHmac("sha256", secret)
      .update(corpsBrut, "utf8")
      .digest("base64");

    return signaturesEgales(attendue, recue);
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

    const type = typeof o.type === "string" ? o.type : null;
    const donnees =
      typeof o.data === "object" && o.data !== null
        ? (o.data as Record<string, unknown>)
        : null;

    if (!type || !donnees) return null;

    // Flutterwave envoie aussi ses remboursements et ses virements sur la même
    // adresse. Ce qui n'est pas une charge est authentique mais hors sujet ici
    // — les virements sortants ne sont pas encore branchés chez lui.
    if (!type.startsWith("charge.")) return "HORS_SUJET";

    const reference =
      typeof donnees.reference === "string"
        ? donnees.reference
        : typeof donnees.tx_ref === "string"
          ? donnees.tx_ref
          : null;
    if (!reference) return null;

    const statut = typeof donnees.status === "string" ? donnees.status : "";

    // « succeeded » est le seul mot qui fasse entrer de l'argent. Tout ce qui
    // n'est ni un succès ni un échec franc reste « en cours » : on attend la
    // suite plutôt que de refermer une commande qui vit encore.
    const issue: FaitPaiement["issue"] =
      statut === "succeeded" || statut === "successful"
        ? "REUSSI"
        : statut === "failed" || statut === "cancelled"
          ? "ECHOUE"
          : "EN_COURS";

    const devise = typeof donnees.currency === "string" ? donnees.currency : null;

    const principal =
      typeof donnees.amount === "number"
        ? donnees.amount
        : typeof donnees.amount === "string"
          ? Number(donnees.amount)
          : null;

    // ────────────────────────────────────────────────────────────────────────
    // FLUTTERWAVE PARLE EN UNITÉS PRINCIPALES, NOUS EN UNITÉS MINEURES
    //
    // La confrontation des montants, plus loin, compare à `Order.total` — qui
    // est en unités mineures. Recopier tel quel passerait inaperçu en franc
    // CFA, qui n'a pas de décimale et où les deux valeurs coïncident. En euro,
    // « 50.00 » serait confronté à « 5000 » et tout paiement légitime serait
    // refusé pour discordance.
    //
    // Sans devise reconnue, on ne convertit rien et on n'annonce rien : un
    // montant faux vaut moins que pas de montant, puisqu'un montant absent
    // laisse simplement la confrontation passer son tour.
    const montant =
      principal !== null &&
      Number.isFinite(principal) &&
      devise !== null &&
      (CURRENCIES as readonly string[]).includes(devise)
        ? toMinorUnits(principal, devise as Currency)
        : null;

    return {
      sens: "ENCAISSEMENT",
      // L'identifiant d'événement du corps quand il existe, l'identifiant de
      // charge sinon — joint au type, pour qu'un échec après un succès ne passe
      // pas pour un rejeu.
      evenement:
        typeof o.id === "string"
          ? o.id
          : `${type}:${String(donnees.id ?? reference)}`,
      reference,
      referenceOperateur: donnees.id !== undefined ? String(donnees.id) : null,
      issue,
      montant,
      devise,
    };
  },
};
