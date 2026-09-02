import type { Metadata, Viewport } from "next";
import { Archivo_Black, Poppins, Space_Mono } from "next/font/google";

import "./globals.css";

/**
 * Les trois voix de la charte, réellement chargées.
 *
 * Elles étaient nommées dans `globals.css` mais aucun fichier n'était servi :
 * le navigateur retombait sur Arial Black et sur son monospace par défaut, et
 * les titres ne ressemblaient pas aux maquettes. Nommer une police ne la charge
 * pas.
 *
 * `next/font` la sert depuis notre propre domaine plutôt que depuis Google :
 * une requête de moins vers un tiers, aucune adresse IP de visiteur transmise
 * au passage, et surtout pas de saut de mise en page — la métrique de repli est
 * calculée à la compilation pour occuper la même place que la police finale.
 */

const archivo = Archivo_Black({
  subsets: ["latin"],
  weight: "400", // la fonte n'existe qu'en une graisse
  variable: "--police-titre",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--police-texte",
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--police-donnees",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Baobart. — Le studio partagé de l'Afrique créative",
  description:
    "Publier, découvrir, vendre. Du premier croquis au premier encaissement, en FCFA.",
  // `app/manifest.ts` sert le fichier ; cette ligne le déclare à la page. Sans
  // elle, le manifeste existe et personne ne le lit — rien n'est installable.
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    // iOS ignore le manifeste et lit ces balises-là. Sans elles, l'ajout à
    // l'écran d'accueil produit un signet qui rouvre Safari, et non une
    // application — or sur iOS, seule une vraie application installée peut
    // recevoir des notifications.
    capable: true,
    title: "Baobart",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icones/apple-touch-icon.png",
  },
};

/**
 * La barre système, et la mise à l'échelle.
 *
 * `viewportFit: "cover"` permet à la page d'aller sous l'encoche ; les écrans
 * qui en ont besoin s'en écartent avec `env(safe-area-inset-*)`.
 *
 * On ne bloque PAS le zoom. Empêcher d'agrandir est un réflexe d'application
 * native qui, sur le web, rend le texte illisible à qui en a besoin — et le
 * gain de confort ne vaut pas cela.
 */
export const viewport: Viewport = {
  themeColor: "#FFD84A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{ children: React.ReactNode; modal: React.ReactNode }>) {
  return (
    <html
      lang="fr"
      className={`${archivo.variable} ${poppins.variable} ${spaceMono.variable}`}
    >
      <body>
        {children}
        {modal}
      </body>
    </html>
  );
}
