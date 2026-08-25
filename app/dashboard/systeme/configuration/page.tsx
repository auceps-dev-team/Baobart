import { DashboardFrame, DashboardPanel } from "@/components/dashboard/frame";
import { exigerAdministrateur } from "@/lib/auth/acces-administration";
import { LIBELLE_ROLE } from "@/lib/auth/administration";
import { etatDeLaPlateforme } from "@/lib/systeme/lecture";
import type { Constat, Gravite } from "@/lib/systeme/diagnostic";

export const metadata = { title: "Configuration — Baobart." };
export const dynamic = "force-dynamic";

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const JAUNE = "#FFD84A";
const ORANGE = "#E2622C";
const CADRE = `2.5px solid ${ENCRE}`;

const TON: Record<Gravite, { fond: string; encre: string; mot: string }> = {
  ok: { fond: BLANC, encre: ENCRE, mot: "OK" },
  attention: { fond: JAUNE, encre: ENCRE, mot: "À VOIR" },
  panne: { fond: ORANGE, encre: BLANC, mot: "PANNE" },
};

const BANDEAU: Record<Gravite, string> = {
  ok: "Tout ce qui est livré fonctionne.",
  attention: "La plateforme sert, mais quelque chose mérite un regard.",
  panne: "Quelque chose d'essentiel ne fonctionne pas.",
};

function Pastille({ gravite }: { gravite: Gravite }) {
  const ton = TON[gravite];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        border: `2px solid ${ENCRE}`,
        borderRadius: 999,
        background: ton.fond,
        color: ton.encre,
        fontFamily: "'Space Mono', monospace",
        fontSize: 10,
        letterSpacing: ".1em",
        whiteSpace: "nowrap",
      }}
    >
      {ton.mot}
    </span>
  );
}

function LigneConstat({ constat }: { constat: Constat }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        padding: "12px 0",
        borderBottom: "1px solid #12121222",
      }}
    >
      <Pastille gravite={constat.gravite} />
      <div style={{ minWidth: 0, flex: "1 1 auto" }}>
        <strong style={{ fontSize: 14 }}>{constat.libelle}</strong>
        <div style={{ fontSize: 13, marginTop: 3 }}>{constat.detail}</div>
        {constat.remede ? (
          <div style={{ fontSize: 12.5, marginTop: 5, opacity: 0.75 }}>
            → {constat.remede}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default async function ConfigurationPage() {
  // Le layout garde déjà la section, mais Next.js ne le réexécute pas à chaque
  // navigation entre pages sœurs. Une garde qui ne s'exécute pas est absente.
  const utilisateur = await exigerAdministrateur();
  const etat = await etatDeLaPlateforme();
  const ton = TON[etat.gravite];

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Configuration"
      description="Ce que cette instance sait faire, et ce qui l'en empêche. Lu à chaque affichage — rien n'est mis en cache."
    >
      <div
        role="status"
        style={{
          border: CADRE,
          borderRadius: 18,
          background: ton.fond,
          color: ton.encre,
          boxShadow: `5px 5px 0 ${ENCRE}`,
          padding: "16px 18px",
          marginBottom: 20,
          fontSize: 14,
          fontWeight: 800,
        }}
      >
        {BANDEAU[etat.gravite]}
      </div>

      <DashboardPanel titre="État des dépendances">
        {etat.constats.map((c) => (
          <LigneConstat key={c.cle} constat={c} />
        ))}
      </DashboardPanel>

      <div style={{ marginTop: 18 }}>
        <DashboardPanel titre="Pas encore écrit">
          <p style={{ margin: "0 0 10px", fontSize: 13, opacity: 0.75 }}>
            Les variables de ces modules sont documentées dans{" "}
            <code>.env.example</code>, mais aucun code ne les lit : les
            renseigner ne branche rien.
          </p>
          {etat.aVenir.map((m) => (
            <div
              key={m}
              style={{
                padding: "8px 0",
                borderBottom: "1px solid #12121222",
                fontSize: 13.5,
              }}
            >
              {m}
            </div>
          ))}
        </DashboardPanel>
      </div>

      <p style={{ marginTop: 18, fontSize: 12.5, opacity: 0.7 }}>
        Connecté en tant que {LIBELLE_ROLE[utilisateur.role]}. Les rôles se
        donnent depuis la base — <code>node scripts/promouvoir-admin.mjs</code> —
        et jamais depuis un écran.
      </p>
    </DashboardFrame>
  );
}
