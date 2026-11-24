"use client";

import { useState, useTransition } from "react";

import { basculerSuivi } from "@/lib/social/actions";
import { ENCRE, LAVANDE, ORANGE } from "@/lib/systeme/charte";

/**
 * « Suivi ✓ » d'une carte de personne (maquette `c_suivre`, l. 1868-1869) : fond
 * orange, texte d'encre (5,4:1), et un clic défait le suivi — la carte reste,
 * le bouton redevient « Suivre » sur fond lavande, pour qu'on puisse revenir
 * sur un clic malheureux.
 *
 * Pas `BoutonSuivre` (components/social/boutons.tsx) : celui-là est la pastille
 * des vitrines, avec son compteur d'abonnés ; la carte de la maquette dessine
 * un bouton carré sans nombre. Même action serveur, même règle (`basculerSuivi`).
 *
 * `aria-pressed` dit l'état ; le nom de la personne, caché à l'œil, dit de qui
 * il s'agit quand plusieurs cartes portent le même bouton.
 */
export function BoutonSuiviCarte({ createurId, nom }: { createurId: string; nom: string }) {
  const [actif, setActif] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const basculer = () =>
    demarrer(async () => {
      const r = await basculerSuivi(createurId);
      if (r.ok) {
        setActif(r.actif);
        setErreur(null);
      } else {
        setErreur(r.message);
      }
    });

  return (
    <span style={{ flex: "0 0 auto", display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <button
        type="button"
        onClick={basculer}
        disabled={enCours}
        aria-pressed={actif}
        className="sticker-press"
        style={{
          padding: "8px 14px",
          border: `2px solid ${ENCRE}`,
          borderRadius: 11,
          background: actif ? ORANGE : LAVANDE,
          color: ENCRE,
          fontFamily: "inherit",
          fontSize: 12,
          fontWeight: 800,
          whiteSpace: "nowrap",
          cursor: enCours ? "wait" : "pointer",
        }}
      >
        {actif ? (
          <>
            Suivi <span aria-hidden="true">✓</span>
          </>
        ) : (
          "Suivre"
        )}
        <span className="sr-only"> {nom}</span>
      </button>
      {erreur ? (
        <span role="alert" style={{ fontSize: 11, fontWeight: 700, color: "#B34A1F" }}>
          {erreur}
        </span>
      ) : null}
    </span>
  );
}
