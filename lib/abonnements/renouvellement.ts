import "server-only";

import { urlDuSite } from "@/lib/config/site";
import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";
import { encaissementPossible, simulationOuverte } from "@/lib/checkout/achat";
import { piloteCourant } from "@/lib/payments/encaissement/pilotes";
import { finaliserRenouvellement } from "@/lib/abonnements/reglement";

/**
 * Payer un renouvellement d'abonnement.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE N'EST PAS UN ACHAT, ET ÇA NE PEUT PAS EN ÊTRE UN
 *
 * `lib/checkout/achat.ts` inscrit une commande, une ligne, un produit, une
 * licence, et son règlement crédite le solde d'un **vendeur**.
 *
 * Un abonnement n'a ni produit ni vendeur : l'argent est celui de la
 * plateforme. Le faire passer par une commande obligerait à inventer les deux,
 * et `finaliserVente` créditerait ce vendeur inventé — on fabriquerait une
 * dette de versement envers quelqu'un à qui l'on ne doit rien, invisible
 * jusqu'au jour du virement.
 *
 * D'où une table à part, et ce fichier.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUI EST IDENTIQUE, EN REVANCHE
 *
 * Les deux moitiés du mobile money : on **ouvre** chez l'opérateur, et on
 * s'arrête là. Rien n'est avancé, le cycle ne bouge pas, aucun reçu ne part.
 * C'est le rappel authentifié qui décide — le retour du navigateur dit où
 * l'abonné a atterri, pas si l'argent est arrivé.
 */

/**
 * Le préfixe qui distingue nos références.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * L'OPÉRATEUR NE SAIT PAS CE QU'IL ENCAISSE
 *
 * Un renouvellement et un achat arrivent tous deux en `charge.success` : rien
 * dans le rappel ne les sépare. Le seul discriminant possible est **notre**
 * référence, celle qu'on a envoyée à l'ouverture.
 *
 * Les commandes envoient un cuid nu, qui ne contient jamais de tiret. Un
 * renouvellement envoie `abo-<id>`. La réception tranche là-dessus, et
 * l'ambiguïté est impossible plutôt qu'improbable.
 *
 * Le tiret est accepté par Paystack comme par Flutterwave dans une référence.
 */
export const PREFIXE = "abo-";

export function referenceDe(paiementId: string): string {
  return `${PREFIXE}${paiementId}`;
}

/** L'identifiant du paiement, ou `null` si la référence n'est pas la nôtre. */
export function paiementDeReference(reference: string): string | null {
  if (!reference.startsWith(PREFIXE)) return null;
  const id = reference.slice(PREFIXE.length);
  return id.length > 0 ? id : null;
}

export type MotifRefus =
  | "INTROUVABLE"
  /** L'abonnement est clos : on n'en reprend pas un, on en commence un neuf. */
  | "CLOS"
  /** Un paiement vient d'être ouvert pour cet abonnement. */
  | "EN_COURS"
  /** Un forfait gratuit : il n'y a rien à payer, son cycle avance seul. */
  | "GRATUIT"
  | "PAIEMENT_INDISPONIBLE";

export const MESSAGES: Record<MotifRefus, string> = {
  INTROUVABLE: "Cet abonnement n'existe pas.",
  CLOS: "Cet abonnement est clos. Tu peux en reprendre un nouveau.",
  GRATUIT: "Ce forfait est gratuit : il n'y a rien à payer.",
  EN_COURS: "Un paiement est déjà en cours pour cet abonnement.",
  PAIEMENT_INDISPONIBLE:
    "Le paiement n'est pas encore disponible. Reviens bientôt.",
};

export type Resultat =
  | {
      ok: true;
      paiementId: string;
      /** Vrai en simulation seulement : le cycle est déjà avancé. */
      paye: boolean;
      redirection?: string;
    }
  | { ok: false; motif: MotifRefus };

/**
 * Un paiement ouvert il y a moins de deux minutes bloque le suivant.
 *
 * Même raison qu'à l'achat : c'est la protection contre le double clic.
 * Au-delà, une tentative restée `PENDING` est un abandon, et la bloquer
 * indéfiniment empêcherait l'abonné de réessayer après un échec — au moment
 * précis où son accès va être coupé.
 */
const FENETRE_DOUBLON_MS = 2 * 60_000;

/**
 * Le bouton peut-il exister ?
 *
 * Même règle que la fiche produit : un bouton qui apparaît là où l'action
 * refuse promet un écran qui n'ouvre sur rien. `APP_URL` en fait partie — sans
 * elle, l'opérateur n'a nulle part où renvoyer l'abonné.
 */
export function renouvellementPossible(): boolean {
  return encaissementPossible();
}

