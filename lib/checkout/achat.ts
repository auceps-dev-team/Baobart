import "server-only";

import { urlDuSite } from "@/lib/config/site";
import { Prisma } from "@prisma/client";

import { nouvelleLicence } from "@/lib/checkout/licence";
import { champsDe, validerLesReponses } from "@/lib/commerce/champs";
import { estOfferte, retenirLeMontant, type MotifMontant } from "@/lib/commerce/montant";
import { ajusterAuPays } from "@/lib/commerce/ppp";
import { consommerLeCode, evaluerUnCode } from "@/lib/commerce/codes-promo";
import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";
import { piloteCourant } from "@/lib/payments/encaissement/pilotes";
import {
  abandonnerVente,
  finaliserVente,
} from "@/lib/payments/encaissement/reglement";

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
  | "CONFLIT"
  /**
   * Le code promo présenté n'a pas été accepté.
   *
   * Un seul motif côté achat, alors que `evaluerUnCode` en distingue sept :
   * l'acheteur voit le détail **avant** de valider, sur l'aperçu de la remise.
   * Au moment de l'achat, le seul cas restant est la course — quelqu'un a pris
   * le dernier exemplaire entre l'aperçu et le clic — et le détail n'apprend
   * alors plus rien d'utile.
   */
  | "CODE_REFUSE"
  /**
   * Une réponse manque, ou n'est pas valable.
   *
   * Le détail — quel champ, et pourquoi — est rendu à l'écran d'achat par
   * `validerLesReponses`, avant qu'on arrive ici. Ce motif-ci couvre le cas
   * où quelqu'un poste directement, sans passer par le formulaire.
   */
  | "CHAMPS_INVALIDES"
  /**
   * Le montant choisi n'est pas acceptable.
   *
   * Comme pour les champs, le détail — trop bas, invalide, pourboire hors
   * plafond — est rendu à l'écran d'achat avant qu'on arrive ici.
   */
  | "MONTANT_REFUSE";

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
      /** Ce que le code promo a fait gagner, quand il y en avait un. */
      remise?: { code: string; montant: number };
      /** Ce que l'acheteur a ajouté, quand il a ajouté quelque chose. */
      pourboire?: number;
    }
  | {
      ok: false;
      motif: MotifRefus;
      /**
       * Pourquoi le montant a été refusé, quand c'est le motif.
       *
       * Il se perdait : la fiche recevait « MONTANT_REFUSE » et n'affichait
       * rien (mesuré le 25/09, P4.3, P5.1, S21). Le détail voyage désormais
       * jusqu'à elle, avec le minimum quand il y en a un.
       */
      montant?: DetailMontant;
    };

export interface DetailMontant {
  motif: MotifMontant;
  minimum?: number;
}

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
  CODE_REFUSE:
    "Ce code promo n'a pas pu être appliqué. Reprends sans lui, ou réessaie.",
  CHAMPS_INVALIDES:
    "Il manque une information demandée par le créateur. Reprends depuis la fiche.",
  MONTANT_REFUSE:
    "Ce montant n'a pas pu être retenu. Reprends depuis la fiche.",
};

