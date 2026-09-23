import "server-only";

import { db } from "@/lib/db";

/**
 * Champs personnalisés au passage en caisse — §3.4-F.
 *
 * Traduit `custom_field.rb` (antiwork/gumroad, MIT, lu comme spécification).
 * Le modèle `CustomField` existait depuis le premier schéma sans qu'aucune
 * ligne ne le lise.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * QUATRE TYPES SERVIS, UN DÉCLARÉ ET REFUSÉ
 *
 * `TEXT`, `CHOICE`, `BOOLEAN` et `TERMS` se remplissent dans le formulaire et
 * repartent avec lui. `FILE`, non : il faudrait une URL signée, un
 * téléversement direct vers le stockage et une réservation à confirmer —
 * c'est-à-dire tout le chemin de `lib/upload/`, **avant** le paiement, sur un
 * réseau mobile.
 *
 * Le déclarer sans le servir donnerait un champ que l'acheteur voit et ne peut
 * pas remplir, et qui bloquerait l'achat s'il est obligatoire. On le refuse
 * donc à la création, avec un message qui le dit — plutôt que de le laisser
 * passer et de découvrir le trou côté acheteur.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES RÉPONSES SONT FIGÉES SUR LA LIGNE DE COMMANDE
 *
 * Même raison que le prix : le vendeur peut renommer un champ, en changer les
 * choix ou le supprimer après la vente. Relire la définition pour afficher une
 * réponse passée montrerait « Taille : M » sous un champ devenu « Couleur ».
 *
 * On stocke donc `[{ nom, valeur }]` — le libellé tel qu'il était, et la
 * réponse. Sans identifiant de champ : un champ supprimé laisserait une
 * réponse orpheline qu'on ne saurait plus nommer.
 */

export const TYPES_CHAMP = ["TEXT", "CHOICE", "BOOLEAN", "TERMS"] as const;

export type TypeChamp = (typeof TYPES_CHAMP)[number];

/**
 * Déclaré au schéma, refusé à la création.
 *
 * Nommé plutôt que passé sous silence : quelqu'un qui lit le schéma verra
 * `FILE` et cherchera pourquoi il ne marche pas. La constante est ce qui rend
 * le refus explicite dans le code, et pas seulement dans un commentaire.
 */
export const TYPE_NON_SERVI = "FILE";

export interface ChampDeclare {
  id: string;
  nom: string;
  type: TypeChamp;
  obligatoire: boolean;
  /** Les choix, pour un champ `CHOICE`. Vide sinon. */
  options: string[];
  position: number;
}

/** Les champs d'une ressource, dans l'ordre où le vendeur les a posés. */
export async function champsDe(produitId: string): Promise<ChampDeclare[]> {
  const lignes = await db.customField.findMany({
    where: { productId: produitId },
    orderBy: [{ position: "asc" }, { id: "asc" }],
  });

  return lignes
    .filter((l): l is typeof l & { fieldType: TypeChamp } =>
      TYPES_CHAMP.includes(l.fieldType as TypeChamp),
    )
    .map((l) => ({
      id: l.id,
      nom: l.name,
      type: l.fieldType,
      obligatoire: l.isRequired,
      options: Array.isArray(l.options) ? (l.options as unknown[]).map(String) : [],
      position: l.position,
    }));
}

export interface Reponse {
  nom: string;
  valeur: string;
}

export type MotifRefusChamp = "MANQUANT" | "CHOIX_INCONNU" | "TROP_LONG";

export type SuiteReponses =
  | { ok: true; reponses: Reponse[] }
  | { ok: false; motif: MotifRefusChamp; champ: string };

/**
 * Valide ce que l'acheteur a rempli, et rend ce qu'on figera.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA VALIDATION EST CÔTÉ SERVEUR, ET ELLE EST LA SEULE QUI COMPTE
 *
 * Le formulaire porte `required` et une liste de choix, et un navigateur les
 * fait respecter. Un `POST` direct ne passe par aucun navigateur : sans ce
 * contrôle, un champ obligatoire serait vide et un choix pourrait valoir
 * n'importe quoi — dans une vente déjà payée, qu'on ne peut plus corriger.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UN CHAMP FACULTATIF LAISSÉ VIDE NE PRODUIT PAS DE RÉPONSE
 *
 * Écrire `{ nom: "Dédicace", valeur: "" }` ferait afficher au vendeur une
 * ligne vide qu'il lirait comme une réponse. L'absence se dit par l'absence.
 */
