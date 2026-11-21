/**
 * Les valeurs du pire cas réaliste (skill Halo `break-ui`), sans base de données :
 * importées par `pire-cas.ts`, qui les pose en développement, et par le test au
 * navigateur `e2e/pire-cas.spec.ts`, qui les pose dans la base e2e.
 *
 * Les limites réelles, lues dans le code le 20/11/2026 :
 *
 *   nom affiché   80 à la modification du profil (lib/profil/validation.ts:80) ;
 *                 AUCUNE à l'inscription (lib/auth/actions.ts:310 : prénom + nom).
 *   identifiant   40 (lib/profil/validation.ts:82), lettres, chiffres et tirets ;
 *                 AUCUNE longueur maximale à l'inscription.
 *   bio           600 (lib/profil/validation.ts:83).
 *   titre         AUCUNE longueur maximale, ni au formulaire
 *                 (components/dashboard/product-form.tsx:163) ni au serveur
 *                 (lib/products/actions.ts:85 et :364) — 3 au minimum.
 *
 * Là où il n'y a pas de limite, le skill demande « quelque chose de long mais
 * crédible », pas 5 000 caractères.
 */

export const DOMAINE = "pire-cas.test";
export const PREFIXE = "pire-cas-";

export const PIRE_CAS = {
  /** Le créateur aux valeurs longues. Son identifiant fait 40 caractères, sans tiret : rien où couper. */
  createurLong: {
    email: `marie-francoise.ndiaye-kouyate.studio-graphique-independant@dakar-plateau.${DOMAINE}`,
    username: "studiographiqueindependantdakarplateau01",
    displayName: "Marie-Françoise Aïssatou Ndiaye-Kouyaté épouse Diallo — Studio Graphique Dakar-Plateau",
    city: "Saint-Louis-du-Sénégal",
  },
  /** Le créateur aux valeurs courtes : deux lettres, aucun abonné, une seule œuvre. */
  createurCourt: { email: `jo@${DOMAINE}`, username: "jox", displayName: "Jo" },
  /** L'acheteur au suffixe (des initiales naïves donnent « CI ») et à l'adresse insécable. */
  acheteur: {
    email: `christopher.alexander.montgomery.iii+factures-studio@northwind-holdings.${DOMAINE}`,
    username: "christopher-alexander-montgomery-iii",
    displayName: "Christopher Alexander Montgomery III",
  },
  /** L'acheteuse dont le nom commence par une séquence d'emoji (un `.charAt(0)` en rend la moitié). */
  acheteuseEmoji: { email: `priya@${DOMAINE}`, username: "priya-code", displayName: "👩🏽‍💻 Priya" },
  produits: [
    {
      cle: "long",
      name:
        "Kit d'identité visuelle complet pour restaurants, maquis et traiteurs de Dakar : logo, menus, enseignes et visuels pour les réseaux sociaux (fichiers sources inclus)",
      price: 12_345_678,
      salesCount: 1_284,
      likesCount: 1_000_000,
      downloadsCount: 98_765,
      commentsCount: 1,
      ratingCount: 1_284,
      ratingAvg: 4.75,
    },
    { cle: "insecable", name: "Affiches_Concert_Abidjan_2026_FINAL_v12_HD_imprimable_A2-A3.zip", price: 1, salesCount: 1, likesCount: 1, ratingCount: 1, ratingAvg: 1 },
    { cle: "court", name: "Zen", price: 0, salesCount: 0, likesCount: 0, ratingCount: 0, ratingAvg: 0 },
    { cle: "emoji", name: "🎨✨ Pinceaux Procreate — collection Wax & Bogolan", price: 2_500, salesCount: 12, likesCount: 99, ratingCount: 2, ratingAvg: 3.5 },
    { cle: "arabe", name: "خط عربي للمصممين — calligraphie arabe pour affiches", price: 5_000, salesCount: 3, likesCount: 7, ratingCount: 0, ratingAvg: 0 },
    { cle: "echappement", name: "<b>Promo</b> &amp; **gras** — gabarits Canva", price: 1_500, salesCount: 2, likesCount: 2, ratingCount: 0, ratingAvg: 0 },
  ],
} as const;

export const BIO =
  "Graphiste indépendante installée entre Saint-Louis et Dakar depuis 2014. J'accompagne les restaurants, maquis, " +
  "traiteurs et petites marques de cosmétiques dans leur identité visuelle : logo, charte, menus, enseignes, " +
  "emballages et contenus pour Instagram, TikTok et WhatsApp Business. Tous mes fichiers sont livrés en sources " +
  "(Illustrator, Photoshop, Figma, Canva) avec un guide d'utilisation en français et en wolof. Commandes sur mesure " +
  "possibles : délai moyen de deux semaines, paiement par Wave ou Orange Money, facture fournie. Membre du collectif " +
  "Graphistes du Fleuve, formatrice à l'ISM et marraine du programme Jeunes Talents 2025.";

export const DESCRIPTION = Array.from(
  { length: 6 },
  (_, i) =>
    `Partie ${i + 1}. Ce kit réunit tout ce qu'il faut pour lancer ou rafraîchir l'image d'un établissement de restauration : ` +
    "un logo décliné en trois versions (couleur, noir, blanc), une charte de quatre pages, trois modèles de menu au format A4 " +
    "et A3, une enseigne de façade, des cartes de visite, et quarante visuels prêts à publier pour les réseaux sociaux.",
).join("\n\n");
