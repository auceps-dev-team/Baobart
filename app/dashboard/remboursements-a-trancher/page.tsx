import { DashboardFrame } from "@/components/dashboard/frame";
import { DecisionDemande } from "@/components/remboursements/gestes";
import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import { demandesPourLeSupport } from "@/lib/remboursements/service";
import { BLANC, CADRE, ENCRE } from "@/lib/systeme/charte";

export const metadata = { title: "Remboursements à trancher — Baobart." };
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Abidjan" });

/**
 * Le support tranche les demandes restées sans réponse du créateur au-delà de
 * sept jours (décidé le 05/10). Le pouvoir est `traiter_les_litiges` :
 * « rembourser, trancher un litige ». Chaque décision va au journal d'audit.
 */
export default async function RemboursementsATrancherPage() {
  const utilisateur = await exigerLePouvoir("traiter_les_litiges");
  const demandes = await demandesPourLeSupport();

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Remboursements à trancher"
      description={
        demandes.length > 0
          ? `${demandes.length} demande${demandes.length > 1 ? "s" : ""} sans réponse du créateur depuis plus de sept jours.`
          : "Aucune demande en souffrance : les créateurs répondent."
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 900 }}>
        {demandes.map((d) => (
          <div key={d.id} data-demande-support={d.id} style={{ border: CADRE, borderRadius: 20, background: BLANC, boxShadow: `4px 4px 0 ${ENCRE}`, padding: 16, color: ENCRE }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline" }}>
              <span style={{ fontSize: 14.5, fontWeight: 800 }}>{d.ressource}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, opacity: 0.65 }}>
                {d.montant} · {d.acheteur} · demandée le {DATE.format(d.demandeeLe)}
              </span>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 500, lineHeight: 1.5, overflowWrap: "anywhere" }}>« {d.motif} »</p>
            <DecisionDemande demandeId={d.id} />
          </div>
        ))}
      </div>
    </DashboardFrame>
  );
}
