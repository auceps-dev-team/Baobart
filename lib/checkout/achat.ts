import "server-only";

import { urlDuSite } from "@/lib/config/site";
import { Prisma } from "@prisma/client";

import { nouvelleLicence } from "@/lib/checkout/licence";
import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";
import { piloteCourant } from "@/lib/payments/encaissement/pilotes";
import { finaliserVente } from "@/lib/payments/encaissement/reglement";

/**
 * L'achat d'une ressource payante.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DEUX CHEMINS, ET UN SEUL CRÉDITE POUR DE VRAI
 *
 * **La simulation** inscrit une commande et crédite le créateur *comme si* le
 * paiement avait eu lieu. Elle refuse de s'exécuter tant que
 * `CHECKOUT_SIMULATION_ENABLED` n'est pas posé.
 *
 * **Le mobile money** ouvre un paiement chez l'opérateur et s'arrête là. La
 * commande reste `IN_PROGRESS`, rien n'est crédité, aucun reçu ne part : on ne
 * sait pas encore si l'acheteur ira au bout. C'est le rappel de l'opérateur,
 * authentifié, qui décidera — voir `app/api/paiements/[fournisseur]/webhook`.
 * Le retour du navigateur ne fait jamais foi : il dit où l'acheteur a atterri,
 * pas si l'argent est arrivé.
 *
 * Chaque commande porte le nom de son `provider`. Ce n'est pas décoratif : le
 * jour où des versements réels partiront, il faudra pouvoir distinguer les
 * ventes qui ont apporté de l'argent de celles qui n'en ont pas apporté. Un
 * drapeau d'environnement se retire ; une colonne reste.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LE GRATUIT NE PASSE PAS PAR ICI
 *
 * `lib/domain/delivery.ts` en a décidé : une ressource offerte se télécharge
 * sans commande, parce que « simuler l'achat inscrirait une vente qui n'a pas
 * eu lieu ». On s'y tient — une vente à 0 F fausserait les compteurs du
 * créateur et son historique.
 */

export const MARQUEUR_SIMULATION = "simulation";

export type MotifRefus =
  /** Ressource inexistante, ou pas publiée. */
  | "INTROUVABLE"
  /** Publiée mais sans fichier : l'acheteur paierait pour rien. */
  | "SANS_FICHIER"
  /** Une ressource offerte se télécharge, elle ne s'achète pas. */
  | "GRATUITE"
  | "SA_PROPRE_RESSOURCE"
  | "DEJA_ACQUISE"
  /** Un achat de la même ressource vient d'être lancé. */
  | "EN_COURS"
  | "PAIEMENT_INDISPONIBLE"
  /** Deux achats simultanés : la base a tranché, l'appelant réessaie. */
  | "CONFLIT";

export type Resultat =
  | {
      ok: true;
      orderId: string;
      orderItemId: string;
      licence: string;
      /**
       * L'argent est-il déjà crédité ?
       *
       * Vrai en simulation seulement. En mobile money, la vente est ouverte et
       * pas conclue : l'appelant doit envoyer l'acheteur sur `redirection` et
       * ne rien lui promettre avant le rappel de l'opérateur.
       */
      paye: boolean;
      /** Où envoyer l'acheteur. Absent quand tout est déjà réglé. */
      redirection?: string;
    }
  | { ok: false; motif: MotifRefus };

export const MESSAGES: Record<MotifRefus, string> = {
  INTROUVABLE: "Cette ressource n'est plus disponible.",
  SANS_FICHIER:
    "Cette ressource n'a aucun fichier attaché : elle ne peut pas être vendue.",
  GRATUITE: "Cette ressource est offerte — télécharge-la directement.",
  SA_PROPRE_RESSOURCE: "On n'achète pas sa propre ressource.",
  DEJA_ACQUISE: "Tu possèdes déjà cette ressource. Retrouve-la dans tes achats.",
  EN_COURS: "Un achat est déjà en cours pour cette ressource.",
  PAIEMENT_INDISPONIBLE:
    "Le paiement n'est pas encore disponible. Reviens bientôt.",
  CONFLIT: "Deux achats sont partis en même temps. Réessaie.",
};

