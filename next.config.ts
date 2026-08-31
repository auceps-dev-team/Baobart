import type { NextConfig } from "next";

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
