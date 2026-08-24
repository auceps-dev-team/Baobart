import { redirect } from "next/navigation";

import { DashboardFrame, DashboardPanel, EmptyState } from "@/components/dashboard/frame";
import { sessionCourante } from "@/lib/auth/session";
import { lireVentesCreateur } from "@/lib/dashboard/lectures";
import { formatMoney } from "@/lib/i18n/money";

export const metadata = { title: "Commandes vendeur — Baobart." };
export const dynamic = "force-dynamic";

export default async function CommandesVendeurPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");
  const lignes = await lireVentesCreateur(utilisateur.id, 20);

  return (
    <DashboardFrame utilisateur={utilisateur} titre="Commandes" description="Vue vendeur : une commande multi-créateurs se lit ligne par ligne, comme chez Gumroad.">
      <DashboardPanel titre="Lignes récentes">
        {lignes.length === 0 ? <EmptyState titre="Aucune commande" texte="Tes futures ventes apparaîtront ici avec l'acheteur et l'état de la ligne." /> : lignes.map((l) => <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "10px 0", borderBottom: "1px solid #12121222" }}><span><strong>{l.product.name}</strong><br /><small>{l.order.buyer.profile?.displayName ?? l.order.buyer.email} · {l.state}</small></span><strong>{formatMoney(l.price * l.quantity, l.product.currency)}</strong></div>)}
      </DashboardPanel>
    </DashboardFrame>
  );
}
