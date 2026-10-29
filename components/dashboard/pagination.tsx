import Link from "next/link";
import type { Route } from "next";

import { BLANC, ENCRE } from "@/lib/systeme/charte";

/**
 * « ← Précédentes · page 2 sur 3 · Suivantes → » sous une liste du tableau de
 * bord. Une liste de trente commandes faisait 2 935 px (mesuré le 27/10) ; la
 * maquette n'en montre que quatre.
 */
export function Pagination({ page, pages, adresse }: { page: number; pages: number; adresse: (n: number) => string }) {
  if (pages <= 1) return null;
  const bouton = (n: number, libelle: string, actif: boolean) =>
    actif ? (
      <Link href={adresse(n) as Route} style={{ padding: "8px 14px", border: `2px solid ${ENCRE}`, borderRadius: 12, background: BLANC, fontSize: 13, fontWeight: 800 }}>
        {libelle}
      </Link>
    ) : (
      <span style={{ padding: "8px 14px", border: `2px solid ${ENCRE}`, borderRadius: 12, fontSize: 13, fontWeight: 800, opacity: 0.35 }}>{libelle}</span>
    );
  return (
    <nav aria-label="Pages" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 16 }}>
      {bouton(page - 1, "← Précédentes", page > 1)}
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, opacity: 0.7 }}>
        page {page} sur {pages}
      </span>
      {bouton(page + 1, "Suivantes →", page < pages)}
    </nav>
  );
}

/** La page demandée, ramenée entre 1 et `pages`. */
export function pageDemandee(brut: string | undefined, pages: number): number {
  const n = Number.parseInt(brut ?? "1", 10);
  return Math.min(Math.max(1, Number.isFinite(n) ? n : 1), Math.max(1, pages));
}
