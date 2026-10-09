import Image from "next/image";
import type { Route } from "next";
import Link from "next/link";

import { GererMesCookies } from "@/components/consentement/banniere-cookies";
import { FormulaireInfolettre } from "@/components/infolettre/formulaire";

import { BLANC, ENCRE, ORANGE } from "@/components/shell/nav-data";

/**
 * Pied de page, traduit du bloc FOOTER de « Baobart Accueil.dc.html ».
 *
 * Ses liens étaient les ancres de la maquette (« #collab », « #contrib »,
 * « #blog ») : hors de l'accueil, elles ne menaient nulle part, et le bas de
 * page écrivait « Conditions · Confidentialité · Licences » sans lien
 * (relevé le 04/10). Chacun mène désormais à sa page.
 */
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
            <Link href="/" className="logo-anime" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                className="logo-pastille"
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
              <span className="logo-mot" style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>
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
            { label: "Espaces", href: "/communautes" },
            // Sans session, la page renvoie à la connexion, qui mène à l'inscription.
            { label: "Vendre", href: "/dashboard/produits/nouveau" },
            { label: "Blog", href: "/blog" },
            { label: "Créatifs", href: "/createurs" },
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
            <FormulaireInfolettre />
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
            <Link href={"/conditions" as Route} style={{ color: "inherit" }}>
              Conditions
            </Link>{" "}
            ·{" "}
            <Link href={"/confidentialite" as Route} style={{ color: "inherit" }}>
              Confidentialité
            </Link>{" "}
            ·{" "}
            <Link href={"/licences" as Route} style={{ color: "inherit" }}>
              Licences
            </Link>{" "}
            ·{" "}
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
