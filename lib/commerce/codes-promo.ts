import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { BAREME_XOF, minimumViablePrice } from "@/lib/domain/fees";

/**
 * Codes promo — §3.4-B du plan de refonte.
 *
 * Traduit `offer_code.rb` (antiwork/gumroad, MIT, lu comme spécification). Le
 * modèle `OfferCode` existait depuis le premier schéma, sans qu'aucune ligne de
 * code ne le lise : la matrice l'annonçait « schéma seul, non câblé ».
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA REMISE EST SUPPORTÉE PAR LE VENDEUR
 *
 * `OrderItem.price` devient le prix remisé, et c'est lui que lit le barème de
 * frais. La commission de Baobart baisse donc avec la remise — c'est ce que
 * fait Gumroad, et c'est la seule répartition défendable : le vendeur décide
 * seul d'accorder une remise, il ne peut pas la faire payer à la plateforme.
 *
 * `OrderItem.listPrice` garde le prix d'avant. Sans lui, une vente à 5 000 F
 * avec un code et une vente à 5 000 F sans code deviennent indistinguables, et
 * la question « ma campagne a-t-elle marché ? » se pose toujours trop tard
 * pour instrumenter quoi que ce soit.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN CODE NE PEUT PAS DESCENDRE SOUS LE PRIX VIABLE
 *
 * `minimumViablePrice` existe déjà dans `lib/domain/fees.ts` : c'est le plus
 * petit prix auquel les frais ne dépassent pas l'encaissement. En dessous, le
 * vendeur ne touche rien et peut même devoir de l'argent.
 *
 * Un code de -100 % produirait pire encore : une commande à zéro franc, qu'un
 * opérateur de paiement refuse d'ouvrir et que `reconcilier` rejette. La vente
 * n'échouerait pas tout de suite — elle s'ouvrirait, et l'acheteur se ferait
 * refuser au moment de payer, sans comprendre pourquoi.
 *
 * On refuse donc franchement, avec un motif que l'écran sait traduire, plutôt
 * que de laisser filer une commande impossible.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA NORMALISATION FAIT PARTIE DU CODE
 *
 * Même leçon que la liste de blocage : « Noel 25 » écrit et « noel25 » tapé ne
 * se retrouvent pas, la base compare des octets. Le code s'afficherait dans
 * l'écran du vendeur, la personne le taperait comme elle l'a lu, et rien ne se
 * passerait.
 */

/** Majuscules, sans espaces ni ponctuation de séparation. */
export function normaliserCode(brut: string): string {
  return brut
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s._-]+/g, "");
}

export type TypeRemise = "PERCENT" | "FIXED";

export type MotifRefusCode =
  /** Aucun code de ce vendeur ne porte cette valeur. */
  | "INCONNU"
  /** Le vendeur l'a retiré. */
  | "RETIRE"
  | "EXPIRE"
  /** Le plafond d'usages est atteint. */
  | "EPUISE"
  /** Le code ne vaut pas pour cette ressource. */
  | "AUTRE_RESSOURCE"
  /** La remise ferait tomber le prix sous le seuil viable. */
  | "TROP_FORTE"
  /** Une remise de zéro franc : le code existe mais ne fait rien. */
  | "SANS_EFFET";

export interface RemiseAccordee {
  ok: true;
  offerCodeId: string;
  code: string;
  /** Ce que l'acheteur économise, en unité mineure. */
  remise: number;
  /** Ce qu'il paiera. */
  prixFinal: number;
  /** Ce qu'il aurait payé. */
  prixAffiche: number;
}

export type SuiteCode = RemiseAccordee | { ok: false; motif: MotifRefusCode };

export const MESSAGES_CODE: Record<MotifRefusCode, string> = {
  INCONNU: "Ce code n'existe pas.",
  RETIRE: "Ce code n'est plus actif.",
  EXPIRE: "Ce code a expiré.",
  EPUISE: "Ce code a déjà servi le nombre de fois prévu.",
  AUTRE_RESSOURCE: "Ce code ne s'applique pas à cette ressource.",
  TROP_FORTE:
    "Ce code ferait descendre le prix trop bas pour que la vente aboutisse.",
  SANS_EFFET: "Ce code ne change rien au prix.",
};

