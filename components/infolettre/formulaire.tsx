"use client";

import { useActionState } from "react";

import { CHAMP_LEURRE } from "@/lib/securite/antibot-champs";
import { sInscrireALaLettre, type EtatInscription } from "@/lib/infolettre/actions";

const ENCRE = "#121212";
const LAVANDE_CLAIR = "#F4EEFC";
const LAVANDE_PROFOND = "#C9A8F5";

/**
 * « Reste au courant », dans le pied de page. Le bouton OK de la maquette
 * était un <div> sans effet ; il inscrit désormais, avec confirmation par
 * courriel.
 *
 * Le leurre est écrit ici plutôt que par `ChampsAntiBot` : celui-ci porte un
 * `id` fixe, et le pied de page partage la page avec d'autres formulaires.
 */
export function FormulaireInfolettre() {
  const [etat, envoyer, enCours] = useActionState<EtatInscription | null, FormData>(sInscrireALaLettre, null);

  return (
    <form action={envoyer} data-infolettre style={{ position: "relative" }}>
      <input
        name={CHAMP_LEURRE}
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        defaultValue=""
        style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <input
          name="email"
          type="email"
          required
          placeholder="ton@email.com"
          aria-label="Adresse e-mail"
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            fontFamily: "var(--font-body)",
            fontSize: 13,
            fontWeight: 500,
            padding: "10px 12px",
            border: `2.5px solid ${ENCRE}`,
            borderRadius: 12,
            outline: "none",
            background: LAVANDE_CLAIR,
          }}
        />
        <button
          type="submit"
          disabled={enCours}
          style={{
            padding: "10px 14px",
            border: `2.5px solid ${ENCRE}`,
            borderRadius: 12,
            background: LAVANDE_PROFOND,
            fontSize: 13,
            fontWeight: 800,
            fontFamily: "inherit",
            color: ENCRE,
            cursor: "pointer",
          }}
        >
          {enCours ? "…" : "OK"}
        </button>
      </div>
      {etat ? (
        <p role="status" style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 700, lineHeight: 1.4, color: etat.ok ? ENCRE : "#E2622C" }}>
          {etat.message}
        </p>
      ) : (
        <p style={{ margin: "8px 0 0", fontSize: 11.5, fontWeight: 600, lineHeight: 1.4, opacity: 0.6 }}>
          Un courriel de confirmation, puis rien sans ton clic. Désinscription en un lien.
        </p>
      )}
    </form>
  );
}
