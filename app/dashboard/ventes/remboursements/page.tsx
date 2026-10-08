import { redirect } from "next/navigation";

import { DashboardFrame } from "@/components/dashboard/frame";
import { DecisionDemande, ReglageDelai } from "@/components/remboursements/gestes";
import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DELAIS } from "@/lib/remboursements/regles";
import { demandesRecues } from "@/lib/remboursements/service";
import { BLANC, CADRE, ENCRE, GRIS, JAUNE, VERT } from "@/lib/systeme/charte";

export const metadata = { title: "Demandes de remboursement — Baobart." };
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Abidjan" });

/**
 * Côté créateur : son délai de remboursement, et les demandes reçues.
 *
 * Le délai se règle ici et nulle part ailleurs : c'est l'endroit où l'on en
 * voit l'effet. Il vaut pour les achats à venir — chaque vente garde celui de
 * son jour (`OrderItem.refundWindowDays`).
 */
export default async function DemandesDeRemboursementPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");
  const [demandes, moi] = await Promise.all([
    demandesRecues(utilisateur.id),
    db.user.findUniqueOrThrow({ where: { id: utilisateur.id }, select: { refundWindowDays: true } }),
  ]);
  const enAttente = demandes.filter((d) => d.statut === "PENDING").length;

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Demandes de remboursement"
      description={
        enAttente > 0
          ? `${enAttente} à traiter. Sans réponse sous sept jours, l'équipe Baobart tranche à ta place.`
          : "Rien à traiter. Un remboursement accepté rend l'argent à l'acheteur et débite ton solde du prix payé."
      }
    >
      <div style={{ border: CADRE, borderRadius: 20, background: BLANC, boxShadow: `4px 4px 0 ${ENCRE}`, padding: 16, maxWidth: 900, marginBottom: 16, display: "grid", gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Ton délai de remboursement</div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.5, opacity: 0.75 }}>
          Écrit sur la fiche de chacune de tes ressources. Il vaut pour les achats à venir : ceux d&apos;avant gardent le délai de
          leur jour.
        </p>
        <ReglageDelai actuel={moi.refundWindowDays} delais={DELAIS} />
      </div>

      {demandes.length === 0 ? (
        <div style={{ border: CADRE, borderRadius: 24, background: BLANC, boxShadow: `6px 6px 0 ${ENCRE}`, padding: 28, maxWidth: 620 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>Aucune demande</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 900 }}>
          {demandes.map((d) => (
            <div key={d.id} data-demande-recue={d.id} style={{ border: CADRE, borderRadius: 20, background: BLANC, boxShadow: `4px 4px 0 ${ENCRE}`, padding: 16, color: ENCRE }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline" }}>
                <span style={{ padding: "3px 10px", border: `2px solid ${ENCRE}`, borderRadius: 999, background: d.statut === "PENDING" ? JAUNE : d.statut === "ACCEPTED" ? VERT : GRIS, fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" }}>
                  {d.statut === "PENDING" ? "À traiter" : d.statut === "ACCEPTED" ? "Remboursée" : "Refusée"}
                </span>
                <span style={{ fontSize: 14.5, fontWeight: 800 }}>{d.ressource}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, opacity: 0.65 }}>
                  {d.montant} · {d.acheteur} · le {DATE.format(d.demandeeLe)}
                </span>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 500, lineHeight: 1.5, overflowWrap: "anywhere" }}>« {d.motif} »</p>
              {d.statut === "PENDING" ? (
                <>
                  <p style={{ margin: "6px 0 0", fontSize: 12, fontWeight: 700, opacity: 0.65 }}>Le support tranchera à partir du {DATE.format(d.supportLe)}.</p>
                  <DecisionDemande demandeId={d.id} />
                </>
              ) : d.statut === "REFUSED" ? (
                <p style={{ margin: "6px 0 0", fontSize: 12.5, fontWeight: 600 }}>
                  Refusée{d.parLeSupport ? " par le support" : ""} : « {d.motifRefus} »
                </p>
              ) : d.parLeSupport ? (
                <p style={{ margin: "6px 0 0", fontSize: 12.5, fontWeight: 600 }}>Remboursée par le support, faute de réponse.</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </DashboardFrame>
  );
}
