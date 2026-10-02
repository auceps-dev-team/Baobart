"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import type { LicenseCode, ProductFamily } from "@/lib/domain/prisma-types";

import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { FILTRES, familleDepuisLibelle, type Filtre } from "@/lib/feed/queries";
import {
  decouperMotsCles,
  tropDeMotsCles,
  prixRetenu,
  slugifier,
  type EtatProduit,
} from "@/lib/products/validation";

/**
 * Dépôt d'une ressource.
 *
 * Le geste qui fait passer un compte d'acheteur à créateur — voir
 * `lib/auth/roles.ts`. On enregistre toujours un **brouillon** : publier est un
 * second geste, délibéré, qui ouvre la vitrine publique.
 *
 * Un module `"use server"` ne peut exporter que des fonctions asynchrones : les
 * règles de saisie vivent donc dans `validation.ts`, où elles se testent sans
 * base ni requête.
 */

/** Slug unique : on suffixe tant que le précédent est pris. */
async function slugDisponible(base: string): Promise<string> {
  const racine = base.length > 0 ? base : "ressource";

  for (let i = 0; i < 50; i += 1) {
    const candidat = i === 0 ? racine : `${racine}-${i + 1}`;
    const pris = await db.product.findUnique({
      where: { slug: candidat },
      select: { id: true },
    });
    if (!pris) return candidat;
  }

  // Après cinquante homonymes, on tranche par l'horloge plutôt que de boucler.
  return `${racine}-${Date.now()}`;
}

function estCollisionUnique(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function creerBrouillon(
  _precedent: EtatProduit,
  donnees: FormData,
): Promise<EtatProduit> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const titre = String(donnees.get("titre") ?? "").trim();
  const familleLibelle = String(donnees.get("famille") ?? "");
  const licence = String(donnees.get("licence") ?? "COMMERCIAL");
  const motsClesBrut = String(donnees.get("motsCles") ?? "");
  const motsCles = decouperMotsCles(motsClesBrut);
  const description = String(donnees.get("description") ?? "").trim();
  const gratuit = donnees.get("gratuit") === "on";
  const prixBrut = String(donnees.get("prix") ?? "");

  // Renvoyée avec chaque refus : React vide les champs non contrôlés à la fin
  // d'une action, et perdre sa saisie sur une virgule oubliée est inacceptable.
  const saisie = {
    titre,
    famille: familleLibelle,
    licence,
    motsCles: motsClesBrut,
    description,
    prix: prixBrut,
    gratuit,
  };

  if (titre.length < 3) {
    return {
      erreur: "Donne un titre d'au moins 3 caractères.",
      champ: "titre",
      saisie,
    };
  }

  const tropDeMots = tropDeMotsCles(motsClesBrut);
  if (tropDeMots) return { erreur: tropDeMots, champ: "motsCles", saisie };

  const famille =
    (FILTRES as readonly string[]).includes(familleLibelle) &&
    familleLibelle !== "Tous"
      ? familleDepuisLibelle(familleLibelle as Filtre)
      : null;

  if (!famille) {
    return { erreur: "Choisis une catégorie.", champ: "famille", saisie };
  }

  const resultatPrix = prixRetenu(prixBrut, gratuit);
  if ("erreur" in resultatPrix) {
    return { erreur: resultatPrix.erreur, champ: "prix", saisie };
  }

  const baseSlug = slugifier(titre);

  // Prisma refuse de mélanger une clé étrangère brute (`sellerId`) et une
  // relation imbriquée dans la même création : on résout la licence avant.
  const typeDeLicence = await db.licenseType.upsert({
    where: { code: licence as LicenseCode },
    update: {},
    create: {
      code: licence as LicenseCode,
      title: "Licence",
      description: "Créée automatiquement au premier dépôt.",
    },
    select: { id: true },
  });

  for (let tentative = 0; tentative < 3; tentative += 1) {
    const slug = await slugDisponible(
      tentative === 0 ? baseSlug : `${baseSlug}-${Date.now()}-${tentative}`,
    );

    try {
      const produit: { id: string } = await db.product.create({
        data: {
          sellerId: utilisateur.id,
          slug,
          name: titre,
          description: description.length > 0 ? description : null,
          family: famille as ProductFamily,
          price: resultatPrix.prix,
          currency: "XOF",
          // Toujours un brouillon : la publication est un second geste.
          status: "DRAFT",
          licenseTypeId: typeDeLicence.id,
          tags: {
            create: motsCles.map((nom) => ({
              tag: {
                connectOrCreate: {
                  where: { slug: slugifier(nom) },
                  create: { slug: slugifier(nom), name: nom },
                },
              },
            })),
          },
        },
        select: { id: true },
      });

      redirect(`/dashboard/produits/${produit.id}`);
    } catch (error) {
      // `slugDisponible` évite les collisions ordinaires, mais deux créations
      // concurrentes peuvent encore choisir le même slug entre la lecture et le
      // create. On laisse la contrainte unique trancher, puis on retente.
      if (!estCollisionUnique(error) || tentative === 2) throw error;
    }
  }

  return { erreur: "Impossible de réserver une URL unique. Réessaie." };
}

