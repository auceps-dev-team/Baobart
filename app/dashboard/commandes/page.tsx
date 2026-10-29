import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { DashboardFrame, DashboardPanel, EmptyState } from "@/components/dashboard/frame";
import { Pagination, pageDemandee } from "@/components/dashboard/pagination";
import { Vignette } from "@/components/dashboard/vignette";
import { sessionCourante } from "@/lib/auth/session";
import { etatCommande, type EtatCommande } from "@/lib/dashboard/historique";
import { lireCommandesVendeur } from "@/lib/dashboard/lectures";
import { debutDuMois } from "@/lib/dashboard/mois";
import { formatMoney } from "@/lib/i18n/money";
import { BLANC, ENCRE, GRIS, JAUNE, MAUVE } from "@/lib/systeme/charte";

export const metadata = { title: "Commandes — Baobart." };
export const dynamic = "force-dynamic";

/**
 * « Commandes » de la maquette (27/10) : une ligne par COMMANDE, avec ses
 * articles, l'acheteur, le moyen de paiement et la date, puis des filtres.
 * L'écran listait des lignes d'achat à plat : une commande de trois articles
 * y prenait trois lignes. Les états sont dits dans les mots de l'acheteur,
 * jamais par le code brut (« · FAILED », relevé le 25/09).
 */

const FILTRES: Array<{ cle: string; libelle: string; etats: EtatCommande[] | null }> = [
  { cle: "toutes", libelle: "Toutes", etats: null },
  { cle: "payees", libelle: "Payées", etats: ["PAYÉE", "PARTIELLEMENT REMBOURSÉE"] },
  { cle: "en-attente", libelle: "En attente", etats: ["EN ATTENTE"] },
  { cle: "remboursees", libelle: "Remboursées", etats: ["REMBOURSÉE", "PARTIELLEMENT REMBOURSÉE"] },
  { cle: "echouees", libelle: "Échouées", etats: ["ÉCHOUÉE"] },
];

const TEINTE: Record<EtatCommande, string> = {
  "PAYÉE": JAUNE,
  "PARTIELLEMENT REMBOURSÉE": JAUNE,
  "EN ATTENTE": MAUVE,
  "REMBOURSÉE": BLANC,
  "ÉCHOUÉE": GRIS,
};

const PAR_PAGE = 12;

export default async function CommandesVendeurPage({ searchParams }: { searchParams: Promise<{ etat?: string; page?: string }> }) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const { etat: demande, page: pageBrute } = await searchParams;
  const filtre = FILTRES.find((f) => f.cle === demande) ?? FILTRES[0]!;
  const commandes = (await lireCommandesVendeur(utilisateur.id)).map((c) => ({ ...c, etat: etatCommande(c.lignes) }));
  const filtrees = filtre.etats ? commandes.filter((c) => filtre.etats!.includes(c.etat)) : commandes;
  const pages = Math.ceil(filtrees.length / PAR_PAGE);
  const page = pageDemandee(pageBrute, pages);
  const visibles = filtrees.slice((page - 1) * PAR_PAGE, page * PAR_PAGE);
  const adresse = (n: number) => {
    const p = new URLSearchParams();
    if (filtre.cle !== "toutes") p.set("etat", filtre.cle);
    if (n > 1) p.set("page", String(n));
    return p.size > 0 ? `/dashboard/commandes?${p}` : "/dashboard/commandes";
  };
  const ceMois = commandes.filter((c) => c.creeeLe >= debutDuMois(new Date())).length;

  return (
    <DashboardFrame utilisateur={utilisateur} titre="Commandes" description="Les commandes qui contiennent au moins une de tes ressources. D'une commande à plusieurs créateurs, tu ne vois que tes articles.">
      <DashboardPanel
        titre={`${ceMois} commande${ceMois > 1 ? "s" : ""} ce mois`}
        action={
          <nav aria-label="Filtrer par état" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {FILTRES.map((f) => {
              const actif = f.cle === filtre.cle;
              return (
                <Link
                  key={f.cle}
                  href={(f.cle === "toutes" ? "/dashboard/commandes" : `/dashboard/commandes?etat=${f.cle}`) as Route}
                  aria-current={actif ? "page" : undefined}
                  style={{ padding: "7px 13px", border: `2px solid ${ENCRE}`, borderRadius: 999, background: actif ? ENCRE : BLANC, color: actif ? BLANC : ENCRE, fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap" }}
                >
                  {f.libelle}
                </Link>
              );
            })}
          </nav>
        }
      >
        {visibles.length === 0 ? (
          <EmptyState
            titre={commandes.length === 0 ? "Aucune commande" : "Rien dans ce filtre"}
            texte={commandes.length === 0 ? "Tes futures ventes apparaîtront ici, regroupées par commande." : "Choisis un autre état pour retrouver tes commandes."}
          />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {visibles.map((c) => (
              <div key={c.id} data-commande style={{ display: "flex", alignItems: "center", gap: 13, border: `2px solid ${ENCRE}`, borderRadius: 16, padding: 12, background: "#F4EEFC" }}>
                <Vignette couverture={c.premiere.product.coverUrl} titre={c.premiere.product.name} />
                <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 900 }}>
                    Commande #{c.id.slice(-6).toUpperCase()} · {c.lignes.length} article{c.lignes.length > 1 ? "s" : ""}
                  </span>
                  <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.66, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.acheteur} · {c.prestataire ?? "—"} · {c.creeeLe.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                    {" · "}
                    {c.lignes.map((l) => l.product.name).join(", ")}
                  </span>
                </span>
                <span style={{ fontSize: 14.5, fontWeight: 900, whiteSpace: "nowrap" }}>{formatMoney(c.montant, c.devise)}</span>
                <span
                  style={{
                    padding: "4px 10px",
                    border: `2px solid ${ENCRE}`,
                    borderRadius: 999,
                    background: TEINTE[c.etat],
                    fontSize: 10.5,
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.etat}
                </span>
              </div>
            ))}
          </div>
        )}
        <Pagination page={page} pages={pages} adresse={adresse} />
      </DashboardPanel>
    </DashboardFrame>
  );
}
