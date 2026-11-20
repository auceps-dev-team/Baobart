"use client";

import { CADRE, ENCRE, JAUNE } from "@/lib/systeme/charte";

export function BoutonImpression() {
  return (
    <button
      type="button"
      data-print-hide="1"
      onClick={() => window.print()}
      style={{
        padding: "13px 20px",
        border: CADRE,
        borderRadius: 14,
        background: JAUNE,
        color: ENCRE,
        boxShadow: `4px 4px 0 ${ENCRE}`,
        fontFamily: "var(--font-body)",
        fontSize: 13.5,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      Imprimer ou enregistrer en PDF
    </button>
  );
}

