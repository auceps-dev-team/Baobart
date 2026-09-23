import "server-only";

import { urlDuSite } from "@/lib/config/site";
import { db } from "@/lib/db";
import { encaisserLigne } from "@/lib/domain/orders";
import { notifier } from "@/lib/notifications/aiguilleur";
import { formatMoney } from "@/lib/i18n/money";
import { journal } from "@/lib/observabilite/journal";
import { libererLeCode } from "@/lib/commerce/codes-promo";
import { noterConversion } from "@/lib/commerce/relance-paiement";

/**
 * Ce qui se passe au moment où l'argent est vraiment arrivé.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DEUX CHEMINS, UNE SEULE FIN
 *
 * Une vente aboutit soit par la simulation de développement, soit par le
 * rappel d'un opérateur de paiement. Ce qui doit alors se produire est
 * identique : créditer le vendeur, clore la commande, envoyer le reçu. Écrire
 * cette suite deux fois garantissait qu'un jour l'une des deux oublierait le
 * reçu — ou pire, le solde.
 *
 * LE REÇU PART ICI, PAS À LA CRÉATION. Un reçu dit « tu as payé ». L'émettre
 * quand la commande s'ouvre le rendrait faux pour tous ceux qui abandonnent au
 * moment de taper leur code — c'est-à-dire beaucoup de monde en mobile money.
 */

/**
 * Crédite, clôt, et dépose le reçu.
 *
 * `encaisserLigne` porte déjà sa garde anti double-encaissement dans le `WHERE`
 * de son écriture : deux rappels concurrents peuvent tous deux lire
 * `IN_PROGRESS`, un seul obtiendra la transition. L'autre repart en erreur, et
 * c'est le signal que l'appelant traduit en « rejeu, rien à faire ».
 */
