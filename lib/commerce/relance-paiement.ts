import "server-only";

import { urlDuSite } from "@/lib/config/site";
import { db } from "@/lib/db";
import { deposer } from "@/lib/email/outbox";
import { formatMoney } from "@/lib/i18n/money";
import { journal } from "@/lib/observabilite/journal";
import { PEREMPTION_MS } from "@/lib/payments/encaissement/reglement";

/**
 * Relance des paiements laissés en plan — §3.4-B, « panier abandonné ».
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE PANIER N'EXISTE PAS SUR CETTE PLATEFORME
 *
 * C'est la première chose à dire, parce que la ligne de la matrice s'appelle
 * « panier abandonné » et que le schéma portait un `SentAbandonedCartEmail`.
 *
 * `Cart` n'est écrit nulle part — vérifié par recherche dans `lib/` et
 * `app/`, et la table était vide. Elle ne pouvait pas l'être autrement : on
 * achète une ressource à la fois depuis sa fiche, il n'y a pas d'étape
 * « panier » à abandonner.
 *
 * Construire la relance sur `Cart` aurait produit un module correct, testé, et
 * qui ne se déclenche jamais. C'est la pire forme de livraison : la ligne
 * passe au vert dans la matrice et rien ne part.
 *
 * Ce qui s'abandonne réellement ici est un **paiement mobile money ouvert** :
 * l'invite part sur un téléphone, et l'acheteur ne la confirme jamais. Le
 * commentaire de `PEREMPTION_MS` le dit déjà — « un téléphone qui peut être
 * hors réseau, en charge, ou dans une autre pièce ».
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX HEURES APRÈS, ET PAS AVANT
 *
 * Trop tôt, on écrit à quelqu'un qui est en train de taper son code. Trop
 * tard, la commande a expiré et le lien de reprise ne mène plus à rien.
 *
 * Deux heures laissent largement le temps d'un rappel d'opérateur en retard —
 * c'est le motif même pour lequel la péremption est à vingt-quatre heures — et
 * laissent vingt-deux heures pour revenir.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE SEULE RELANCE, ET LA BASE LE GARANTIT
 *
 * `RelancePaiement.orderId` est unique. Deux passages qui se chevauchent ne
 * peuvent pas écrire deux fois : la seconde insertion échoue sur la
 * contrainte. Le garde-fou est dans la base, pas dans un `if` — parce qu'un
 * `if` entre deux passages simultanés ne garde rien.
 */

/** Deux heures. Voir l'en-tête. */
export const DELAI_RELANCE_MS = 2 * 3_600_000;

export interface BilanRelance {
  /** Combien de relances déposées dans la file de courriels. */
  envoyees: number;
  /** Combien de commandes examinées puis écartées, et pourquoi. */
  ecartees: {
    dejaRelancee: number;
    dejaAcquise: number;
    sansAdresse: number;
  };
}

/**
 * Dépose une relance pour chaque paiement laissé en plan.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ON VÉRIFIE QUE LA RESSOURCE N'A PAS ÉTÉ ACQUISE ENTRE-TEMPS
 *
 * `state: IN_PROGRESS` ne suffit pas. Entre la tentative abandonnée et ce
 * passage, l'acheteur a pu recommencer et réussir : il existe alors une
 * **seconde** commande, aboutie, et la première reste ouverte jusqu'à sa
 * péremption.
 *
 * Sans ce contrôle, on écrirait « ton achat attend encore » à quelqu'un qui a
 * déjà payé et téléchargé. C'est le genre de message qui fait douter de la
 * plateforme au moment précis où l'on venait de la convaincre.
 */
