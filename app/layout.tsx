import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Baobart. — Le studio partagé de l'Afrique créative",
  description:
    "Publier, découvrir, vendre. Du premier croquis au premier encaissement, en FCFA.",
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{ children: React.ReactNode; modal: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        {children}
        {modal}
      </body>
    </html>
  );
}