/** La simulation est-elle ouverte ? */
export function simulationOuverte(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const v = (env.CHECKOUT_SIMULATION_ENABLED ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "oui" || v === "on";
}

/**
 * Un achat lancé il y a moins de deux minutes bloque le suivant.
 *
 * C'est la protection contre le double clic. Au-delà, une ligne restée
 * `IN_PROGRESS` est une tentative abandonnée — la bloquer indéfiniment
 * empêcherait l'acheteur de réessayer après un échec.
 */
const FENETRE_DOUBLON_MS = 2 * 60_000;

export async function acheter(input: {
  produitId: string;
  acheteurId: string;
  /**
   * Le rail mobile money visé — « om », « wave », « mtn », « moov ».
   *
   * Ignoré en simulation. En mobile money, il décide de l'invite que reçoit
   * l'acheteur sur son téléphone.
   */
  moyen?: string;
}): Promise<Resultat> {
  // La simulation prime quand elle est ouverte : c'est un réglage de
  // développement, et le laisser cohabiter avec un opérateur réel produirait
  // des ventes payées pour de vrai et des ventes gratuites dans la même base.
  const simulation = simulationOuverte();
  const pilote = simulation ? null : piloteCourant();

  if (!simulation && (pilote === null || pilote.nom === "aucun")) {
    return { ok: false, motif: "PAIEMENT_INDISPONIBLE" };
  }

  // L'adresse publique est vérifiée AVANT d'inscrire quoi que ce soit. Sans
  // elle, l'URL de retour serait relative et le pilote lèverait — après avoir
  // laissé une commande ouverte que personne ne viendrait conclure. Un refus
  // franc vaut mieux qu'une commande orpheline.
  const base = simulation ? null : urlDuSite();
  if (!simulation && !base) {
    journal.erreur("achat impossible : APP_URL absente", {
      produitId: input.produitId,
    });
    return { ok: false, motif: "PAIEMENT_INDISPONIBLE" };
  }

  const fournisseur = simulation ? MARQUEUR_SIMULATION : pilote!.nom;

  let creation: {
    orderId: string;
    orderItemId: string;
    licence: string;
    total: number;
    devise: string;
  };

  try {
    creation = await db.$transaction(
      async (tx) => {
        const produit = await tx.product.findUnique({
          where: { id: input.produitId },
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            price: true,
            currency: true,
            sellerId: true,
            _count: { select: { files: { where: { role: "SOURCE", deletedAt: null } } } },
          },
        });

        if (!produit || produit.status !== "PUBLISHED") {
          return refus("INTROUVABLE");
        }
        if (produit._count.files === 0) return refus("SANS_FICHIER");
        if (produit.price === 0) return refus("GRATUITE");
        if (produit.sellerId === input.acheteurId) {
          return refus("SA_PROPRE_RESSOURCE");
        }

        // Ce que l'acheteur possède déjà. Même lecture que la livraison : un
        // remboursement intégral, un litige ou un retrait d'accès rendent la
        // ressource à nouveau achetable.
        const lignes = await tx.orderItem.findMany({
          where: {
            productId: produit.id,
            order: { buyerId: input.acheteurId },
            state: { in: ["IN_PROGRESS", "SUCCESSFUL", "NOT_CHARGED"] },
          },
          select: {
            state: true,
            price: true,
            quantity: true,
            refundedAmount: true,
            chargebackAt: true,
            chargebackReversedAt: true,
            accessRevokedAt: true,
            createdAt: true,
          },
        });

        for (const l of lignes) {
          if (l.state === "IN_PROGRESS") {
            if (Date.now() - l.createdAt.getTime() < FENETRE_DOUBLON_MS) {
              return refus("EN_COURS");
            }
            continue;
          }

          const paye = l.price * l.quantity;
          const rembourseEnEntier = paye > 0 && l.refundedAmount >= paye;
          const litige =
            l.chargebackAt !== null && l.chargebackReversedAt === null;

          if (!rembourseEnEntier && !litige && l.accessRevokedAt === null) {
            return refus("DEJA_ACQUISE");
          }
        }

        const commande = await tx.order.create({
          data: {
            buyerId: input.acheteurId,
            total: produit.price,
            currency: produit.currency,
            provider: fournisseur,
            items: {
              create: {
                productId: produit.id,
                quantity: 1,
                // Le prix est **figé** ici. Le relire sur le produit plus tard
                // ferait varier une vente passée au gré des changements de
                // tarif du créateur.
                price: produit.price,
              },
            },
          },
          select: { id: true, items: { select: { id: true } } },
        });

        const ligneId = commande.items[0]!.id;

        const licence = await creerLicence(tx, {
          produitId: produit.id,
          ligneId,
        });

        // LE REÇU NE PART PAS D'ICI. Il dit « tu as payé » : l'émettre à
        // l'ouverture le rendrait faux pour tous ceux qui abandonnent au
        // moment de taper leur code — c'est-à-dire beaucoup de monde en
        // mobile money. Il est déposé par `finaliserVente`, quand l'argent
        // est arrivé, dans la même transaction que la clôture.

        return {
          orderId: commande.id,
          orderItemId: ligneId,
          licence,
          // Le montant sort d'ici plutôt que d'être relu plus tard : c'est
          // celui qu'on a figé, et c'est à lui que le rappel de l'opérateur
          // sera confronté.
          total: produit.price,
          devise: produit.currency as string,
        };
      },
      // Deux clics simultanés doivent aboutir à une seule commande. Sans
      // sérialisation, les deux transactions liraient « rien d'acquis » et
      // écriraient chacune la leur.
      { isolationLevel: "Serializable", timeout: 15_000, maxWait: 10_000 },
    );
  } catch (cause) {
    if (cause instanceof RefusInterne) return { ok: false, motif: cause.motif };
    // P2034 : conflit de sérialisation. La base a fait son travail.
    if (
      cause instanceof Prisma.PrismaClientKnownRequestError &&
      cause.code === "P2034"
    ) {
      return { ok: false, motif: "CONFLIT" };
    }
    throw cause;
  }

  if (simulation) {
    // Le règlement ouvre ses propres transactions : il ne peut pas être
    // imbriqué. Si cette étape échoue, la commande reste IN_PROGRESS —
    // l'acheteur n'a aucun accès et rien n'est crédité. C'est le bon état pour
    // un paiement qui n'a pas abouti.
    await finaliserVente(creation.orderItemId);

    journal.avertissement("achat simulé — aucun paiement réel", {
      orderId: creation.orderId,
      produitId: input.produitId,
    });

    return {
      ok: true,
      orderId: creation.orderId,
      orderItemId: creation.orderItemId,
      licence: creation.licence,
      paye: true,
    };
  }

  // ── Mobile money : on ouvre, et on s'arrête là ─────────────────────────────
  const ouverture = await pilote!.ouvrir({
    // Notre référence est l'identifiant de la commande. C'est elle qu'on
    // retrouvera dans le rappel, et c'est par elle que la réception recolle
    // l'annonce de l'opérateur à ce qu'on attend.
    reference: creation.orderId,
    montant: creation.total,
    devise: creation.devise,
    moyen: input.moyen ?? "om",
    retour: `${base}/achat/${creation.orderId}`,
  });

  if (!ouverture.ok) {
    // L'opérateur a refusé d'ouvrir. La commande reste IN_PROGRESS : rien
    // n'est crédité, et la fenêtre anti-doublon laissera l'acheteur réessayer
    // dans deux minutes.
    journal.erreur("ouverture de paiement refusée par l'opérateur", {
      orderId: creation.orderId,
      operateur: pilote!.nom,
      message: ouverture.message,
    });
    return { ok: false, motif: "PAIEMENT_INDISPONIBLE" };
  }

  if (ouverture.referenceOperateur) {
    await db.order.update({
      where: { id: creation.orderId },
      data: { providerRef: ouverture.referenceOperateur },
    });
  }

  return {
    ok: true,
    orderId: creation.orderId,
    orderItemId: creation.orderItemId,
    licence: creation.licence,
    paye: false,
    redirection: ouverture.redirection,
  };
}

class RefusInterne extends Error {
  constructor(readonly motif: MotifRefus) {
    super(motif);
    this.name = "RefusInterne";
  }
}

/**
 * Sortir d'une transaction par une exception, pas par un retour.
 *
 * Un `return` laisserait la transaction s'engager : rien n'aurait été écrit
 * ici, mais l'habitude est mauvaise et le premier `create` ajouté au-dessus
 * d'un refus serait conservé.
 */
function refus(motif: MotifRefus): never {
  throw new RefusInterne(motif);
}

/** Le sérial doit être unique. Une collision est improbable, pas impossible. */
async function creerLicence(
  tx: Prisma.TransactionClient,
  input: { produitId: string; ligneId: string },
): Promise<string> {
  for (let essai = 0; essai < 5; essai += 1) {
    const serial = nouvelleLicence();
    try {
      await tx.licenseKey.create({
        data: {
          productId: input.produitId,
          orderItemId: input.ligneId,
          serial,
        },
      });
      return serial;
    } catch (cause) {
      const collision =
        cause instanceof Prisma.PrismaClientKnownRequestError &&
        cause.code === "P2002";
      if (!collision) throw cause;
    }
  }
  throw new Error("Impossible de tirer une clé de licence libre.");
}
