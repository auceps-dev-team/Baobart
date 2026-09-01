import "server-only";

import { createHmac } from "node:crypto";

import { decimalsFor, type Currency } from "@/lib/i18n/money";
import { journal } from "@/lib/observabilite/journal";
import {
  signaturesEgales,
  type DemandeRemboursement,
  type FaitPaiement,
  type PiloteEncaissement,
  type Remboursement,
} from "@/lib/payments/encaissement/contrat";
import { VERSEMENTS_PAYSTACK } from "@/lib/payments/encaissement/pilotes/paystack-versements";

/**
 * Paystack.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI LUI D'ABORD
 *
 * Il accepte le franc CFA. C'est la seule question qui compte pour Baobart, et
 * elle en écarte beaucoup : ni Stripe ni PayPal ne règlent en XOF.
 *
 * Son parcours tient en un appel : on initialise une transaction, on reçoit une
 * `authorization_url`, on y envoie l'acheteur. Sa page présente les moyens que
 * le compte marchand a activés pour cette devise — mobile money, carte, USSD.
 * Puis il rappelle.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LE PIÈGE DES MONTANTS, ET IL EST SÉVÈRE
 *
 * Paystack veut un montant « en sous-unité », qu'il définit comme **le montant
 * principal multiplié par cent — y compris pour les devises qui n'ont pas de
 * sous-unité**. Le franc CFA n'en a pas. Cinq mille francs se déclarent donc
 * `500000`.
 *
 * Or Baobart garde ses montants en unités mineures ISO 4217 : le XOF ayant zéro
 * décimale, cinq mille francs valent `5000` chez nous. Recopier tel quel
 * facturerait cinquante francs. Et pour le naira, qui a bien deux décimales,
 * notre valeur est DÉJÀ la sous-unité attendue : multiplier par cent
 * facturerait cent fois trop.
 *
 * D'où la conversion générale ci-dessous, et ses tests. C'est le seul endroit
 * du pilote où une erreur ne se voit pas : elle passe la revue, passe le bac à
 * sable, et se découvre sur un relevé.
 */

const BASE = "https://api.paystack.co";

/** Ce que Paystack sait régler. Le reste, on refuse d'ouvrir. */
const DEVISES = new Set<string>(["NGN", "GHS", "KES", "ZAR", "USD", "XOF"]);

/**
 * Notre montant (unités mineures ISO) vers le montant Paystack.
 *
 * Paystack = principal × 100. Nous = principal × 10^décimales.
 * Donc Paystack = nous × 10^(2 − décimales).
 *
 *   XOF (0 décimale) : 5000 → 500000
 *   NGN (2 décimales) : 500000 → 500000
 */
export function versPaystack(montant: number, devise: Currency): number {
  return Math.round(montant * 10 ** (2 - decimalsFor(devise)));
}

/** L'inverse, pour confronter ce que le rappel annonce à ce qu'on attend. */
export function depuisPaystack(montant: number, devise: Currency): number {
  return Math.round(montant / 10 ** (2 - decimalsFor(devise)));
}

function cle(): string {
  return (process.env.PAYSTACK_SECRET_KEY ?? "").trim();
}

/**
 * Ce que Paystack appelle un événement, traduit en un sens et une issue.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UNE SEULE ADRESSE POUR TOUT
 *
 * Paystack n'a qu'une adresse de rappel par intégration. Il y envoie les
 * paiements entrants (`charge.*`), les virements sortants (`transfer.*`), les
 * remboursements, les litiges, les factures. Sans tri à l'entrée, un virement
 * réussi serait cherché parmi les commandes.
 *
 * Ce qui ne nous concerne pas rend `null` ici et devient « hors sujet » plus
 * bas — pas une erreur. Un remboursement passe par `lib/domain/litiges.ts`, où
 * il laisse une écriture inverse au lieu d'effacer la première.
 */
function sensEtIssue(
  evenement: string,
  statut: string,
): { sens: FaitPaiement["sens"]; issue: FaitPaiement["issue"] } | null {
  if (evenement === "charge.success") {
    return {
      sens: "ENCAISSEMENT",
      issue: statut === "success" ? "REUSSI" : "ECHOUE",
    };
  }
  if (evenement === "charge.failed") {
    return { sens: "ENCAISSEMENT", issue: "ECHOUE" };
  }

  // Les virements. `reversed` n'est pas un échec : l'ordre est bien parti, et
  // l'argent est revenu — souvent parce que le compte n'existe plus. Les deux
  // ne se traitent pas pareil du côté des soldes.
  if (evenement === "transfer.success") {
    return { sens: "VERSEMENT", issue: "REUSSI" };
  }
  if (evenement === "transfer.failed") {
    return { sens: "VERSEMENT", issue: "ECHOUE" };
  }
  if (evenement === "transfer.reversed") {
    return { sens: "VERSEMENT", issue: "RETOURNE" };
  }

  return null;
}

