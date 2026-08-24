import Link from "next/link";
import { redirect } from "next/navigation";

import {
  DashboardFrame,
  DashboardPanel,
  EmptyState,
  MetricCard,
  CADRE,
  ENCRE,
  JAUNE,
} from "@/components/dashboard/frame";
import { deconnecter } from "@/lib/auth/actions";
import { sessionCourante } from "@/lib/auth/session";
import { lireProduitsCreateur, lireResumeDashboard } from "@/lib/dashboard/lectures";
import { messageProgression } from "@/lib/dashboard/nav";
import { formatMoney } from "@/lib/i18n/money";

export const metadata = { title: "Tableau de bord — Baobart." };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const [resume, produits] = await Promise.all([
    lireResumeDashboard(utilisateur.id),
    lireProduitsCreateur(utilisateur.id, 4),
  ]);

  const action = (
    <form action={deconnecter}>
      <button
        type="submit"
        style={{
          padding: "11px 18px",
          border: CADRE,
          borderRadius: 13,
          background: "#FFFFFF",
          fontSize: 13,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        Se déconnecter
      </button>
    </form>
  );

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre={`Bonjour ${utilisateur.nom}`}
      description={messageProgression(utilisateur.progression)}
      action={action}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 16,
        }}
      >
        <MetricCard label="Étape" value={utilisateur.progression.etape} accent />
        <MetricCard label="Produits" value={resume.produits} hint={`${resume.produitsPublies} publiés`} />
        <MetricCard label="Achats" value={resume.commandes} hint={`${resume.telechargements} téléchargements`} />
        <MetricCard label="Solde à verser" value={formatMoney(resume.soldeDisponible, "XOF")} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1.1fr) minmax(280px,.9fr)",
          gap: 18,
          marginTop: 22,
        }}
      >
        <DashboardPanel
          titre="Prochain geste"
          action={
            <Link
              href="/dashboard/produits/nouveau"
              className="sticker-press"
              style={{
                padding: "9px 14px",
                border: `2px solid ${ENCRE}`,
                borderRadius: 12,
                background: JAUNE,
                boxShadow: `3px 3px 0 ${ENCRE}`,
                fontSize: 12.5,
                fontWeight: 900,
              }}
            >
              Ajouter
            </Link>
          }
        >
          {produits.length === 0 ? (
            <EmptyState
              titre="Ton espace vendeur est prêt."
              texte="Dépose un premier brouillon pour ouvrir l'atelier, puis attache-lui un fichier : sans lui, un acheteur paierait sans rien recevoir, et la publication reste fermée."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {produits.map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/produits/${p.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 14,
                    border: `2px solid ${ENCRE}`,
                    borderRadius: 16,
                    padding: 13,
                    background: p.status === "PUBLISHED" ? "#FFD84A" : "#FFFFFF",
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 900 }}>{p.name}</span>
                    <span style={{ display: "block", fontSize: 11.5, opacity: 0.66 }}>
                      {p.status === "PUBLISHED" ? "En ligne" : "Brouillon"} · {p._count.files} fichier{p._count.files > 1 ? "s" : ""}
                    </span>
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 900 }}>›</span>
                </Link>
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel titre="Raccourcis">
          <div style={{ display: "grid", gap: 10 }}>
            {[
              ["Mes achats", "/dashboard/achats"],
              ["Mes collections", "/dashboard/collections"],
              ["Produits", "/dashboard/produits"],
              ["Gains", "/dashboard/gains"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                style={{
                  border: `2px solid ${ENCRE}`,
                  borderRadius: 14,
                  padding: "12px 14px",
                  fontSize: 13.5,
                  fontWeight: 850,
                  background: "#FFFFFF",
                }}
              >
                {label} →
              </a>
            ))}
          </div>
        </DashboardPanel>
      </div>
    </DashboardFrame>
  );
}