export function validerLesReponses(
  champs: ChampDeclare[],
  saisies: Record<string, string>,
): SuiteReponses {
  const reponses: Reponse[] = [];

  for (const champ of champs) {
    const brut = (saisies[champ.id] ?? "").trim();

    if (champ.type === "BOOLEAN" || champ.type === "TERMS") {
      const coche = brut === "on" || brut === "true" || brut === "1";

      // `TERMS` obligatoire veut dire « il faut cocher », pas « il faut
      // répondre » : une case décochée sur des conditions à accepter est un
      // refus, pas un oubli.
      if (champ.obligatoire && !coche) {
        return { ok: false, motif: "MANQUANT", champ: champ.nom };
      }

      if (coche) reponses.push({ nom: champ.nom, valeur: "oui" });
      continue;
    }

    if (!brut) {
      if (champ.obligatoire) {
        return { ok: false, motif: "MANQUANT", champ: champ.nom };
      }
      continue;
    }

    if (champ.type === "CHOICE" && !champ.options.includes(brut)) {
      return { ok: false, motif: "CHOIX_INCONNU", champ: champ.nom };
    }

    // Deux cents caractères : de quoi écrire une dédicace ou une taille, pas
    // de quoi coller un roman dans une colonne JSON que le vendeur lira dans
    // un tableau.
    if (brut.length > 200) {
      return { ok: false, motif: "TROP_LONG", champ: champ.nom };
    }

    reponses.push({ nom: champ.nom, valeur: brut });
  }

  return { ok: true, reponses };
}

export const MESSAGES_CHAMP: Record<MotifRefusChamp, string> = {
  MANQUANT: "Ce champ est obligatoire.",
  CHOIX_INCONNU: "Ce choix n'existe pas.",
  TROP_LONG: "Deux cents caractères au maximum.",
};

export type SuiteDeclarationChamp =
  | { ok: true; id: string }
  | {
      ok: false;
      motif:
        | "RESSOURCE_ETRANGERE"
        | "TYPE_NON_SERVI"
        | "TYPE_INCONNU"
        | "NOM_VIDE"
        | "CHOIX_MANQUANTS";
    };

/**
 * Déclare un champ sur une ressource.
 *
 * La ressource doit être au vendeur — sans quoi on poserait une question sur
 * la page d'achat d'un concurrent.
 */
export async function declarerUnChamp(input: {
  vendeurId: string;
  produitId: string;
  nom: string;
  type: string;
  obligatoire?: boolean;
  options?: string[];
}): Promise<SuiteDeclarationChamp> {
  const nom = input.nom.trim();
  if (nom.length < 2) return { ok: false, motif: "NOM_VIDE" };

  if (input.type === TYPE_NON_SERVI) {
    return { ok: false, motif: "TYPE_NON_SERVI" };
  }
  if (!TYPES_CHAMP.includes(input.type as TypeChamp)) {
    return { ok: false, motif: "TYPE_INCONNU" };
  }

  const options = (input.options ?? [])
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  // Un `CHOICE` sans choix est une liste déroulante vide : l'acheteur ne peut
  // rien sélectionner, et s'il est obligatoire, l'achat devient impossible.
  if (input.type === "CHOICE" && options.length < 2) {
    return { ok: false, motif: "CHOIX_MANQUANTS" };
  }

  const sienne = await db.product.count({
    where: { id: input.produitId, sellerId: input.vendeurId },
  });
  if (sienne !== 1) return { ok: false, motif: "RESSOURCE_ETRANGERE" };

  const dernier = await db.customField.findFirst({
    where: { productId: input.produitId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const cree = await db.customField.create({
    data: {
      productId: input.produitId,
      name: nom,
      fieldType: input.type,
      isRequired: input.obligatoire ?? false,
      position: (dernier?.position ?? -1) + 1,
      options: input.type === "CHOICE" ? options : [],
    },
    select: { id: true },
  });

  return { ok: true, id: cree.id };
}

/**
 * Retire un champ.
 *
 * Les réponses déjà données ne bougent pas : elles sont figées sur les lignes
 * de commande, avec le libellé de l'époque. C'est tout l'intérêt de les y
 * avoir écrites.
 */
export async function retirerUnChamp(
  vendeurId: string,
  champId: string,
): Promise<boolean> {
  const champ = await db.customField.findUnique({
    where: { id: champId },
    select: { productId: true },
  });
  if (!champ) return false;

  const sienne = await db.product.count({
    where: { id: champ.productId, sellerId: vendeurId },
  });
  if (sienne !== 1) return false;

  await db.customField.delete({ where: { id: champId } });
  return true;
}

/** Les réponses figées sur une ligne de commande, pour l'affichage. */
export function reponsesDe(brut: unknown): Reponse[] {
  if (!Array.isArray(brut)) return [];

  return brut
    .filter(
      (r): r is { nom: unknown; valeur: unknown } =>
        typeof r === "object" && r !== null && "nom" in r && "valeur" in r,
    )
    .map((r) => ({ nom: String(r.nom), valeur: String(r.valeur) }));
}
