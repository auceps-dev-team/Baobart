import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

/**
 * Coquille d'un écran de tableau de bord, traduite de « Baobart Dashboard.dc.html ».
 *
 * La maquette décrit chaque écran par les mêmes briques : un titre avec son
 * bouton d'action, une phrase d'intro, des indicateurs, puis un bloc de lignes
 * avec ses filtres. Les écrans qui suivent — gains, ventes, commandes — s'y
 * couleront sans redessiner quoi que ce soit.
 */

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const JAUNE = "#FFD84A";
const LAVANDE_CLAIR = "#F4EEFC";
const CADRE = `2.5px solid ${ENCRE}`;

export interface Indicateur {
  label: string;
  valeur: string;
  precision?: string;
  fond?: string;
}

export interface Ligne {
  cle: string;
  titre: string;
  meta: string;
  montant: string;
  etat: string;
  /** Fond de la pastille d'état. La maquette varie selon ce qu'elle annonce. */
  etatFond?: string;
  /** Vignette : une couverture s'il y en a une, la trame du design sinon. */
  visuel?: string | null;
  action?: { label: string; href: string; telecharger?: boolean };
}

export interface Filtre {
  label: string;
  href: string;
  actif: boolean;
}

/**
 * Trame diagonale du design system, déterministe par ligne.
 *
 * Deux lectures de la même page doivent donner la même trame : une couleur
 * tirée au hasard à chaque rendu ferait clignoter la liste.
 */
export function trameDe(cle: string): string {
  const teintes = ["#C9A8F5", "#E2622C", "#FFD84A", "#EADFF9", BLANC];
  let somme = 0;
  for (let i = 0; i < cle.length; i += 1) somme = (somme + cle.charCodeAt(i)) % 997;
  const accent = teintes[somme % teintes.length];
  return `repeating-linear-gradient(135deg, ${accent} 0 7px, ${BLANC} 7px 16px)`;
}

export function EcranDashboard({
  titre,
  intro,
  action,
  indicateurs,
  blocLignes,
  enfants,
}: {
  titre: string;
  intro: string;
  action?: { label: string; href: string };
  indicateurs?: Indicateur[];
  blocLignes?: {
    titre: string;
    filtres?: Filtre[];
    lignes: Ligne[];
    /** Ce qu'on dit quand il n'y a rien — jamais un tableau vide muet. */
    vide: { titre: string; texte: string; action?: { label: string; href: string } };
  };
  enfants?: ReactNode;
}) {
  return (
    <main style={{ flex: "1 1 auto", padding: "32px 36px", minWidth: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(28px,3.2vw,40px)",
              letterSpacing: "-1.4px",
              margin: 0,
              textTransform: "uppercase",
            }}
          >
            {titre}
          </h1>
          <p
            style={{
              fontSize: 15,
              fontWeight: 600,
              opacity: 0.75,
              margin: "10px 0 0",
              maxWidth: 760,
            }}
          >
            {intro}
          </p>
        </div>

        {action ? (
          <Link
            href={action.href as Route}
            className="sticker-press"
            style={{
              padding: "11px 18px",
              border: CADRE,
              borderRadius: 13,
              background: JAUNE,
              boxShadow: `4px 4px 0 ${ENCRE}`,
              fontSize: 13,
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            {action.label}
          </Link>
        ) : null}
      </div>

      {indicateurs && indicateurs.length > 0 ? (
        <div
          style={{
            marginTop: 24,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
            gap: 16,
          }}
        >
          {indicateurs.map((k) => (
            <div
              key={k.label}
              style={{
                border: CADRE,
                borderRadius: 20,
                boxShadow: `5px 5px 0 ${ENCRE}`,
                padding: 18,
                background: k.fond ?? BLANC,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  textTransform: "uppercase",
                  letterSpacing: ".1em",
                  opacity: 0.65,
                }}
              >
                {k.label}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 30,
                  lineHeight: 1.1,
                  marginTop: 6,
                }}
              >
                {k.valeur}
              </div>
              {k.precision ? (
                <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.7 }}>
                  {k.precision}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {blocLignes ? (
        <div
          style={{
            marginTop: 20,
            border: CADRE,
            borderRadius: 24,
            background: BLANC,
            boxShadow: `6px 6px 0 ${ENCRE}`,
            padding: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, flex: "1 1 auto" }}>
              {blocLignes.titre}
            </div>

            {(blocLignes.filtres ?? []).map((f) => (
              <Link
                key={f.label}
                href={f.href as Route}
                style={{
                  padding: "7px 14px",
                  border: `2px solid ${ENCRE}`,
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                  background: f.actif ? ENCRE : BLANC,
                  color: f.actif ? BLANC : ENCRE,
                }}
              >
                {f.label}
              </Link>
            ))}
          </div>

          {blocLignes.lignes.length === 0 ? (
            <Vide {...blocLignes.vide} />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginTop: 16,
              }}
            >
              {blocLignes.lignes.map((l) => (
                <LigneTableau key={l.cle} ligne={l} />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {enfants}
    </main>
  );
}

function LigneTableau({ ligne }: { ligne: Ligne }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
        padding: 13,
        border: CADRE,
        borderRadius: 16,
        background: LAVANDE_CLAIR,
      }}
    >
      <div
        style={{
          width: 54,
          height: 54,
          flex: "0 0 auto",
          border: CADRE,
          borderRadius: 12,
          background: ligne.visuel
            ? `center / cover no-repeat url(${ligne.visuel})`
            : trameDe(ligne.cle),
        }}
      />

      <div style={{ flex: "1 1 210px", minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.3 }}>
          {ligne.titre}
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            opacity: 0.65,
          }}
        >
          {ligne.meta}
        </div>
      </div>

      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 16,
          whiteSpace: "nowrap",
        }}
      >
        {ligne.montant}
      </div>

      <div
        style={{
          padding: "6px 12px",
          border: `2px solid ${ENCRE}`,
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 800,
          whiteSpace: "nowrap",
          background: ligne.etatFond ?? JAUNE,
        }}
      >
        {ligne.etat}
      </div>

      {ligne.action ? (
        // Un téléchargement passe par une route d'API, pas par le routeur :
        // `Link` tenterait une navigation client sur une redirection 302.
        ligne.action.telecharger ? (
          <a
            href={ligne.action.href}
            download
            style={ACTION}
          >
            {ligne.action.label}
          </a>
        ) : (
          <Link href={ligne.action.href as Route} style={ACTION}>
            {ligne.action.label}
          </Link>
        )
      ) : null}
    </div>
  );
}

const ACTION = {
  padding: "9px 15px",
  border: CADRE,
  borderRadius: 12,
  background: BLANC,
  fontSize: 12.5,
  fontWeight: 800,
  whiteSpace: "nowrap" as const,
};

function Vide({
  titre,
  texte,
  action,
}: {
  titre: string;
  texte: string;
  action?: { label: string; href: string };
}) {
  return (
    <div
      style={{
        marginTop: 16,
        border: `2.5px dashed ${ENCRE}`,
        borderRadius: 18,
        padding: "28px 22px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800 }}>{titre}</div>
      <p
        style={{
          fontSize: 13.5,
          fontWeight: 500,
          opacity: 0.7,
          margin: "8px auto 0",
          maxWidth: 420,
        }}
      >
        {texte}
      </p>
      {action ? (
        <Link
          href={action.href as Route}
          className="sticker-press"
          style={{
            display: "inline-block",
            marginTop: 16,
            padding: "11px 18px",
            border: CADRE,
            borderRadius: 13,
            background: JAUNE,
            boxShadow: `4px 4px 0 ${ENCRE}`,
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
