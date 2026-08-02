"use client";

import {
  BLANC,
  ENCRE,
  JAUNE,
  LAVANDE_PROFOND,
  ORANGE,
} from "@/components/shell/nav-data";

/**
 * Les deux variantes de hero de « Baobart Accueil.dc.html », avec leur
 * sélecteur.
 *
 * ⚠️ Le sélecteur « Variante A / Variante B » est un outil de revue de design :
 * il sert à choisir une direction, pas à laisser le visiteur en changer. Il est
 * reproduit parce que la maquette le contient, mais c'est une décision à
 * trancher avant la mise en ligne.
 *
 * La variante retenue commande aussi l'affichage du rail : la maquette
 * n'affiche le rail latéral qu'en variante B.
 */

export type VarianteHero = "A" | "B";

const CADRE = `2.5px solid ${ENCRE}`;

export function SelecteurHero({
  variante,
  onChange,
}: {
  variante: VarianteHero;
  onChange: (v: VarianteHero) => void;
}) {
  const bouton = (v: VarianteHero, label: string) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      aria-pressed={variante === v}
      style={{
        padding: "6px 14px",
        border: `2px solid ${ENCRE}`,
        borderRadius: 10,
        fontSize: 12,
        fontWeight: 800,
        cursor: "pointer",
        background: variante === v ? JAUNE : BLANC,
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        maxWidth: 1400,
        margin: "22px auto 0",
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        gap: 10,
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
        Hero
      </span>
      {bouton("A", "Variante A")}
      {bouton("B", "Variante B")}
    </div>
  );
}

export function HeroA() {
  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "34px 32px 0" }}>
      <div style={{ textAlign: "center", position: "relative" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            border: CADRE,
            borderRadius: 999,
            background: BLANC,
            padding: "7px 16px",
            fontSize: 12,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: ".08em",
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: 99,
              background: ORANGE,
            }}
          />
          +170 ressources africaines, prêtes à l&apos;emploi
        </div>

        <h1
          style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: "clamp(42px,5.4vw,76px)",
            lineHeight: 0.93,
            letterSpacing: "-2.5px",
            margin: "20px auto 0",
            maxWidth: 1000,
            textTransform: "uppercase",
            textWrap: "balance",
          }}
        >
          Create<span style={{ color: ORANGE }}>.</span> Share
          <span style={{ color: ORANGE }}>.</span> Inspire
          <span style={{ color: ORANGE }}>.</span>
        </h1>

        <p
          style={{
            maxWidth: 560,
            margin: "18px auto 0",
            fontSize: 16.5,
            fontWeight: 500,
            lineHeight: 1.5,
            opacity: 0.75,
            textWrap: "pretty",
          }}
        >
          La communauté créative africaine met ses illustrations, mockups, fonts
          et photos en commun. Tu prends, tu partages, on avance ensemble.
        </p>

        <div
          style={{
            display: "flex",
            gap: 14,
            justifyContent: "center",
            marginTop: 26,
            flexWrap: "wrap",
          }}
        >
          <a
            href="#grid"
            style={{
              padding: "15px 28px",
              border: CADRE,
              borderRadius: 16,
              background: JAUNE,
              boxShadow: `5px 5px 0 ${ENCRE}`,
              fontSize: 15,
              fontWeight: 800,
            }}
          >
            Explorer les ressources
          </a>
          <a
            href="#contrib"
            style={{
              padding: "15px 28px",
              border: CADRE,
              borderRadius: 16,
              background: BLANC,
              boxShadow: `5px 5px 0 ${ENCRE}`,
              fontSize: 15,
              fontWeight: 800,
            }}
          >
            Publier mon travail
          </a>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.5fr 1fr",
          gap: 22,
          alignItems: "stretch",
          marginTop: 40,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              border: CADRE,
              borderRadius: 22,
              background: LAVANDE_PROFOND,
              boxShadow: `5px 5px 0 ${ENCRE}`,
              padding: 18,
              animation: "floaty 6s ease-in-out infinite",
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                border: CADRE,
                borderRadius: 99,
                background: BLANC,
                display: "grid",
                placeItems: "center",
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: 13,
              }}
            >
              #1
            </div>
            <div
              style={{
                marginTop: 14,
                fontSize: 15,
                fontWeight: 700,
                lineHeight: 1.35,
              }}
            >
              Le pack « Wax &amp; Motifs » a été téléchargé 2 340 fois ce mois.
            </div>
            <div
              style={{
                marginTop: 14,
                height: 96,
                border: CADRE,
                borderRadius: 14,
                background: `repeating-linear-gradient(135deg,${ENCRE} 0 7px,${JAUNE} 7px 17px)`,
              }}
            />
          </div>
          <div
            style={{
              border: CADRE,
              borderRadius: 22,
              background: BLANC,
              boxShadow: `5px 5px 0 ${ENCRE}`,
              padding: 18,
              flex: "1 1 auto",
            }}
          >
            <div
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: 34,
                lineHeight: 1,
              }}
            >
              4.9
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.4,
                marginTop: 6,
              }}
            >
              de satisfaction chez les créatifs du continent
            </div>
          </div>
        </div>

        <div
          style={{
            border: CADRE,
            borderRadius: 26,
            background: JAUNE,
            boxShadow: `6px 6px 0 ${ENCRE}`,
            padding: 22,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontFamily: "'Space Mono', monospace",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: ".1em",
            }}
          >
            <span>Ressource du jour</span>
            <span>gratuit</span>
          </div>
          <div
            style={{
              flex: "1 1 auto",
              minHeight: 250,
              border: CADRE,
              borderRadius: 18,
              background: "url('/img/demo/mode-rouge.jpg') center 22% / cover no-repeat",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.2 }}>
                Collection Ankara Editorial
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.7 }}>
                24 visuels · par Awa Diallo
              </div>
            </div>
            <a
              href="#grid"
              style={{
                padding: "13px 20px",
                border: CADRE,
                borderRadius: 14,
                background: BLANC,
                boxShadow: `4px 4px 0 ${ENCRE}`,
                fontSize: 14,
                fontWeight: 800,
                whiteSpace: "nowrap",
              }}
            >
              Voir la ressource
            </a>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              border: CADRE,
              borderRadius: 22,
              background: BLANC,
              boxShadow: `5px 5px 0 ${ENCRE}`,
              padding: 18,
              flex: "1 1 auto",
            }}
          >
            <div style={{ display: "flex" }}>
              {[
                `repeating-linear-gradient(135deg,${ORANGE} 0 6px,${JAUNE} 6px 13px)`,
                `repeating-linear-gradient(135deg,${LAVANDE_PROFOND} 0 6px,${BLANC} 6px 13px)`,
                `repeating-linear-gradient(135deg,${ENCRE} 0 6px,#EADFF9 6px 13px)`,
              ].map((fond, i) => (
                <span
                  key={fond}
                  style={{
                    width: 38,
                    height: 38,
                    border: CADRE,
                    borderRadius: 99,
                    background: fond,
                    marginLeft: i === 0 ? 0 : -12,
                  }}
                />
              ))}
              <span
                style={{
                  width: 38,
                  height: 38,
                  border: CADRE,
                  borderRadius: 99,
                  background: JAUNE,
                  display: "grid",
                  placeItems: "center",
                  fontSize: 15,
                  fontWeight: 800,
                  marginLeft: -12,
                }}
              >
                +
              </span>
            </div>
            <div
              style={{
                marginTop: 14,
                fontSize: 14.5,
                fontWeight: 700,
                lineHeight: 1.35,
              }}
            >
              Crée un espace, invite ton équipe, commentez les mêmes boards.
            </div>
            <a
              href="#collab"
              style={{
                display: "inline-block",
                marginTop: 12,
                fontSize: 13,
                fontWeight: 800,
                borderBottom: CADRE,
              }}
            >
              Voir les espaces
            </a>
          </div>
          <div
            style={{
              border: CADRE,
              borderRadius: 22,
              background: ORANGE,
              color: BLANC,
              boxShadow: `5px 5px 0 ${ENCRE}`,
              padding: 18,
            }}
          >
            <div
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: 30,
                lineHeight: 1,
              }}
            >
              12 400
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
              créatifs déjà inscrits
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroB() {
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
              fontFamily: "'Archivo Black', sans-serif",
              fontSize: "clamp(40px,5.8vw,82px)",
              lineHeight: 0.94,
              letterSpacing: "-2.5px",
              margin: "18px 0 0",
              textTransform: "uppercase",
              overflowWrap: "break-word",
              minWidth: 0,
            }}
          >
            Le studio partagé de l&apos;Afrique{" "}
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
              { valeur: "170+", libelle: "ressources" },
              { valeur: "12 400", libelle: "créatifs" },
              { valeur: "4.9", libelle: "satisfaction" },
            ].map((s) => (
              <div key={s.libelle}>
                <div
                  style={{
                    fontFamily: "'Archivo Black', sans-serif",
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "auto auto",
            gap: 18,
          }}
        >
          <div
            style={{
              gridColumn: "1 / span 2",
              border: CADRE,
              borderRadius: 24,
              background: BLANC,
              boxShadow: `6px 6px 0 ${ENCRE}`,
              padding: 16,
            }}
          >
            <div
              style={{
                height: 240,
                border: CADRE,
                borderRadius: 16,
                background:
                  "url('/img/demo/beaute-afro.jpg') center 30% / cover no-repeat",
              }}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 14,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                Ankara Editorial · 24 visuels
              </div>
              <a
                href="#grid"
                style={{
                  padding: "10px 16px",
                  border: CADRE,
                  borderRadius: 12,
                  background: JAUNE,
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                Ouvrir
              </a>
            </div>
          </div>

          <div
            style={{
              border: CADRE,
              borderRadius: 24,
              background: JAUNE,
              boxShadow: `6px 6px 0 ${ENCRE}`,
              padding: 16,
              animation: "floaty 7s ease-in-out infinite",
            }}
          >
            <div
              style={{
                height: 130,
                border: CADRE,
                borderRadius: 14,
                background: "url('/img/demo/neon-01.png') center / cover no-repeat",
              }}
            />
            <div style={{ marginTop: 12, fontSize: 14, fontWeight: 800 }}>
              Pack Wax &amp; Motifs
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.75 }}>
              gratuit · 2 340 dl
            </div>
          </div>

          <div
            style={{
              border: CADRE,
              borderRadius: 24,
              background: BLANC,
              boxShadow: `6px 6px 0 ${ENCRE}`,
              padding: 16,
            }}
          >
            <div
              style={{
                height: 130,
                border: CADRE,
                borderRadius: 14,
                background: "url('/img/demo/packshot-soin.png') center / cover no-repeat",
              }}
            />
            <div style={{ marginTop: 12, fontSize: 14, fontWeight: 800 }}>
              Mockup Affiche Rue
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.75 }}>
              3 000 FCFA
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