export async function finaliserVente(orderItemId: string): Promise<void> {
  await encaisserLigne({ orderItemId, regime: "DIRECT" });

  const ligne = await db.orderItem.findUniqueOrThrow({
    where: { id: orderItemId },
    select: {
      price: true,
      quantity: true,
      orderId: true,
      product: { select: { name: true, currency: true, sellerId: true } },
      order: {
        select: {
          buyer: {
            // `id` en plus de l'adresse : l'aiguilleur lit le compte pour
            // écrire dans sa cloche, et il ne prend pas une adresse en
            // paramètre — la recevoir permettrait d'envoyer le reçu de
            // quelqu'un à l'adresse d'un autre.
            select: { id: true, email: true, profile: { select: { displayName: true } } },
          },
        },
      },
    },
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SI CETTE COMMANDE AVAIT ÉTÉ RELANCÉE, ON LE NOTE
  //
  // C'est la seule façon de savoir si la relance sert à quelque chose. Sans
  // cette mesure, on continuerait d'écrire à des gens qui ont renoncé, sans
  // jamais pouvoir dire si ça convertit — et une relance qui ne convertit pas
  // coûte de la délivrabilité pour rien.
  //
  // Hors transaction, et sans `await` bloquant le reçu : une commande qui
  // aboutit ne doit pas échouer parce qu'un compteur de campagne n'a pas pu
  // s'écrire.
  await noterConversion(ligne.orderId);

  const base = urlDuSite();
  const acheteur = ligne.order.buyer;

  // Le reçu et la clôture, ensemble. Si le dépôt échoue, la commande reste
  // ouverte alors que l'argent est crédité — un écart visible à l'écran
  // Système, donc réparable. L'inverse — commande close, reçu perdu — ne se
  // voit nulle part.
  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: ligne.orderId },
      data: { status: "COMPLETED" },
    });

    // ════════════════════════════════════════════════════════════════════════
    // PAR L'AIGUILLEUR, ET TOUJOURS DANS LA TRANSACTION
    //
    // C'était un `deposer` direct : le reçu partait par courriel, et rien n'en
    // restait dans l'application. Un acheteur qui relève sa boîte rarement
    // n'avait aucune trace de ce qu'il venait de payer.
    //
    // Le `tx` est passé tel quel, et c'est ce qui ne doit pas se perdre :
    // l'avis s'écrit dans la MÊME transaction que la clôture de la commande.
    // Le raisonnement du bloc ci-dessus vaut pour les deux canaux — commande
    // close et reçu perdu ne se voit nulle part.
    await notifier(
      {
        destinataireId: acheteur.id,
        evenement: "ACHAT_CONFIRME",
        // La même clé quel que soit le chemin : un rejeu ne peut pas produire
        // un second reçu, même s'il vient d'un autre événement.
        cle: `recu-${orderItemId}`,
        titre: `Achat confirmé — ${ligne.product.name}`,
        corps: `${formatMoney(ligne.price * ligne.quantity, ligne.product.currency)} payés. Tu retrouves ta ressource dans tes achats.`,
        lien: "/dashboard/achats",
        charge: {
          nom: acheteur.profile?.displayName ?? acheteur.email,
          ressource: ligne.product.name,
          montant: formatMoney(
            ligne.price * ligne.quantity,
            ligne.product.currency,
          ),
          // Vers l'espace gardé, pas vers le fichier : la route de retrait
          // revérifie tout à chaque clic (remboursement, litige, accès retiré,
          // quota). Une URL signée dans un courriel ne revérifie plus rien.
          //
          // Et vers les ACHATS, pas les téléchargements. L'écran des
          // téléchargements liste ce qui a déjà été retiré : juste après un
          // achat, il est vide. Le reçu y menait, et l'acheteur y trouvait une
          // page qui semblait dire qu'il n'avait rien acheté.
          lien: base ? `${base}/dashboard/achats` : undefined,
        },
      },
      tx,
    );

    // ════════════════════════════════════════════════════════════════════════
    // ET LE VENDEUR, QUI N'ÉTAIT PRÉVENU DE RIEN
    //
    // C'est le manque le plus visible du système avant v1.52.2 : une vente ne
    // se savait qu'en ouvrant son tableau de bord. Chez notre référent, c'est
    // même la notification emblématique — la sonnerie de vente pousse sur son
    // application mobile.
    //
    // Le montant annoncé est le BRUT de la ligne, et c'est délibéré : c'est le
    // prix que l'acheteur a payé, donc celui qui figure sur la fiche. Le net
    // dépend des frais et du régime, et il apparaît sur l'écran des gains. Les
    // confondre dans une notification ferait croire à une erreur de calcul à
    // qui comparerait les deux.
    //
    // Dans la même transaction que le reste : un vendeur prévenu d'une vente
    // qui n'a finalement pas été encaissée est pire qu'un vendeur non prévenu.
    //
    // Pas d'avis quand on achète sa propre ressource — le cas est déjà refusé
    // à l'achat, mais la garde ne coûte rien et dit l'intention.
    if (ligne.product.sellerId !== acheteur.id) {
      await notifier(
        {
          destinataireId: ligne.product.sellerId,
          evenement: "VENTE_REALISEE",
          cle: `vente-${orderItemId}`,
          titre: `Vente — ${ligne.product.name}`,
          corps: `${formatMoney(ligne.price * ligne.quantity, ligne.product.currency)} encaissés. Le net après frais apparaît dans tes gains.`,
          lien: "/dashboard/ventes",
          charge: {
            ressource: ligne.product.name,
            montant: formatMoney(
              ligne.price * ligne.quantity,
              ligne.product.currency,
            ),
          },
        },
        tx,
      );
    }
  });
}

/**
 * L'acheteur n'a pas payé : on referme sans rien créditer.
 *
 * La commande n'est pas supprimée. Une tentative abandonnée est une
 * information — c'est elle qui dit qu'un moyen de paiement échoue trop souvent,
 * et c'est elle qu'on montre à l'opérateur quand on le lui reproche.
 */