/**
 * Le prix minimum d'une vente, quel que soit le barème.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UN FRANC, ET IL NE VIENT PAS DU BARÈME
 *
 * `minimumViablePrice` rend **zéro** aujourd'hui, et c'est juste : les parts
 * fixes de `BAREME_XOF` sont délibérément à 0 « tant que les coûts réels par
 * transaction mobile money ne sont pas mesurés ». Sans part fixe, tout prix
 * strictement positif laisse quelque chose au vendeur.
 *
 * Mais zéro franc n'est pas un prix. Aucun opérateur n'ouvre un paiement nul,
 * et `reconcilier` refuse un montant nul depuis le 3 septembre 2026 — mesuré,
 * pas supposé. Une remise de -100 % produirait donc une commande ouverte que
 * l'acheteur ne pourrait pas payer, et le refus tomberait chez l'opérateur,
 * devant lui, sans explication.
 *
 * Le plancher est donc le plus exigeant de deux choses de nature différente :
 * ce que le barème rend impossible, et ce qu'un paiement rend impossible.
 */
const PRIX_MINIMUM_VENTE = 1;

/**
 * Le prix plancher, tous régimes confondus.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ON PREND LE PLUS EXIGEANT, ET ON LE CALCULE
 *
 * Le régime d'une vente — DIRECT ou DECOUVERTE — se décide au règlement, pas
 * ici. Choisir le mauvais laisserait passer une remise qui échouerait plus
 * tard, au pire moment.
 *
 * Calculé à partir du barème plutôt que recopié : le jour où les parts fixes
 * recevront des valeurs mesurées, ce seuil montera tout seul. Un nombre écrit
 * en dur resterait juste jusqu'au jour où il ne le serait plus, en silence.
 */
export function prixPlancher(): number {
  return Math.max(
    PRIX_MINIMUM_VENTE,
    minimumViablePrice("DIRECT", BAREME_XOF),
    minimumViablePrice("DECOUVERTE", BAREME_XOF),
  );
}

/**
 * Ce code vaut-il pour cette ressource, et que donne-t-il ?
 *
 * Ne consomme rien : c'est une évaluation, employée aussi bien par l'aperçu au
 * moment de la saisie que par l'achat lui-même. La consommation est un geste
 * distinct — voir `consommerLeCode`.
 */
export async function evaluerUnCode(input: {
  code: string;
  vendeurId: string;
  produitId: string;
  prix: number;
  /** Pour éprouver l'expiration sans attendre. */
  maintenant?: Date;
}): Promise<SuiteCode> {
  const code = normaliserCode(input.code);
  if (!code) return { ok: false, motif: "INCONNU" };

  const ligne = await db.offerCode.findUnique({
    where: { sellerId_code: { sellerId: input.vendeurId, code } },
    select: {
      id: true,
      code: true,
      type: true,
      amount: true,
      maxUses: true,
      usesCount: true,
      productIds: true,
      expiresAt: true,
      disabledAt: true,
    },
  });

  if (!ligne) return { ok: false, motif: "INCONNU" };
  if (ligne.disabledAt) return { ok: false, motif: "RETIRE" };

  const maintenant = input.maintenant ?? new Date();
  if (ligne.expiresAt && ligne.expiresAt.getTime() <= maintenant.getTime()) {
    return { ok: false, motif: "EXPIRE" };
  }

  if (ligne.maxUses !== null && ligne.usesCount >= ligne.maxUses) {
    return { ok: false, motif: "EPUISE" };
  }

  // `[]` veut dire « toutes les ressources du vendeur ». C'est écrit dans le
  // schéma, et c'est la valeur par défaut : un code créé sans choisir de
  // ressource vaut partout.
  const ciblees = Array.isArray(ligne.productIds)
    ? (ligne.productIds as unknown[]).map(String)
    : [];
  if (ciblees.length > 0 && !ciblees.includes(input.produitId)) {
    return { ok: false, motif: "AUTRE_RESSOURCE" };
  }

  const remise = remiseDe(ligne.type as TypeRemise, ligne.amount, input.prix);

  if (remise <= 0) return { ok: false, motif: "SANS_EFFET" };

  const prixFinal = input.prix - remise;
  if (prixFinal < prixPlancher()) return { ok: false, motif: "TROP_FORTE" };

  return {
    ok: true,
    offerCodeId: ligne.id,
    code: ligne.code,
    remise,
    prixFinal,
    prixAffiche: input.prix,
  };
}