/**
 * Ces trois actions partagent une règle : on vérifie toujours que la ressource
 * appartient à la personne connectée. Sans ça, un identifiant deviné suffirait
 * à publier ou supprimer le travail de quelqu'un d'autre.
 */
async function ressourceDe(userId: string, produitId: string) {
  const produit = await db.product.findUnique({
    where: { id: produitId },
    select: {
      id: true,
      sellerId: true,
      status: true,
      // Seuls les fichiers sources comptent : publier avec un aperçu et rien
      // à télécharger reste une vente impossible à honorer.
      _count: {
        select: { files: { where: { role: "SOURCE", deletedAt: null } } },
      },
    },
  });

  return produit && produit.sellerId === userId ? produit : null;
}

/**
 * Une ressource sous retrait juridique n'obéit plus à son auteur.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SANS CETTE GARDE, LE RETRAIT SE DÉFAIT EN UN CLIC
 *
 * `SUSPENDED` est posé par `lib/juridique/retrait.ts` sur notification (loi
 * 2013-451). Les quatre gestes ci-dessous appartiennent au propriétaire, et
 * trois d'entre eux annuleraient le retrait sans rien signaler :
 *
 *   publier      remet en ligne ce que la plateforme devait retirer ;
 *   dépublier    passe en DRAFT, donc sort de SUSPENDED — et la restauration
 *                du dossier ne retrouverait plus rien à rendre ;
 *   modifier     laisse changer le contenu contesté pendant l'examen ;
 *   supprimer    efface la pièce avant que le dossier soit tranché.
 *
 * Le dernier est le plus grave : le dossier reste ouvert, le notifiant attend,
 * et l'objet du litige n'existe plus. La suppression en cascade emporterait
 * même la ligne de `LegalSuspension`.
 *
 * On redirige plutôt qu'on ne lève : l'auteur n'a rien fait de mal en
 * cliquant, et l'écran lui dit où lire le dossier.
 */
function refuserSiRetiree(produit: { id: string; status: string }): void {
  if (produit.status === "SUSPENDED") {
    redirect(`/dashboard/produits/${produit.id}?erreur=retrait-juridique`);
  }
}

/** Ouvre la vitrine : le second geste, celui qui rend la ressource visible. */
export async function publierRessource(produitId: string): Promise<void> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const produit = await ressourceDe(utilisateur.id, produitId);
  if (!produit) notFound();
  refuserSiRetiree(produit);

  // Une ressource sans fichier est invendable : l'acheteur paierait et
  // n'aurait rien à télécharger. On refuse la publication plutôt que de la
  // laisser produire une commande impossible à honorer.
  if (produit._count.files === 0) {
    redirect(`/dashboard/produits/${produit.id}?erreur=sans-fichier`);
  }

  await db.product.update({
    where: { id: produit.id },
    data: { status: "PUBLISHED" },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/produits/${produit.id}`);
  redirect(`/dashboard/produits/${produit.id}`);
}

/**
 * Retire la ressource de la vente sans la détruire.
 *
 * Elle redevient un brouillon : ce qui a déjà été vendu reste acquis aux
 * acheteurs, seule la mise en vente s'arrête.
 */
export async function depublierRessource(produitId: string): Promise<void> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const produit = await ressourceDe(utilisateur.id, produitId);
  if (!produit) notFound();
  refuserSiRetiree(produit);

  await db.product.update({
    where: { id: produit.id },
    data: { status: "DRAFT" },
  });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/produits/${produit.id}`);
  redirect(`/dashboard/produits/${produit.id}`);
}

/**
 * Supprime définitivement une ressource.
 *
 * Refusée dès qu'elle a été vendue : un acheteur garde un droit sur ce qu'il a
 * payé, et l'écriture comptable qui s'y rattache ne doit pas devenir orpheline.
 * On propose alors de dépublier, qui répond au même besoin sans effacer le
 * passé.
 */
export async function supprimerRessource(produitId: string): Promise<void> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const produit = await ressourceDe(utilisateur.id, produitId);
  if (!produit) notFound();
  refuserSiRetiree(produit);

  const ventes = await db.orderItem.count({ where: { productId: produit.id } });
  if (ventes > 0) {
    redirect(`/dashboard/produits/${produit.id}?erreur=vendue`);
  }

  await db.productTag.deleteMany({ where: { productId: produit.id } });
  await db.product.delete({ where: { id: produit.id } });

  revalidatePath("/dashboard");
  redirect("/dashboard/produits");
}