export async function relancerLesPaiementsOublies(
  maintenant: Date = new Date(),
): Promise<BilanRelance> {
  const base = urlDuSite();

  if (!base) {
    // Une relance sans lien ne sert à rien — contrairement à un reçu, qui
    // vaut preuve de paiement même sans URL. Mieux vaut ne rien envoyer.
    journal.erreur("relance de paiement impossible : APP_URL absente", {});
    return { envoyees: 0, ecartees: { dejaRelancee: 0, dejaAcquise: 0, sansAdresse: 0 } };
  }

  const debut = new Date(maintenant.getTime() - PEREMPTION_MS);
  const fin = new Date(maintenant.getTime() - DELAI_RELANCE_MS);

  const candidates = await db.orderItem.findMany({
    where: {
      state: "IN_PROGRESS",
      order: {
        status: "IN_PROGRESS",
        // Entre la péremption et le délai de relance : plus vieux que deux
        // heures, plus jeune que vingt-quatre. Une commande déjà périmée n'a
        // plus de lien de reprise à offrir.
        createdAt: { gt: debut, lt: fin },
      },
    },
    select: {
      id: true,
      price: true,
      quantity: true,
      order: {
        select: {
          id: true,
          currency: true,
          buyerId: true,
          createdAt: true,
          buyer: {
            select: {
              email: true,
              profile: { select: { displayName: true } },
            },
          },
        },
      },
      product: { select: { id: true, name: true, slug: true } },
    },
    take: 200,
  });

  const bilan: BilanRelance = {
    envoyees: 0,
    ecartees: { dejaRelancee: 0, dejaAcquise: 0, sansAdresse: 0 },
  };

  for (const ligne of candidates) {
    const deja = await db.relancePaiement.findUnique({
      where: { orderId: ligne.order.id },
      select: { id: true },
    });
    if (deja) {
      bilan.ecartees.dejaRelancee += 1;
      continue;
    }

    // La ressource a-t-elle été acquise depuis, par une autre commande ?
    const acquise = await db.orderItem.count({
      where: {
        productId: ligne.product.id,
        order: { buyerId: ligne.order.buyerId },
        state: { in: ["SUCCESSFUL", "NOT_CHARGED"] },
        accessRevokedAt: null,
      },
    });
    if (acquise > 0) {
      bilan.ecartees.dejaAcquise += 1;
      continue;
    }

    if (!ligne.order.buyer.email) {
      bilan.ecartees.sansAdresse += 1;
      continue;
    }

    // ══════════════════════════════════════════════════════════════════════
    // LES HEURES RESTANTES S'ARRONDISSENT VERS LE BAS
    //
    // La commande se referme à `createdAt + PEREMPTION_MS`. Annoncer « il te
    // reste 3 heures » quand il en reste 3,8 est honnête — on tient parole.
    // Annoncer « 4 » quand il en reste 3,2 ferait revenir quelqu'un devant
    // une commande déjà fermée, avec un message de nous à l'appui.
    //
    // Le plancher à 1 : la sélection garantit qu'il reste au moins deux
    // heures, mais un passage très lent pourrait franchir la limite entre la
    // lecture et l'envoi. « Une heure » reste vrai plus longtemps que « zéro ».
    const finLe = ligne.order.createdAt.getTime() + PEREMPTION_MS;
    const restantes = Math.max(
      1,
      Math.floor((finLe - maintenant.getTime()) / 3_600_000),
    );

    const suite = await deposer({
      // Une clé par commande : même rejouée, la file ne portera qu'un
      // message. C'est la seconde garde, après la contrainte d'unicité.
      cle: `relance-paiement-${ligne.order.id}`,
      destinataire: ligne.order.buyer.email,
      modele: "PAIEMENT_ABANDONNE",
      charge: {
        nom: ligne.order.buyer.profile?.displayName ?? "toi",
        ressource: ligne.product.name,
        montant: formatMoney(ligne.price * ligne.quantity, ligne.order.currency),
        lien: `${base}/acheter/${ligne.product.slug}`,
        heures: restantes,
      },
    });

    if (!suite.depose) {
      journal.erreur("relance de paiement refusée au dépôt", {
        orderId: ligne.order.id,
        motif: suite.motif,
      });
      continue;
    }

    // Écrit APRÈS le dépôt : noter la relance avant l'envoi empêcherait
    // définitivement de réessayer si le dépôt échouait.
    try {
      await db.relancePaiement.create({ data: { orderId: ligne.order.id } });
      bilan.envoyees += 1;
    } catch {
      // Un autre passage a écrit entre-temps. Le message, lui, ne partira
      // qu'une fois : la clé d'idempotence de la file s'en charge.
      bilan.ecartees.dejaRelancee += 1;
    }
  }

  if (bilan.envoyees > 0) {
    journal.info("paiements relancés", { envoyees: bilan.envoyees });
  }

  return bilan;
}

/**
 * Note qu'une commande relancée a fini par aboutir.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * MESURÉ, PAS SUPPOSÉ
 *
 * C'est la seule façon de savoir si la relance sert à quelque chose. Sans
 * cette colonne, on continuerait d'envoyer sans jamais pouvoir dire si ça
 * marche — et une relance qui ne convertit pas coûte de la délivrabilité pour
 * rien.
 *
 * `updateMany` et non `update` : la plupart des commandes n'ont pas été
 * relancées, et une absence de ligne n'est pas une erreur.
 */
export async function noterConversion(orderId: string): Promise<void> {
  await db.relancePaiement.updateMany({
    where: { orderId, converted: false },
    data: { converted: true },
  });
}

export interface StatistiquesRelance {
  envoyees: number;
  converties: number;
  /** En pourcentage, arrondi. `null` quand rien n'a été envoyé. */
  taux: number | null;
}

/** Ce que l'écran de supervision affiche. */
export async function statistiquesRelance(
  depuis: Date,
): Promise<StatistiquesRelance> {
  const [envoyees, converties] = await Promise.all([
    db.relancePaiement.count({ where: { sentAt: { gte: depuis } } }),
    db.relancePaiement.count({
      where: { sentAt: { gte: depuis }, converted: true },
    }),
  ]);

  return {
    envoyees,
    converties,
    taux: envoyees === 0 ? null : Math.round((converties / envoyees) * 100),
  };
}
