import { z } from "zod";

/**
 * Le texte des messages transactionnels, et rien d'autre.
 *
 * Module pur : il transforme une charge utile en sujet et corps. Aucune base,
 * aucun réseau — ce qui rend le contenu des messages éprouvable, et c'est
 * précieux : une faute dans un reçu d'achat part chez tous les acheteurs à la
 * fois, sans possibilité de rappel.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI VALIDER LA CHARGE
 *
 * Elle vient de la base, en JSON, écrite parfois des jours plus tôt par une
 * version antérieure du code. Sans contrôle, un champ renommé produit
 * « Bonjour undefined » — et l'erreur ne se voit qu'une fois le message parti.
 * Mieux vaut un envoi qui échoue bruyamment qu'un message absurde délivré.
 */

export const MODELES = [
  "BIENVENUE",
  "REINITIALISATION_MOT_DE_PASSE",
  "RECU_ACHAT",
  "LIEN_TELECHARGEMENT",
  "AVIS_VERSEMENT",
] as const;

export type Modele = (typeof MODELES)[number];

export interface Message {
  sujet: string;
  texte: string;
}

/**
 * Un sujet ne contient jamais de retour à la ligne.
 *
 * Historiquement, un saut de ligne dans un sujet permet d'injecter des en-têtes
 * — un `Bcc:` ajouté par l'appelant, et le message part à des inconnus. Les API
 * modernes en JSON ferment cette porte, mais la donnée traverse aussi des
 * journaux et des écrans, et un sujet sur trois lignes y casse tout. On coupe à
 * la source plutôt que de faire confiance au transport.
 */
function sujetSur(brut: string): string {
  return brut.replace(/[\r\n]+/g, " ").trim().slice(0, 200);
}

const nom = z.string().min(1).max(120);
/**
 * Un lien, et seulement en http(s).
 *
 * `z.string().url()` s'appuie sur `new URL()`, qui accepte tout schéma —
 * `javascript:`, `data:`, `file:`. Un tel lien dans un courriel est au mieux
 * mort, au pire un hameçonnage signé de notre nom. On restreint donc.
 */
const lien = z
  .string()
  .url()
  .refine(
    (v) => {
      try {
        const p = new URL(v).protocol;
        return p === "http:" || p === "https:";
      } catch {
        return false;
      }
    },
    { message: "doit être une adresse http(s)" },
  );

const SCHEMAS = {
  BIENVENUE: z.object({ nom }),
  REINITIALISATION_MOT_DE_PASSE: z.object({ nom, lien, heures: z.number().int().positive() }),
  RECU_ACHAT: z.object({
    nom,
    ressource: z.string().min(1).max(200),
    montant: z.string().min(1).max(40),
    /**
     * Vers l'espace de l'acheteur, jamais vers le fichier.
     *
     * Facultatif : sans `APP_URL`, le reçu part quand même — il vaut preuve de
     * paiement, et c'est ce qui compte le jour d'une contestation.
     */
    lien: lien.optional(),
  }),
  /**
   * ────────────────────────────────────────────────────────────────────────
   * CE MODÈLE N'EST DÉLIBÉRÉMENT DÉPOSÉ PAR PERSONNE
   *
   * Son texte annonce un lien « valable un temps limité » : une URL signée,
   * donc. Or une URL signée est un laissez-passer au porteur. Envoyée par
   * courriel, elle contourne tout ce que `app/api/telechargement` vérifie au
   * moment du clic — commande remboursée, paiement contesté, accès retiré par
   * le créateur, abonnement échu, quota épuisé. Le message dormirait dans une
   * boîte, réexpédiable, encore valide après le remboursement.
   *
   * Le reçu d'achat porte donc un lien vers l'espace de l'acheteur, où ces
   * vérifications ont lieu à chaque fois. Ce modèle-ci attend un usage où le
   * porteur n'a pas de compte — un cadeau, un achat pour un tiers — et il
   * faudra alors lui donner sa propre péremption courte.
   */
  LIEN_TELECHARGEMENT: z.object({
    nom,
    ressource: z.string().min(1).max(200),
    lien,
  }),
  AVIS_VERSEMENT: z.object({
    nom,
    montant: z.string().min(1).max(40),
    compte: z.string().min(1).max(60),
  }),
} satisfies Record<Modele, z.ZodTypeAny>;

