/**
 * Quatre comptes pour parcourir l'application à la main.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE N'EST PAS LE SEED DE DÉMO
 *
 * `prisma/seed-demo.ts` fabrique du **contenu** — des créateurs et des
 * ressources pour que les listes ne soient pas vides. Ses comptes n'ont pas de
 * mot de passe : ils ne servent qu'à remplir l'écran, et l'on ne s'y connecte
 * pas.
 *
 * Ici, on fabrique des **identités connectables**, chacune positionnée là où
 * un écran l'attend :
 *
 *   — un créateur qui a déjà publié, sans quoi l'Atelier et la Boutique
 *     restent verrouillés (`deduireProgression` lit les produits publiés) ;
 *   — un client nu, pour éprouver l'achat depuis le début ;
 *   — un administrateur, pour les CMS et l'exploitation ;
 *   — une agence abonnée et badgée, la seule combinaison qui ouvre la
 *     publication de services (§18.3).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL EST REJOUABLE
 *
 * Tout passe par `upsert` sur l'adresse. Le relancer remet chaque compte dans
 * l'état attendu — c'est ce qu'on veut après avoir cassé quelque chose en
 * testant, et c'est pourquoi le mot de passe est réécrit à chaque passage.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL REFUSE DE TOURNER AILLEURS QU'EN DÉVELOPPEMENT
 *
 * Il pose des mots de passe connus et publie des produits sans paiement. Sur
 * une base de production, ce serait quatre portes ouvertes. La garde est
 * grossière — on regarde l'adresse de la base — mais elle est franche : mieux
 * vaut refuser un cas légitime que créer un compte administrateur dont le mot
 * de passe est dans un dépôt Git.
 */

import { PrismaClient } from "@prisma/client";

// `lib/auth/password` importe `server-only`, qui refuse de se charger hors
// d'un composant serveur. `--conditions=react-server` le résout vers le module
// vide que le paquet fournit pour ce cas — c'est ce que fait déjà le script
// des versements, et c'est pourquoi ce fichier se lance par `pnpm comptes:test`
// et non par un `tsx` nu.
import { hacherMotDePasse } from "@/lib/auth/password";

const db = new PrismaClient();

/** Le même pour les quatre : on les enchaîne en testant. */
const MOT_DE_PASSE = "Baobart2026!";

function refuserSiCeNEstPasDuDeveloppement() {
  const url = process.env.DATABASE_URL ?? "";
  const local =
    url.includes("localhost") || url.includes("127.0.0.1") || url.includes("baobart_test");

  if (!local) {
    console.error(
      "Refus : DATABASE_URL ne pointe pas sur une base locale.\n" +
        "Ce script pose des mots de passe connus — il n'a rien à faire ailleurs qu'en développement.",
    );
    process.exit(1);
  }
}

interface Compte {
  cle: string;
  email: string;
  username: string;
  nom: string;
  role: "MEMBER" | "SUPER_ADMIN";
  ville: string;
  /** Produits publiés à lui attribuer — c'est ce qui fait de lui un vendeur. */
  produits: { nom: string; prix: number }[];
  /** Badge professionnel, pour les services (§18.3). */
  badge?: "FREELANCE" | "AGENCE";
  /** Abonnement en cours, pour les services aussi. */
  abonne?: boolean;
  aQuoiCaSert: string;
}

const COMPTES: Compte[] = [
  {
    cle: "createur",
    email: "createur@baobart.test",
    username: "awa-createur",
    nom: "Awa Diallo",
    role: "MEMBER",
    ville: "Abidjan",
    produits: [
      { nom: "Pack 12 illustrations wax", prix: 15_000 },
      { nom: "Photographies studio — lot de 30", prix: 25_000 },
      { nom: "Police display Baobab", prix: 8_000 },
    ],
    aQuoiCaSert: "Tableaux de bord créateur : Atelier, Boutique, ventes, gains, versements.",
  },
  {
    cle: "client",
    email: "client@baobart.test",
    username: "kofi-client",
    nom: "Kofi Mensah",
    role: "MEMBER",
    ville: "Accra",
    // Aucun produit : c'est un acheteur, et son tableau de bord doit le
    // montrer — les écrans vendeur restent verrouillés, ce qui est le cas
    // qu'on veut éprouver.
    produits: [],
    aQuoiCaSert: "Parcours d'achat de bout en bout, et tableau de bord acheteur.",
  },
  {
    cle: "admin",
    email: "admin@baobart.test",
    username: "admin-baobart",
    nom: "Administration Baobart",
    role: "SUPER_ADMIN",
    ville: "Abidjan",
    produits: [],
    aQuoiCaSert:
      "CMS (Jobs, Services, Événements), file de modération, système, versements, rôles.",
  },
  {
    cle: "agence",
    email: "agence@baobart.test",
    username: "atelier-sankofa",
    nom: "Atelier Sankofa",
    role: "MEMBER",
    ville: "Dakar",
    produits: [{ nom: "Identité visuelle — étude de cas", prix: 45_000 }],
    badge: "AGENCE",
    abonne: true,
    aQuoiCaSert:
      "Jobs (dépôt d'offre, candidatures reçues) et Services — la seule identité qui peut publier un service.",
  },
];

