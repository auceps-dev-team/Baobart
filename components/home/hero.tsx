"use client";

import Link from "next/link";

import { Compteur } from "@/components/anime/compteur";
import { Parallaxe } from "@/components/anime/defilement";
import { Vague } from "@/components/anime/vague";
import {
  BLANC,
  ENCRE,
  JAUNE,
  LAVANDE_PROFOND,
  ORANGE,
} from "@/components/shell/nav-data";

/**
 * Hero de l'accueil — variante B de « Baobart Accueil.dc.html ».
 *
 * La variante A et son sélecteur ont été retirés après arbitrage : son titre
 * était en anglais alors que tout le projet est en français, et il ne portait
 * pas la baseline. Le rail latéral, que la maquette liait à cette variante,
 * est désormais une navigation permanente — c'est de la navigation, pas une
 * option de mise en page.
 *
 * Les chiffres viennent de la base : afficher une preuve sociale qu'on n'a pas
 * serait un mensonge.
 */

const CADRE = `2.5px solid ${ENCRE}`;

export interface ChiffresCommunaute {
  ressources: number;
  createurs: number;
  /** `null` tant que personne n'a noté : le bloc est alors masqué. */
  note: number | null;
}

export interface Vitrine {
  principale: CarteHero | null;
  gratuite: CarteHero | null;
  payante: CarteHero | null;
}

interface CarteHero {
  slug: string;
  titre: string;
  couverture: string;
  detail: string;
}

export function HeroB({ chiffres, vitrine }: { chiffres: ChiffresCommunaute; vitrine: Vitrine }) {
  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "34px 32px 0" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1.05fr) minmax(0,.95fr)",
          gap: 34,
          alignItems: "center",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              border: CADRE,
              borderRadius: 999,
              background: JAUNE,
              padding: "7px 16px",
              fontSize: 12,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: ".08em",
            }}
          >
            Plateforme collaborative
          </div>

          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(40px,5.8vw,82px)",
              lineHeight: 0.94,
              letterSpacing: "-2.5px",
              margin: "18px 0 0",
              textTransform: "uppercase",
              overflowWrap: "break-word",
              minWidth: 0,
            }}
          >
            {/* La vague arrive mot à mot ; « créative », le sticker, en dernier.
                Ajout du 08/10 (labo Animata), absent de la maquette. */}
            <Vague
              texte="Le studio partagé de l'Afrique"
              pas={70}
              fin={
                <span
                  style={{
                    background: LAVANDE_PROFOND,
                    border: `3px solid ${ENCRE}`,
                    padding: "0 10px",
                    display: "inline-block",
                    transform: "rotate(-1.5deg)",
                  }}
                >
                  créative
                </span>
              }
            />
          </h1>

          <p
            style={{
              maxWidth: 480,
              margin: "22px 0 0",
              fontSize: 17,
              fontWeight: 500,
              lineHeight: 1.5,
              opacity: 0.75,
            }}
          >
            Illustrations, mockups, fonts, photos : tout est là, libre ou à petit
            prix. Enregistre dans tes collections, commente avec ton équipe.
          </p>

          <div style={{ display: "flex", gap: 14, marginTop: 28, flexWrap: "wrap" }}>
            <a
              href="#grid"
              style={{
                padding: "16px 30px",
                border: CADRE,
                borderRadius: 16,
                background: ENCRE,
                color: BLANC,
                boxShadow: `5px 5px 0 ${ORANGE}`,
                fontSize: 15,
                fontWeight: 800,
              }}
            >
              Commencer gratuitement
            </a>
            <a
              href="#collab"
              style={{
                padding: "16px 30px",
                border: CADRE,
                borderRadius: 16,
                background: BLANC,
                boxShadow: `5px 5px 0 ${ENCRE}`,
                fontSize: 15,
                fontWeight: 800,
              }}
            >
              Créer un espace
            </a>
          </div>

          <div style={{ display: "flex", gap: 28, marginTop: 34 }}>
            {[
              // Les comptes défilent jusqu'à leur valeur (Compteur, labo
              // Animata) ; le HTML porte déjà la vraie valeur. La note reste
              // fixe : défiler jusqu'à une note sur 5 n'apprend rien.
              {
                valeur: <Compteur cible={chiffres.ressources} />,
                libelle: "ressources",
              },
              {
                valeur: <Compteur cible={chiffres.createurs} delai={150} />,
                libelle: "créatifs",
              },
              ...(chiffres.note !== null
                ? [
                    {
                      valeur: chiffres.note.toFixed(1),
                      libelle: "satisfaction",
                    },
                  ]
                : []),
            ].map((s) => (
              <div key={s.libelle}>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 28,
                  }}
                >
                  {s.valeur}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.7 }}>
                  {s.libelle}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/*
          Trois ressources publiées, et rien d'inventé : voir `vitrineDuHero`.
          La maquette y posait « Ankara Editorial · 24 visuels » et « 2 340 dl »,
          qui ne correspondaient à rien (relevé le 04/10).
        */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "auto auto",
            gap: 18,
          }}
        >
          {vitrine.principale ? (
            <Link
              href={`/products/${vitrine.principale.slug}`}
              scroll={false}
              className="sticker-press"
              style={{
                gridColumn: "1 / span 2",
                display: "block",
                border: CADRE,
                borderRadius: 24,
                background: BLANC,
                boxShadow: `6px 6px 0 ${ENCRE}`,
                padding: 16,
                color: ENCRE,
              }}
            >
              <div
                style={{
                  height: 240,
                  border: CADRE,
                  borderRadius: 16,
                  background: `url(${JSON.stringify(vitrine.principale.couverture)}) center 30% / cover no-repeat`,
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  marginTop: 14,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{vitrine.principale.titre}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.7 }}>{vitrine.principale.detail}</div>
                </div>
                <span
                  style={{
                    flex: "0 0 auto",
                    padding: "10px 16px",
                    border: CADRE,
                    borderRadius: 12,
                    background: JAUNE,
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  Ouvrir
                </span>
              </div>
            </Link>
          ) : null}

          {/* Les deux petites cartes glissent à contre-sens au défilement
              (parallaxe, 08/10) : 50 px d'écart sur toute la traversée, pour
              décoller les plans sans les promener. */}
          {[vitrine.gratuite, vitrine.payante].map((c, i) =>
            c ? (
              <Parallaxe key={c.slug} amplitude={i === 0 ? 50 : -50}>
                <Link
                  href={`/products/${c.slug}`}
                  scroll={false}
                  className="sticker-press"
                  style={{
                    display: "block",
                    border: CADRE,
                    borderRadius: 24,
                    background: i === 0 ? JAUNE : BLANC,
                    boxShadow: `6px 6px 0 ${ENCRE}`,
                    padding: 16,
                    color: ENCRE,
                    animation: i === 0 ? "floaty 7s ease-in-out infinite" : undefined,
                  }}
                >
                  <div
                    style={{
                      height: 130,
                      border: CADRE,
                      borderRadius: 14,
                      background: `url(${JSON.stringify(c.couverture)}) center / cover no-repeat`,
                    }}
                  />
                  <div style={{ marginTop: 12, fontSize: 14, fontWeight: 800 }}>{c.titre}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.75 }}>{c.detail}</div>
                </Link>
              </Parallaxe>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}