/** La simulation est-elle ouverte ? */
export function simulationOuverte(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const v = (env.CHECKOUT_SIMULATION_ENABLED ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "oui" || v === "on";
}

/**
 * Un paiement peut-il aboutir aujourd'hui ? La simulation de développement,
 * ou un opérateur branché avec une adresse de retour (`APP_URL`).
 *
 * Le seul endroit qui le décide. La fiche produit et le renouvellement en
 * tenaient chacun une copie ; l'historique des achats n'en lisait aucune et
 * affichait en dur « Le paiement n'est pas encore branché » — y compris sous
 * une commande payée (mesuré le 25/09, Qualitytest D11).
 */
export function encaissementPossible(): boolean {
  if (simulationOuverte()) return true;
  return piloteCourant().nom !== "aucun" && urlDuSite() !== null;
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
  /** Le code promo tapé par l'acheteur, s'il y en a un. */
  codePromo?: string | null;
  /** Les réponses aux champs personnalisés, par identifiant de champ. */
  champs?: Record<string, string>;
  /** Le montant choisi, sur une ressource à prix libre. */
  montant?: string | number | null;
  /** Le pourboire ajouté, quand la ressource en invite un. */
  pourboire?: string | number | null;
  /**
   * Le pays déclaré par l'acheteur au moment de payer.
   *
   * Déclaré, pas vérifié : il vient du formulaire, et il n'y a pas de
   * géolocalisation ici. C'est pourquoi la réduction qu'il ouvre est bornée
   * par le créateur — voir `lib/commerce/ppp.ts`.
   */
  pays?: string | null;
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
    pourboire: number;
    remise?: { code: string; montant: number };
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
            pricingMode: true,
            minPrice: true,
            tipsEnabled: true,
            pppEnabled: true,
            pppMaxDiscountBp: true,
            _count: { select: { files: { where: { role: "SOURCE", deletedAt: null } } } },
          },
        });

        if (!produit || produit.status !== "PUBLISHED") {
          return refus("INTROUVABLE");
        }
        if (produit._count.files === 0) return refus("SANS_FICHIER");

        // ══════════════════════════════════════════════════════════════════
        // « GRATUITE » NE VAUT PLUS POUR UNE RESSOURCE À PRIX LIBRE
        //
        // La règle d'origine — `lib/domain/delivery.ts` — dit qu'une ressource
        // offerte se télécharge sans commande, parce que « simuler l'achat
        // inscrirait une vente qui n'a pas eu lieu ».
        //
        // Elle tenait tant qu'un prix nul voulait dire « gratuit ». En
        // `LIBRE`, il veut dire « le créateur n'a pas suggéré de montant » —
        // et l'acheteur, lui, va en donner un. Refuser ici rendrait
        // impossible de soutenir quelqu'un qui offre son travail, ce qui est
        // exactement le cas d'usage du produit « coffee ».
        //
        // Le montant réellement facturé est contrôlé plus bas, contre le
        // plancher : une ressource `LIBRE` ne peut pas se vendre à zéro.
        if (estOfferte(produit)) {
          return refus("GRATUITE");
        }
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

        // ══════════════════════════════════════════════════════════════
        // LE CODE PROMO S'ÉVALUE PUIS SE CONSOMME, DANS CET ORDRE
        //
        // Deux gestes et non un, parce qu'ils ne répondent pas à la même
        // question. L'évaluation dit « ce code vaut-il, et combien » ;
        // la consommation dit « restait-il un exemplaire à l'instant où j'ai
        // écrit ».
        //
        // Entre l'aperçu que l'acheteur a vu et ce clic, quelqu'un a pu
        // prendre le dernier. `consommerLeCode` porte le plafond dans son
        // `WHERE` : si la base ne touche aucune ligne, on refuse la vente
        // plutôt que de l'accorder au prix remisé.
        //
        // Accorder quand même serait le défaut le plus discret de tout ce
        // module : le plafond afficherait la bonne valeur, la vente
        // aboutirait, et le vendeur aurait vendu une fois de plus que ce
        // qu'il avait décidé.
        // ══════════════════════════════════════════════════════════════
        // LES RÉPONSES SONT REVALIDÉES ICI, PAS SEULEMENT AU FORMULAIRE
        //
        // Le formulaire porte `required` et une liste de choix, et un
        // navigateur les fait respecter. Un `POST` direct n'en passe par
        // aucun : sans ce contrôle, un champ obligatoire serait vide dans une
        // vente déjà payée, qu'on ne peut plus corriger.
        //
        // La lecture est faite même quand le produit n'a aucun champ — une
        // requête de plus, mais l'alternative serait de se fier à ce que
        // l'appelant a envoyé pour décider s'il faut vérifier.
        const declares = await champsDe(produit.id);
        const suiteChamps = validerLesReponses(declares, input.champs ?? {});
        if (!suiteChamps.ok) return refus("CHAMPS_INVALIDES");

        // ══════════════════════════════════════════════════════════════
        // LE MONTANT SE RETIENT AVANT LA REMISE, ET C'EST L'ORDRE JUSTE
        //
        // En `LIBRE`, la remise s'applique à ce que l'acheteur a choisi, pas
        // au montant suggéré par le créateur. L'inverse ferait qu'un code
        // « -20 % » retire un cinquième d'un prix que personne n'a payé —
        // et sur un montant choisi plus bas que la suggestion, la remise
        // pourrait dépasser ce qui est donné.
        const retenu = retenirLeMontant({
          mode: produit.pricingMode,
          prix: produit.price,
          minPrice: produit.minPrice,
          pourboiresOuverts: produit.tipsEnabled,
          montantChoisi: input.montant,
          pourboireChoisi: input.pourboire,
        });

        if (!retenu.ok) {
          return refus("MONTANT_REFUSE", {
            motif: retenu.motif,
            ...(retenu.minimum !== undefined ? { minimum: retenu.minimum } : {}),
          });
        }

        // ══════════════════════════════════════════════════════════════
        // LA PARITÉ S'APPLIQUE AVANT LE CODE PROMO, ET L'ORDRE COMPTE
        //
        // La parité ajuste le prix au pays ; le code promo est une remise que
        // le créateur accorde par-dessus. Dans l'autre sens, un code « -20 % »
        // porterait sur un prix que cet acheteur-là n'aurait jamais vu, et
        // deux personnes présentant le même code paieraient des réductions
        // différentes sans que rien ne l'explique.
        const parite = await ajusterAuPays({
          prix: retenu.prix,
          actif: produit.pppEnabled,
          plafondBp: produit.pppMaxDiscountBp,
          pays: input.pays ?? null,
        });

        let prixFacture = parite.prix;
        let prixAffiche: number | null = null;
        let codeApplique: { id: string; code: string; remise: number } | null =
          null;

        if (input.codePromo) {
          const remise = await evaluerUnCode({
            code: input.codePromo,
            vendeurId: produit.sellerId,
            produitId: produit.id,
            prix: parite.prix,
          });

          if (!remise.ok) return refus("CODE_REFUSE");

          if (!(await consommerLeCode(remise.offerCodeId, tx))) {
            return refus("CODE_REFUSE");
          }

          prixFacture = remise.prixFinal;
          prixAffiche = remise.prixAffiche;
          codeApplique = {
            id: remise.offerCodeId,
            code: remise.code,
            remise: remise.remise,
          };
        }

        const commande = await tx.order.create({
          data: {
            buyerId: input.acheteurId,
            // Le pourboire est dans le total : c'est ce que l'acheteur
            // débourse, et c'est ce montant-là qu'on présente à l'opérateur.
            total: prixFacture + retenu.pourboire,
            currency: produit.currency,
            provider: fournisseur,
            items: {
              create: {
                productId: produit.id,
                quantity: 1,
                // Le prix est **figé** ici. Le relire sur le produit plus tard
                // ferait varier une vente passée au gré des changements de
                // tarif du créateur.
                //
                // C'est le prix REMISÉ : c'est lui que lit le barème de frais,
                // et la remise est donc supportée par le vendeur. `listPrice`
                // garde l'autre, sans quoi une vente remisée et une vente au
                // tarif réduit deviendraient indistinguables.
                price: prixFacture,
                // Le prix d'avant toute réduction — remise ET parité. Sans
                // lui, une vente ajustée au pays serait indistinguable d'une
                // vente au tarif, et la question « la parité change-t-elle
                // quelque chose ? » resterait sans réponse.
                listPrice: prixAffiche ?? (parite.remiseBp > 0 ? retenu.prix : null),
                offerCodeId: codeApplique?.id ?? null,
                tipAmount: retenu.pourboire,
                // Gardés même sans réduction : c'est ce qui permet de savoir
                // d'où viennent les ventes, et de répondre plus tard à « la
                // parité change-t-elle quelque chose ? » sans instrumenter
                // après coup.
                buyerCountry: input.pays?.trim().toUpperCase() || null,
                pppDiscountBp: parite.remiseBp,
                // Figées avec leur libellé d'alors : le vendeur peut renommer
                // ou supprimer un champ après la vente, et relire la
                // définition montrerait « Taille : M » sous « Couleur ».
                customFields:
                  suiteChamps.reponses.length > 0
                    ? (suiteChamps.reponses as unknown as Prisma.InputJsonValue)
                    : undefined,
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
          // sera confronté. Remisé, le cas échéant : c'est ce que l'acheteur
          // va réellement payer chez l'opérateur.
          total: prixFacture + retenu.pourboire,
          devise: produit.currency as string,
          pourboire: retenu.pourboire,
          remise: codeApplique
            ? { code: codeApplique.code, montant: codeApplique.remise }
            : undefined,
        };
      },
      // Deux clics simultanés doivent aboutir à une seule commande. Sans
      // sérialisation, les deux transactions liraient « rien d'acquis » et
      // écriraient chacune la leur.
      { isolationLevel: "Serializable", timeout: 15_000, maxWait: 10_000 },
    );
  } catch (cause) {
    if (cause instanceof RefusInterne) {
      return cause.montant
        ? { ok: false, motif: cause.motif, montant: cause.montant }
        : { ok: false, motif: cause.motif };
    }
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
      remise: creation.remise,
      pourboire: creation.pourboire > 0 ? creation.pourboire : undefined,
    };
  }

  // ── Mobile money : on ouvre, et on s'arrête là ─────────────────────────────
  //
  // L'adresse de l'acheteur est relue depuis la base, jamais reçue en
  // paramètre : c'est elle qui rattache la transaction à un client chez
  // l'opérateur, et la laisser venir de l'appelant permettrait d'ouvrir un
  // paiement au nom d'autrui.
  const acheteur = await db.user.findUniqueOrThrow({
    where: { id: input.acheteurId },
    select: { email: true, profile: { select: { displayName: true } } },
  });

  const ouverture = await pilote!.ouvrir({
    // Notre référence est l'identifiant de la commande. C'est elle qu'on
    // retrouvera dans le rappel, et c'est par elle que la réception recolle
    // l'annonce de l'opérateur à ce qu'on attend.
    reference: creation.orderId,
    montant: creation.total,
    devise: creation.devise,
    moyen: input.moyen ?? "om",
    retour: `${base}/achat/${creation.orderId}`,
    email: acheteur.email,
    nom: acheteur.profile?.displayName ?? undefined,
  });

  if (!ouverture.ok) {
    // ══════════════════════════════════════════════════════════════════════
    // ON REFERME TOUT DE SUITE, AU LIEU DE LAISSER TRAÎNER
    //
    // Cette branche laissait la commande `IN_PROGRESS`, en comptant sur la
    // fenêtre anti-doublon pour que l'acheteur réessaie dans deux minutes.
    //
    // Deux raisons d'y renoncer. La première : l'opérateur a refusé
    // d'**ouvrir**, donc aucun paiement n'existe et cette commande ne
    // deviendra jamais rien — la laisser ouverte fait monter le compteur
    // « commandes bloquées » de l'écran de supervision pour un cas qui n'a
    // rien de bloqué.
    //
    // La seconde est décisive depuis les codes promo : un exemplaire vient
    // d'être réservé, et seul `abandonnerVente` le rend. Sans cet appel, il
    // faudrait attendre la péremption à vingt-quatre heures — et entre-temps,
    // un code à dix usages serait épuisé par dix refus d'opérateur.
    //
    // La transition d'état de cette fonction ne réussit qu'une fois : le
    // passage de péremption qui repasserait dessus ne libérerait pas deux fois.
    await abandonnerVente(creation.orderItemId);

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
  constructor(
    readonly motif: MotifRefus,
    readonly montant?: DetailMontant,
  ) {
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
function refus(motif: MotifRefus, montant?: DetailMontant): never {
  throw new RefusInterne(motif, montant);
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
