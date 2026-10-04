"use client";

import { useState } from "react";

import { ChoixEpingle } from "@/components/collections/choix-epingle";

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const JAUNE = "#FFD84A";

/**
 * « ⌸ Collection » sur la fiche d'une ressource : le même choix que l'épingle
 * des cartes. Le bouton annonçait « Les collections arrivent bientôt » tant
 * qu'elles n'existaient pas.
 */
export function BoutonCollection({
  produitId,
  titre,
  connecte,
  rangeeInitiale,
}: {
  produitId: string;
  titre: string;
  connecte: boolean;
  rangeeInitiale: boolean;
}) {
  const [rangee, setRangee] = useState(rangeeInitiale);
  const [ouvert, setOuvert] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-pressed={rangee}
        onClick={() => {
          if (!connecte) {
            window.location.href = "/connexion";
            return;
          }
          setOuvert(true);
        }}
        style={{
          flex: "1 1 auto",
          padding: 11,
          border: `2.5px solid ${ENCRE}`,
          borderRadius: 13,
          textAlign: "center",
          fontSize: 13,
          fontWeight: 800,
          fontFamily: "inherit",
          background: rangee ? JAUNE : BLANC,
          color: ENCRE,
          cursor: "pointer",
        }}
      >
        ⌸ {rangee ? "Rangée" : "Collection"}
      </button>
      {ouvert ? (
        <ChoixEpingle
          produitId={produitId}
          titre={titre}
          onFerme={(r) => {
            setRangee(r);
            setOuvert(false);
          }}
        />
      ) : null}
    </>
  );
}
