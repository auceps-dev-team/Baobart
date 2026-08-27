import { redirect } from "next/navigation";

import {
  DashboardFrame,
  DashboardPanel,
  EmptyState,
  MetricCard,
} from "@/components/dashboard/frame";
import { LigneVente, type VenteAffichee } from "@/components/dashboard/ligne-vente";
import { sessionCourante } from "@/lib/auth/session";
import { lireVentesCreateur } from "@/lib/dashboard/lectures";
import { formatMoney } from "@/lib/i18n/money";

export const metadata = { title: "Ventes — Baobart." };
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

type Vente = Awaited<ReturnType<typeof lireVentesCreateur>>[number];

/**
 * Comment se lit une vente.
 *
 * L'ordre compte : un litige l'emporte sur tout — l'argent a été repris, le
 * reste est secondaire. Vient ensuite le remboursement intégral, puis le
 * retrait d'accès, qui peut coexister avec un remboursement partiel.
 */
function decrire(v: Vente): VenteAffichee {
  const brut = v.price * v.quantity;
  const restant = brut - v.refundedAmount;
  const litige = v.chargebackAt !== null && v.chargebackReversedAt === null;
  const rembourseEnEntier = v.refundedAmount >= brut && brut > 0;

  let etat = "ENCAISSÉE";
  let fond = "#FFFFFF";

  if (litige) {
    etat = "CONTESTÉE";
    fond = "#FFF1EA";
  } else if (v.state === "IN_PROGRESS") {
    etat = "EN ATTENTE";
    fond = "#FFFBEB";
  } else if (rembourseEnEntier) {
    etat = "REMBOURSÉE";
    fond = "#F4EEFC";
  } else if (v.refundedAmount > 0) {
    etat = `REMBOURSÉE EN PARTIE`;
    fond = "#FFFBEB";
  } else if (v.accessRevokedAt !== null) {
    etat = "ACCÈS RETIRÉ";
    fond = "#FFFBEB";
  } else if (v.state === "NOT_CHARGED") {
    etat = "OFFERTE";
  }

  return {
    id: v.id,
    ressource: v.product.name,
    acheteur: v.order.buyer.profile?.displayName ?? v.order.buyer.email,
    date: DATE.format(v.createdAt),
    montant: formatMoney(brut, v.product.currency),
    restant,
    restantLisible: formatMoney(restant, v.product.currency),
    etat,
    fond,
    // Une ligne jamais encaissée n'a rien à rendre ; une ligne contestée non
    // plus — la banque a déjà repris l'argent.
    remboursable:
      v.state === "SUCCESSFUL" && restant > 0 && !litige,
    accesRetire: v.accessRevokedAt !== null,
    litige,
  };
}

export default async function VentesPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const ventes = await lireVentesCreateur(utilisateur.id, 30);
  const devise = ventes[0]?.product.currency ?? "XOF";

  const encaisse = ventes
    .filter((v) => v.state === "SUCCESSFUL")
    .reduce((s, v) => s + v.price * v.quantity, 0);
  const rendu = ventes.reduce((s, v) => s + v.refundedAmount, 0);
  const contestees = ventes.filter(
    (v) => v.chargebackAt !== null && v.chargebackReversedAt === null,
  ).length;

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Ventes"
      description="Ce que tu as vendu, et ce que tu peux encore en faire."
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 16,
        }}
      >
        <MetricCard label="Ventes récentes" value={ventes.length} />
        <MetricCard label="Brut encaissé" value={formatMoney(encaisse, devise)} accent />
        <MetricCard label="Remboursé" value={formatMoney(rendu, devise)} />
        {contestees > 0 ? (
          <MetricCard label="Contestées" value={contestees} />
        ) : null}
      </div>

      <div style={{ marginTop: 22 }}>
        <DashboardPanel titre="Détail">
          {ventes.length === 0 ? (
            <EmptyState
              titre="Pas encore de vente"
              texte="Publie une ressource, partage-la, puis retrouve les ventes ici."
            />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginTop: 14,
              }}
            >
              {ventes.map((v) => (
                <LigneVente key={v.id} vente={decrire(v)} />
              ))}
            </div>
          )}
        </DashboardPanel>
      </div>

      {/*
        Obligation d'information, la même que sur l'écran des versements : la
        découvrir sur un solde négatif serait une mauvaise surprise.
      */}
      <p
        style={{
          marginTop: 18,
          maxWidth: 720,
          fontSize: 12.5,
          fontWeight: 600,
          opacity: 0.75,
          lineHeight: 1.55,
        }}
      >
        Rembourser te débite du prix entier : la commission Baobart reste
        acquise, et les frais de l&apos;opérateur ne sont jamais restitués par la
        passerelle. Retirer l&apos;accès ne rend aucun argent — les deux gestes
        sont indépendants.
      </p>
    </DashboardFrame>
  );
}
