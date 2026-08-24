import { redirect } from "next/navigation";

import { DashboardFrame, DashboardPanel, EmptyState, MetricCard } from "@/components/dashboard/frame";
import { sessionCourante } from "@/lib/auth/session";
import { lireVentesCreateur } from "@/lib/dashboard/lectures";
import { formatMoney } from "@/lib/i18n/money";

export const metadata = { title: "Ventes — Baobart." };
export const dynamic = "force-dynamic";

export default async function VentesPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");
  const ventes = await lireVentesCreateur(utilisateur.id, 30);
  const total = ventes.filter((v) => v.state === "SUCCESSFUL" || v.state === "NOT_CHARGED").reduce((s, v) => s + v.price * v.quantity, 0);
  const devise = ventes[0]?.product.currency ?? "XOF";

  return (
    <DashboardFrame utilisateur={utilisateur} titre="Ventes" description="Suivi commercial des ressources vendues, séparé des soldes comptables.">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
        <MetricCard label="Ventes récentes" value={ventes.length} />
        <MetricCard label="Brut récent" value={formatMoney(total, devise)} accent />
      </div>
      <div style={{ marginTop: 22 }}>
        <DashboardPanel titre="Détail">
          {ventes.length === 0 ? <EmptyState titre="Pas encore de vente" texte="Publie une ressource, partage-la, puis retrouve les ventes ici." /> : ventes.map((v) => <div key={v.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #12121222" }}><span><strong>{v.product.name}</strong><br /><small>{v.createdAt.toLocaleDateString("fr-FR")} · {v.state}</small></span><span>{formatMoney(v.price * v.quantity, v.product.currency)}</span></div>)}
        </DashboardPanel>
      </div>
    </DashboardFrame>
  );
}
