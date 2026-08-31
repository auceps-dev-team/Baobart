import "server-only";

import { journal } from "@/lib/observabilite/journal";
import type {
  Beneficiaire,
  Envoi,
  Inscription,
  OrdreVersement,
  PiloteVersement,
} from "@/lib/payments/encaissement/contrat";
import { versPaystack } from "@/lib/payments/encaissement/pilotes/paystack";
import type { Currency } from "@/lib/i18n/money";

/**
 * Envoyer de l'argent chez Paystack.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TROIS APPELS, ET LE PREMIER EST UNE QUESTION
 *
 *   1. **demander le code de l'opérateur.** Paystack désigne chaque réseau
 *      mobile money par un code qui dépend du pays et de la devise. Ces codes
 *      ne sont écrits nulle part dans notre code, et c'est délibéré : les
 *      inventer enverrait l'argent chez le mauvais opérateur, ou nulle part.
 *      On les lui demande, on garde la réponse en mémoire le temps du
 *      processus ;
 *   2. **inscrire le bénéficiaire** — une fois par compte, puis on garde son
 *      code. Le recréer à chaque versement multiplierait les doublons chez
 *      l'opérateur et rendrait illisible un virement contesté ;
 *   3. **ordonner le virement.**
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QUI PEUT RENDRE TOUT CECI INOPÉRANT
 *
 * Paystack peut exiger un code à usage unique, envoyé au propriétaire du
 * compte, pour **chaque** virement. Tant que ce réglage est actif, aucun
 * versement automatique n'est possible et aucune quantité de code n'y changera
 * rien : il se désactive sur leur tableau de bord. On distingue donc ce cas
 * d'un échec ordinaire — le remède n'est pas de réessayer, c'est de changer un
 * réglage.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QUI N'A PAS PU ÊTRE VÉRIFIÉ
 *
 * Rien de tout ceci n'a été exercé contre le vrai service. La correspondance
 * entre nos rails (« om », « wave », « mtn », « moov ») et les noms que
 * Paystack donne à ses opérateurs est faite par rapprochement de chaînes, et
 * c'est le point le plus fragile : le premier virement réel doit être vérifié
 * bénéficiaire par bénéficiaire.
 */

const BASE = "https://api.paystack.co";

function cle(): string {
  return (process.env.PAYSTACK_SECRET_KEY ?? "").trim();
}

/**
 * Ce que Paystack peut appeler chacun de nos rails.
 *
 * Ce ne sont **pas** des codes : ce sont des mots qu'on cherche dans le nom que
 * Paystack donne à ses opérateurs. Le code, lui, vient de chez eux.
 */
const NOMS_PROBABLES: Record<string, readonly string[]> = {
  om: ["orange"],
  mtn: ["mtn"],
  moov: ["moov"],
  wave: ["wave"],
};

interface Etablissement {
  name: string;
  code: string;
  type?: string;
}

/**
 * Le catalogue des opérateurs, demandé à Paystack.
 *
 * Gardé en mémoire le temps du processus : la liste ne change pas d'une heure à
 * l'autre, et la redemander à chaque versement ajouterait un aller-retour par
 * créateur au passage du matin.
 */
const catalogue = new Map<string, Etablissement[]>();

async function etablissements(devise: string): Promise<Etablissement[]> {
  const connu = catalogue.get(devise);
  if (connu) return connu;

  const reponse = await fetch(
    `${BASE}/bank?currency=${encodeURIComponent(devise)}&type=mobile_money`,
    { headers: { authorization: `Bearer ${cle()}` } },
  );

  const lu = (await reponse.json().catch(() => null)) as {
    status?: boolean;
    data?: Etablissement[];
  } | null;

  if (!reponse.ok || lu?.status !== true || !Array.isArray(lu.data)) {
    // On ne met pas en cache un échec : la prochaine tentative doit redemander.
    return [];
  }

  catalogue.set(devise, lu.data);
  return lu.data;
}

/** Vidé par les tests, et le jour où un opérateur change de nom. */
export function oublierCatalogue(): void {
  catalogue.clear();
}

