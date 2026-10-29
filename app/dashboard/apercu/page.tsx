import Link from "next/link";
import { redirect } from "next/navigation";

import { CADRE, DashboardFrame, DashboardPanel, EmptyState, ENCRE, JAUNE, MetricCard } from "@/components/dashboard/frame";
import { RevenusParMois } from "@/components/dashboard/revenus-mois";
import { Vignette } from "@/components/dashboard/vignette";
import { sessionCourante } from "@/lib/auth/session";
import { apercuAcheteur } from "@/lib/dashboard/acheteur";
import { formatCount, formatMoney } from "@/lib/i18n/money";

export const metadata = { title: "Aperçu — Baobart." };
export const dynamic = "force-dynamic";

/**
 * « Aperçu » acheteur de la maquette (27/10) : quatre cartes, les
 * téléchargements sur six mois, l'activité récente. Le partage d'équipe que la
 * maquette suppose n'existe pas — voir `lib/dashboard/acheteur.ts`.
 */
export default async function ApercuPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion?suite=/dashboard/apercu");
  const a = await apercuAcheteur(utilisateur.id);

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Aperçu"
      description="Ton activité du mois : quota, achats récents et collections."
      action={
        <Link href="/explore" className="sticker-press" style={{ padding: "11px 18px", border: CADRE, borderRadius: 13, background: JAUNE, boxShadow: `4px 4px 0 ${ENCRE}`, fontSize: 13, fontWeight: 800 }}>
          Explorer les ressources
        </Link>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
        <MetricCard label="Téléchargements ce mois" value={formatCount(a.telechargementsMois)} hint={a.quota ? `sur ${a.quota.limite} inclus` : "sans quota"} />
        <MetricCard label="Achats" value={formatCount(a.achats)} hint={`+${a.achatsMois} ce mois`} accent />
        <MetricCard label="Collections" value={formatCount(a.collections)} hint={`${a.collectionsPubliques} publique${a.collectionsPubliques > 1 ? "s" : ""}`} />
        <MetricCard label="Créateurs suivis" value={formatCount(a.suivis)} hint={`+${a.suivisMois} ce mois`} mauve />
      </div>

      <div style={{ marginTop: 18 }}>
        <DashboardPanel titre="Téléchargements par mois" action={<span style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.6 }}>6 derniers mois</span>}>
          <RevenusParMois barres={a.parMois} format={(n) => formatCount(n)} couleur={JAUNE} quoi="Téléchargements" />
        </DashboardPanel>
      </div>

      <div style={{ marginTop: 18 }}>
        <DashboardPanel
          titre="Activité récente"
          action={
            <Link href="/dashboard/telechargements" style={{ fontSize: 13, fontWeight: 800, textDecoration: "underline" }}>
              Tout l&apos;historique →
            </Link>
          }
        >
          {a.recents.length === 0 ? (
            <EmptyState titre="Rien encore" texte="Tes téléchargements et tes achats apparaîtront ici." />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {a.recents.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 13, border: `2px solid ${ENCRE}`, borderRadius: 16, padding: 12, background: "#F4EEFC" }}>
                  <Vignette couverture={r.couverture} titre={r.nom} />
                  <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nom}</span>
                    <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.66 }}>
                      téléchargée · {r.quand.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </span>
                  <span style={{ fontSize: 14.5, fontWeight: 900, whiteSpace: "nowrap" }}>{r.prix === 0 ? "gratuit" : formatMoney(r.prix, r.devise)}</span>
                  <span style={{ padding: "4px 10px", border: `2px solid ${ENCRE}`, borderRadius: 999, background: JAUNE, fontSize: 10.5, fontWeight: 800 }}>
                    {r.achete ? "ACHETÉE" : "OFFERTE"}
                  </span>
                  <Link href={`/products/${r.slug}`} style={{ padding: "8px 14px", border: `2px solid ${ENCRE}`, borderRadius: 12, background: "#FFFFFF", fontSize: 13, fontWeight: 800 }}>
                    Ouvrir
                  </Link>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>
      </div>
    </DashboardFrame>
  );
}
