import { redirect } from "next/navigation";

import { DashboardFrame, DashboardPanel, EmptyState, MetricCard } from "@/components/dashboard/frame";
import { RevenusParMois } from "@/components/dashboard/revenus-mois";
import { Vignette } from "@/components/dashboard/vignette";
import { sessionCourante } from "@/lib/auth/session";
import { statistiquesCreateur } from "@/lib/dashboard/statistiques";
import { formatCount } from "@/lib/i18n/money";
import { JAUNE } from "@/lib/systeme/charte";

export const metadata = { title: "Statistiques — Baobart." };
export const dynamic = "force-dynamic";

/**
 * « Statistiques » de la maquette (27/10) : quatre cartes, une courbe sur six
 * mois, le podium. Ce qui n'est pas mesuré — les vues de fiches — est écrit
 * dans `lib/dashboard/statistiques.ts`, et remplacé ici par ce qui l'est.
 */
export default async function StatistiquesPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");
  const s = await statistiquesCreateur(utilisateur.id);

  return (
    <DashboardFrame utilisateur={utilisateur} titre="Statistiques" description="Ce qui attire du monde, et ce qui convertit.">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
        <MetricCard label="Vues de ta vitrine" value={formatCount(s.vuesVitrine)} hint="comptées depuis le 16/10" />
        <MetricCard label="Téléchargements" value={formatCount(s.telechargements)} hint={`+${s.telechargementsMois} ce mois`} accent />
        {/*
          Pas de « taux d'achat » : la maquette le calcule sur les vues de
          fiches, qu'on ne compte pas. Rapporté aux téléchargements, il
          donnait 328 % (mesuré le 27/10) — on achète sans télécharger.
        */}
        <MetricCard label="Ventes" value={formatCount(s.ventes)} hint={`+${s.ventesMois} ce mois`} />
        <MetricCard label="Nouveaux abonnés" value={formatCount(s.nouveauxAbonnes)} hint={`ce mois · ${formatCount(s.abonnes)} en tout`} mauve />
      </div>

      <div style={{ marginTop: 18 }}>
        <DashboardPanel titre="Téléchargements par mois" action={<span style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.6 }}>6 derniers mois</span>}>
          <RevenusParMois barres={s.parMois} format={(n) => formatCount(n)} couleur={JAUNE} quoi="Téléchargements" />
        </DashboardPanel>
      </div>

      <div style={{ marginTop: 18 }}>
        <DashboardPanel titre="Meilleures ressources">
          {s.meilleures.length === 0 ? (
            <EmptyState titre="Pas encore de classement" texte="Tes ressources les plus vendues et téléchargées apparaîtront ici." />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {s.meilleures.map((r, i) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 13, border: "2px solid #121212", borderRadius: 16, padding: 12, background: "#F4EEFC" }}>
                  <Vignette couverture={r.couverture} titre={r.nom} />
                  <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nom}</span>
                    <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.66 }}>
                      {formatCount(r.telechargements)} dl · {formatCount(r.ventes)} vente{r.ventes > 1 ? "s" : ""}
                    </span>
                  </span>
                  <span style={{ padding: "4px 10px", border: "2px solid #121212", borderRadius: 999, background: JAUNE, fontSize: 10.5, fontWeight: 800 }}>TOP {i + 1}</span>
                  <a href={`/dashboard/produits/${r.id}`} style={{ padding: "8px 14px", border: "2px solid #121212", borderRadius: 12, background: "#FFFFFF", fontSize: 13, fontWeight: 800 }}>
                    Détail
                  </a>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>
      </div>
    </DashboardFrame>
  );
}
