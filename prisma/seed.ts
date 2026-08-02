/**
 * Données de référence Baobart.
 *
 * Idempotent (upsert) : relançable sans risque à chaque migration.
 * Les chiffres viennent du PLAN §2.3 (plans), de SPEC_LICENCES (licences) et
 * de SPEC_GAMIFICATION (badges). Les montants sont en unité mineure XOF,
 * c'est-à-dire en FCFA entiers.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function seedPlans() {
  const plans = [
    {
      code: "DISCOVERY" as const,
      name: "Découverte",
      priceMonthly: 0,
      downloadsPerMonth: 3,
      licenseIncluded: null,
      shieldLevel: "NONE" as const,
      features: {
        resolution: "basse, filigranée",
        services: "voir + commenter",
      },
    },
    {
      code: "EXPLORER" as const,
      name: "Explorer",
      priceMonthly: 2_500,
      downloadsPerMonth: 15,
      licenseIncluded: "PERSONAL" as const,
      shieldLevel: "WATERMARK_ONLY" as const,
      features: { resolution: "HD", services: "réserver" },
    },
    {
      code: "STUDIO" as const,
      name: "Studio",
      priceMonthly: 7_500,
      downloadsPerMonth: null, // illimité
      licenseIncluded: "COMMERCIAL" as const,
      shieldLevel: "PERTURBATION" as const,
      features: {
        resolution: "HD / sources",
        services: "réserver + priorité",
        badge: "Membre Studio",
        earlyAccess: true,
      },
    },
  ];

  for (const plan of plans) {
    await db.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
  }

  return plans.length;
}

async function seedLicenseTypes() {
  const licenses = [
    {
      code: "PERSONAL" as const,
      title: "Licence personnelle",
      description:
        "Usage privé et projets non commerciaux. Pas de revente, pas de redistribution.",
      conditions: { commercial: false, print: false, resale: false },
      pricePremium: null,
    },
    {
      code: "COMMERCIAL" as const,
      title: "Licence commerciale",
      description:
        "Usage en clientèle et projets commerciaux, un projet à la fois. Pas de revente du fichier source.",
      conditions: { commercial: true, print: true, resale: false },
      pricePremium: null,
    },
    {
      code: "EXTENDED" as const,
      title: "Licence étendue",
      description:
        "Print, édition, broadcast et merchandising. À acquérir par produit.",
      conditions: {
        commercial: true,
        print: true,
        edition: true,
        broadcast: true,
        merchandising: true,
      },
      pricePremium: 25_000,
    },
  ];

  for (const license of licenses) {
    await db.licenseType.upsert({
      where: { code: license.code },
      update: license,
      create: license,
    });
  }

  return licenses.length;
}

async function seedBadges() {
  const badges = [
    {
      code: "VERIFIED_CREATOR" as const,
      name: "Créateur vérifié",
      description: "Identité, téléphone et portfolio vérifiés (KYC).",
      criteria: { kyc: "verified", phone: "verified", portfolio: "min 3 shots" },
    },
    {
      code: "TOP_CREATOR" as const,
      name: "Top créateur",
      description:
        "Ventes et engagement élevés sur une période glissante. Jamais achetable.",
      criteria: { window: "90 jours", signals: ["ventes", "likes", "saves", "note"] },
    },
    {
      code: "NEW_TALENT" as const,
      name: "Nouveau talent",
      description: "Ascension rapide d'un compte récent.",
      criteria: { accountAgeDays: 90, growth: "percentile 90" },
    },
    {
      code: "COMMUNITY_PILLAR" as const,
      name: "Pilier de la communauté",
      description: "Contribution au forum, entraide, modération.",
      criteria: { window: "180 jours", signals: ["réponses utiles", "modération"] },
    },
    {
      code: "VIP_CREATOR" as const,
      name: "VIP",
      description:
        "Seuil de payouts cumulés atteint. Statut automatique, objectif et transparent.",
      criteria: { cumulativePayoutsXOF: 3_000_000 },
    },
  ];

  for (const badge of badges) {
    await db.badge.upsert({
      where: { code: badge.code },
      update: badge,
      create: badge,
    });
  }

  return badges.length;
}

async function main() {
  const plans = await seedPlans();
  const licenses = await seedLicenseTypes();
  const badges = await seedBadges();

  console.log(
    `Seed terminé : ${plans} plans, ${licenses} types de licence, ${badges} badges.`,
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
