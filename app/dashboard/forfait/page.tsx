import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { BoutonForfait } from "@/components/abonnements/bouton-forfait";
import { Notifications } from "@/components/push/notifications";
import { ACCES_LIBRE, fonctionsDuForfait } from "@/lib/abonnements/grille";
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

  const gratuit = actif !== null && actif.plan.priceMonthly === 0;
  const quota = actif?.quotas[0] ?? null;
  const detail = (cle: string, valeur: string) => (
    <div key={cle} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "10px 0", borderBottom: "1.5px solid #12121222" }}>
      <span style={{ fontSize: 13, fontWeight: 800 }}>{cle}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, textAlign: "right", opacity: 0.75 }}>{valeur}</span>
    </div>
  );

  return (
    <DashboardFrame utilisateur={utilisateur} titre="Forfait & pass" description="Ton forfait, ton quota et tes pass d'accès ponctuels.">
      {/*
        Deux cartes côte à côte, comme la maquette (27/10) : le forfait en jaune,
        ses détails à droite. « Ton forfait » s'étirait sur toute la largeur
        pour un contenu de 520 px, collé à gauche.
      */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,360px),1fr))", gap: 20, alignItems: "start" }}>
        <section data-forfait-actif={actif ? "1" : undefined} style={{ border: `2.5px solid ${ENCRE}`, borderRadius: 24, background: JAUNE, boxShadow: `5px 5px 0 ${ENCRE}`, padding: 20 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".12em", opacity: 0.7 }}>Forfait actuel</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 32, lineHeight: 1.05, margin: "6px 0 4px", textTransform: "uppercase" }}>
            {actif ? actif.plan.name : "Aucun"}
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>
            {actif === null
              ? "Accès libre est gratuit et s'active d'un clic."
              : gratuit
                ? "Gratuit, sans prélèvement"
                : `${formatMoney(actif.plan.priceMonthly, "XOF")} / mois · échéance le ${actif.cycleEnd.toLocaleDateString("fr-FR")}`}
          </div>

          {quota && quota.limit ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 800 }}>
                <span>Quota du mois</span>
                <span>
                  {quota.used} / {quota.limit}
                </span>
              </div>
              <div style={{ marginTop: 6, height: 14, border: `2px solid ${ENCRE}`, borderRadius: 99, background: "#FFFFFF", overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, Math.round((quota.used / quota.limit) * 100))}%`, height: "100%", background: "#E2622C" }} />
              </div>
            </div>
          ) : null}

          {gratuit ? (
            <ul style={{ margin: "12px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
              {ACCES_LIBRE.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : null}

          <div style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {actif === null ? (
              <BoutonForfait mode="activer" />
            ) : gratuit ? (
              // Un forfait gratuit n'a ni échéance à payer ni grâce : son cycle
              // avance seul (`renouvelerLesGratuits`). Lui montrer « Renouveler »
              // promettrait un paiement qui n'existe pas.
              <BoutonForfait mode="quitter" />
            ) : (
              // Le bouton de renouvellement vit ICI et non sur « Abonnements » :
              // cette entrée-là désigne les créateurs suivis. C'est aussi la page
              // où mènent les reçus et les relances Ndank.
              <Link
                href={`/abonnement/${actif.id}/renouveler` as Route}
                className="sticker-press"
                style={{ display: "inline-block", padding: "11px 16px", border: `2.5px solid ${ENCRE}`, borderRadius: 14, background: ENCRE, color: "#FFFFFF", fontSize: 13.5, fontWeight: 800 }}
              >
                {actif.status === "EXPIRED" ? "Réactiver mon accès" : "Renouveler maintenant"}
              </Link>
            )}
          </div>
        </section>

        <DashboardPanel titre="Détails du compte">
          {actif === null ? (
            <p style={{ margin: 0, fontSize: 13.5, opacity: 0.75 }}>Aucun forfait en cours : rien à détailler.</p>
          ) : (
            <div>
              {detail("Forfait", actif.plan.name)}
              {detail("Prix", gratuit ? "gratuit" : `${formatMoney(actif.plan.priceMonthly, "XOF")} / mois`)}
              {gratuit ? null : detail("Période", `${actif.cycleStart.toLocaleDateString("fr-FR")} → ${actif.cycleEnd.toLocaleDateString("fr-FR")}`)}
              {/*
                Les deux horloges de Ndank : l'échéance dit quand payer, l'accès
                jusqu'à quand le service tient. Les confondre ferait croire à une
                coupure le jour de l'échéance, alors qu'il reste la grâce.
              */}
              {!gratuit && accesJusquA ? detail("Accès maintenu jusqu'au", `${accesJusquA.toLocaleDateString("fr-FR")} · ${REGLAGES_PAR_DEFAUT.graceJours} j de grâce`) : null}
              {detail("Téléchargements", actif.plan.downloadsPerMonth ? `${actif.plan.downloadsPerMonth} / mois` : "illimités")}
              {quota ? detail("Ce mois", `${quota.used} / ${quota.limit ?? "—"}`) : null}
            </div>
          )}
        </DashboardPanel>
      </div>

      <div style={{ height: 20 }} />

      <DashboardPanel titre="Plans disponibles">
        {plans.length === 0 ? (
          <EmptyState titre="Plans non initialisés" texte="Lance le seed pour créer Découverte, Explorer et Studio." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
            {/* La même grille que Tarifs : l'ouvert en couleur, le reste grisé
                avec « Bientôt » (décidé le 05/10). */}
            {[...plans].sort((a, b) => Number(b.openForSubscription) - Number(a.openForSubscription) || a.priceMonthly - b.priceMonthly).map((plan) => (
              <div key={plan.id} data-plan={plan.code} style={{ border: `2.5px solid ${ENCRE}`, borderRadius: 20, padding: 18, background: plan.openForSubscription ? JAUNE : "#FFFFFF", boxShadow: `4px 4px 0 ${ENCRE}`, opacity: plan.openForSubscription ? 1 : 0.5, filter: plan.openForSubscription ? undefined : "grayscale(1)" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>{plan.name}</div>
                <div style={{ marginTop: 8, fontSize: 18, fontWeight: 900 }}>
                  {formatMoney(plan.priceMonthly, "XOF")}
                  {plan.openForSubscription ? "" : "/mois · bientôt"}
                </div>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12.5, lineHeight: 1.55 }}>
                  {(plan.openForSubscription && !plan.includesPaidResources ? [...ACCES_LIBRE] : fonctionsDuForfait(plan)).map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </DashboardPanel>

      <div style={{ height: 20 }} />

      {/*
        Le réglage des notifications vit sur la page du forfait : c'est le seul
        endroit où l'on vient déjà pour une échéance, donc le seul où la
        proposition a un sens. Aucune maquette ne le couvre — il suit la charte,
        et passe sous les plans depuis le 27/10 : il occupait le haut de l'écran
        pour dire, le plus souvent, qu'il n'est pas branché.
      */}
      <Notifications clePublique={clePubliqueVapid()} relances={relancesAnnoncees("push")} />
    </DashboardFrame>
  );
}