export type ChargeDe<M extends Modele> = z.infer<(typeof SCHEMAS)[M]>;

const SIGNATURE = "\n\n— L'équipe Baobart\n";

const TEXTES: {
  [M in Modele]: (c: ChargeDe<M>) => Message;
} = {
  BIENVENUE: (c) => ({
    sujet: `Bienvenue sur Baobart, ${c.nom}`,
    texte:
      `Bonjour ${c.nom},\n\n` +
      `Ton compte est ouvert. Tu peux déjà parcourir le catalogue et ` +
      `télécharger ce qui est offert.\n\n` +
      `Quand tu voudras vendre, dépose une ressource : la boutique s'ouvre ` +
      `toute seule au premier dépôt.` +
      SIGNATURE,
  }),

  REINITIALISATION_MOT_DE_PASSE: (c) => ({
    sujet: "Réinitialiser ton mot de passe Baobart",
    texte:
      `Bonjour ${c.nom},\n\n` +
      `Voici le lien pour choisir un nouveau mot de passe :\n${c.lien}\n\n` +
      `Il expire dans ${c.heures} heure(s).\n\n` +
      `Si tu n'as rien demandé, ignore ce message : ton mot de passe actuel ` +
      `reste valable.` +
      SIGNATURE,
  }),

  RECU_ACHAT: (c) => ({
    sujet: `Ton achat : ${c.ressource}`,
    texte:
      `Bonjour ${c.nom},\n\n` +
      `Merci pour ton achat.\n\n` +
      `  ${c.ressource}\n  ${c.montant}\n\n` +
      `Retrouve le fichier dans ton espace, rubrique « Mes achats ». Il y ` +
      `reste disponible.` +
      (c.lien ? `

${c.lien}` : "") +
      SIGNATURE,
  }),

  LIEN_TELECHARGEMENT: (c) => ({
    sujet: `Ton téléchargement : ${c.ressource}`,
    texte:
      `Bonjour ${c.nom},\n\n` +
      `Voici ton lien pour « ${c.ressource} » :\n${c.lien}\n\n` +
      `Ce lien est personnel et n'est valable qu'un temps limité. Passé ce ` +
      `délai, reprends-le depuis ton espace.` +
      SIGNATURE,
  }),

  AVIS_VERSEMENT: (c) => ({
    sujet: `Versement en route : ${c.montant}`,
    texte:
      `Bonjour ${c.nom},\n\n` +
      `Un versement de ${c.montant} part vers ${c.compte}.\n\n` +
      `Le délai dépend de l'opérateur — compte un à trois jours ouvrés.` +
      SIGNATURE,
  }),
};

export class ChargeInvalide extends Error {
  constructor(modele: Modele, detail: string) {
    super(`Charge invalide pour ${modele} : ${detail}`);
    this.name = "ChargeInvalide";
  }
}

/**
 * Rend un message, ou lève.
 *
 * Lever plutôt que renvoyer un message dégradé est délibéré : la file
 * enregistrera l'échec, l'écran de supervision le montrera, et personne ne
 * recevra un texte à trous.
 */
export function rendre(modele: Modele, charge: unknown): Message {
  const schema = SCHEMAS[modele];
  if (!schema) throw new ChargeInvalide(modele, "modèle inconnu");

  const lu = schema.safeParse(charge);
  if (!lu.success) {
    const detail = lu.error.issues
      .map((i) => `${i.path.join(".") || "(racine)"} ${i.message}`)
      .join(" ; ");
    throw new ChargeInvalide(modele, detail);
  }

  const rendu = (TEXTES[modele] as (c: unknown) => Message)(lu.data);
  return { sujet: sujetSur(rendu.sujet), texte: rendu.texte };
}
