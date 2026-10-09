import Link from "next/link";
import type { Route } from "next";

import type { CarteRessource } from "@/lib/feed/types";
import { formatCount } from "@/lib/i18n/money";
import { BLANC, CADRE, ENCRE } from "@/lib/systeme/charte";
import { vignetteDe } from "@/lib/upload/vignette";

/**
 * Une ressource, sur la vitrine de son créateur.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI PAS `CarteMosaique`
 *
 * La carte de l'explorateur est un composant client : elle porte le survol, le
 * cœur, l'ouverture en modale et trois styles d'affichage. Tout cela sert une
 * mosaïque qu'on parcourt.
 *
 * Une vitrine se lit autrement — on sait déjà de qui c'est, on cherche une
 * œuvre précise. Réutiliser la carte de l'explorateur aurait imposé de rendre
 * la page cliente entière pour un survol dont personne n'a besoin ici.
 *
 * Le prix et le nom restent lus au même endroit : `CarteRessource`, la forme
 * que produit `listerFeed`. Aucun champ n'est recalculé.
 */
export function CarteRessourceLien({ ressource }: { ressource: CarteRessource }) {
  return (
    <Link
      href={`/products/${ressource.slug}` as Route}
      className="sticker-press"
      style={{
        display: "block",
        border: CADRE,
        borderRadius: 20,
        background: BLANC,
        boxShadow: `4px 4px 0 ${ENCRE}`,
        overflow: "hidden",
        color: ENCRE,
      }}
    >
      <div
        style={{
          aspectRatio: "4 / 3",
          borderBottom: CADRE,
          background: ressource.coverUrl
            ? `center / cover no-repeat url(${vignetteDe(ressource.coverUrl)})`
            : "repeating-linear-gradient(135deg,#EADFF9 0 9px,#FFFFFF 9px 18px)",
        }}
      />
      <div style={{ padding: 14 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 800,
            lineHeight: 1.3,
            // Un titre long ne doit pas pousser la grille : deux lignes, puis
            // les points de suspension.
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {ressource.title}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 10,
            marginTop: 8,
          }}
        >
          <span style={{ fontSize: 13.5, fontWeight: 800 }}>
            {ressource.offerte ? "Offert" : ressource.prixAffiche}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              opacity: 0.6,
            }}
          >
            {formatCount(ressource.downloadsCount)} téléch.
          </span>
        </div>
      </div>
    </Link>
  );
}
