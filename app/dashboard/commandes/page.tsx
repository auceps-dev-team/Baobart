import { redirect } from "next/navigation";

import { DashboardFrame, DashboardPanel, EmptyState } from "@/components/dashboard/frame";
import { sessionCourante } from "@/lib/auth/session";
import { etatCommande } from "@/lib/dashboard/historique";
import { lireVentesCreateur } from "@/lib/dashboard/lectures";
import { formatMoney } from "@/lib/i18n/money";

export const metadata = { title: "Commandes vendeur — Baobart." };
export const dynamic = "force-dynamic";

export default async function CommandesVendeurPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");
  // Toutes les lignes, y compris en cours ou échouées — mais dites dans les
  // mots de l'acheteur, jamais par le code brut (« · FAILED », mesuré le 25/09).
  const lignes = await lireVentesCreateur(utilisateur.id, 20, { toutes: true });

  return (
    <DashboardFrame utilisateur={utilisateur} titre="Commandes" description="Vue vendeur : une commande multi-créateurs se lit ligne par ligne, comme chez Gumroad.">
      <DashboardPanel titre="Lignes récentes">
        {lignes.length === 0 ? <EmptyState titre="Aucune commande" texte="Tes futures ventes apparaîtront ici avec l'acheteur et l'état de la ligne." /> : lignes.map((l) => <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "10px 0", borderBottom: "1px solid #12121222" }}><span><strong>{l.product.name}</strong><br /><small>{l.order.buyer.profile?.displayName ?? l.order.buyer.email} · {etatCommande([l]).toLowerCase()}</small></span><strong>{formatMoney(l.price * l.quantity, l.product.currency)}</strong></div>)}
      </DashboardPanel>
    </DashboardFrame>
  );
}
