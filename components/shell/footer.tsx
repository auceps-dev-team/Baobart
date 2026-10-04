import Image from "next/image";
import type { Route } from "next";
import Link from "next/link";

import { GererMesCookies } from "@/components/consentement/banniere-cookies";

import {
  BLANC,
  ENCRE,
  LAVANDE_CLAIR,
  LAVANDE_PROFOND,
  ORANGE,
} from "@/components/shell/nav-data";

/** Pied de page, traduit du bloc FOOTER de « Baobart Accueil.dc.html ». */
export function Footer() {
  const colonne = (titre: string, liens: Array<{ label: string; href: string }>) => (
    <div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: ".08em",
          marginBottom: 12,
        }}
      >
        {titre}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          fontSize: 13.5,
          fontWeight: 600,
        }}
      >
        {liens.map((l) => (
          <a key={l.label} href={l.href}>
            {l.label}
          </a>
        ))}
      </div>
    </div>
  );

  return (
    <div data-pied="1" style={{ maxWidth: 1400, margin: "72px auto 0", padding: "0 32px 40px" }}>
      <div
        style={{
          border: `2.5px solid ${ENCRE}`,
          borderRadius: 28,
          background: BLANC,
          boxShadow: `7px 7px 0 ${ENCRE}`,
          padding: 32,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
            gap: 26,
          }}
        >
          <div>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width: 36,
                  height: 36,
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
                  width={24}
                  height={24}
                  style={{ width: 24, height: "auto", display: "block", marginTop: 2 }}
                />
              </span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>
                Baobart<span style={{ color: ORANGE }}>.</span>
              </span>
            </Link>
            <p
              style={{
                fontSize: 13.5,
                fontWeight: 500,
                opacity: 0.7,
                lineHeight: 1.5,
                maxWidth: 280,
                margin: "14px 0 0",
              }}
            >
              La communauté créative africaine. Ressources partagées, projets
              menés ensemble.
            </p>
          </div>

          {colonne("Explorer", [
            { label: "Illustrations", href: "/explore?filtre=Illustration" },
            { label: "Mockups", href: "/explore?filtre=Mockup" },
            { label: "Fonts", href: "/explore?filtre=Font" },
            { label: "Photos", href: "/explore?filtre=Photo" },
          ])}

          {colonne("Communauté", [
            { label: "Espaces", href: "#collab" },
            { label: "Vendre", href: "#contrib" },
            { label: "Blog", href: "#blog" },
            { label: "Créatifs", href: "#collab" },
          ])}

          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: ".08em",
                marginBottom: 12,
              }}
            >
              Reste au courant
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
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
                type="button"
                style={{
                  padding: "10px 14px",
                  border: `2.5px solid ${ENCRE}`,
                  borderRadius: 12,
                  background: LAVANDE_PROFOND,
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 26,
            paddingTop: 18,
            borderTop: `2.5px solid ${ENCRE}`,
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            opacity: 0.65,
          }}
        >
          {/*
            La maquette écrit « Dakar, Sénégal ». Baobart est établie à Abidjan,
            et cette ligne est la seule du site qui dise où : sur sa foi, un
            module juridique entier avait été bâti sur la loi sénégalaise
            (corrigé en v1.57.0, sans que le pied de page le soit).
          */}
          <span>© 2026 Baobart — Abidjan, Côte d&apos;Ivoire</span>
          <span>
            Conditions · Confidentialité · Licences ·{" "}
            <Link href={"/cookies" as Route} style={{ color: "inherit" }}>
              Cookies
            </Link>{" "}
            · <GererMesCookies />
          </span>
        </div>
      </div>
    </div>
  );
}
