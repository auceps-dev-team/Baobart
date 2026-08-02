import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sortie « standalone » : requise par l'image Docker (SPEC_DEPLOIEMENT §2),
  // mais elle crée des symlinks que Windows refuse hors mode développeur.
  // Le Dockerfile pose BUILD_STANDALONE=1 ; en local, on s'en passe.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  reactStrictMode: true,
  typedRoutes: true,
  images: {
    // Les médias (shots, produits) vivent sur S3/CDN, jamais en base (PLAN §8.2).
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
