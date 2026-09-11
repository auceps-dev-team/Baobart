import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { DashboardFrame, DashboardPanel } from "@/components/dashboard/frame";
import { FormulaireProfil } from "@/components/dashboard/profil-form";
import { sessionCourante } from "@/lib/auth/session";
import { lireProfilDashboard } from "@/lib/dashboard/lectures";

export const metadata = { title: "Profil — Baobart." };
export const dynamic = "force-dynamic";

function ligne(label: string, valeur: string | null | undefined) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 18,
        padding: "10px 0",
        borderBottom: "1.5px solid #12121222",
      }}
    >
      <span style={{ fontSize: 13, opacity: 0.62, fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 850, textAlign: "right" }}>
        {valeur || "—"}
      </span>
    </div>
  );
}

/**
 * Le profil, enfin modifiable.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA VITRINE EXISTAIT DEPUIS v1.45.0, RIEN NE LA REMPLISSAIT
 *
 * `/createurs/[username]` affiche la spécialité, les liens, la disponibilité
 * et le tarif indicatif. Ces colonnes existaient au schéma — mais **aucune
 * action ne les écrivait**, et cet écran annonçait « Édition bientôt
 * disponible ». Un créateur découvrait donc une page publique vide sans aucun
 * moyen d'y remédier : c'est pourtant la page que les agences visitent.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * PUBLIC ET FACTURATION RESTENT SÉPARÉS
 *
 * C'est ce que cet écran disait déjà, et c'est maintenant visible dans sa
 * forme : un formulaire pour ce qui se montre, un panneau en lecture pour ce
 * qui ne se montre pas. Les mélanger ferait qu'un jour une adresse postale
 * partirait dans une vitrine.
 */
export default async function ProfilPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion?suite=/dashboard/profil");

  const profil = await lireProfilDashboard(utilisateur.id);
  const p = profil?.profile;

  const depart = {
    nomAffiche: p?.displayName ?? "",
    username: p?.username ?? "",
    bio: p?.bio ?? "",
    ville: p?.city ?? "",
    pays: p?.country ?? "",
    specialite: p?.speciality ?? "",
    portfolio: p?.portfolioUrl ?? "",
    instagram: p?.instagram ?? "",
    behance: p?.behance ?? "",
    disponibilite: p?.openToCommissions ?? "",
    tarifJournalier: p?.dailyRate ? String(p.dailyRate) : "",
  };

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Profil"
      description="Ce que tu remplis ici s'affiche sur ta page publique. La facturation reste à part — une adresse privée n'a rien à faire dans une vitrine."
      action={
        p?.username ? (
          <Link
            href={`/@${p.username}` as Route}
            style={{
              padding: "10px 16px",
              border: "2.5px solid #121212",
              borderRadius: 13,
              background: "#FFFFFF",
              fontSize: 13,
              fontWeight: 800,
              color: "#121212",
            }}
          >
            Voir ma page ↗
          </Link>
        ) : undefined
      }
    >
      <FormulaireProfil depart={depart} />

      <div style={{ marginTop: 20, maxWidth: 900 }}>
        <DashboardPanel titre="Compte & facturation">
          {/*
            En lecture seule, et à dessein : ces champs touchent au paiement et
            à la conformité. Les rendre modifiables ici demanderait les mêmes
            gardes que le KYC — ce n'est pas le même écran ni le même risque.
          */}
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
    </DashboardFrame>
  );
}
