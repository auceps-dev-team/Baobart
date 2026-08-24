import { redirect } from "next/navigation";

import { DashboardFrame, DashboardPanel, EmptyState } from "@/components/dashboard/frame";
import { sessionCourante } from "@/lib/auth/session";
import { lireCommissions } from "@/lib/dashboard/lectures";
import { formatMoney } from "@/lib/i18n/money";

export const metadata = { title: "Commissions — Baobart." };
export const dynamic = "force-dynamic";

export default async function CommissionsPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");
  const commissions = await lireCommissions(utilisateur.id);

  return (
    <DashboardFrame utilisateur={utilisateur} titre="Commissions" description="Services créatifs en deux temps : acompte, brief, livraison et solde.">
      <DashboardPanel titre="Demandes">
        {commissions.length === 0 ? <EmptyState titre="Aucune commission" texte="Le modèle existe déjà ; l'interface de réservation arrivera avec les produits de type commission." /> : commissions.map((c) => <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #12121222" }}><span><strong>{c.status}</strong><br /><small>{c.brief ?? "Sans brief"}</small></span><span>{formatMoney(c.depositAmount, "XOF")}{c.completionAmount ? ` + ${formatMoney(c.completionAmount, "XOF")}` : ""}</span></div>)}
      </DashboardPanel>
    </DashboardFrame>
  );
}
