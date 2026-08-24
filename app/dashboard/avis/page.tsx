import { redirect } from "next/navigation";

import { DashboardFrame, DashboardPanel, EmptyState, MetricCard } from "@/components/dashboard/frame";
import { sessionCourante } from "@/lib/auth/session";
import { lireProduitsCreateur, lireProfilDashboard } from "@/lib/dashboard/lectures";

export const metadata = { title: "Feedback créateur — Baobart." };
export const dynamic = "force-dynamic";

export default async function AvisPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");
  const [profil, produits] = await Promise.all([lireProfilDashboard(utilisateur.id), lireProduitsCreateur(utilisateur.id, 20)]);
  const note = profil?.profile?.ratingAvg ? Number(profil.profile.ratingAvg).toFixed(1) : "—";
  const totalAvis = profil?.profile?.ratingCount ?? 0;

  return (
    <DashboardFrame utilisateur={utilisateur} titre="Créateur feedback" description="Avis, notes et signaux de confiance visibles par les acheteurs.">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
        <MetricCard label="Note boutique" value={note} accent />
        <MetricCard label="Avis boutique" value={totalAvis} />
        <MetricCard label="Ressources notées" value={produits.filter((p) => p.ratingCount > 0).length} />
      </div>
      <div style={{ marginTop: 22 }}>
        <DashboardPanel titre="Avis par ressource">
          {produits.every((p) => p.ratingCount === 0) ? <EmptyState titre="Aucun avis" texte="Les avis apparaîtront après les premières ventes et téléchargements." /> : produits.map((p) => <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #12121222" }}><strong>{p.name}</strong><span>{Number(p.ratingAvg).toFixed(1)} · {p.ratingCount} avis</span></div>)}
        </DashboardPanel>
      </div>
    </DashboardFrame>
  );
}
