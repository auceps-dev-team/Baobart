import type { ReactNode } from "react";

import { LigneEspace } from "@/components/dashboard/espace";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import type { UtilisateurConnecte } from "@/lib/auth/session";

const ENCRE = "#121212";
const CADRE = `2.5px solid ${ENCRE}`;
const BLANC = "#FFFFFF";
const JAUNE = "#FFD84A";
const LAVANDE_CLAIR = "#F4EEFC";

export function DashboardFrame({
  utilisateur,
  titre,
  description,
  action,
  children,
}: {
  utilisateur: UtilisateurConnecte;
  titre: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div data-shell="1" style={{ display: "flex", minHeight: "100vh", background: "#EADFF9" }}>
      <DashboardSidebar
        etape={utilisateur.progression.etape}
        nom={utilisateur.nom}
        email={utilisateur.email}
        role={utilisateur.role}
      />
      <main style={{ flex: "1 1 auto", minWidth: 0 }}>
        {/*
          L'en-tête de la maquette (27/10) : l'espace en petites capitales, le
          titre, l'action à droite, un filet sur toute la largeur. Le titre
          passe de 44 à 32 px : la maquette ne le grossit pas, et chaque page
          y gagne de la hauteur.
        */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
            padding: "20px 36px 16px",
            borderBottom: `3px solid ${ENCRE}`,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <LigneEspace />
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(24px,2.4vw,32px)",
                letterSpacing: "-1px",
                margin: "4px 0 0",
                textTransform: "uppercase",
                // « REMBOURSEMENT » en capitales dépasse un écran de 320 px :
                // le mot se coupe plutôt que de pousser la page.
                overflowWrap: "anywhere",
              }}
            >
              {titre}
            </h1>
          </div>
          {action}
        </header>
        <div style={{ padding: "22px 36px 40px" }}>
          {description ? (
            <p style={{ fontSize: 14.5, fontWeight: 500, opacity: 0.78, margin: "0 0 20px", maxWidth: 760 }}>{description}</p>
          ) : null}
          {children}
        </div>
      </main>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  accent = false,
  mauve = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
  /** La carte mauve de la maquette (« Vues de page »). */
  mauve?: boolean;
}) {
  return (
    <div
      style={{
        border: CADRE,
        borderRadius: 20,
        background: accent ? JAUNE : mauve ? "#C9A8F5" : BLANC,
        boxShadow: `4px 4px 0 ${ENCRE}`,
        padding: 18,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: ".1em",
          opacity: 0.62,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 28,
          lineHeight: 1,
          marginTop: 10,
        }}
      >
        {value}
      </div>
      {hint ? (
        <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 650, opacity: 0.7 }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function DashboardPanel({
  titre,
  children,
  action,
}: {
  titre: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      style={{
        border: CADRE,
        borderRadius: 24,
        background: BLANC,
        boxShadow: `5px 5px 0 ${ENCRE}`,
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: 20,
            letterSpacing: "-.5px",
            textTransform: "uppercase",
          }}
        >
          {titre}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({
  titre,
  texte,
  action,
}: {
  titre: string;
  texte: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        border: `2px dashed ${ENCRE}`,
        borderRadius: 18,
        background: LAVANDE_CLAIR,
        padding: 22,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 900 }}>{titre}</div>
      <p style={{ margin: "8px auto 0", maxWidth: 520, fontSize: 13.5, opacity: 0.72 }}>
        {texte}
      </p>
      {action ? <div style={{ marginTop: 14 }}>{action}</div> : null}
    </div>
  );
}

export { BLANC, CADRE, ENCRE, JAUNE, LAVANDE_CLAIR };
