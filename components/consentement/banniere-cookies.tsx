"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState, useTransition } from "react";

import { enregistrerConsentement } from "@/lib/consentement/actions";
import { COOKIE_CONSENTEMENT, lireConsentement } from "@/lib/consentement/regles";

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const JAUNE = "#FFD84A";

/** L'événement qui rouvre la bannière — le lien « Gérer mes cookies ». */
export const ROUVRIR_COOKIES = "baobart:cookies";

function choixActuel() {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_CONSENTEMENT}=([^;]*)`));
  return lireConsentement(m?.[1]);
}

/**
 * La bannière de consentement — demandée le 03/10.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * AUCUNE MAQUETTE NE LA DESSINE
 *
 * Cherché dans les huit `Baobart Design/*.dc.html` et `support.js` (« cookie »,
 * « consent », « bandeau ») : la maquette écrit le texte de la politique et dit
 * « désactivables depuis le bandeau », sans dessiner le bandeau. Elle reprend
 * donc les gestes de la charte — cadre de 2,5 px, ombre décalée, jaune pour
 * l'action — plutôt qu'un dessin inventé.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * REFUSER EST AUSSI SIMPLE QU'ACCEPTER
 *
 * Deux boutons de même taille, côte à côte, et aucun choix fait d'avance. Un
 * « Refuser » caché derrière « Personnaliser » obtiendrait des accords qu'on
 * n'aurait pas vraiment reçus. Fermer sans choisir n'est pas proposé : sans
 * choix, rien n'est déposé, et la bannière revient à la page suivante.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ELLE NE S'AFFICHE QU'APRÈS L'HYDRATATION
 *
 * Le serveur ne lit pas le cookie de choix : le lire dans le layout rendrait
 * toutes les pages dynamiques. La bannière se décide donc dans le navigateur,
 * une fois la page montée — pour qui a déjà choisi, elle n'apparaît jamais,
 * même une fraction de seconde.
 */
export function BanniereCookies() {
  const [visible, setVisible] = useState(false);
  const [enCours, demarrer] = useTransition();

  useEffect(() => {
    if (!choixActuel()) setVisible(true);
    const rouvrir = () => setVisible(true);
    window.addEventListener(ROUVRIR_COOKIES, rouvrir);
    return () => window.removeEventListener(ROUVRIR_COOKIES, rouvrir);
  }, []);

  if (!visible) return null;

  const choisir = (mesurePub: boolean) =>
    demarrer(async () => {
      await enregistrerConsentement(mesurePub);
      setVisible(false);
      window.dispatchEvent(new CustomEvent("baobart:cookies-choisis", { detail: { mesurePub } }));
    });

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookies-titre"
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 1000,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          pointerEvents: "auto",
          width: "100%",
          maxWidth: 640,
          border: `2.5px solid ${ENCRE}`,
          borderRadius: 22,
          background: BLANC,
          boxShadow: `6px 6px 0 ${ENCRE}`,
          padding: "18px 20px",
          color: ENCRE,
        }}
      >
        <div id="cookies-titre" style={{ fontSize: 16, fontWeight: 800 }}>
          Un seul cookie facultatif, si tu veux bien
        </div>
        <p style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, margin: "8px 0 0", opacity: 0.85 }}>
          Baobart pose les cookies sans lesquels le site ne marche pas — ta connexion, ton choix ici.
          Le seul autre retient les bannières que tu cliques, pour savoir si une vente vient d&apos;une
          publicité. Le refuser ne change rien à ce que tu peux faire ici.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 14 }}>
          <button type="button" disabled={enCours} onClick={() => choisir(false)} style={bouton(BLANC)}>
            Refuser
          </button>
          <button type="button" disabled={enCours} onClick={() => choisir(true)} style={bouton(JAUNE)}>
            Accepter
          </button>
          <Link
            href={"/cookies" as Route}
            style={{ fontSize: 12.5, fontWeight: 700, color: ENCRE, textDecoration: "underline", marginLeft: 4 }}
          >
            Lire la politique de cookies
          </Link>
        </div>
      </div>
    </div>
  );
}

/** « Gérer mes cookies » : rouvre la bannière, où qu'on soit. */
export function GererMesCookies({ style }: { style?: React.CSSProperties }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(ROUVRIR_COOKIES))}
      style={{
        border: "none",
        background: "none",
        padding: 0,
        font: "inherit",
        color: "inherit",
        textDecoration: "underline",
        cursor: "pointer",
        ...style,
      }}
    >
      Gérer mes cookies
    </button>
  );
}

function bouton(fond: string): React.CSSProperties {
  return {
    minWidth: 120,
    padding: "10px 18px",
    border: `2.5px solid ${ENCRE}`,
    borderRadius: 13,
    background: fond,
    boxShadow: `3px 3px 0 ${ENCRE}`,
    fontSize: 13.5,
    fontWeight: 800,
    fontFamily: "inherit",
    color: ENCRE,
    cursor: "pointer",
  };
}
