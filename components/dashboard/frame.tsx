import type { ReactNode } from "react";

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
    <div style={{ display: "flex", minHeight: "100vh", background: "#EADFF9" }}>
      <DashboardSidebar
        etape={utilisateur.progression.etape}
        nom={utilisateur.nom}
        email={utilisateur.email}
      />
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
                fontFamily: "'Archivo Black', sans-serif",
                fontSize: "clamp(30px,3.4vw,44px)",
                letterSpacing: "-1.4px",
                margin: 0,
                textTransform: "uppercase",
              }}
            >
              {titre}
            </h1>
            {description ? (
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  opacity: 0.75,
                  margin: "8px 0 0",
                  maxWidth: 680,
                }}
              >
                {description}
              </p>
            ) : null}
          </div>
          {action}
        </div>
        <div style={{ marginTop: 28 }}>{children}</div>
      </main>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        border: CADRE,
        borderRadius: 20,
        background: accent ? JAUNE : BLANC,
        boxShadow: `4px 4px 0 ${ENCRE}`,
        padding: 18,
      }}
    >
      <div
        style={{
          fontFamily: "'Space Mono', monospace",
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
          fontFamily: "'Archivo Black', sans-serif",
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
            fontFamily: "'Archivo Black', sans-serif",
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