function slugifier(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function poser(compte: Compte, empreinte: string) {
  const user = await db.user.upsert({
    where: { email: compte.email },
    update: {
      passwordHash: empreinte,
      platformRole: compte.role,
      riskState: "COMPLIANT",
      kycStatus: "VERIFIED",
      suspendedAt: null,
    },
    create: {
      email: compte.email,
      passwordHash: empreinte,
      platformRole: compte.role,
      riskState: "COMPLIANT",
      kycStatus: "VERIFIED",
      profile: {
        create: {
          username: compte.username,
          displayName: compte.nom,
          city: compte.ville,
          country: "CI",
          isVerified: true,
        },
      },
    },
    select: { id: true },
  });

  // Le profil peut manquer si le compte préexistait sans lui.
  await db.profile.upsert({
    where: { userId: user.id },
    update: { displayName: compte.nom, city: compte.ville },
    create: {
      userId: user.id,
      username: compte.username,
      displayName: compte.nom,
      city: compte.ville,
      country: "CI",
      isVerified: true,
    },
  });

  // ── Les produits, publiés ────────────────────────────────────────────────
  //
  // `deduireProgression` compte les produits PUBLISHED : c'est ce compteur,
  // et lui seul, qui ouvre l'Atelier puis la Boutique. Un brouillon ne
  // suffirait pas, et l'on chercherait longtemps pourquoi l'écran reste
  // verrouillé.
  for (const p of compte.produits) {
    const slug = slugifier(`${compte.username}-${p.nom}`);
    await db.product.upsert({
      where: { slug },
      update: { status: "PUBLISHED" },
      create: {
        sellerId: user.id,
        slug,
        name: p.nom,
        description: `Ressource de test appartenant à ${compte.nom}.`,
        price: p.prix,
        status: "PUBLISHED",
        type: "DIGITAL",
      },
    });
  }

  // ── Le badge professionnel ───────────────────────────────────────────────
  if (compte.badge) {
    const badge = await db.badge.findUnique({
      where: { code: compte.badge },
      select: { id: true },
    });

    if (!badge) {
      console.warn(
        `  ⚠ badge ${compte.badge} absent — lance « pnpm db:seed » d'abord.`,
      );
    } else {
      await db.userBadge.upsert({
        where: { userId_badgeId: { userId: user.id, badgeId: badge.id } },
        update: {},
        create: { userId: user.id, badgeId: badge.id },
      });
    }
  }

  // ── L'abonnement ─────────────────────────────────────────────────────────
  //
  // Sans lui, le badge ne suffit pas : §18.3 exige les trois conditions
  // ensemble. On prend le plan le plus cher — c'est celui qui ouvre le plus
  // d'écrans à regarder.
  if (compte.abonne) {
    const plan = await db.plan.findFirst({
      orderBy: { priceMonthly: "desc" },
      select: { id: true },
    });

    if (!plan) {
      console.warn("  ⚠ aucun plan en base — lance « pnpm db:seed » d'abord.");
    } else {
      const existant = await db.subscription.findFirst({
        where: { userId: user.id },
        select: { id: true },
      });

      const cycleStart = new Date();
      // Trente jours devant : l'abonnement est ACTIVE et loin de l'échéance,
      // donc il n'apparaît dans aucune file de relance pendant les essais.
      const cycleEnd = new Date(cycleStart.getTime() + 30 * 86_400_000);

      if (existant) {
        await db.subscription.update({
          where: { id: existant.id },
          data: { status: "ACTIVE", cycleStart, cycleEnd, cancelledAt: null },
        });
      } else {
        await db.subscription.create({
          data: {
            userId: user.id,
            planId: plan.id,
            status: "ACTIVE",
            cycleStart,
            cycleEnd,
            cadence: "MENSUEL",
          },
        });
      }
    }
  }

  return user.id;
}

async function main() {
  refuserSiCeNEstPasDuDeveloppement();

  const empreinte = await hacherMotDePasse(MOT_DE_PASSE);

  console.log("\nComptes de test — Baobart\n");

  for (const compte of COMPTES) {
    const id = await poser(compte, empreinte);
    console.log(`  ${compte.email}`);
    console.log(`    rôle      ${compte.role}`);
    console.log(`    profil    /@${compte.username}`);
    if (compte.produits.length > 0) {
      console.log(`    produits  ${compte.produits.length} publiés`);
    }
    if (compte.badge) console.log(`    badge     ${compte.badge}`);
    if (compte.abonne) console.log(`    abonné    oui (30 jours devant)`);
    console.log(`    pour      ${compte.aQuoiCaSert}`);
    console.log(`    id        ${id}`);
    console.log("");
  }

  console.log(`  Mot de passe commun : ${MOT_DE_PASSE}\n`);
}

main()
  .catch((cause) => {
    console.error(cause);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
