import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { DashboardFrame, DashboardPanel, EmptyState } from "@/components/dashboard/frame";
import { Pagination } from "@/components/dashboard/pagination";
import { Vignette } from "@/components/dashboard/vignette";
import { sessionCourante } from "@/lib/auth/session";
import { connexionPuis } from "@/lib/auth/suite";
import { LIBELLE_STATUT } from "@/lib/dashboard/lectures";
import { adressePaginee, paginer } from "@/lib/dashboard/pagination";
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

/**
 * Mesuré le 16/11/2026 à 1440 × 900, liste pleine (`pnpm design:remplir-listes`) : la
 * liste commence à 246 px, une ressource tous les 84 px (74 de haut). Sous un menu qui
 * descend au moins à 900 px, barre de pagination comprise : 7 ressources.
 */
// Ramené de 7 à 6 par la mesure d'après (16/11) : à 7, la LISTE tenait sous le menu,
// mais la page entière descendait 32 px sous le menu (marges du panneau, 62 px sous la barre). Le choix retenu le 14/11 : la page s'arrête avec le menu.
const PAR_PAGE = 6;

export default async function MesProduitsPage({ searchParams }: { searchParams: Promise<{ statut?: string; page?: string }> }) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect(connexionPuis("/dashboard/produits"));

  const parametres = await searchParams;
  const demande = parametres.statut;
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
  const filtres = filtre.statuts ? produits.filter((p) => filtre.statuts!.includes(p.status)) : produits;
  const paginees = paginer(filtres, parametres.page, PAR_PAGE);
  const visibles = paginees.visibles;
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
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10 }}>
            {/* `flexWrap`, et un titre de base 160 px : sur un téléphone, le titre garde
                la première ligne, le prix, l'état et « Modifier » passent dessous (la
                ligne débordait de 80 px à 320, mesuré le 20/11, D2a). Au bureau, tout
                tient sur une ligne, comme avant. */}
            {visibles.map((p) => (
              <div key={p.id} data-ressource style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, border: `2px solid ${ENCRE}`, borderRadius: 16, padding: 12, background: "#F4EEFC" }}>
                <Vignette couverture={p.coverUrl} titre={p.name} taille={46} />
                <span style={{ flex: "1 1 160px", minWidth: 0 }}>
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
                <Link href={`/dashboard/produits/${p.id}`} style={{ padding: "8px 14px", border: `2px solid ${ENCRE}`, borderRadius: 12, background: BLANC, fontSize: 13, fontWeight: 800, whiteSpace: "nowrap" }}>
                  {p.status === "DRAFT" ? "Reprendre" : "Modifier"}
                </Link>
              </div>
            ))}
          </div>
        )}
        <Pagination
          page={paginees.page}
          pages={paginees.pages}
          adresse={(n) => adressePaginee("/dashboard/produits", { statut: filtre.cle === "toutes" ? undefined : filtre.cle }, n)}
        />
      </DashboardPanel>
    </DashboardFrame>
  );
}
