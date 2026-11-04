import "server-only";

import { paiementDeReference } from "@/lib/abonnements/renouvellement";
import { db } from "@/lib/db";
import { encaisseDe } from "@/lib/domain/encaisse";
import { enregistrerLitige, litigeGagne } from "@/lib/domain/litiges";
import { journal } from "@/lib/observabilite/journal";
import type { FaitPaiement } from "@/lib/payments/encaissement/contrat";
import type { Reception } from "@/lib/payments/encaissement/reception";

/**
 * Appliquer une contestation bancaire à la vente qu'elle vise.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POURQUOI CE RACCORD (03/11/2026)
 *
 * Audit du 31/10 (Q2-5) : `lib/domain/litiges.ts` débite le vendeur, suspend
 * ses versements et coupe l'accès de l'acheteur — et rien ne l'appelait. Les
 * pilotes classaient les contestations « hors sujet ». La banque reprenait
 * l'argent ; chez nous, le vendeur gardait son solde et pouvait être versé :
 * la plateforme payait deux fois, sans le savoir.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DÉBITER À L'OUVERTURE, RENDRE SI LE VENDEUR L'EMPORTE
 *
 * On ne sait pas encore, pour Paystack, si l'argent est retenu à l'ouverture
 * ou seulement à la résolution (voir `litigeDepuisPaystack`). On choisit donc
 * le sens qui ne coûte rien à la plateforme : débiter et suspendre dès
 * l'ouverture — c'est ce que `enregistrerLitige` fait déjà —, puis rendre par
 * `litigeGagne` si la contestation est tranchée pour le vendeur. Se tromper
 * dans ce sens retient un solde quelques jours ; se tromper dans l'autre
 * verse un argent qui n'existe plus.
 *
 * Une résolution en faveur de l'acheteur dont l'ouverture n'a jamais été
 * reçue — rappel perdu — est enregistrée à ce moment-là : la vente ne peut
 * pas rester créditée.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUI N'EST PAS TRAITÉ, ET SE SIGNALE
 *
 *   — un renouvellement contesté : il n'y a pas de vendeur à débiter, et le
 *     code ne dit pas encore ce qu'on coupe à l'abonné. Journal, pas d'effet ;
 *   — un remboursement PARTIEL accordé à l'issue : le vendeur a été débité de
 *     l'encaissé entier. Journal, avec le remède ; la différence se rend à la
 *     main tant que le cas n'a jamais été observé.
 */
export async function appliquerLitige(fait: FaitPaiement): Promise<Reception> {
  if (paiementDeReference(fait.reference) !== null) {
    journal.avertissement("contestation sur un renouvellement d'abonnement", {
      reference: fait.reference,
      contestation: fait.referenceOperateur,
      litige: fait.litige ?? null,
      remede: "Aucun vendeur à débiter. Décider à la main de l'accès de l'abonné.",
    });
    return { recu: true, effet: "SANS_EFFET" };
  }

  const commande = await db.order.findUnique({
    where: { id: fait.reference },
    select: { items: { select: { id: true, price: true, quantity: true, tipAmount: true } } },
  });
  const ligne = commande?.items[0];
  if (!ligne) {
    return {
      recu: false,
      motif: "COMMANDE_INTROUVABLE",
      detail: `Contestation sur une référence inconnue : ${fait.reference}.`,
    };
  }

  const ouvrir = async () => {
    const r = await enregistrerLitige({ orderItemId: ligne.id, reference: fait.referenceOperateur ?? undefined });
    if (!r.enregistre && r.motif === "NON_ENCAISSEE") {
      // La banque conteste un paiement que notre grand livre n'a jamais
      // encaissé : c'est notre trace qui manque, pas la sienne.
      journal.erreur("contestation sur une vente jamais encaissée", {
        orderItemId: ligne.id,
        contestation: fait.referenceOperateur,
        remede: "Rapprocher le relevé de l'opérateur : un encaissement a peut-être été perdu.",
      });
    }
    return r.enregistre;
  };

  switch (fait.litige) {
    case "OUVERT":
      return { recu: true, effet: (await ouvrir()) ? "LITIGE_OUVERT" : "SANS_EFFET" };

    case "TRANCHE_VENDEUR": {
      const r = await litigeGagne({ orderItemId: ligne.id });
      if (!r.rendu && r.motif === "PAS_DE_LITIGE") {
        // Gagnée sans avoir été ouverte chez nous : rien n'a été débité,
        // donc rien à rendre. Le rappel d'ouverture s'est perdu.
        journal.avertissement("contestation tranchée pour le vendeur, jamais ouverte ici", {
          orderItemId: ligne.id,
          contestation: fait.referenceOperateur,
        });
      }
      return { recu: true, effet: r.rendu ? "LITIGE_GAGNE" : "SANS_EFFET" };
    }

    case "TRANCHE_ACHETEUR": {
      await ouvrir();
      const encaisse = encaisseDe(ligne);
      if (fait.montant !== null && fait.montant > 0 && fait.montant < encaisse) {
        journal.avertissement("contestation tranchée par un remboursement partiel", {
          orderItemId: ligne.id,
          contestation: fait.referenceOperateur,
          rembourse: fait.montant,
          encaisse,
          remede: "Le vendeur a été débité de l'encaissé entier : lui rendre la différence à la main.",
        });
      }
      return { recu: true, effet: "LITIGE_PERDU" };
    }

    default:
      return { recu: true, effet: "SANS_EFFET" };
  }
}
