import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { DashboardFrame, DashboardPanel, EmptyState, MetricCard } from "@/components/dashboard/frame";
import { Vignette } from "@/components/dashboard/vignette";
import { sessionCourante } from "@/lib/auth/session";
import { lireCommissions } from "@/lib/dashboard/lectures";
import { remunerationDe } from "@/lib/dashboard/remuneration";
import { partDuCreateur } from "@/lib/domain/fees";
import { formatMoney } from "@/lib/i18n/money";
import { BLANC, ENCRE, JAUNE, MAUVE } from "@/lib/systeme/charte";

export const metadata = { title: "Commissions — Baobart." };
export const dynamic = "force-dynamic";

/**
 * « Commissions » de la maquette (27/10) : la rémunération du créateur, par
 * ressource — voir `lib/dashboard/remuneration.ts` pour les deux sens du mot.
 * Les filtres de période de la maquette (« Ce mois · Trimestre · Année »)
 * sont branchés sur la date des mouvements.
 */

const PERIODES = [
  { cle: "tout", libelle: "Depuis le début", mois: null },
  { cle: "mois", libelle: "Ce mois", mois: 0 },
  { cle: "trimestre", libelle: "Trimestre", mois: 2 },
  { cle: "annee", libelle: "Année", mois: 11 },
] as const;

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const demande = (await searchParams).periode;
  const periode = PERIODES.find((p) => p.cle === demande) ?? PERIODES[0];
  const maintenant = new Date();
  const depuis = periode.mois === null ? undefined : new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - periode.mois, 1));

  const [r, surMesure] = await Promise.all([remunerationDe(utilisateur.id, depuis), lireCommissions(utilisateur.id)]);
  const argent = (n: number) => formatMoney(n, r.devise);

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Commissions"
      description={`Tu touches ${partDuCreateur()} du prix de chaque vente. Ta part reste impayée jusqu'au versement qui la porte, puis passe en versée.`}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
        <MetricCard label="Rémunération impayée" value={argent(r.impayee)} hint={`${r.ventesImpayees} vente${r.ventesImpayees > 1 ? "s" : ""} en attente de versement`} />
        <MetricCard label="Rémunération versée" value={argent(r.versee)} hint={periode.libelle.toLowerCase()} accent />
        <MetricCard label="Gains révoqués" value={argent(r.revoquee)} hint={`${r.remboursements} remboursement${r.remboursements > 1 ? "s" : ""} ou contestation${r.remboursements > 1 ? "s" : ""}`} />
      </div>

      <div style={{ marginTop: 18 }}>
        <DashboardPanel
          titre="Commissions par ressource"
          action={
            <nav aria-label="Période" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {PERIODES.map((p) => {
                const actif = p.cle === periode.cle;
                return (
                  <Link
                    key={p.cle}
                    href={(p.cle === "tout" ? "/dashboard/commissions" : `/dashboard/commissions?periode=${p.cle}`) as Route}
                    aria-current={actif ? "page" : undefined}
                    style={{ padding: "7px 13px", border: `2px solid ${ENCRE}`, borderRadius: 999, background: actif ? ENCRE : BLANC, color: actif ? BLANC : ENCRE, fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap" }}
                  >
                    {p.libelle}
                  </Link>
                );
              })}
            </nav>
          }
        >
          {r.parRessource.length === 0 ? (
            <EmptyState titre="Rien sur cette période" texte="Ce que chaque ressource te rapporte apparaîtra ici, vente après vente." />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {r.parRessource.map((l) => {
                const statut = l.net < 0 ? { libelle: "RÉVOQUÉE", fond: BLANC } : l.impaye > 0 ? { libelle: "IMPAYÉE", fond: MAUVE } : { libelle: "VERSÉE", fond: JAUNE };
                return (
                  <div key={l.produitId} style={{ display: "flex", alignItems: "center", gap: 13, border: `2px solid ${ENCRE}`, borderRadius: 16, padding: 12, background: "#F4EEFC" }}>
                    <Vignette couverture={l.couverture} titre={l.nom} />
                    <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 14, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nom}</span>
                      <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.66 }}>
                        {l.ventes} vente{l.ventes > 1 ? "s" : ""} · ta part, remboursements déduits
                      </span>
                    </span>
                    <span style={{ fontSize: 14.5, fontWeight: 900, whiteSpace: "nowrap" }}>{argent(l.net)}</span>
                    <span style={{ padding: "4px 10px", border: `2px solid ${ENCRE}`, borderRadius: 999, background: statut.fond, fontSize: 10.5, fontWeight: 800 }}>{statut.libelle}</span>
                    <a href={`/dashboard/produits/${l.produitId}`} style={{ padding: "8px 14px", border: `2px solid ${ENCRE}`, borderRadius: 12, background: BLANC, fontSize: 13, fontWeight: 800 }}>
                      Détail
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </DashboardPanel>
      </div>

      {surMesure.length > 0 ? (
        <div style={{ marginTop: 18 }}>
          <DashboardPanel titre="Commandes sur mesure">
            {surMesure.map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #12121222" }}>
                <span>
                  <strong>{c.status}</strong>
                  <br />
                  <small>{c.brief ?? "Sans brief"}</small>
                </span>
                <span>
                  {formatMoney(c.depositAmount, "XOF")}
                  {c.completionAmount ? ` + ${formatMoney(c.completionAmount, "XOF")}` : ""}
                </span>
              </div>
            ))}
          </DashboardPanel>
        </div>
      ) : null}
    </DashboardFrame>
  );
}
