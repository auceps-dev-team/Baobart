"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { deconnecter } from "@/lib/auth/actions";

import {
  BLANC,
  ENCRE,
  JAUNE,
  LAVANDE,
  LAVANDE_CLAIR,
  LAVANDE_PROFOND,
  MENUS,
  ORANGE,
} from "@/components/shell/nav-data";

/**
 * En-tête, traduit du bloc HEADER de « Baobart Accueil.dc.html ».
 *
 * Carte blanche contourée collée en haut, logo, champ de recherche avec
 * suggestions, menus déroulants au survol, panier et puce de compte.
 */

interface Suggestion {
  title: string;
  famille: string | null;
  slug: string;
}

export interface UtilisateurEnTete {
  nom: string;
  username: string | null;
}

export function Header({
  cartCount = 0,
  utilisateur = null,
}: {
  cartCount?: number;
  utilisateur?: UtilisateurEnTete | null;
}) {
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [menuOuvert, setMenuOuvert] = useState<string | null>(null);
  const [compteOuvert, setCompteOuvert] = useState(false);
  const dernier = useRef(0);

  // Les suggestions viennent de la base, pas d'une liste figée : c'est le seul
  // écart assumé avec la maquette, qui filtrait un tableau en dur.
  useEffect(() => {
    if (q.trim().length === 0) {
      setSuggestions([]);
      return;
    }
    const jeton = ++dernier.current;
    const minuteur = setTimeout(async () => {
      const reponse = await fetch(`/api/recherche?q=${encodeURIComponent(q)}`);
      const data = await reponse.json();
      // Une réponse plus ancienne ne doit pas écraser une plus récente.
      if (jeton === dernier.current) setSuggestions(data.items ?? []);
    }, 180);
    return () => clearTimeout(minuteur);
  }, [q]);

  const montreSuggestions = focus && q.length > 0 && suggestions.length > 0;

  return (
    <div style={{ position: "sticky", top: 0, zIndex: 40, padding: "18px 32px 0" }}>
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "14px 20px",
          background: BLANC,
          border: `2.5px solid ${ENCRE}`,
          borderRadius: 22,
          boxShadow: `5px 5px 0 ${ENCRE}`,
          padding: "12px 16px",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flex: "0 0 auto",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              width: 40,
              height: 40,
              flex: "0 0 auto",
              border: `2.5px solid ${ENCRE}`,
              borderRadius: 99,
              background: ORANGE,
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
            }}
          >
            <Image
              src="/img/baobab-white.svg"
              alt="Baobart"
              width={27}
              height={27}
              style={{ width: 27, height: "auto", display: "block", marginTop: 2 }}
            />
          </span>
          <span
            style={{
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: 22,
              letterSpacing: "-.5px",
            }}
          >
            Baobart<span style={{ color: ORANGE }}>.</span>
          </span>
        </Link>

        <div
          style={{
            flex: "1 1 190px",
            maxWidth: 300,
            position: "relative",
            minWidth: 0,
          }}
        >
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setFocus(true);
            }}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
            placeholder="Cherche un mockup, une illu, une font…"
            aria-label="Rechercher une ressource"
            style={{
              width: "100%",
              fontFamily: "Poppins, sans-serif",
              fontSize: 14,
              fontWeight: 500,
              padding: "11px 16px",
              border: `2.5px solid ${ENCRE}`,
              borderRadius: 14,
              background: LAVANDE_CLAIR,
              outline: "none",
            }}
          />
          {montreSuggestions ? (
            <div
              style={{
                position: "absolute",
                top: 52,
                left: 0,
                right: 0,
                background: BLANC,
                border: `2.5px solid ${ENCRE}`,
                borderRadius: 16,
                boxShadow: `5px 5px 0 ${ENCRE}`,
                padding: 8,
                animation: "popin .16s ease-out",
              }}
            >
              {suggestions.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => {
                    setQ(s.title);
                    setFocus(false);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    background: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 10px",
                    borderRadius: 11,
                    cursor: "pointer",
                    fontSize: 13.5,
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      border: `2px solid ${ENCRE}`,
                      flex: "0 0 auto",
                      background: LAVANDE_PROFOND,
                    }}
                  />
                  <span style={{ flex: "1 1 auto" }}>{s.title}</span>
                  <span
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: 11,
                      opacity: 0.55,
                    }}
                  >
                    {s.famille}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: ".03em",
            textTransform: "uppercase",
            flex: "1 1 auto",
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          {MENUS.map((groupe) => (
            <div
              key={groupe.key}
              onMouseEnter={() => setMenuOuvert(groupe.key)}
              onMouseLeave={() => setMenuOuvert(null)}
              style={{ position: "relative" }}
            >
              <a
                href={groupe.href ?? "#"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  color: ENCRE,
                }}
              >
                {groupe.label}{" "}
                <span style={{ fontSize: 9 }}>
                  {groupe.items.length > 0 ? "▼" : ""}
                </span>
              </a>
              {menuOuvert === groupe.key && groupe.items.length > 0 ? (
                <div
                  style={{
                    position: "absolute",
                    top: 26,
                    left: -14,
                    width: 262,
                    background: BLANC,
                    border: `2.5px solid ${ENCRE}`,
                    borderRadius: 18,
                    boxShadow: `5px 5px 0 ${ENCRE}`,
                    padding: 8,
                    textTransform: "none",
                    letterSpacing: 0,
                    zIndex: 50,
                    animation: "popin .14s ease-out",
                  }}
                >
                  {groupe.items.map((m) => (
                    <a
                      key={m.label}
                      href={m.href ?? "#"}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 11,
                        padding: 10,
                        borderRadius: 12,
                        cursor: "pointer",
                        opacity: m.href ? 1 : 0.55,
                      }}
                    >
                      <span
                        style={{
                          width: 30,
                          height: 30,
                          flex: "0 0 auto",
                          border: `2px solid ${ENCRE}`,
                          borderRadius: 9,
                          display: "grid",
                          placeItems: "center",
                          fontSize: 13,
                          background: LAVANDE,
                        }}
                      >
                        {m.glyph}
                      </span>
                      <span>
                        <span
                          style={{
                            display: "block",
                            fontSize: 13.5,
                            fontWeight: 800,
                          }}
                        >
                          {m.label}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: 11,
                            fontWeight: 600,
                            opacity: 0.6,
                          }}
                        >
                          {m.hint}
                        </span>
                      </span>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
          <button
            type="button"
            style={{
              position: "relative",
              padding: "10px 13px",
              border: `2.5px solid ${ENCRE}`,
              borderRadius: 12,
              background: BLANC,
              fontFamily: "'Space Mono', monospace",
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: ".06em",
              cursor: "pointer",
            }}
          >
            PANIER
            {cartCount > 0 ? (
              <span
                style={{
                  position: "absolute",
                  top: -8,
                  right: -8,
                  minWidth: 22,
                  height: 22,
                  padding: "0 5px",
                  border: `2.5px solid ${ENCRE}`,
                  borderRadius: 99,
                  background: ORANGE,
                  color: BLANC,
                  fontSize: 11,
                  fontWeight: 800,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {cartCount}
              </span>
            ) : null}
          </button>

          <div
            onMouseEnter={() => setCompteOuvert(true)}
            onMouseLeave={() => setCompteOuvert(false)}
            style={{ position: "relative" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "6px 12px 6px 6px",
                border: `2.5px solid ${ENCRE}`,
                borderRadius: 14,
                background: LAVANDE_PROFOND,
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 30,
                  border: `2.5px solid ${ENCRE}`,
                  borderRadius: 99,
                  background: `repeating-linear-gradient(135deg,${JAUNE} 0 5px,${BLANC} 5px 11px)`,
                }}
              />
              <span style={{ fontSize: 12.5, fontWeight: 800 }}>
                {utilisateur ? utilisateur.nom : "Invité"}
              </span>
            </div>
            {compteOuvert ? (
              <div
                style={{
                  position: "absolute",
                  top: 48,
                  right: 0,
                  width: 268,
                  background: BLANC,
                  border: `2.5px solid ${ENCRE}`,
                  borderRadius: 20,
                  boxShadow: `6px 6px 0 ${ENCRE}`,
                  padding: 10,
                  zIndex: 55,
                  animation: "popin .14s ease-out",
                }}
              >
                {utilisateur ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <a
                      href="/dashboard"
                      style={{
                        padding: "9px 10px",
                        borderRadius: 11,
                        fontSize: 13.5,
                        fontWeight: 700,
                      }}
                    >
                      Tableau de bord
                    </a>
                    <form action={deconnecter}>
                      <button
                        type="submit"
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "9px 10px",
                          borderRadius: 11,
                          border: "none",
                          background: "none",
                          fontFamily: "inherit",
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: ORANGE,
                          cursor: "pointer",
                        }}
                      >
                        Se déconnecter
                      </button>
                    </form>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <a
                      href="/connexion"
                      style={{
                        padding: "11px 12px",
                        border: `2.5px solid ${ENCRE}`,
                        borderRadius: 13,
                        background: JAUNE,
                        textAlign: "center",
                        fontSize: 13.5,
                        fontWeight: 800,
                      }}
                    >
                      Se connecter
                    </a>
                    <a
                      href="/inscription"
                      style={{
                        padding: "11px 12px",
                        border: `2.5px solid ${ENCRE}`,
                        borderRadius: 13,
                        background: LAVANDE_CLAIR,
                        textAlign: "center",
                        fontSize: 13.5,
                        fontWeight: 800,
                      }}
                    >
                      Créer un compte
                    </a>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
