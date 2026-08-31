import { PrismaClient } from "@prisma/client";

/**
 * Le jeu de données que les parcours consomment.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SON PROPRE CLIENT, ET SA PROPRE URL
 *
 * `lib/db` lit `DATABASE_URL` au moment de l'import. Le processus de test, lui,
 * a l'environnement de développement — c'est le serveur lancé par Playwright
 * qui reçoit celui du navigateur. Réutiliser `lib/db` ici écrirait donc dans la
 * base de développement, silencieusement, et les parcours ne verraient jamais
 * leurs propres données.
 *
 * D'où un client à part, avec l'URL passée explicitement.
 */
const url =
  process.env.DATABASE_URL_E2E ??
  "postgresql://baobart:baobart@localhost:5433/baobart_e2e?schema=public";

export const db = new PrismaClient({ datasources: { db: { url } } });

/**
 * Un suffixe unique par appel.
 *
 * Les parcours ne vident pas la base entre eux — voir `preparation.ts`. Chacun
 * doit donc fabriquer ses propres comptes, sans quoi le second échouerait sur
 * une adresse déjà prise, et l'échec ressemblerait à un bogue d'inscription.
 */
let compteur = 0;
export function unique(prefixe: string): string {
  compteur += 1;
  return `${prefixe}${Date.now().toString(36)}${compteur}`;
}

export interface RessourceVendable {
  produitId: string;
  slug: string;
  nom: string;
  prix: number;
  vendeurId: string;
}

/**
 * Une ressource publiée, avec son fichier, prête à être achetée.
 *
 * Créée directement en base plutôt que par l'interface : le dépôt d'un fichier
 * passe par une URL signée et un envoi au stockage, ce qui éprouve MinIO plus
 * que Baobart. Ce parcours-là mérite son propre test ; celui-ci veut une
 * ressource achetable, pas une démonstration d'envoi de fichier.
 */
export async function ressourceVendable(
  prix = 5_000,
): Promise<RessourceVendable> {
  const marque = unique("e2e");

  const vendeur = await db.user.create({
    data: {
      email: `vendeur-${marque}@baobart.test`,
      profile: {
        create: { username: `vendeur-${marque}`, displayName: `Vendeur ${marque}` },
      },
    },
    select: { id: true },
  });

  const nom = `Ressource ${marque}`;
  const slug = `ressource-${marque}`;

  const produit = await db.product.create({
    data: {
      sellerId: vendeur.id,
      name: nom,
      slug,
      price: prix,
      currency: "XOF",
      status: "PUBLISHED",
    },
    select: { id: true },
  });

  const media = await db.mediaAsset.create({
    data: {
      ownerId: vendeur.id,
      purpose: "product",
      s3Key: `produits/${produit.id}/${marque}.zip`,
      checksum: "e2e",
      contentType: "application/zip",
      sizeBytes: 2048,
      status: "READY",
    },
    select: { id: true },
  });

  await db.productFile.create({
    data: {
      productId: produit.id,
      mediaId: media.id,
      filename: `${marque}.zip`,
      sizeBytes: 2048,
      role: "SOURCE",
      position: 0,
    },
  });

  return { produitId: produit.id, slug, nom, prix, vendeurId: vendeur.id };
}

/** Les identifiants d'un compte que le parcours va créer par l'interface. */
export function nouveauCompte() {
  const marque = unique("ach");
  return {
    prenom: "Awa",
    nom: "Diallo",
    username: `awa${marque}`,
    email: `awa-${marque}@baobart.test`,
    motDePasse: "UnMotDePasseSolide2026!",
  };
}
