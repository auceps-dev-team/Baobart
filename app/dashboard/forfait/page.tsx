import { redirect } from "next/navigation";

import { DashboardFrame, DashboardPanel, EmptyState, ENCRE, JAUNE } from "@/components/dashboard/frame";
import { sessionCourante } from "@/lib/auth/session";
import { lireAbonnements, lirePlans } from "@/lib/dashboard/lectures";
import { formatMoney } from "@/lib/i18n/money";

export const metadata = { title: "Forfait — Baobart." };
export const dynamic = "force-dynamic";

export default async function ForfaitPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");
  // Le forfait en cours et les forfaits disponibles se lisent au même endroit :
  // « Abonnements » dans la barre latérale désigne les créateurs suivis, pas un
  // abonnement payant. Séparer les deux ici laisserait la personne chercher son
  // propre forfait dans un écran qui parle d'autre chose.
  const [plans, abonnements] = await Promise.all([
    lirePlans(),
    lireAbonnements(utilisateur.id),
  ]);
  const actif = abonnements.find((a) => a.status === "ACTIVE") ?? null;

  return (
    <DashboardFrame utilisateur={utilisateur} titre="Forfait & pass" description="Choisis ton niveau d'accès : découverte gratuite, quotas ou usage studio.">
      <DashboardPanel titre="Ton forfait">
        {actif === null ? (
          <EmptyState
            titre="Aucun forfait en cours"
            texte="Baobart s'utilise gratuitement. Un forfait sert à télécharger davantage chaque mois, pas à accéder au site."
          />
        ) : (
          <div style={{ border: `2px solid ${ENCRE}`, borderRadius: 16, padding: 14 }}>
            <strong>{actif.plan.name}</strong> · {formatMoney(actif.plan.priceMonthly, "XOF")}/mois
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.72 }}>
              Période du {actif.cycleStart.toLocaleDateString("fr-FR")} au{" "}
              {actif.cycleEnd.toLocaleDateString("fr-FR")} ·{" "}
              {actif.plan.downloadsPerMonth ?? "illimité"} téléchargements/mois
            </div>
            {actif.quotas.length > 0 ? (
              <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 800 }}>
                Ce mois : {actif.quotas[0]?.used ?? 0} / {actif.quotas[0]?.limit ?? "—"}
              </div>
            ) : null}
          </div>
        )}
      </DashboardPanel>

      <div style={{ height: 18 }} />

      <DashboardPanel titre="Plans disponibles">
        {plans.length === 0 ? (
          <EmptyState titre="Plans non initialisés" texte="Lance le seed pour créer Découverte, Explorer et Studio." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
            {plans.map((plan) => (
              <div key={plan.id} style={{ border: `2.5px solid ${ENCRE}`, borderRadius: 20, padding: 18, background: plan.priceMonthly === 0 ? "#FFFFFF" : JAUNE, boxShadow: `4px 4px 0 ${ENCRE}` }}>
                <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 22 }}>{plan.name}</div>
                <div style={{ marginTop: 8, fontSize: 18, fontWeight: 900 }}>{formatMoney(plan.priceMonthly, "XOF")}/mois</div>
                <p style={{ fontSize: 13, opacity: .75 }}>{plan.downloadsPerMonth ?? "Téléchargements illimités"} {plan.downloadsPerMonth ? "téléchargements/mois" : ""}</p>
                <div style={{ fontSize: 12, fontWeight: 800 }}>Licence : {plan.licenseIncluded ?? "—"} · Shield : {plan.shieldLevel}</div>
              </div>
            ))}
          </div>
        )}
      </DashboardPanel>
    </DashboardFrame>
  );
}