export async function ouvrirRenouvellement(input: {
  abonnementId: string;
  abonneId: string;
  moyen?: string;
}): Promise<Resultat> {
  const simulation = simulationOuverte();
  const pilote = simulation ? null : piloteCourant();

  if (!simulation && (pilote === null || pilote.nom === "aucun")) {
    return { ok: false, motif: "PAIEMENT_INDISPONIBLE" };
  }

  const base = simulation ? null : urlDuSite();
  if (!simulation && !base) {
    journal.erreur("renouvellement impossible : APP_URL absente", {
      abonnement: input.abonnementId,
    });
    return { ok: false, motif: "PAIEMENT_INDISPONIBLE" };
  }

  const abonnement = await db.subscription.findUnique({
    where: { id: input.abonnementId },
    select: {
      id: true,
      userId: true,
      status: true,
      cycleEnd: true,
      plan: { select: { priceMonthly: true } },
    },
  });

  // 404 et non « accès refusé » : dire qu'un abonnement existe mais n'est pas
  // le tien, c'est déjà en dire trop.
  if (!abonnement || abonnement.userId !== input.abonneId) {
    return { ok: false, motif: "INTROUVABLE" };
  }

  // ── Qui a le droit de payer ────────────────────────────────────────────────
  //
  // ACTIVE et EXPIRED, évidemment. Mais aussi PENDING_CANCELLATION : cet
  // abonné a demandé l'arrêt, et Ndank continue pourtant à le relancer tant
  // qu'il lui reste de l'accès. Lui refuser le paiement que nos propres
  // rappels l'invitent à faire serait incohérent — payer est un changement
  // d'avis sans ambiguïté, et il annule la résiliation.
  //
  // CANCELLED, non : l'abonnement est clos, il se recommence.
  if (abonnement.status === "CANCELLED") {
    return { ok: false, motif: "CLOS" };
  }

  // Ouvrir un paiement de 0 F enverrait l'abonné valider sur son téléphone
  // un débit qui n'existe pas.
  if (abonnement.plan.priceMonthly === 0) {
    return { ok: false, motif: "GRATUIT" };
  }

  const recent = await db.subscriptionPayment.findFirst({
    where: {
      subscriptionId: abonnement.id,
      status: "PENDING",
      createdAt: { gte: new Date(Date.now() - FENETRE_DOUBLON_MS) },
    },
    select: { id: true },
  });

  if (recent) return { ok: false, motif: "EN_COURS" };

  const fournisseur = simulation ? "simulation" : pilote!.nom;

  const paiement = await db.subscriptionPayment.create({
    data: {
      subscriptionId: abonnement.id,
      // Le montant est **figé** ici. Le relire sur le plan au moment du rappel
      // ferait varier un paiement déjà autorisé si le tarif change entre-temps.
      amount: abonnement.plan.priceMonthly,
      currency: "XOF",
      provider: fournisseur,
      cycleEnd: abonnement.cycleEnd,
    },
    select: { id: true, amount: true, currency: true },
  });

  if (simulation) {
    // Le règlement ouvre sa propre transaction : il ne peut pas être imbriqué.
    // S'il échoue, le paiement reste PENDING et le cycle n'a pas bougé — le
    // bon état pour un paiement qui n'a pas abouti.
    await finaliserRenouvellement(paiement.id);

    journal.avertissement("renouvellement simulé — aucun paiement réel", {
      abonnement: abonnement.id,
      paiement: paiement.id,
    });

    return { ok: true, paiementId: paiement.id, paye: true };
  }

  // L'adresse de l'abonné est relue depuis la base, jamais reçue en paramètre :
  // la laisser venir de l'appelant permettrait d'ouvrir un paiement au nom
  // d'autrui.
  const abonne = await db.user.findUniqueOrThrow({
    where: { id: abonnement.userId },
    select: { email: true, profile: { select: { displayName: true } } },
  });

  const ouverture = await pilote!.ouvrir({
    reference: referenceDe(paiement.id),
    montant: paiement.amount,
    devise: paiement.currency,
    moyen: input.moyen ?? "om",
    retour: `${base}/abonnement/${abonnement.id}/paiement/${paiement.id}`,
    email: abonne.email,
    nom: abonne.profile?.displayName ?? undefined,
  });

  if (!ouverture.ok) {
    // On marque l'échec tout de suite : laisser la ligne PENDING la ferait
    // bloquer la tentative suivante pendant deux minutes, alors que rien n'a
    // jamais été proposé à l'abonné.
    await db.subscriptionPayment.update({
      where: { id: paiement.id },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        failureReason: `Ouverture refusée par l'opérateur : ${ouverture.message}`,
      },
    });

    journal.erreur("ouverture de renouvellement refusée par l'opérateur", {
      abonnement: abonnement.id,
      paiement: paiement.id,
      operateur: pilote!.nom,
      message: ouverture.message,
    });

    return { ok: false, motif: "PAIEMENT_INDISPONIBLE" };
  }

  if (ouverture.referenceOperateur) {
    await db.subscriptionPayment.update({
      where: { id: paiement.id },
      data: { providerRef: ouverture.referenceOperateur },
    });
  }

  return {
    ok: true,
    paiementId: paiement.id,
    paye: false,
    redirection: ouverture.redirection,
  };
}
