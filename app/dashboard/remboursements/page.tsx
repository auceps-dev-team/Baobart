import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { DashboardFrame } from "@/components/dashboard/frame";
import { FormulaireDemande } from "@/components/remboursements/gestes";
import { sessionCourante } from "@/lib/auth/session";
import { MESSAGES_REFUS } from "@/lib/remboursements/regles";
import { achatsRemboursables } from "@/lib/remboursements/service";
import { BLANC, CADRE, ENCRE, GRIS, JAUNE, VERT } from "@/lib/systeme/charte";

export const metadata = { title: "Remboursements — Baobart." };
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Abidjan" });

const STATUT = {
  PENDING: { libelle: "En attente du créateur", fond: JAUNE },
  ACCEPTED: { libelle: "Remboursé", fond: VERT },
  REFUSED: { libelle: "Refusé", fond: GRIS },
} as const;

/**
 * Côté acheteur : ce qu'on peut demander, et où en sont ses demandes.
 *
 * Décidé le 05/10 : la demande se fait dans le délai du créateur, affiché sur
 * la fiche et figé à l'achat ; le créateur répond ; sans réponse sous sept
 * jours, le support tranche. Il n'y avait jusque-là aucun moyen de demander
 * quoi que ce soit depuis le site (relevé le 04/10).
 */
export default async function RemboursementsPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");
  const achats = await achatsRemboursables(utilisateur.id);

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Remboursements"
      description="Chaque créateur fixe son délai, écrit sur la fiche de la ressource. Ta demande lui arrive ; sans réponse sous sept jours, l'équipe Baobart tranche."
    >
      {achats.length === 0 ? (
        <div style={{ border: CADRE, borderRadius: 24, background: BLANC, boxShadow: `6px 6px 0 ${ENCRE}`, padding: 28, maxWidth: 620 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>Aucun achat payant</div>
          <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55, marginTop: 8 }}>Les ressources offertes n&apos;ont rien à rembourser.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 900 }}>
          {achats.map((a) => (
            <div key={a.orderItemId} data-achat={a.orderItemId} style={{ border: CADRE, borderRadius: 20, background: BLANC, boxShadow: `4px 4px 0 ${ENCRE}`, padding: 16, color: ENCRE }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline" }}>
                <Link href={`/products/${a.slug}` as Route} style={{ fontSize: 15, fontWeight: 800, color: ENCRE }}>
                  {a.ressource}
                </Link>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, opacity: 0.65 }}>{a.montant}</span>
                {a.demande ? (
                  <span data-statut={a.demande.statut} style={{ padding: "3px 10px", border: `2px solid ${ENCRE}`, borderRadius: 999, background: STATUT[a.demande.statut].fond, fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase" }}>
                    {STATUT[a.demande.statut].libelle}
                  </span>
                ) : null}
              </div>
              {a.demande?.statut === "REFUSED" ? (
                <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 600 }}>
                  Refusée par {a.demande.parLeSupport ? "l'équipe Baobart" : "le créateur"} : « {a.demande.motifRefus} »
                </p>
              ) : a.demande ? null : a.jusquA ? (
                <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.7 }}>Jusqu&apos;au {DATE.format(a.jusquA)}.</span>
                  <FormulaireDemande orderItemId={a.orderItemId} />
                </div>
              ) : (
                <p style={{ margin: "8px 0 0", fontSize: 12.5, fontWeight: 600, opacity: 0.7 }}>{a.refus ? MESSAGES_REFUS[a.refus] : null}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardFrame>
  );
}
