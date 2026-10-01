import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { Notifications } from "@/components/push/notifications";
import { DashboardFrame, DashboardPanel, EmptyState, ENCRE, JAUNE } from "@/components/dashboard/frame";
import { sessionCourante } from "@/lib/auth/session";
import { lireAbonnements, lirePlans } from "@/lib/dashboard/lectures";
import { formatMoney } from "@/lib/i18n/money";
import { REGLAGES_PAR_DEFAUT, accesJusquA as finDeLAcces } from "@/lib/ndank/cycle";
import { relancesAnnoncees } from "@/lib/ndank/etats";
import { clePubliqueVapid } from "@/lib/push/pilotes";

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
  // EXPIRED compte aussi : c'est un abonnement suspendu faute de
  // renouvellement, et c'est précisément celui à qui il faut montrer le bouton.
  // Ne montrer que les ACTIVE cacherait le bouton à qui en a le plus besoin.
  const actif =
    abonnements.find((a) => a.status === "ACTIVE") ??
    abonnements.find((a) => a.status === "EXPIRED") ??
    null;

  // Les deux horloges de Ndank : l'échéance dit quand payer, l'accès dit
  // jusqu'à quand le service tient. Les confondre ferait croire à une coupure
  // le jour de l'échéance, alors qu'il reste la grâce.
  const accesJusquA = actif ? finDeLAcces(actif.cycleEnd) : null;

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
            {accesJusquA ? (
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.72 }}>
                Accès maintenu jusqu&apos;au {accesJusquA.toLocaleDateString("fr-FR")} —
                {" "}
                {REGLAGES_PAR_DEFAUT.graceJours} jours de grâce après l&apos;échéance,
                le temps de renouveler.
              </div>
            ) : null}
            {actif.quotas.length > 0 ? (
              <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 800 }}>
                Ce mois : {actif.quotas[0]?.used ?? 0} / {actif.quotas[0]?.limit ?? "—"}
              </div>
            ) : null}

            {/*
              Le bouton de renouvellement vit ICI et non sur « Abonnements » :
              cette entrée-là désigne les créateurs suivis. C'est aussi la page où
              mènent les reçus et les relances Ndank.
            */}
            <Link
              href={`/abonnement/${actif.id}/renouveler` as Route}
              className="sticker-press"
              style={{
                display: "inline-block",
                marginTop: 14,
                padding: "11px 16px",
                border: `2.5px solid ${ENCRE}`,
                borderRadius: 14,
                background: JAUNE,
                fontSize: 13.5,
                fontWeight: 800,
              }}
            >
              {actif.status === "EXPIRED" ? "Réactiver mon accès" : "Renouveler maintenant"}
            </Link>
          </div>
        )}
      </DashboardPanel>

      <div style={{ height: 18 }} />

      {/*
        Le réglage des notifications vit sur la page du forfait : c'est le seul
        endroit où l'on vient déjà pour une échéance, donc le seul où la
        proposition a un sens. Aucune maquette ne le couvre — il suit la charte.
      */}
      <Notifications
        clePublique={clePubliqueVapid()}
        relances={relancesAnnoncees("push")}
      />

      <div style={{ height: 18 }} />

      <DashboardPanel titre="Plans disponibles">
        {plans.length === 0 ? (
          <EmptyState titre="Plans non initialisés" texte="Lance le seed pour créer Découverte, Explorer et Studio." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
            {plans.map((plan) => (
              <div key={plan.id} style={{ border: `2.5px solid ${ENCRE}`, borderRadius: 20, padding: 18, background: plan.priceMonthly === 0 ? "#FFFFFF" : JAUNE, boxShadow: `4px 4px 0 ${ENCRE}` }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>{plan.name}</div>
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
