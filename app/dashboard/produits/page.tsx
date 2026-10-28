import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { DashboardFrame, DashboardPanel, EmptyState } from "@/components/dashboard/frame";
import { Vignette } from "@/components/dashboard/vignette";
import { sessionCourante } from "@/lib/auth/session";
import { LIBELLE_STATUT } from "@/lib/dashboard/lectures";
import { db } from "@/lib/db";
import type { Currency, ProductFamily, ProductStatus } from "@/lib/domain/prisma-types";
import { LIBELLE_PAR_FAMILLE } from "@/lib/feed/types";
import { formatCount, formatPrice } from "@/lib/i18n/money";
import { BLANC, CADRE, ENCRE, JAUNE } from "@/lib/systeme/charte";

export const metadata = { title: "Produits — Baobart." };
export const dynamic = "force-dynamic";

/**
 * « Mes ressources » de `Baobart Dashboard.dc.html` : un catalogue, des
 * filtres par statut, une vignette par ligne.
 *
 * Revu le 27/10 : la liste tenait dans 900 px, laissant un tiers de l'écran
 * vide à droite, et aucune ligne ne montrait la ressource elle-même. La
 * vignette est la couverture déjà résolue (`Product.coverUrl`) : aucune
 * lecture de plus par ligne.
 */

const FILTRES: Array<{ cle: string; libelle: string; statuts: ProductStatus[] | null }> = [
  { cle: "toutes", libelle: "Toutes", statuts: null },
  { cle: "en-ligne", libelle: "En ligne", statuts: ["PUBLISHED"] },
  { cle: "brouillons", libelle: "Brouillons", statuts: ["DRAFT"] },
  { cle: "retirees", libelle: "Retirées", statuts: ["ARCHIVED", "SUSPENDED"] },
];

export default async function MesProduitsPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const demande = (await searchParams).statut;
  const filtre = FILTRES.find((f) => f.cle === demande) ?? FILTRES[0]!;

  const produits: Array<{
    id: string;
    name: string;
    status: ProductStatus;
    price: number;
    currency: Currency;
    family: ProductFamily | null;
    coverUrl: string | null;
    downloadsCount: number;
    _count: { files: number };
  }> = await db.product.findMany({
    where: { sellerId: utilisateur.id },
    // Les brouillons d'abord : ce sont eux qui attendent une action.
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      status: true,
      price: true,
      currency: true,
      family: true,
      coverUrl: true,
      downloadsCount: true,
      _count: { select: { files: { where: { role: "SOURCE", deletedAt: null } } } },
    },
  });

  const compte = (f: (typeof FILTRES)[number]) => (f.statuts ? produits.filter((p) => f.statuts!.includes(p.status)).length : produits.length);
  const visibles = filtre.statuts ? produits.filter((p) => filtre.statuts!.includes(p.status)) : produits;
  const enLigne = compte(FILTRES[1]!);
  const brouillons = compte(FILTRES[2]!);

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Produits"
      description={
        produits.length === 0
          ? "Rien encore. Dépose une première ressource."
          : `${enLigne} en ligne${brouillons > 0 ? `, ${brouillons} en brouillon` : ""} — ${produits.length} en tout.`
      }
      action={
        <Link
          href="/dashboard/produits/nouveau"
          className="sticker-press"
          style={{ padding: "13px 22px", border: CADRE, borderRadius: 14, background: JAUNE, boxShadow: `4px 4px 0 ${ENCRE}`, fontSize: 14, fontWeight: 800 }}
        >
          Ajouter un produit
        </Link>
      }
    >
      <DashboardPanel
        titre="Catalogue"
        action={
          <nav aria-label="Filtrer par statut" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {FILTRES.map((f) => {
              const actif = f.cle === filtre.cle;
              return (
                <Link
                  key={f.cle}
                  href={(f.cle === "toutes" ? "/dashboard/produits" : `/dashboard/produits?statut=${f.cle}`) as Route}
                  aria-current={actif ? "page" : undefined}
                  style={{ padding: "7px 13px", border: `2px solid ${ENCRE}`, borderRadius: 999, background: actif ? ENCRE : BLANC, color: actif ? BLANC : ENCRE, fontSize: 12.5, fontWeight: 800, whiteSpace: "nowrap" }}
                >
                  {f.libelle} · {compte(f)}
                </Link>
              );
            })}
          </nav>
        }
      >
        {visibles.length === 0 ? (
          <EmptyState
            titre={produits.length === 0 ? "Ton catalogue est vide." : "Rien dans ce filtre."}
            texte={produits.length === 0 ? "Ajoute une première ressource : elle restera en brouillon tant que tu ne la publies pas." : "Choisis un autre statut pour retrouver tes ressources."}
          />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {visibles.map((p) => (
              <div key={p.id} data-ressource style={{ display: "flex", alignItems: "center", gap: 14, border: `2px solid ${ENCRE}`, borderRadius: 16, padding: 12, background: "#F4EEFC" }}>
                <Vignette couverture={p.coverUrl} titre={p.name} taille={46} />
                <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.62 }}>
                    {p.family ? LIBELLE_PAR_FAMILLE[p.family] : "sans catégorie"} · {formatCount(p.downloadsCount)} dl
                    {p._count.files === 0 ? " · aucun fichier" : ` · ${p._count.files} fichier${p._count.files > 1 ? "s" : ""}`}
                  </span>
                </span>
                <span style={{ fontSize: 14.5, fontWeight: 900, whiteSpace: "nowrap" }}>{p.price === 0 ? "gratuit" : formatPrice(p.price, p.currency)}</span>
                <span
                  style={{
                    padding: "4px 10px",
                    border: `2px solid ${ENCRE}`,
                    borderRadius: 999,
                    background: p.status === "PUBLISHED" ? JAUNE : BLANC,
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    textTransform: "uppercase",
                    letterSpacing: ".06em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {LIBELLE_STATUT[p.status]}
                </span>
                <a href={`/dashboard/produits/${p.id}`} style={{ padding: "8px 14px", border: `2px solid ${ENCRE}`, borderRadius: 12, background: BLANC, fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>
                  {p.status === "DRAFT" ? "Reprendre" : "Modifier"}
                </a>
              </div>
            ))}
          </div>
        )}
      </DashboardPanel>
    </DashboardFrame>
  );
}
