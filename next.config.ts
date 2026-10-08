import type { NextConfig } from "next";

import { entetesDeSecurite } from "./lib/securite/entetes";

/**
 * Hôtes autorisés pour l'optimiseur d'images.
 *
 * Il n'y en a qu'un : celui d'où viennent les aperçus. La configuration
 * précédente ouvrait `https://**`, c'est-à-dire un proxy d'images vers tout
 * Internet — n'importe qui pouvait faire transiter n'importe quelle image par
 * le domaine Baobart, à nos frais et sous notre nom. Et pour rien : aucun
 * `<Image>` du dépôt ne pointe ailleurs que sur `/img/`.
 *
 * Dérivé de `S3_PUBLIC_URL` plutôt qu'écrit en dur : le stockage change entre
 * le développement, la préproduction et la production, et une liste figée
 * casserait l'une des trois.
 */
function hotesDesApercus(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const brut = process.env.S3_PUBLIC_URL ?? process.env.S3_ENDPOINT;
  if (!brut) return [];

  try {
    const url = new URL(brut);
    return [
      {
        protocol: url.protocol.replace(":", "") as "http" | "https",
        hostname: url.hostname,
        port: url.port || undefined,
      },
    ];
  } catch {
    // Une URL illisible ne doit pas empêcher le build : on n'autorise
    // simplement personne, et les aperçus passent par leur `background-image`
    // comme aujourd'hui.
    return [];
  }
}

const nextConfig: NextConfig = {
  // Sortie « standalone » : requise par l'image Docker (SPEC_DEPLOIEMENT §2),
  // mais elle crée des symlinks que Windows refuse hors mode développeur, et
  // Vercel n'en veut pas. Le Dockerfile pose BUILD_STANDALONE=1 ; ailleurs on
  // s'en passe.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  reactStrictMode: true,
  // `X-Powered-By: Next.js` n'apprend rien à un visiteur et tout à quelqu'un
  // qui cherche une version vulnérable.
  poweredByHeader: false,

  /**
   * Les en-têtes de sécurité, sur toutes les réponses. Ce qu'ils couvrent et
   * pourquoi la CSP n'observe encore qu'en silence : `lib/securite/entetes.ts`.
   */
  async headers() {
    return [{ source: "/:path*", headers: entetesDeSecurite(process.env) }];
  },

  /**
   * Où le build dépose ses artefacts.
   *
   * ═══════════════════════════════════════════════════════════════════════
   * POURQUOI C'EST RÉGLABLE
   *
   * `next build` et `next dev` écrivent tous les deux dans `.next`. Lancer un
   * build pendant qu'un serveur de développement tourne corrompt son cache :
   * il répond ensuite `Cannot find module './vendor-chunks/…'` avec un 500 là
   * où l'on attendait un 404. La panne ne ressemble en rien à sa cause, et
   * elle survit au rechargement de la page.
   *
   * `NEXT_DIST_DIR=.next-verif pnpm build` permet de vérifier qu'un build
   * passe sans toucher au serveur ouvert. Rien n'est changé par défaut : la
   * production et l'intégration continue écrivent toujours dans `.next`.
   *
   * Un détail à ne pas oublier : `next build` **réécrit `tsconfig.json`** pour
   * y ajouter le chemin de ses types — donc `.next-verif/types/…` quand on
   * passe par ici. Le fichier est à remettre en l'état après la vérification
   * (`git checkout -- tsconfig.json`), sinon la ligne part au commit et
   * désigne un dossier que personne d'autre n'a.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",

  /**
   * L'adresse courte d'un créateur : `/@awa-diallo`.
   *
   * ───────────────────────────────────────────────────────────────────
   * POURQUOI UNE RÉÉCRITURE PLUTÔT QU'UN DOSSIER `app/@[username]`
   *
   * Dans l'App Router, un dossier qui commence par `@` déclare une **route
   * parallèle**, pas un segment d'URL. `app/@[username]` créerait donc un slot
   * nommé `[username]` et ne servirait jamais `/@awa-diallo`.
   *
   * L'autre voie — un dossier dynamique à la racine — attraperait **toutes** les
   * adresses de premier niveau et masquerait chaque route à venir.
   *
   * La réécriture garde l'adresse courte de la maquette et une arborescence
   * lisible. Le `@` est obligatoire dans le motif : sans lui, on retomberait
   * sur le problème du dossier attrape-tout.
   */
  async rewrites() {
    return [{ source: "/@:username", destination: "/createurs/:username" }];
  },
  typedRoutes: true,

  /**
   * Ce que le bundler ne doit PAS empaqueter.
   *
   * `ioredis` est un module Node : il ouvre des sockets et lit des fichiers. Il
   * n'a rien à faire dans un graphe de composants — mais il y entre sans qu'on
   * le veuille, parce que la limitation vit dans `lib/auth/actions.ts`, que
   * presque chaque page importe pour son bouton de déconnexion.
   *
   * Le déclarer externe évite au bundler d'essayer de le suivre. Ce n'est pas
   * une correction de panne — la seule qu'on cherchait venait d'ailleurs — mais
   * une hygiène : un client Redis n'a pas à traverser l'analyse de dépendances
   * d'un graphe de composants, et le jour où il le fera mal, la faute sera
   * illisible.
   */
  serverExternalPackages: ["ioredis"],
  images: {
    // Les médias (shots, produits) vivent sur S3/CDN, jamais en base (PLAN §8.2).
    remotePatterns: hotesDesApercus(),
  },
};

export default nextConfig;
