"use client";

import { useEffect, useState } from "react";

import { GererMesCookies } from "@/components/consentement/banniere-cookies";
import { COOKIE_CONSENTEMENT, lireConsentement, type Choix } from "@/lib/consentement/regles";

const ENCRE = "#121212";

/** Ton choix d'aujourd'hui, lu dans le navigateur, et de quoi le changer. */
export function EtatDuChoix() {
  const [choix, setChoix] = useState<Choix | null | undefined>(undefined);

  useEffect(() => {
    const lire = () => {
      const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_CONSENTEMENT}=([^;]*)`));
      setChoix(lireConsentement(m?.[1]));
    };
    lire();
    window.addEventListener("baobart:cookies-choisis", lire);
    return () => window.removeEventListener("baobart:cookies-choisis", lire);
  }, []);

  const texte =
    choix === undefined
      ? "…"
      : choix === null
        ? "Tu n'as pas encore choisi : rien n'est déposé tant que tu ne l'as pas accepté."
        : choix.mesurePub
          ? "Tu as accepté le cookie de mesure des publicités."
          : "Tu as refusé le cookie de mesure des publicités : il n'est pas déposé.";

  return (
    <div
      data-choix-cookies={choix === undefined ? "" : choix === null ? "aucun" : choix.mesurePub ? "accepte" : "refuse"}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "8px 16px",
        marginTop: 12,
        padding: "12px 14px",
        border: `2.5px solid ${ENCRE}`,
        borderRadius: 14,
        background: "#F4EEFC",
        fontSize: 13.5,
        fontWeight: 700,
      }}
    >
      <span>{texte}</span>
      <GererMesCookies style={{ fontWeight: 800 }} />
    </div>
  );
}
