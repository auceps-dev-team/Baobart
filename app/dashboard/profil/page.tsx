import { redirect } from "next/navigation";

import { DashboardFrame, DashboardPanel, EmptyState } from "@/components/dashboard/frame";
import { sessionCourante } from "@/lib/auth/session";
import { lireProfilDashboard } from "@/lib/dashboard/lectures";

export const metadata = { title: "Profil — Baobart." };
export const dynamic = "force-dynamic";

function ligne(label: string, valeur: string | null | undefined) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 18, padding: "10px 0", borderBottom: "1.5px solid #12121222" }}>
      <span style={{ fontSize: 13, opacity: 0.62, fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 850, textAlign: "right" }}>{valeur || "—"}</span>
    </div>
  );
}

export default async function ProfilPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const profil = await lireProfilDashboard(utilisateur.id);

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Profil"
      description="Les informations publiques et de facturation sont séparées pour éviter d'exposer une adresse privée par erreur."
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18 }}>
        <DashboardPanel titre="Identité publique">
          {ligne("Nom affiché", profil?.profile?.displayName)}
          {ligne("Nom d'utilisateur", profil?.profile?.username ? `@${profil.profile.username}` : null)}
          {ligne("Ville", profil?.profile?.city)}
          {ligne("Pays", profil?.profile?.country)}
          {ligne("Spécialité", profil?.profile?.speciality)}
          {ligne("Portfolio", profil?.profile?.portfolioUrl)}
          {ligne("Instagram", profil?.profile?.instagram)}
          {ligne("Behance", profil?.profile?.behance)}
        </DashboardPanel>
        <DashboardPanel titre="Compte & facturation">
          {ligne("Email", profil?.email)}
          {ligne("Téléphone", profil?.phone)}
          {ligne("Devise", profil?.defaultCurrency)}
          {ligne("KYC", profil?.kycStatus)}
          {ligne("Risque", profil?.riskState)}
          {ligne("Prénom", profil?.billing?.firstName)}
          {ligne("Nom", profil?.billing?.lastName)}
          {ligne("Adresse", profil?.billing?.addressLine1)}
        </DashboardPanel>
      </div>
      <div style={{ marginTop: 18 }}>
        <EmptyState titre="Édition bientôt disponible" texte="Cette page expose déjà la bonne séparation public/privé. Les formulaires d'édition arriveront après les écrans de consultation." />
      </div>
    </DashboardFrame>
  );
}