export async function abandonnerVente(orderItemId: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    // La condition est dans le `WHERE` : une ligne déjà encaissée ne doit pas
    // pouvoir être renversée par un rappel tardif annonçant un échec.
    const transition = await tx.orderItem.updateMany({
      where: { id: orderItemId, state: "IN_PROGRESS" },
      data: { state: "FAILED" },
    });

    if (transition.count !== 1) return false;

    const ligne = await tx.orderItem.findUniqueOrThrow({
      where: { id: orderItemId },
      select: { orderId: true, offerCodeId: true },
    });

    // ══════════════════════════════════════════════════════════════════════
    // LE CODE PROMO EST RENDU ICI, ET NULLE PART AILLEURS
    //
    // Il a été consommé à l'ouverture de la commande — le seul instant où
    // l'on peut réserver un exemplaire contre la concurrence. Mais ouvrir
    // n'est pas payer : en mobile money, l'invite part sur un téléphone qui
    // reste souvent sans réponse.
    //
    // Sans cette libération, dix hésitations épuisent un code à dix usages.
    // Le vendeur annonce dix remises, personne n'en reçoit, et le compteur
    // affiche fidèlement « 10 / 10 ».
    //
    // Cette fonction est le passage obligé des deux chemins d'échec — le
    // refus de l'opérateur et la péremption à vingt-quatre heures — et sa
    // transition d'état ne réussit qu'une fois. La libération est donc
    // exactement aussi idempotente que l'abandon lui-même.
    if (ligne.offerCodeId) {
      await libererLeCode(ligne.offerCodeId, tx);
    }

    // La raison de l'échec n'est PAS recopiée ici : `providerRef` porte la
    // référence de la transaction chez l'opérateur, et c'est par elle qu'on
    // retrouve la commande. Y écrire autre chose casserait la recherche. Le
    // motif vit sur l'événement reçu, qui est fait pour ça.
    await tx.order.update({
      where: { id: ligne.orderId },
      data: { status: "ABANDONED" },
    });

    return true;
  });
}

/**
 * Au-delà, une commande ouverte n'attend plus personne.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI VINGT-QUATRE HEURES, ET PAS QUINZE MINUTES
 *
 * Gumroad borne son intention de paiement à quinze minutes
 * (`TIME_TO_COMPLETE_SCA`) — c'est la fenêtre de l'authentification forte
 * européenne, où l'acheteur a une application bancaire sous les yeux.
 *
 * Le mobile money n'a pas ce rythme. L'invite part sur un téléphone qui peut
 * être hors réseau, en charge, ou dans une autre pièce ; les opérateurs
 * rappellent parfois avec des heures de retard après un incident chez eux.
 * Fermer à quinze minutes fabriquerait le pire cas possible : un acheteur qui
 * a payé, et une commande qu'on a refermée avant de le savoir.
 *
 * Vingt-quatre heures passent largement au-delà de tout rappel plausible. Ce
 * n'est donc pas une fenêtre d'autorisation, c'est du ménage : sans lui, une
 * tentative abandonnée reste ouverte à jamais et le compteur « commandes
 * bloquées » de l'écran de supervision ne redescend plus — il finit par ne
 * plus rien signaler du tout.
 */
export const PEREMPTION_MS = 24 * 3_600_000;

/**
 * Referme les commandes qu'aucun rappel n'est venu conclure.
 *
 * Ne rend aucun argent et n'en crédite aucun : ces commandes n'ont jamais rien
 * encaissé. La ligne reste en base — une tentative abandonnée est une
 * information, c'est elle qui dit qu'un moyen de paiement échoue trop souvent.
 */
export async function perimerCommandesOubliees(
  maintenant: Date = new Date(),
): Promise<number> {
  const limite = new Date(maintenant.getTime() - PEREMPTION_MS);

  const oubliees = await db.orderItem.findMany({
    where: {
      state: "IN_PROGRESS",
      order: { status: "IN_PROGRESS", createdAt: { lt: limite } },
    },
    select: { id: true },
    // Un plafond par passage : si dix mille commandes traînent, mieux vaut
    // dix passages qu'une transaction qui tient la base une minute.
    take: 500,
  });

  let fermees = 0;
  for (const ligne of oubliees) {
    // Une par une, et chacune sous sa propre garde : une commande conclue
    // entre la lecture et l'écriture ne doit pas être refermée.
    if (await abandonnerVente(ligne.id)) fermees += 1;
  }

  if (fermees > 0) {
    journal.info("commandes oubliées refermées", { fermees });
  }

  return fermees;
}
