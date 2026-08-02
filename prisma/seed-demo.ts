/**
 * Jeu de démonstration pour le feed.
 *
 * Distinct de `seed.ts`, qui ne contient que des données de RÉFÉRENCE (plans,
 * licences, badges) et doit tourner en production. Celui-ci ne sert qu'au
 * développement : il peuple le feed pour qu'on puisse le regarder.
 *
 *   pnpm db:seed:demo
 */

import { PrismaClient, type ProductFamily } from "@prisma/client";

const db = new PrismaClient();

const CREATEURS = [
  { username: "awa-diallo", displayName: "Awa Diallo", city: "Dakar" },
  { username: "kwame-mensah", displayName: "Kwame Mensah", city: "Accra" },
  { username: "fatoumata-gnahore", displayName: "Fatoumata Gnahoré", city: "Abidjan" },
  { username: "chidi-okonkwo", displayName: "Chidi Okonkwo", city: "Lagos" },
];

const RESSOURCES: Array<{
  name: string;
  family: ProductFamily;
  price: number;
  staffPicked?: boolean;
}> = [
  { name: "Portrait Wax Éditorial", family: "PHOTO", price: 0, staffPicked: true },
  { name: "Illu Femme au Foulard", family: "ILLUSTRATION", price: 5_000 },
  { name: "Collage Lunettes", family: "ILLUSTRATION", price: 10_000, staffPicked: true },
  { name: "Pack 20 motifs wax", family: "PACK", price: 25_000 },
  { name: "Mockup affiche Sandaga", family: "MOCKUP", price: 7_500 },
  { name: "Typo Sahel Display", family: "FONT", price: 18_000 },
  { name: "Icônes transport Abidjan", family: "ICONE", price: 4_000 },
  { name: "Logo coopérative textile", family: "LOGO", price: 0 },
  { name: "Studio Dakar — série nuit", family: "PHOTO", price: 12_000 },
  { name: "Peinture Émeraude", family: "ART", price: 180_000 },
  { name: "Boucle kora — 12 samples", family: "AUDIO", price: 9_000 },
  { name: "Motion néon Lagos", family: "VIDEO", price: 30_000 },
  { name: "Portraits marché Kermel", family: "PHOTO", price: 0 },
  { name: "Pack icônes cuisine ouest", family: "ICONE", price: 6_000 },
  { name: "Illu Danseuse Sabar", family: "ILLUSTRATION", price: 8_500 },
  { name: "Mockup packaging beurre de karité", family: "MOCKUP", price: 11_000 },
  { name: "Typo Adinkra Mono", family: "FONT", price: 22_000 },
  { name: "Affiche Wax Futurism", family: "ART", price: 15_000 },
  { name: "Nappe sonore Harmattan", family: "AUDIO", price: 5_500 },
  { name: "Logotype Baobab moderne", family: "LOGO", price: 13_000 },
  { name: "Pack 40 textures terre", family: "PACK", price: 28_000 },
  { name: "Timelapse marché de Treichville", family: "VIDEO", price: 0 },
];

function slugifier(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  const createurs = [];

  for (const c of CREATEURS) {
    const user = await db.user.upsert({
      where: { email: `${c.username}@baobart.demo` },
      update: {},
      create: {
        email: `${c.username}@baobart.demo`,
        riskState: "COMPLIANT",
        kycStatus: "VERIFIED",
        profile: {
          create: {
            username: c.username,
            displayName: c.displayName,
            city: c.city,
            country: "SN",
            isVerified: true,
          },
        },
      },
    });
    createurs.push(user);
  }

  // Publié sur plusieurs jours : la pagination par curseur n'a de sens que si
  // les dates de création diffèrent réellement.
  const depart = Date.now() - RESSOURCES.length * 3_600_000;

  let index = 0;
  for (const r of RESSOURCES) {
    const createur = createurs[index % createurs.length]!;
    const createdAt = new Date(depart + index * 3_600_000);

    await db.product.upsert({
      where: { slug: slugifier(r.name) },
      update: {},
      create: {
        sellerId: createur.id,
        slug: slugifier(r.name),
        name: r.name,
        family: r.family,
        price: r.price,
        currency: "XOF",
        status: "PUBLISHED",
        isStaffPicked: r.staffPicked ?? false,
        staffPickedAt: r.staffPicked ? createdAt : null,
        createdAt,
      },
    });
    index += 1;
  }

  console.log(
    `Démo : ${createurs.length} créateurs, ${RESSOURCES.length} ressources publiées.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
