"use client";

import { useState } from "react";

import { CADRE, ENCRE, JAUNE } from "@/lib/systeme/charte";

const LAVANDE_CLAIR = "#F4EEFC";

/**
 * « L'URL de ta boutique » : l'adresse courte, et de quoi la copier.
 *
 * Le champ reste sélectionnable à la main : le presse-papiers peut être
 * refusé (page servie en http, navigateur prudent), et l'adresse doit
 * pouvoir partir quand même.
 */
export function UrlBoutique({ adresse }: { adresse: string }) {
  const [copie, setCopie] = useState<"oui" | "non" | null>(null);

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <input
        readOnly
        value={adresse}
        aria-label="L'adresse de ta boutique"
        onFocus={(e) => e.currentTarget.select()}
        style={{ flex: "1 1 220px", minWidth: 0, padding: "11px 13px", border: CADRE, borderRadius: 12, background: LAVANDE_CLAIR, fontFamily: "var(--font-mono)", fontSize: 12.5, color: ENCRE }}
      />
      <button
        type="button"
        className="sticker-press"
        onClick={() =>
          navigator.clipboard.writeText(adresse).then(
            () => setCopie("oui"),
            () => setCopie("non"),
          )
        }
        style={{ padding: "10px 16px", border: CADRE, borderRadius: 12, background: JAUNE, fontFamily: "inherit", fontSize: 13, fontWeight: 800, cursor: "pointer" }}
      >
        {copie === "oui" ? "Copiée ✓" : "Copier"}
      </button>
      {copie === "non" ? (
        <span role="status" style={{ fontSize: 12.5, fontWeight: 700 }}>
          Copie refusée par le navigateur : sélectionne l&apos;adresse à la main.
        </span>
      ) : null}
    </div>
  );
}
