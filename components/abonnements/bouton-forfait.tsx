"use client";

import { useActionState } from "react";

import { activerAccesLibre, quitterAccesLibre, type EtatForfait } from "@/lib/abonnements/actions";

const ENCRE = "#121212";
const BLANC = "#FFFFFF";

/** « Activer » ou « Désactiver » Accès libre — sans paiement, d'un clic. */
export function BoutonForfait({ mode, fond = ENCRE }: { mode: "activer" | "quitter"; fond?: string }) {
  const [etat, agir, enCours] = useActionState<EtatForfait | null, FormData>(
    async () => (mode === "activer" ? activerAccesLibre() : quitterAccesLibre()),
    null,
  );

  return (
    <form action={agir} data-forfait={mode} style={{ display: "grid", gap: 8 }}>
      <button
        type="submit"
        disabled={enCours}
        style={{
          padding: 14,
          border: `2.5px solid ${ENCRE}`,
          borderRadius: 14,
          background: mode === "activer" ? fond : BLANC,
          color: mode === "activer" && fond === ENCRE ? BLANC : ENCRE,
          textAlign: "center",
          fontSize: 14,
          fontWeight: 800,
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        {enCours ? "Un instant…" : mode === "activer" ? "Activer gratuitement" : "Désactiver Accès libre"}
      </button>
      {etat && !etat.ok ? (
        <span role="alert" style={{ fontSize: 12.5, fontWeight: 700, color: "#E2622C" }}>
          {etat.message}
        </span>
      ) : null}
    </form>
  );
}
