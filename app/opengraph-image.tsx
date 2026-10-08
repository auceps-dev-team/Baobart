import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

/**
 * L'aperçu d'un lien partagé : WhatsApp, LinkedIn, Facebook, X.
 *
 * Il n'y en avait aucun (mesuré le 05/10 et le 08/10/2026) : un lien vers
 * Baobart s'affichait en texte nu, sans image — alors que le partage par
 * messagerie est le premier canal de découverte visé. Next déclare ce fichier
 * dans `og:image` de chaque page qui ne fournit pas le sien ; une fiche
 * d'article garde son image propre.
 *
 * Généré au build, une fois. La police est celle par défaut de `next/og` :
 * charger Archivo Black ici demanderait d'embarquer le fichier de fonte, pour
 * une image que l'on voit en vignette.
 */

export const alt = "Baobart. — Le studio partagé de l'Afrique créative";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logo = await readFile(join(process.cwd(), "public/img/baobab-ink.svg"));
  const source = `data:image/svg+xml;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#FFD84A",
          color: "#121212",
          border: "16px solid #121212",
        }}
      >
        <img src={source} width={150} height={155} alt="" />
        <div style={{ fontSize: 108, fontWeight: 800, marginTop: 24 }}>
          Baobart.
        </div>
        <div style={{ fontSize: 44, marginTop: 12 }}>
          Le studio partagé de l&apos;Afrique créative
        </div>
        <div style={{ fontSize: 32, marginTop: 28 }}>
          Publier, découvrir, vendre — en FCFA.
        </div>
      </div>
    ),
    size,
  );
}
