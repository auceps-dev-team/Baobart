import Image from "next/image";
import Link from "next/link";

import {
  BLANC,
  ENCRE,
  JAUNE,
  LAVANDE,
  LAVANDE_CLAIR,
  ORANGE,
} from "@/components/shell/nav-data";
import type { EtapeCompte } from "@/lib/auth/roles";
import { navigationPour } from "@/lib/dashboard/nav";

/**
 * Barre latérale du tableau de bord, traduite de « Baobart Dashboard.dc.html ».
 *
 * Elle ne montre pas trois navigations selon un rôle : elle montre **une**
 * navigation qui grandit. Les entrées verrouillées restent visibles et
 * expliquent ce qui les ouvrira — les cacher priverait la personne de la carte
 * du chemin qu'elle est en train de parcourir.
 */

const CADRE = `2.5px solid ${ENCRE}`;

export function DashboardSidebar({
  etape,
  nom,
  email,
}: {
  etape: EtapeCompte;
  nom: string;
  email: string;
}) {
  const groupes = navigationPour(etape);

  return (
    <aside
      style={{
        width: 268,
        flex: "0 0 auto",
        minHeight: "100vh",
        borderRight: `3px solid ${ENCRE}`,
        background: BLANC,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 38,
            height: 38,
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
            width={26}
            height={26}
            style={{ width: 26, height: "auto", display: "block", marginTop: 2 }}
          />
        </span>
        <span style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 19 }}>
          Baobart<span style={{ color: ORANGE }}>.</span>
        </span>
      </Link>

      {groupes.map((groupe) => (
        <div
          key={groupe.titre ?? "principal"}
          style={{ display: "flex", flexDirection: "column", gap: 4 }}
        >
          {groupe.titre ? (
            <div
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 10.5,
                textTransform: "uppercase",
                letterSpacing: ".12em",
                opacity: 0.55,
                margin: "8px 0 4px",
              }}
            >
              {groupe.titre}
            </div>
          ) : null}

          {groupe.entrees.map((n) => {
            const contenu = (
              <>
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
                    fontWeight: 800,
                    background: n.actif ? LAVANDE : BLANC,
                  }}
                >
                  {n.glyph}
                </span>
                <span
                  style={{
                    flex: "1 1 auto",
                    fontSize: 13.5,
                    fontWeight: 700,
                    lineHeight: 1.25,
                  }}
                >
                  {n.label}
                </span>
                {n.badge ? (
                  <span
                    style={{
                      padding: "3px 8px",
                      border: `2px solid ${ENCRE}`,
                      borderRadius: 999,
                      background: ORANGE,
                      color: BLANC,
                      fontSize: 10.5,
                      fontWeight: 800,
                    }}
                  >
                    {n.badge}
                  </span>
                ) : null}
                {!n.actif ? (
                  <span style={{ fontSize: 12, opacity: 0.5 }} aria-hidden>
                    ⌁
                  </span>
                ) : null}
              </>
            );

            const style = {
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: "9px 10px",
              borderRadius: 12,
              background: n.badge ? JAUNE : "transparent",
              // Verrouillée : estompée mais lisible. Illisible, elle
              // n'apprendrait rien ; absente, elle ne promettrait rien.
              opacity: n.actif ? 1 : 0.45,
            } as const;

            if (!n.actif) {
              return (
                <div
                  key={n.cle}
                  aria-disabled="true"
                  title={n.raisonVerrou ?? undefined}
                  style={{ ...style, cursor: "not-allowed" }}
                >
                  {contenu}
                </div>
              );
            }

            if (!n.href) {
              return (
                <div
                  key={n.cle}
                  title="Écran à venir"
                  style={{ ...style, cursor: "default" }}
                >
                  {contenu}
                </div>
              );
            }

            // `href` est une chaîne connue de notre table de navigation, mais
            // typedRoutes ne peut pas le prouver depuis une variable : une
            // ancre suffit, la navigation reste correcte.
            return (
              <a key={n.cle} href={n.href} style={style}>
                {contenu}
              </a>
            );
          })}
        </div>
      ))}

      <div
        style={{
          marginTop: "auto",
          border: CADRE,
          borderRadius: 16,
          background: LAVANDE_CLAIR,
          padding: 12,
          display: "flex",
          alignItems: "center",
          gap: 11,
        }}
      >
        <span
          style={{
            width: 36,
            height: 36,
            flex: "0 0 auto",
            border: CADRE,
            borderRadius: 99,
            background: `repeating-linear-gradient(135deg,${JAUNE} 0 5px,${BLANC} 5px 11px)`,
          }}
        />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13.5, fontWeight: 800 }}>
            {nom}
          </span>
          <span
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 600,
              opacity: 0.6,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {email}
          </span>
        </span>
      </div>
    </aside>
  );
}