/**
 * Traduit notre rail en code d'opérateur, d'après ce que Paystack déclare.
 *
 * Rend `null` plutôt que de deviner. Un code approximatif enverrait de l'argent
 * chez quelqu'un d'autre — c'est la seule erreur de ce module qui ne se
 * rattrape pas.
 */
export function codePour(
  rail: string,
  liste: readonly Etablissement[],
): string | null {
  const mots = NOMS_PROBABLES[rail];
  if (!mots) return null;

  const trouve = liste.find((e) =>
    mots.some((mot) => e.name.toLowerCase().includes(mot)),
  );

  return trouve?.code ?? null;
}

export const VERSEMENTS_PAYSTACK: PiloteVersement = {
  async inscrire(beneficiaire: Beneficiaire): Promise<Inscription> {
    if (cle().length === 0) {
      return {
        ok: false,
        message: "Paystack n'est pas configuré.",
        definitif: true,
      };
    }

    let code: string | null = null;

    if (beneficiaire.moyen !== "bank") {
      const liste = await etablissements(beneficiaire.devise);
      code = codePour(beneficiaire.moyen, liste);

      if (!code) {
        // Refus franc. Deviner enverrait l'argent chez le mauvais opérateur.
        return {
          ok: false,
          message: `Paystack ne déclare aucun opérateur « ${beneficiaire.moyen} » en ${beneficiaire.devise}.`,
          definitif: true,
        };
      }
    }

    const reponse = await fetch(`${BASE}/transferrecipient`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${cle()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: beneficiaire.moyen === "bank" ? "nuban" : "mobile_money",
        name: beneficiaire.nom,
        account_number: beneficiaire.compte,
        bank_code: code,
        currency: beneficiaire.devise,
      }),
    });

    const lu = (await reponse.json().catch(() => null)) as {
      status?: boolean;
      message?: string;
      data?: { recipient_code?: string };
    } | null;

    if (!reponse.ok || lu?.status !== true || !lu.data?.recipient_code) {
      journal.erreur("Paystack refuse le bénéficiaire", {
        code: reponse.status,
        message: lu?.message ?? "",
      });
      return {
        ok: false,
        message: lu?.message ?? "Paystack a refusé le bénéficiaire.",
        definitif: reponse.status < 500,
      };
    }

    return { ok: true, reference: lu.data.recipient_code };
  },

  async ordonner(ordre: OrdreVersement): Promise<Envoi> {
    if (cle().length === 0) {
      return {
        ok: false,
        message: "Paystack n'est pas configuré.",
        definitif: true,
      };
    }

    const reponse = await fetch(`${BASE}/transfer`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${cle()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        // L'argent sort du solde Paystack : il faut donc avoir encaissé avant
        // de verser. Un solde insuffisant est un refus, pas une panne.
        source: "balance",
        amount: versPaystack(ordre.montant, ordre.devise as Currency),
        currency: ordre.devise,
        recipient: ordre.beneficiaire,
        reference: ordre.reference,
        reason: ordre.motif.slice(0, 100),
      }),
    });

    const lu = (await reponse.json().catch(() => null)) as {
      status?: boolean;
      message?: string;
      data?: { transfer_code?: string; status?: string };
    } | null;

    // Le cas qui n'est pas une panne : un humain doit taper un code.
    if (lu?.data?.status === "otp") {
      journal.erreur("Paystack exige un code à usage unique par virement", {
        versement: ordre.reference,
        remede:
          "Désactiver l'OTP sur les transferts depuis le tableau de bord Paystack. Aucun versement automatique n'est possible tant qu'il est actif.",
      });
      return {
        ok: false,
        otpRequis: true,
        definitif: true,
        message:
          "Paystack exige un code à usage unique pour chaque virement. À désactiver sur leur tableau de bord.",
      };
    }

    if (!reponse.ok || lu?.status !== true || !lu.data?.transfer_code) {
      journal.erreur("Paystack refuse le virement", {
        versement: ordre.reference,
        code: reponse.status,
        message: lu?.message ?? "",
      });
      return {
        ok: false,
        message: lu?.message ?? "Paystack a refusé le virement.",
        definitif: reponse.status < 500,
      };
    }

    return { ok: true, referenceOperateur: lu.data.transfer_code };
  },
};
