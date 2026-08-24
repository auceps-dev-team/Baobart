import { redirect } from "next/navigation";

import { DashboardFrame, DashboardPanel, EmptyState } from "@/components/dashboard/frame";
import { sessionCourante } from "@/lib/auth/session";
import { lireProfilDashboard } from "@/lib/dashboard/lectures";
import { formatMoney } from "@/lib/i18n/money";

export const metadata = { title: "Profil boutique — Baobart." };
export const dynamic = "force-dynamic";

export default async function BoutiquePage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");
  const profil = await lireProfilDashboard(utilisateur.id);
  const p = profil?.profile;

  return (
    <DashboardFrame utilisateur={utilisateur} titre="Profil de la boutique" description="La vitrine publique d'un créateur doit rester distincte des informations de facturation.">
      <DashboardPanel titre="Vitrine">
        <div style={{ display: "grid", gap: 10 }}>
          <strong style={{ fontSize: 22 }}>{p?.displayName ?? utilisateur.nom}</strong>
          <span>@{p?.username ?? "—"}</span>
          <p style={{ margin: 0, opacity: .75 }}>{p?.bio ?? "Ajoute une bio pour expliquer ton univers créatif."}</p>
          <span>Spécialité : {p?.speciality ?? "—"}</span>
          <span>Ouvert aux commissions : {p?.openToCommissions ?? "—"}</span>
          <span>Tarif jour : {p?.dailyRate ? formatMoney(p.dailyRate, "XOF") : "—"}</span>
        </div>
      </DashboardPanel>
      <div style={{ marginTop: 18 }}><EmptyState titre="Éditeur de boutique à venir" texte="Cette page fixe le parcours. Les champs éditables seront raccordés avec les formulaires de profil." /></div>
    </DashboardFrame>
  );
}
