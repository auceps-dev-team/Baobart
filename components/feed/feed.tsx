"use client";

import { useCallback, useState, useTransition } from "react";

import { CarteAlaUne, CarteMosaique, type StyleCarte } from "@/components/feed/resource-card";
import { FILTRES, type CarteRessource, type Filtre } from "@/lib/feed/types";

/**
 * Le feed « Découvre aujourd'hui ».
 *
 * Structure et valeurs reprises de « Baobart Accueil.dc.html », bloc
 * `FILTERS + GRID` : en-tête, sélecteur de style de cartes, barre de filtres,
 * deux cartes à la une, puis la mosaïque et son bouton « charger plus ».
 */

const ENCRE = "#121212";
const JAUNE = "#FFD84A";
const BLANC = "#FFFFFF";

const STYLES_CARTE: StyleCarte[] = ["Sticker", "Contour fin", "Image pleine"];

export interface FeedProps {
  itemsInitiaux: CarteRessource[];
  curseurInitial: string | null;
  alaUne: CarteRessource[];
}

export function Feed({ itemsInitiaux, curseurInitial, alaUne }: FeedProps) {
  const [items, setItems] = useState(itemsInitiaux);
  const [curseur, setCurseur] = useState(curseurInitial);
  const [filtre, setFiltre] = useState<Filtre>("Tous");
  const [styleCarte, setStyleCarte] = useState<StyleCarte>("Sticker");
  const [survolee, setSurvolee] = useState<string | null>(null);
  const [likes, setLikes] = useState<Record<string, boolean>>({});
  const [epingles, setEpingles] = useState<Record<string, boolean>>({});
  const [chargement, demarrer] = useTransition();

  const changerFiltre = useCallback((f: Filtre) => {
    setFiltre(f);
    demarrer(async () => {
      const reponse = await fetch(
        `/api/feed?filtre=${encodeURIComponent(f)}`,
      );
      const page = await reponse.json();
      setItems(page.items);
      setCurseur(page.nextCursor);
    });
  }, []);

  const chargerPlus = useCallback(() => {
    if (!curseur) return;
    demarrer(async () => {
      const reponse = await fetch(
        `/api/feed?filtre=${encodeURIComponent(filtre)}&cursor=${encodeURIComponent(curseur)}`,
      );
      const page = await reponse.json();
      setItems((precedents) => [...precedents, ...page.items]);
      setCurseur(page.nextCursor);
    });
  }, [curseur, filtre]);

  const proprietesCarte = (r: CarteRessource) => ({
    ressource: r,
    style: styleCarte,
    survolee: survolee === r.id,
    aime: likes[r.id] === true,
    epingle: epingles[r.id] === true,
    onEnter: () => setSurvolee(r.id),
    onLeave: () => setSurvolee((actuel) => (actuel === r.id ? null : actuel)),
    onLike: () => setLikes((l) => ({ ...l, [r.id]: !l[r.id] })),
    onSave: () => setEpingles((s) => ({ ...s, [r.id]: !s[r.id] })),
    onOpen: () => {
      window.location.href = `/products/${r.slug}`;
    },
  });

  return (
    <div
      id="grid"
      style={{ maxWidth: 1400, margin: "0 auto", padding: "64px 32px 0" }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "16px 20px",
        }}
      >
        <h2
          style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: "clamp(28px,4vw,44px)",
            letterSpacing: "-1.5px",
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          Découvre aujourd&apos;hui
        </h2>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: ".1em",
              opacity: 0.55,
            }}
          >
            Cartes
          </span>
          {STYLES_CARTE.map((cs) => (
            <button
              key={cs}
              type="button"
              onClick={() => setStyleCarte(cs)}
              aria-pressed={styleCarte === cs}
              style={{
                padding: "6px 13px",
                border: `2px solid ${ENCRE}`,
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                background: styleCarte === cs ? JAUNE : BLANC,
                color: ENCRE,
              }}
            >
              {cs}
            </button>
          ))}
          <span
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: 12,
              opacity: 0.6,
              marginLeft: 8,
            }}
          >
            {items.length} ressources affichées
          </span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          margin: "22px 0 26px",
        }}
      >
        {FILTRES.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => changerFiltre(f)}
            aria-pressed={filtre === f}
            style={{
              padding: "9px 16px",
              border: `2.5px solid ${ENCRE}`,
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
              background: filtre === f ? ENCRE : BLANC,
              color: filtre === f ? BLANC : ENCRE,
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {alaUne.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
            gap: 20,
            marginBottom: 20,
          }}
        >
          {alaUne.map((r) => (
            <CarteAlaUne key={r.id} {...proprietesCarte(r)} />
          ))}
        </div>
      ) : null}

      <div data-masonry="1" style={{ columns: "250px", columnGap: 20 }}>
        {items.map((r) => (
          <CarteMosaique key={r.id} {...proprietesCarte(r)} />
        ))}
      </div>

      {items.length === 0 ? (
        <div
          style={{
            border: `2.5px solid ${ENCRE}`,
            borderRadius: 20,
            background: BLANC,
            boxShadow: `4px 4px 0 ${ENCRE}`,
            padding: 32,
            textAlign: "center",
            fontWeight: 700,
          }}
        >
          Rien dans cette famille pour l&apos;instant.
        </div>
      ) : null}

      {curseur ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <button
            type="button"
            onClick={chargerPlus}
            disabled={chargement}
            className="sticker-press"
            style={{
              padding: "14px 28px",
              border: `2.5px solid ${ENCRE}`,
              borderRadius: 16,
              background: JAUNE,
              boxShadow: `5px 5px 0 ${ENCRE}`,
              fontSize: 14.5,
              fontWeight: 800,
              cursor: chargement ? "wait" : "pointer",
            }}
          >
            {chargement ? "Chargement…" : "Charger plus de ressources"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