/**
 * La remise en francs, quel que soit le type.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * L'ARRONDI VA VERS LE BAS, DONC VERS L'ACHETEUR
 *
 * `Math.floor` sur un pourcentage : à 33 % de 1 000 F, la remise est 330 et le
 * prix 670. Arrondir au plus proche donnerait 330 aussi, mais sur 1 015 F on
 * aurait 335 contre 334 — un franc de différence, toujours au détriment de
 * quelqu'un.
 *
 * Vers le bas, c'est toujours le vendeur qui garde le franc de reste. C'est
 * arbitraire et c'est écrit : une règle d'arrondi qu'on ne peut pas nommer est
 * une règle qui se redécidera différemment au prochain appel.
 *
 * Une remise fixe est bornée par le prix : un code « -10 000 F » sur une
 * ressource à 3 000 F ne rend pas 7 000 F à l'acheteur.
 */
export function remiseDe(
  type: TypeRemise,
  montant: number,
  prix: number,
): number {
  if (montant <= 0 || prix <= 0) return 0;

  if (type === "PERCENT") {
    const taux = Math.min(montant, 100);
    return Math.min(prix, Math.floor((prix * taux) / 100));
  }

  return Math.min(prix, montant);
}

/**
 * Consomme un usage, si le plafond le permet encore.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LE PLAFOND EST DANS LE `WHERE`, PAS DANS UN `IF`
 *
 * Deux acheteurs qui présentent le dernier exemplaire au même instant
 * liraient tous deux « 9 sur 10 » et écriraient tous deux « 10 ». Le plafond
 * serait dépassé d'un, et le compteur afficherait exactement la bonne valeur —
 * un défaut qui ne laisse aucune trace.
 *
 * `updateMany` avec la condition dans le `WHERE` laisse la base trancher : une
 * seule des deux écritures touche une ligne, l'autre en touche zéro et le sait.
 *
 * Rend faux quand le code vient d'être épuisé par quelqu'un d'autre. L'appelant
 * doit alors refuser la vente plutôt que l'accorder au prix remisé : c'est le
 * seul moment où la course se voit.
 */
export async function consommerLeCode(
  offerCodeId: string,
  client: Prisma.TransactionClient | typeof db = db,
): Promise<boolean> {
  const ligne = await client.offerCode.findUnique({
    where: { id: offerCodeId },
    select: { maxUses: true },
  });

  if (!ligne) return false;

  const { count } = await client.offerCode.updateMany({
    where: {
      id: offerCodeId,
      disabledAt: null,
      // Sans plafond, la seule condition est que le code existe encore.
      ...(ligne.maxUses === null
        ? {}
        : { usesCount: { lt: ligne.maxUses } }),
    },
    data: { usesCount: { increment: 1 } },
  });

  return count > 0;
}

/**
 * Rend un exemplaire consommé.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * SANS ELLE, DIX PANIERS ABANDONNÉS ÉPUISENT UN CODE À DIX USAGES
 *
 * C'est le défaut le plus silencieux de tout ce module, et il fallait le
 * chercher : `consommerLeCode` s'exécute à l'**ouverture** de la commande,
 * parce que c'est le seul instant où l'on peut réserver un exemplaire contre
 * la concurrence.
 *
 * Mais en mobile money, ouvrir n'est pas payer. L'invite part sur un téléphone
 * qui peut rester sans réponse — et c'est fréquent. Sans libération, chaque
 * hésitation mange un exemplaire : le vendeur annonce dix remises, personne
 * n'en reçoit, et le compteur affiche fidèlement « 10 / 10 ». Aucune erreur,
 * aucune trace, et une campagne qui n'a servi personne.
 *
 * Elle est appelée par `abandonnerVente`, qui est le passage obligé des deux
 * chemins d'échec — le refus de l'opérateur et la péremption à vingt-quatre
 * heures. Et cette fonction ne libère qu'une fois, parce que sa transition
 * d'état ne réussit qu'une fois.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LE PLANCHER À ZÉRO EST DANS LE `WHERE`
 *
 * Un décrément non gardé sur un compteur déjà nul donnerait `-1`, et le
 * plafond ne s'appliquerait plus jamais : `-1 < 10` reste vrai pour toujours.
 */
export async function libererLeCode(
  offerCodeId: string,
  client: Prisma.TransactionClient | typeof db = db,
): Promise<boolean> {
  const { count } = await client.offerCode.updateMany({
    where: { id: offerCodeId, usesCount: { gt: 0 } },
    data: { usesCount: { decrement: 1 } },
  });

  return count > 0;
}

// ────────────────────────────────────────────────────── administration ──

