"use server";

import { redirect } from "next/navigation";

import type { LicenseCode, ProductFamily } from "@prisma/client";

import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { FILTRES, familleDepuisLibelle, type Filtre } from "@/lib/feed/queries";
import {
  decouperMotsCles,
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

  const slug = await slugDisponible(slugifier(titre));

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

  const produit = await db.product.create({
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
}