export const PAYSTACK: PiloteEncaissement = {
  nom: "paystack",

  configure() {
    // Le préfixe distingue une vraie clé d'un espace réservé recopié depuis la
    // documentation. `sk_test_` et `sk_live_` sont les deux formes légitimes.
    return /^sk_(test|live)_.{10,}$/.test(cle());
  },

  async ouvrir(demande) {
    if (!DEVISES.has(demande.devise)) {
      return {
        ok: false,
        message: `Paystack ne règle pas en ${demande.devise}.`,
        definitif: true,
      };
    }

    let reponse: Response;
    try {
      reponse = await fetch(`${BASE}/transaction/initialize`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${cle()}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: demande.email,
          amount: versPaystack(demande.montant, demande.devise as Currency),
          currency: demande.devise,
          reference: demande.reference,
          callback_url: demande.retour,
          // `channels` n'est volontairement pas transmis : la page de Paystack
          // présente ce que le compte marchand a activé pour cette devise. Lui
          // imposer « mobile_money » là où il ne l'offre pas donnerait un écran
          // de paiement vide.
          metadata: { baobart_reference: demande.reference },
        }),
      });
    } catch (cause) {
      // Panne réseau : réessayable. L'acheteur peut recommencer dans deux
      // minutes, la fenêtre anti-doublon le laisse passer.
      journal.erreur("Paystack injoignable", {
        reference: demande.reference,
        cause: cause instanceof Error ? cause.message : String(cause),
      });
      return { ok: false, message: "Paystack est injoignable.", definitif: false };
    }

    const lu = (await reponse.json().catch(() => null)) as {
      status?: boolean;
      message?: string;
      data?: { authorization_url?: string; reference?: string };
    } | null;

    if (!reponse.ok || lu?.status !== true || !lu.data?.authorization_url) {
      journal.erreur("Paystack refuse d'ouvrir la transaction", {
        reference: demande.reference,
        code: reponse.status,
        message: lu?.message ?? "",
      });
      return {
        ok: false,
        message: lu?.message ?? "Paystack a refusé la transaction.",
        // Un 4xx vient de nous — clé, devise, montant. Réessayer n'y changera
        // rien. Un 5xx vient de chez eux, et sera peut-être passé dans dix
        // minutes.
        definitif: reponse.status < 500,
      };
    }

    return {
      ok: true,
      redirection: lu.data.authorization_url,
      referenceOperateur: lu.data.reference ?? null,
    };
  },

  authentifier(corpsBrut, entetes) {
    const secret = cle();
    if (secret.length === 0) return false;

    const recue = entetes.get("x-paystack-signature");
    if (!recue) return false;

    // HMAC-SHA512, en hexadécimal, sur les octets reçus, avec la clé secrète
    // elle-même — pas un secret de webhook distinct.
    const attendue = createHmac("sha512", secret)
      .update(corpsBrut, "utf8")
      .digest("hex");

    return signaturesEgales(attendue, recue);
  },

  confirmer(reference) {
    return confirmerAupresDePaystack(reference);
  },

  rembourser(demande) {
    return rembourserChezPaystack(demande);
  },

  // La moitié sortante vit dans son propre fichier : elle a ses trois
  // appels et son cas d'OTP, et les mêler ici rendrait les deux illisibles.
  versements: VERSEMENTS_PAYSTACK,

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
    const donnees =
      typeof o.data === "object" && o.data !== null
        ? (o.data as Record<string, unknown>)
        : null;

    if (!evenement || !donnees) return null;

    const reference =
      typeof donnees.reference === "string" ? donnees.reference : null;
    if (!reference) return null;

    const statut = typeof donnees.status === "string" ? donnees.status : "";
    const decision = sensEtIssue(evenement, statut);

    // Authentique, mais pas notre affaire. Répondre par une erreur ferait
    // rejouer sans fin un événement parfaitement normal.
    if (!decision) return "HORS_SUJET";

    const devise = typeof donnees.currency === "string" ? donnees.currency : null;
    const brutMontant =
      typeof donnees.amount === "number" ? donnees.amount : null;

    return {
      sens: decision.sens,
      issue: decision.issue,
      // Paystack ne donne pas d'identifiant d'événement distinct : c'est
      // l'identifiant de la transaction qui sert de clé. Le nom de l'événement
      // y est joint, sans quoi un succès et un échec sur la même transaction se
      // confondraient — et le second serait pris pour un rejeu du premier.
      evenement: `${evenement}:${String(donnees.id ?? reference)}`,
      reference,
      referenceOperateur:
        typeof donnees.transfer_code === "string"
          ? donnees.transfer_code
          : donnees.id !== undefined
            ? String(donnees.id)
            : null,
      montant:
        brutMontant !== null && devise !== null && DEVISES.has(devise)
          ? depuisPaystack(brutMontant, devise as Currency)
          : null,
      devise,
    };
  },
};

