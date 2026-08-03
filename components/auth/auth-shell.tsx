import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  BLANC,
  ENCRE,
  JAUNE,
  LAVANDE,
  LAVANDE_PROFOND,
  ORANGE,
} from "@/components/shell/nav-data";

/**
 * Cadre des écrans d'authentification, traduit de « Baobart Auth.dc.html ».
 *
 * Deux volets : l'argumentaire à gauche sur fond lavande profond, le formulaire
 * à droite. En dessous de 900 px, la maquette empile — le volet gauche passe
 * sous le formulaire, qui reste la raison d'être de la page.
 */

const CADRE = `2.5px solid ${ENCRE}`;

export interface Argumentaire {
  kicker: string;
  titre: string;
  texte: string;
  points: string[];
}

export function AuthShell({
  argumentaire,
  lienBascule,
  libelleBascule,
  indiceBascule,
  children,
}: {
  argumentaire: Argumentaire;
  lienBascule: string;
  libelleBascule: string;
  indiceBascule: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: LAVANDE,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "18px 26px",
          borderBottom: `3px solid ${ENCRE}`,
          background: LAVANDE,
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <span
            style={{
              width: 40,
              height: 40,
              flex: "0 0 auto",
              border: CADRE,
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
              fontSize: 21,
              letterSpacing: "-.6px",
            }}
          >
            Baobart<span style={{ color: ORANGE }}>.</span>
          </span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.7 }}>
            {indiceBascule}
          </span>
          <a
            href={lienBascule}
            style={{
              padding: "10px 18px",
              border: CADRE,
              borderRadius: 13,
              background: BLANC,
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {libelleBascule}
          </a>
        </div>
      </div>

      <div className="auth-volets" style={{ flex: "1 1 auto" }}>
        <div
          className="auth-argumentaire"
          style={{
            borderRight: `3px solid ${ENCRE}`,
            background: LAVANDE_PROFOND,
            padding: "44px 40px",
            display: "flex",
            flexDirection: "column",
            gap: 22,
            justifyContent: "center",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-block",
                border: CADRE,
                borderRadius: 999,
                background: JAUNE,
                padding: "7px 15px",
                fontFamily: "'Space Mono', monospace",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: ".14em",
              }}
            >
              {argumentaire.kicker}
            </div>
            <h1
              style={{
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: "clamp(30px,3.6vw,50px)",
                lineHeight: 0.97,
                letterSpacing: "-2px",
                margin: "16px 0 0",
                textTransform: "uppercase",
                maxWidth: 460,
              }}
            >
              {argumentaire.titre}
            </h1>
            <p
              style={{
                fontSize: 16,
                fontWeight: 500,
                lineHeight: 1.5,
                maxWidth: 440,
                margin: "14px 0 0",
                opacity: 0.82,
              }}
            >
              {argumentaire.texte}
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,minmax(0,1fr))",
              gap: 12,
              maxWidth: 520,
            }}
          >
            {[
              { img: "/img/demo/mode-rouge.jpg", position: "center 20%", decale: false },
              { img: "/img/demo/neon-01.png", position: "center", decale: true },
              { img: "/img/demo/beaute-afro.jpg", position: "center 25%", decale: false },
            ].map((v) => (
              <div
                key={v.img}
                style={{
                  height: 150,
                  border: CADRE,
                  borderRadius: 18,
                  boxShadow: `4px 4px 0 ${ENCRE}`,
                  background: `url('${v.img}') ${v.position} / cover no-repeat`,
                  marginTop: v.decale ? 18 : 0,
                }}
              />
            ))}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              maxWidth: 460,
            }}
          >
            {argumentaire.points.map((p) => (
              <div
                key={p}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: "12px 14px",
                  border: CADRE,
                  borderRadius: 15,
                  background: BLANC,
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    flex: "0 0 auto",
                    border: `2px solid ${ENCRE}`,
                    borderRadius: 9,
                    background: JAUNE,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  ✓
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{p}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            padding: "44px 40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              border: CADRE,
              borderRadius: 28,
              background: BLANC,
              boxShadow: `8px 8px 0 ${ENCRE}`,
              padding: 30,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