/**
 * Corriger une ressource après coup.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ELLE MANQUAIT, ET C'EST LE MÊME DÉFAUT QUE §21.1
 *
 * On pouvait créer, publier, dépublier et supprimer — jamais **modifier**. Une
 * faute dans un titre ou un prix mal tapé n'avait qu'une issue : supprimer et
 * tout recommencer, ce qui perd les fichiers déjà envoyés, et se refuse dès
 * qu'une vente a eu lieu.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE SLUG NE BOUGE PAS, MÊME SI LE TITRE CHANGE
 *
 * C'est la décision qui mérite d'être écrite, parce que l'inverse semble plus
 * propre : une ressource renommée devrait avoir une URL qui lui ressemble.
 *
 * Sauf que cette URL est **publique**. Elle a été partagée, mise en favori,
 * peut-être indexée. La recalculer casserait tous ces liens d'un coup, en
 * silence, et la personne qui corrige une faute de frappe dans son titre n'a
 * aucune raison de s'attendre à cela.
 *
 * Un slug est une adresse, pas un résumé. Il est choisi une fois.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON PEUT MODIFIER UNE RESSOURCE EN LIGNE
 *
 * Sans la dépublier d'abord : corriger un prix ou une description sur une
 * fiche publiée est le cas le plus courant, et obliger à la retirer la ferait
 * disparaître des listes le temps de la correction — pour une virgule.
 */
export async function modifierRessource(
  produitId: string,
  _precedent: EtatProduit,
  donnees: FormData,
): Promise<EtatProduit> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const produit = await ressourceDe(utilisateur.id, produitId);
  if (!produit) notFound();
  refuserSiRetiree(produit);

  const titre = String(donnees.get("titre") ?? "").trim();
  const familleLibelle = String(donnees.get("famille") ?? "");
  const licence = String(donnees.get("licence") ?? "COMMERCIAL");
  const motsClesBrut = String(donnees.get("motsCles") ?? "");
  const motsCles = decouperMotsCles(motsClesBrut);
  const description = String(donnees.get("description") ?? "").trim();
  const gratuit = donnees.get("gratuit") === "on";
  const prixBrut = String(donnees.get("prix") ?? "");

  const saisie = {
    titre,
    famille: familleLibelle,
    licence,
    motsCles: motsClesBrut,
    description,
    prix: prixBrut,
    gratuit,
  };

  // Les mêmes règles qu'à la création, et pour la même raison : une ressource
  // corrigée doit rester aussi valable qu'une ressource neuve.
  if (titre.length < 3) {
    return { erreur: "Donne un titre d'au moins 3 caractères.", champ: "titre", saisie };
  }

  const tropDeMots = tropDeMotsCles(motsClesBrut);
  if (tropDeMots) return { erreur: tropDeMots, champ: "motsCles", saisie };

  const famille =
    (FILTRES as readonly string[]).includes(familleLibelle) &&
    familleLibelle !== "Tous"
      ? familleDepuisLibelle(familleLibelle as Filtre)
      : null;

  if (!famille) {
    return { erreur: "Choisis une catégorie.", champ: "famille", saisie };
  }

  const resultatPrix = prixRetenu(prixBrut, gratuit);
  if ("erreur" in resultatPrix) {
    return { erreur: resultatPrix.erreur, champ: "prix", saisie };
  }

  const typeDeLicence = await db.licenseType.upsert({
    where: { code: licence as LicenseCode },
    update: {},
    create: {
      code: licence as LicenseCode,
      title: "Licence",
      description: "Créée automatiquement au premier dépôt.",
    },
    select: { id: true },
  });

  await db.product.update({
    where: { id: produit.id },
    data: {
      name: titre,
      description: description.length > 0 ? description : null,
      family: famille as ProductFamily,
      price: resultatPrix.prix,
      licenseTypeId: typeDeLicence.id,
      // `slug` absent de ce `data` : voir l'en-tête.
    },
  });

  // Les mots-clés se remplacent en bloc plutôt que de se réconcilier un par
  // un : la liste est courte, et un diff introduirait un ordre de suppression
  // et d'ajout dont personne n'a besoin ici.
  await db.productTag.deleteMany({ where: { productId: produit.id } });
  for (const nom of motsCles) {
    await db.productTag.create({
      data: {
        // `product: { connect }` plutôt que `productId` : Prisma refuse de
        // mêler une clé étrangère brute et une relation imbriquée dans le
        // même `data`. Le même piège est signalé plus haut, à la création.
        product: { connect: { id: produit.id } },
        tag: {
          connectOrCreate: {
            where: { slug: slugifier(nom) },
            create: { slug: slugifier(nom), name: nom },
          },
        },
      },
    });
  }

  revalidatePath("/dashboard/produits");
  revalidatePath(`/dashboard/produits/${produit.id}`);

  return { ok: true, saisie };
}