export interface LigneCodePromo {
  id: string;
  code: string;
  type: TypeRemise;
  montant: number;
  /** « -20 % » ou « -1 000 F », tel qu'on l'affiche. */
  libelleRemise: string;
  usages: number;
  plafond: number | null;
  expireLe: Date | null;
  retireLe: Date | null;
  /** Vraie quand le code n'accorde plus rien, pour quelque raison que ce soit. */
  inactif: boolean;
  /** Les ressources visées. Vide = toutes celles du vendeur. */
  produitIds: string[];
  creeLe: Date;
}

export async function listerLesCodes(
  vendeurId: string,
): Promise<LigneCodePromo[]> {
  const lignes = await db.offerCode.findMany({
    where: { sellerId: vendeurId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const maintenant = Date.now();

  return lignes.map((l) => {
    const produitIds = Array.isArray(l.productIds)
      ? (l.productIds as unknown[]).map(String)
      : [];

    const epuise = l.maxUses !== null && l.usesCount >= l.maxUses;
    const expire = l.expiresAt !== null && l.expiresAt.getTime() <= maintenant;

    return {
      id: l.id,
      code: l.code,
      type: l.type as TypeRemise,
      montant: l.amount,
      libelleRemise:
        l.type === "PERCENT" ? `-${l.amount} %` : `-${l.amount} F`,
      usages: l.usesCount,
      plafond: l.maxUses,
      expireLe: l.expiresAt,
      retireLe: l.disabledAt,
      inactif: Boolean(l.disabledAt) || epuise || expire,
      produitIds,
      creeLe: l.createdAt,
    };
  });
}

export type SuiteCreation =
  | { ok: true; id: string }
  | {
      ok: false;
      motif: "CODE_VIDE" | "DEJA_PRIS" | "MONTANT_INVALIDE" | "RESSOURCE_ETRANGERE";
    };

/**
 * Crée un code pour ce vendeur.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LES RESSOURCES VISÉES SONT VÉRIFIÉES
 *
 * Sans cela, un vendeur pourrait coller l'identifiant de la ressource d'un
 * autre dans `productIds`. Le code ne servirait à rien — `evaluerUnCode`
 * cherche par `sellerId` — mais l'écran afficherait une campagne sur un
 * produit qui n'est pas le sien, et personne ne comprendrait pourquoi elle ne
 * convertit pas.
 */
export async function creerUnCode(input: {
  vendeurId: string;
  code: string;
  type: TypeRemise;
  montant: number;
  plafond?: number | null;
  expireLe?: Date | null;
  produitIds?: string[];
}): Promise<SuiteCreation> {
  const code = normaliserCode(input.code);
  if (code.length < 3) return { ok: false, motif: "CODE_VIDE" };

  if (!Number.isInteger(input.montant) || input.montant <= 0) {
    return { ok: false, motif: "MONTANT_INVALIDE" };
  }
  if (input.type === "PERCENT" && input.montant > 100) {
    return { ok: false, motif: "MONTANT_INVALIDE" };
  }

  const produitIds = input.produitIds ?? [];

  if (produitIds.length > 0) {
    const siens = await db.product.count({
      where: { id: { in: produitIds }, sellerId: input.vendeurId },
    });
    if (siens !== produitIds.length) {
      return { ok: false, motif: "RESSOURCE_ETRANGERE" };
    }
  }

  const deja = await db.offerCode.findUnique({
    where: { sellerId_code: { sellerId: input.vendeurId, code } },
    select: { id: true },
  });
  if (deja) return { ok: false, motif: "DEJA_PRIS" };

  const cree = await db.offerCode.create({
    data: {
      sellerId: input.vendeurId,
      code,
      type: input.type,
      amount: input.montant,
      maxUses: input.plafond ?? null,
      expiresAt: input.expireLe ?? null,
      productIds: produitIds,
    },
    select: { id: true },
  });

  return { ok: true, id: cree.id };
}

/**
 * Retire un code, sans l'effacer.
 *
 * L'effacer perdrait la trace des ventes qui le citent — `OrderItem.offerCodeId`
 * pointerait dans le vide, et la question « combien cette campagne a-t-elle
 * rapporté ? » deviendrait sans réponse.
 *
 * `updateMany` avec le vendeur dans le `WHERE` : sans cela, connaître
 * l'identifiant d'un code suffirait à retirer celui d'un concurrent.
 */
export async function retirerUnCode(
  vendeurId: string,
  codeId: string,
): Promise<boolean> {
  const { count } = await db.offerCode.updateMany({
    where: { id: codeId, sellerId: vendeurId, disabledAt: null },
    data: { disabledAt: new Date() },
  });

  return count > 0;
}
