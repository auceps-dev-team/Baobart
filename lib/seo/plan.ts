import "server-only";

import type { MetadataRoute } from "next";

import { urlDuSite } from "@/lib/config/site";
import { db } from "@/lib/db";
import { journal } from "@/lib/observabilite/journal";

/**
 * Le plan du site et les consignes aux robots d'indexation.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI ILS MANQUAIENT, ET CE QU'ILS ACHÈTENT
 *
 * Mesuré le 05/10 et le 08/10/2026 : ni `app/sitemap.ts`, ni `app/robots.ts`,
 * ni `public/robots.txt`. Un moteur ne trouvait les fiches qu'en suivant les
 * liens d'une page à l'autre — et le feed est paginé par curseur, au défilement :
 * ce qui n'est pas dans la première page ne se découvre jamais.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA RÈGLE : LE PLAN NE LISTE QUE CE QUE LA PAGE ACCEPTERAIT D'AFFICHER
 *
 * Chaque requête ci-dessous reprend la condition de la page qu'elle désigne :
 *
 *   — une ressource : `status = PUBLISHED`, comme `obtenirProduit` ;
 *   — un article : `state = PUBLIE`, la `CLAUSE_PUBLIQUE` de `lib/blog` ;
 *   — un créateur : un compte non suspendu qui a au moins une ressource
 *     publiée, comme `profilPublic` — un acheteur n'a pas de vitrine.
 *
 * Une URL du plan qui répond 404 n'est pas une simple perte : un moteur qui en
 * rencontre beaucoup cesse de faire confiance au plan entier.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QUE ÇA NE FAIT PAS
 *
 *   — sans `APP_URL`, pas de plan : il exige des adresses absolues, et deviner
 *     le domaine depuis la requête est précisément ce que `urlDuSite` refuse ;
 *   — au-delà de `PLAFOND` ressources, le plan s'arrête aux plus récentes. Le
 *     protocole en admet 50 000 par fichier ; le découpage en plusieurs plans
 *     viendra le jour où le catalogue en approchera ;
 *   — `Disallow` n'est PAS une protection : il demande poliment aux robots
 *     honnêtes de ne pas visiter. Les pages privées restent gardées par leur
 *     propre contrôle de session.
 */

/** Les pages fixes ouvertes à tous, de la plus à la moins importante. */
export const PAGES_PUBLIQUES = [
  "/",
  "/explore",
  "/createurs",
  "/blog",
  "/tarifs",
  "/fonctionnalites",
  "/communautes",
  "/evenements",
  "/jobs",
  "/services",
  "/a-propos",
  "/licences",
  "/documentation",
  "/sponsoriser",
  "/contact",
  "/support",
  "/regles-de-publication",
  "/changelog",
  "/conditions",
  "/confidentialite",
  "/cookies",
] as const;

/**
 * Ce que les robots n'ont pas à parcourir : l'espace connecté, les tunnels
 * d'achat, les formulaires et les liens à usage unique. Les visiter ne
 * révélerait rien — chaque page se garde elle-même — mais gaspillerait le
 * budget d'exploration et ferait apparaître « Connexion » dans les résultats.
 */
export const CHEMINS_EXCLUS = [
  "/dashboard",
  "/api/",
  "/achat/",
  "/acheter/",
  "/abonnement/",
  "/connexion",
  "/inscription",
  "/mot-de-passe-oublie",
  "/reinitialiser/",
  "/infolettre/",
  "/jobs/deposer",
  "/jobs/mes-propositions",
  "/jobs/*/postuler",
  "/services/deposer",
  "/signalement",
  "/communautes/nouvelle",
] as const;

const PLAFOND = 10_000;

export interface Contenus {
  ressources: { slug: string; updatedAt: Date }[];
  articles: { slug: string; updatedAt: Date }[];
  createurs: { username: string; updatedAt: Date }[];
}

/** Assemble le plan. Pur : un test l'exerce sans base. */
export function assemblerPlan(
  base: string,
  contenus: Contenus,
): MetadataRoute.Sitemap {
  return [
    ...PAGES_PUBLIQUES.map((chemin) => ({
      url: `${base}${chemin === "/" ? "" : chemin}`,
    })),
    ...contenus.ressources.map((r) => ({
      url: `${base}/products/${encodeURIComponent(r.slug)}`,
      lastModified: r.updatedAt,
    })),
    ...contenus.articles.map((a) => ({
      url: `${base}/blog/${encodeURIComponent(a.slug)}`,
      lastModified: a.updatedAt,
    })),
    ...contenus.createurs.map((c) => ({
      url: `${base}/createurs/${encodeURIComponent(c.username)}`,
      lastModified: c.updatedAt,
    })),
  ];
}

async function lireContenus(): Promise<Contenus> {
  const [ressources, articles, createurs] = await Promise.all([
    db.product.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: PLAFOND,
    }),
    db.blogPost.findMany({
      where: { state: "PUBLIE" },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: "desc" },
      take: PLAFOND,
    }),
    db.profile.findMany({
      where: {
        user: {
          suspendedAt: null,
          products: { some: { status: "PUBLISHED" } },
        },
      },
      select: { username: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: PLAFOND,
    }),
  ]);
  return { ressources, articles, createurs };
}

export async function planDuSite(): Promise<MetadataRoute.Sitemap> {
  const base = urlDuSite();
  if (!base) return [];

  try {
    return assemblerPlan(base, await lireContenus());
  } catch (cause) {
    // Une base indisponible ne doit pas faire répondre 500 au plan : un moteur
    // qui reçoit une erreur réessaie plus tard ; les pages fixes, elles, ne
    // dépendent de rien.
    journal.erreur("plan du site : contenus illisibles", {
      cause: cause instanceof Error ? cause.message : String(cause),
    });
    return assemblerPlan(base, { ressources: [], articles: [], createurs: [] });
  }
}

export function consignesAuxRobots(): MetadataRoute.Robots {
  const base = urlDuSite();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: [...CHEMINS_EXCLUS] }],
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