/**
 * Confirme auprès de Paystack ce que le rappel affirme.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI UNE VÉRIFICATION DE PLUS
 *
 * La signature prouve que le message vient de Paystack — tant que la clé n'a
 * pas fui. Cet appel-ci, lui, ne prouve rien de moins : il DEMANDE à Paystack
 * ce qu'il en est, plutôt que de croire ce qu'on lui a envoyé. Une clé
 * dérobée permet de forger un rappel signé ; elle ne permet pas de faire mentir
 * le serveur de Paystack sur une transaction qui n'a jamais eu lieu.
 *
 * C'est la recommandation de Paystack, et elle est bon marché : un appel par
 * vente. On l'utilise avant de créditer, jamais après.
 */
export async function confirmerAupresDePaystack(
  reference: string,
): Promise<{ confirme: boolean; montant: number | null; devise: string | null }> {
  const secret = cle();
  if (secret.length === 0) return { confirme: false, montant: null, devise: null };

  try {
    const reponse = await fetch(
      `${BASE}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { authorization: `Bearer ${secret}` } },
    );

    const lu = (await reponse.json().catch(() => null)) as {
      status?: boolean;
      data?: { status?: string; amount?: number; currency?: string };
    } | null;

    if (!reponse.ok || lu?.status !== true || !lu.data) {
      return { confirme: false, montant: null, devise: null };
    }

    const devise = typeof lu.data.currency === "string" ? lu.data.currency : null;

    return {
      confirme: lu.data.status === "success",
      montant:
        typeof lu.data.amount === "number" && devise !== null && DEVISES.has(devise)
          ? depuisPaystack(lu.data.amount, devise as Currency)
          : null,
      devise,
    };
  } catch (cause) {
    // Injoignable : on ne confirme pas, donc on ne crédite pas. Le rappel sera
    // rejoué par Paystack, et la prochaine tentative aboutira peut-être.
    journal.erreur("Paystack injoignable pour la confirmation", {
      reference,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    return { confirme: false, montant: null, devise: null };
  }
}


/**
 * Demande à Paystack de rendre l'argent.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LE MONTANT SUIT LA MÊME RÈGLE QUE PARTOUT
 *
 * Multiplié par cent, y compris pour le franc CFA. Se tromper ici rembourse
 * cinquante francs au lieu de cinq mille — et personne ne s'en aperçoit avant
 * la réclamation de l'acheteur.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA RÉFÉRENCE EST CELLE DE L'OPÉRATEUR, PAS LA NÔTRE
 *
 * Paystack veut l'identifiant de SA transaction. Lui envoyer notre identifiant
 * de commande ne rembourserait rien : il ne connaît pas nos numéros. C'est la
 * valeur gardée sur `Order.providerRef` au moment du rappel.
 */
export async function rembourserChezPaystack(
  demande: DemandeRemboursement,
): Promise<Remboursement> {
  const secret = cle();
  if (secret.length === 0) {
    return { ok: false, message: "Paystack n'est pas configuré.", definitif: true };
  }

  if (!DEVISES.has(demande.devise)) {
    return {
      ok: false,
      message: `Paystack ne rembourse pas en ${demande.devise}.`,
      definitif: true,
    };
  }

  let reponse: Response;
  try {
    reponse = await fetch(`${BASE}/refund`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        transaction: demande.referenceOperateur,
        amount: versPaystack(demande.montant, demande.devise as Currency),
        currency: demande.devise,
        customer_note: demande.motifClient.slice(0, 200),
        merchant_note: demande.motifInterne.slice(0, 200),
      }),
    });
  } catch (cause) {
    journal.erreur("Paystack injoignable pour le remboursement", {
      transaction: demande.referenceOperateur,
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    return { ok: false, message: "Paystack est injoignable.", definitif: false };
  }

  const lu = (await reponse.json().catch(() => null)) as {
    status?: boolean;
    message?: string;
    data?: { id?: number | string };
  } | null;

  if (!reponse.ok || lu?.status !== true) {
    journal.erreur("Paystack refuse le remboursement", {
      transaction: demande.referenceOperateur,
      code: reponse.status,
      message: lu?.message ?? "",
    });
    return {
      ok: false,
      message: lu?.message ?? "Paystack a refusé le remboursement.",
      // Un 4xx vient de nous — transaction inconnue, montant trop grand. Un
      // 5xx vient de chez eux et sera peut-être passé dans dix minutes.
      definitif: reponse.status < 500,
    };
  }

  return {
    ok: true,
    referenceOperateur: lu.data?.id !== undefined ? String(lu.data.id) : null,
  };
}
