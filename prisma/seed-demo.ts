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
  {
    username: "awa-diallo",
    displayName: "Awa Diallo",
    city: "Dakar",
    speciality: "Illustration & motifs",
    portfolioUrl: "awadiallo.com",
    instagram: "@awa.draws",
    openToCommissions: "Oui, sous 2 semaines",
    dailyRate: 45_000,
  },
  {
    username: "kwame-mensah",
    displayName: "Kwame Mensah",
    city: "Accra",
    speciality: "Motion design",
    portfolioUrl: "kwame.studio",
    instagram: "@kwame.motion",
    openToCommissions: "Complet jusqu'en septembre",
    dailyRate: 60_000,
  },
  {
    username: "fatoumata-gnahore",
    displayName: "Fatoumata Gnahoré",
    city: "Abidjan",
    speciality: "Direction artistique",
    portfolioUrl: "fatou.africa",
    instagram: "@fatou.da",
    openToCommissions: "Oui, sous 1 mois",
    dailyRate: 75_000,
  },
  {
    username: "chidi-okonkwo",
    displayName: "Chidi Okonkwo",
    city: "Lagos",
    speciality: "Typographie",
    portfolioUrl: "chidi.type",
    instagram: "@chidi.type",
    openToCommissions: "Oui, immédiatement",
    dailyRate: 50_000,
  },
];

/**
 * Les visuels viennent du dossier de design, recopiés dans `public/img/demo/`.
 * Sans eux la mosaïque n'affiche que sa trame de repli, et on ne peut pas
 * comparer honnêtement le rendu aux maquettes.
 */
const RESSOURCES: Array<{
  name: string;
  family: ProductFamily;
  price: number;
  cover?: string;
  staffPicked?: boolean;
}> = [
  { name: "Portrait Wax Éditorial", family: "PHOTO", price: 0, cover: "beaute-afro.jpg", staffPicked: true },
  { name: "Illu Femme au Foulard", family: "ILLUSTRATION", price: 5_000, cover: "mode-rouge.jpg" },
  { name: "Collage Lunettes", family: "ILLUSTRATION", price: 10_000, cover: "collage-lunettes.jpg", staffPicked: true },
  { name: "Pack 20 motifs wax", family: "PACK", price: 25_000, cover: "neon-01.png" },
  { name: "Mockup affiche Sandaga", family: "MOCKUP", price: 7_500, cover: "packshot-soin.png" },
  { name: "Typo Sahel Display", family: "FONT", price: 18_000, cover: "neon-02.png" },
  { name: "Icônes transport Abidjan", family: "ICONE", price: 4_000 },
  { name: "Logo coopérative textile", family: "LOGO", price: 0 },
  { name: "Studio Dakar — série nuit", family: "PHOTO", price: 12_000, cover: "studio-01.png" },
  { name: "Peinture Émeraude", family: "ART", price: 180_000, cover: "emeraude.png" },
  { name: "Boucle kora — 12 samples", family: "AUDIO", price: 9_000 },
  { name: "Motion néon Lagos", family: "VIDEO", price: 30_000, cover: "neon-03.png" },
  { name: "Portraits marché Kermel", family: "PHOTO", price: 0, cover: "mode-blanc-01.png" },
  { name: "Pack icônes cuisine ouest", family: "ICONE", price: 6_000 },
  { name: "Illu Danseuse Sabar", family: "ILLUSTRATION", price: 8_500, cover: "robe-bleue.png" },
  { name: "Mockup packaging beurre de karité", family: "MOCKUP", price: 11_000, cover: "studio-02.png" },
  { name: "Typo Adinkra Mono", family: "FONT", price: 22_000 },
  { name: "Affiche Wax Futurism", family: "ART", price: 15_000, cover: "neon-04.png" },
  { name: "Nappe sonore Harmattan", family: "AUDIO", price: 5_500 },
  { name: "Logotype Baobab moderne", family: "LOGO", price: 13_000, cover: "neon-05.png" },
  { name: "Pack 40 textures terre", family: "PACK", price: 28_000, cover: "studio-03.png" },
  { name: "Timelapse marché de Treichville", family: "VIDEO", price: 0, cover: "mode-blanc-02.png" },
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
            speciality: c.speciality,
            portfolioUrl: c.portfolioUrl,
            instagram: c.instagram,
            openToCommissions: c.openToCommissions,
            dailyRate: c.dailyRate,
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

    const produit = await db.product.upsert({
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
        coverUrl: r.cover ? `/img/demo/${r.cover}` : null,
        isStaffPicked: r.staffPicked ?? false,
        staffPickedAt: r.staffPicked ? createdAt : null,
        createdAt,
      },
    });

    // Un fichier par ressource : sans lui, le panneau « Détails » de la fiche
    // n'a ni format, ni dimensions, ni poids à afficher.
    const dejaLa = await db.productFile.findFirst({
      where: { productId: produit.id },
      select: { id: true },
    });

    if (!dejaLa) {
      const extension = r.cover?.endsWith(".jpg") ? "jpg" : "png";
      const media = await db.mediaAsset.create({
        data: {
          ownerId: createur.id,
          purpose: "product",
          s3Key: `demo/${produit.slug}.${extension}`,
          checksum: produit.id,
          sizeBytes: 4_000_000 + index * 1_500_000,
          contentType: `image/${extension === "jpg" ? "jpeg" : "png"}`,
          width: 2400,
          height: 1600,
          status: "READY",
        },
      });

      await db.productFile.create({
        data: {
          productId: produit.id,
          mediaId: media.id,
          filename: `${produit.slug}.${extension}`,
          sizeBytes: media.sizeBytes,
        },
      });
    }

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
