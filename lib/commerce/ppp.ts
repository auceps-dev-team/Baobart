import "server-only";

import { prixPlancher } from "@/lib/commerce/codes-promo";
import { db } from "@/lib/db";

/**
 * Parité de pouvoir d'achat — §3.4-B.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE MÉCANISME N'A PERSONNE À SERVIR AUJOURD'HUI, ET IL FAUT LE DIRE
 *
 * `lib/payments/rails.ts` ne connaît que quatre pays : Sénégal, Côte d'Ivoire,
 * Ghana, Bénin. Tous en Afrique de l'Ouest, trois dans la même monnaie. La
 * parité entre eux est proche, et une réduction fondée dessus ne changerait
 * pratiquement rien.
 *
 * La PPP devient utile le jour où la diaspora peut payer — un créateur pourra
 * alors afficher un prix qui tient à Paris et rester abordable à Abidjan.
 * C'est pour ce jour-là que ceci est écrit.
 *
 * Le dire ici plutôt que de laisser croire au contraire : la ligne passe au
 * vert dans la matrice, et il serait facile d'en conclure qu'une réduction
 * s'applique quelque part. Elle ne s'applique nulle part tant que
 * `PppFactor` est vide, ce qu'elle est à la livraison.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES COEFFICIENTS SONT DES DONNÉES, PAS DU CODE
 *
 * Un coefficient PPP est une valeur **mesurée** — la Banque mondiale en publie
 * un par pays et par année. En inventer pour faire marcher une démonstration
 * reviendrait à poser une réduction sur des nombres qu'aucune source ne
 * soutient, et personne ne saurait plus lesquels ont été vérifiés.
 *
 * La table est donc livrée vide, chaque ligne exige sa source et sa date de
 * relevé, et l'absence de coefficient veut dire « prix inchangé ».
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE PAYS EST DÉCLARÉ, PAS VÉRIFIÉ
 *
 * Il vient du formulaire de paiement. Il n'y a pas de géolocalisation par
 * adresse IP ici, et il n'y en aura pas : l'adresse qu'on lit sert à gêner un
 * retour, jamais à établir une identité (`lib/securite/adresse.ts`).
 *
 * N'importe qui peut donc cocher le pays le moins cher. C'est la raison d'être
 * de `Product.pppMaxDiscountBp` : le créateur borne ce que cela peut lui
 * coûter. Sans plafond, une réduction de 80 % serait offerte à qui coche la
 * bonne case, et il le découvrirait sur son relevé.
 */

/** 10 000 points de base = 100 %. */
const CENT_POUR_CENT_BP = 10_000;

export interface AjustementPpp {
  /** Les points de base retirés. 0 = prix inchangé. */
  remiseBp: number;
  /** Le prix après ajustement. */
  prix: number;
  /** Pourquoi rien ne s'applique, quand rien ne s'applique. */
  raison?:
    | "DESACTIVE"
    | "PAYS_INCONNU"
    | "SANS_COEFFICIENT"
    | "COEFFICIENT_NEUTRE"
    | "PLANCHER_ATTEINT";
}

/**
 * Ce que la parité change au prix, pour ce pays.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UN COEFFICIENT AU-DESSUS DE CENT POUR CENT EST IGNORÉ
 *
 * Un pays plus cher que la référence produirait un coefficient supérieur à
 * 10 000, donc une **hausse**. « Parité de pouvoir d'achat » n'annonce pas
 * cela, et personne n'accepte de payer davantage parce qu'il habite ailleurs.
 *
 * On traite donc ces cas comme neutres. C'est un choix, pas une limite
 * technique — et c'est le genre de décision qui, non écrite, se redécide
 * différemment au prochain passage.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LE PRIX NE DESCEND JAMAIS SOUS LE PLANCHER — ET CETTE GARDE DORT
 *
 * Même règle que les codes promo : au-dessous, les frais dépassent
 * l'encaissement et l'opérateur refuse. La réduction est rabotée jusqu'au
 * plancher plutôt que refusée — une parité qui rend l'achat impossible ne sert
 * personne, alors qu'une parité partielle sert encore.
 *
 * **Elle est aujourd'hui inatteignable, et c'est écrit ici pour qu'on ne la
 * croie pas éprouvée.** `prixPlancher()` rend `1`, parce que les parts fixes
 * de `BAREME_XOF` valent délibérément zéro tant que les coûts réels par
 * transaction ne sont pas mesurés. Or la remise est arrondie vers le bas :
 * pour tout prix entier, `prix − floor(prix × bp / 10 000)` reste ≥ 1. La
 * branche ne peut donc pas se déclencher.
 *
 * On la garde parce qu'elle redeviendra nécessaire le jour où une part fixe
 * recevra une valeur mesurée — le plancher montera alors tout seul. Une garde
 * qu'on retire « parce qu'elle ne sert pas » est une garde qu'il faudra
 * réécrire sous pression, le jour où elle manquera.
 *
 * Le test correspondant ne prétend pas l'exercer : il constate qu'elle dort, ce
 * qui est la seule chose vraie qu'on puisse en dire aujourd'hui.
 */
