import "server-only";

import { Prisma } from "@prisma/client";

import { nouvelleLicence } from "@/lib/checkout/licence";
import { db } from "@/lib/db";
import { encaisserLigne } from "@/lib/domain/orders";
import { deposer } from "@/lib/email/outbox";
import { formatMoney } from "@/lib/i18n/money";
import { journal } from "@/lib/observabilite/journal";

/**
 * L'achat d'une ressource payante.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * AUCUN ARGENT NE CHANGE DE MAINS
 *
 * Il n'y a pas d'opérateur de paiement branché. Cette fonction inscrit une
 * commande et crédite le créateur **comme si** le paiement avait eu lieu :
 * c'est une simulation, et elle refuse de s'exécuter tant que
 * `CHECKOUT_SIMULATION_ENABLED` n'est pas posé.
 *
 * Chaque commande ainsi créée porte `provider = "simulation"`. Ce n'est pas
 * décoratif : le jour où des versements réels partiront, il faudra pouvoir
 * distinguer les ventes qui ont apporté de l'argent de celles qui n'en ont pas
 * apporté. Un drapeau d'environnement se retire ; une colonne reste.
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
  | { ok: true; orderId: string; orderItemId: string; licence: string }
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
}): Promise<Resultat> {
  if (!simulationOuverte()) return { ok: false, motif: "PAIEMENT_INDISPONIBLE" };

  let creation: { orderId: string; orderItemId: string; licence: string };

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
            provider: MARQUEUR_SIMULATION,
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

        // Le reçu s'inscrit dans la même transaction que la vente : si la
        // commande échoue, il disparaît avec elle. C'est tout l'intérêt de la
        // file (voir lib/email/outbox.ts).
        const acheteur = await tx.user.findUniqueOrThrow({
          where: { id: input.acheteurId },
          select: { email: true, profile: { select: { displayName: true } } },
        });

        await deposer(
          {
            cle: `recu-${ligneId}`,
            destinataire: acheteur.email,
            modele: "RECU_ACHAT",
            charge: {
              nom: acheteur.profile?.displayName ?? acheteur.email,
              ressource: produit.name,
              montant: formatMoney(produit.price, produit.currency),
            },
          },
          tx,
        );

        return { orderId: commande.id, orderItemId: ligneId, licence };
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

  // L'encaissement ouvre sa propre transaction : il ne peut pas être imbriqué.
  // Si cette étape échoue, la commande reste IN_PROGRESS — l'acheteur n'a aucun
  // accès, et rien n'est crédité. C'est le bon état pour un paiement qui n'a
  // pas abouti.
  await encaisserLigne({ orderItemId: creation.orderItemId, regime: "DIRECT" });

  await db.order.update({
    where: { id: creation.orderId },
    data: { status: "COMPLETED" },
  });

  journal.avertissement("achat simulé — aucun paiement réel", {
    orderId: creation.orderId,
    produitId: input.produitId,
  });

  return { ok: true, ...creation };
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
