import type { Metadata } from "next";
import { Archivo_Black, Poppins, Space_Mono } from "next/font/google";

import "./globals.css";

const display = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display-loaded",
  display: "swap",
});

const body = Poppins({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-body-loaded",
  display: "swap",
});

const mono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Baobart. — Le studio partagé de l'Afrique créative",
  description:
    "Publier, découvrir, vendre. Du premier croquis au premier encaissement, en FCFA.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body
        className={`${display.variable} ${body.variable} ${mono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