export async function ajusterAuPays(input: {
  prix: number;
  actif: boolean;
  plafondBp: number | null;
  pays: string | null;
}): Promise<AjustementPpp> {
  if (!input.actif) {
    return { remiseBp: 0, prix: input.prix, raison: "DESACTIVE" };
  }

  const pays = (input.pays ?? "").trim().toUpperCase();
  if (pays.length !== 2) {
    return { remiseBp: 0, prix: input.prix, raison: "PAYS_INCONNU" };
  }

  const facteur = await db.pppFactor.findUnique({
    where: { country: pays },
    select: { factorBp: true },
  });

  // Aucun coefficient mesuré pour ce pays : prix inchangé. C'est le
  // comportement de toute la table à la livraison.
  if (!facteur) {
    return { remiseBp: 0, prix: input.prix, raison: "SANS_COEFFICIENT" };
  }

  if (facteur.factorBp >= CENT_POUR_CENT_BP) {
    return { remiseBp: 0, prix: input.prix, raison: "COEFFICIENT_NEUTRE" };
  }

  const brute = CENT_POUR_CENT_BP - facteur.factorBp;
  const plafond = input.plafondBp ?? CENT_POUR_CENT_BP;
  const remiseBp = Math.max(0, Math.min(brute, plafond));

  if (remiseBp === 0) {
    return { remiseBp: 0, prix: input.prix, raison: "COEFFICIENT_NEUTRE" };
  }

  // Arrondi vers le bas sur la remise, donc vers le haut sur le prix : c'est
  // le créateur qui garde le franc de reste, comme pour les codes promo. Une
  // règle d'arrondi qu'on ne nomme pas se redécide différemment ailleurs.
  const remise = Math.floor((input.prix * remiseBp) / CENT_POUR_CENT_BP);
  const plancher = prixPlancher();

  if (input.prix - remise < plancher) {
    const possible = Math.max(0, input.prix - plancher);
    if (possible === 0) {
      return { remiseBp: 0, prix: input.prix, raison: "PLANCHER_ATTEINT" };
    }

    return {
      // Les points de base réellement appliqués, pas ceux demandés : la ligne
      // de commande doit porter ce qui s'est passé, pas l'intention.
      remiseBp: Math.floor((possible * CENT_POUR_CENT_BP) / input.prix),
      prix: input.prix - possible,
      raison: "PLANCHER_ATTEINT",
    };
  }

  return { remiseBp, prix: input.prix - remise };
}

export interface LigneFacteur {
  country: string;
  factorBp: number;
  source: string;
  measuredAt: Date;
}

/** Les coefficients chargés, pour l'écran d'administration. */
export async function listerLesFacteurs(): Promise<LigneFacteur[]> {
  return db.pppFactor.findMany({
    orderBy: { country: "asc" },
    select: { country: true, factorBp: true, source: true, measuredAt: true },
  });
}

export type SuiteFacteur =
  | { ok: true }
  | { ok: false; motif: "PAYS_INVALIDE" | "COEFFICIENT_INVALIDE" | "SANS_SOURCE" };

/**
 * Pose ou met à jour un coefficient.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA SOURCE EST OBLIGATOIRE, ET CE N'EST PAS DE LA BUREAUCRATIE
 *
 * Un coefficient sans source ne peut pas être revérifié. Personne n'osera le
 * corriger — ni le supprimer —, et il restera en place des années après que le
 * chiffre a bougé, en appliquant une réduction que plus rien ne justifie.
 *
 * La date de relevé est distincte de la date d'écriture : un chiffre de 2021
 * chargé aujourd'hui reste un chiffre de 2021.
 */
export async function poserUnFacteur(input: {
  pays: string;
  facteurBp: number;
  source: string;
  releveLe: Date;
}): Promise<SuiteFacteur> {
  const pays = input.pays.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(pays)) return { ok: false, motif: "PAYS_INVALIDE" };

  if (
    !Number.isInteger(input.facteurBp) ||
    input.facteurBp <= 0 ||
    input.facteurBp > CENT_POUR_CENT_BP
  ) {
    return { ok: false, motif: "COEFFICIENT_INVALIDE" };
  }

  const source = input.source.trim();
  if (source.length < 4) return { ok: false, motif: "SANS_SOURCE" };

  await db.pppFactor.upsert({
    where: { country: pays },
    update: { factorBp: input.facteurBp, source, measuredAt: input.releveLe },
    create: {
      country: pays,
      factorBp: input.facteurBp,
      source,
      measuredAt: input.releveLe,
    },
  });

  return { ok: true };
}

/** Retire un coefficient. Le pays repasse au prix plein. */
export async function retirerUnFacteur(pays: string): Promise<boolean> {
  const { count } = await db.pppFactor.deleteMany({
    where: { country: pays.trim().toUpperCase() },
  });

  return count > 0;
}
