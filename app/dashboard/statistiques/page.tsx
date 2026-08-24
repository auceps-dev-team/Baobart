import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardFrame, DashboardPanel, EmptyState, MetricCard } from "@/components/dashboard/frame";
import { sessionCourante } from "@/lib/auth/session";
import { lireProduitsCreateur } from "@/lib/dashboard/lectures";
import { formatCount } from "@/lib/i18n/money";

export const metadata = { title: "Statistiques — Baobart." };
export const dynamic = "force-dynamic";

export default async function StatistiquesPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");
  const produits = await lireProduitsCreateur(utilisateur.id, 50);
  const downloads = produits.reduce((s, p) => s + p.downloadsCount, 0);
  const ventes = produits.reduce((s, p) => s + p.salesCount, 0);
  const publies = produits.filter((p) => p.status === "PUBLISHED").length;

  return (
    <DashboardFrame utilisateur={utilisateur} titre="Statistiques" description="Compteurs dénormalisés : rapides à afficher, recalculables par jobs si besoin.">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
        <MetricCard label="Produits publiés" value={publies} />
        <MetricCard label="Téléchargements" value={formatCount(downloads)} accent />
        <MetricCard label="Ventes" value={formatCount(ventes)} />
      </div>
      <div style={{ marginTop: 22 }}>
        <DashboardPanel titre="Par ressource">
          {produits.length === 0 ? <EmptyState titre="Pas encore de données" texte="Les statistiques se rempliront avec tes ressources." /> : produits.map((p) => <Link key={p.id} href={`/dashboard/produits/${p.id}`} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #12121222" }}><strong>{p.name}</strong><span>{formatCount(p.downloadsCount)} dl · {formatCount(p.salesCount)} ventes</span></Link>)}
        </DashboardPanel>
      </div>
    </DashboardFrame>
  );
}
