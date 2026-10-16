import Link from "next/link";
import type { Route } from "next";

import type { CarteRessource } from "@/lib/feed/types";
import { BLANC, CADRE, ENCRE, JAUNE } from "@/lib/systeme/charte";
import { vignetteDe } from "@/lib/upload/vignette";

/**
 * Une ressource, sur la vitrine de son créateur.
 *
 * Traduite de `Baobart Accueil.dc.html`, section `PROFIL CREATEUR`, liste
 * `profilWork` : une carte de mosaïque (`columns: 250px`) dont le visuel a la
 * hauteur de la ressource (`r.h`), le titre, « par … dans … », et le prix dans
 * une pastille — jaune quand la ressource est offerte (`priceBg`). Jusqu'au
 * 16/10, la vitrine montrait une grille de cartes 4:3 qui ne venait pas de la
 * maquette.
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
        breakInside: "avoid",
        marginBottom: 20,
        display: "inline-block",
        width: "100%",
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
          height: ressource.visualHeight,
          borderBottom: CADRE,
          display: "grid",
          placeItems: "center",
          background: ressource.coverUrl
            ? `center / cover no-repeat url(${vignetteDe(ressource.coverUrl)})`
            : "repeating-linear-gradient(135deg,#EADFF9 0 9px,#FFFFFF 9px 18px)",
        }}
      >
        {ressource.coverUrl ? null : (
          <span
            style={{
              padding: "6px 12px",
              border: `2px solid ${ENCRE}`,
              borderRadius: 999,
              background: BLANC,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
            }}
          >
            {ressource.famille ?? "Ressource"}
          </span>
        )}
      </div>
      <div style={{ padding: "12px 13px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              lineHeight: 1.25,
              // Un titre long ne doit pas étirer la carte : deux lignes, puis
              // les points de suspension.
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {ressource.title}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.6 }}>
            par {ressource.author}
            {ressource.famille ? ` dans ${ressource.famille}` : ""}
          </div>
        </div>
        <div
          style={{
            padding: "5px 10px",
            border: `2px solid ${ENCRE}`,
            borderRadius: 9,
            fontSize: 11,
            fontWeight: 800,
            whiteSpace: "nowrap",
            background: ressource.offerte ? JAUNE : BLANC,
          }}
        >
          {ressource.offerte ? "Offert" : ressource.prixAffiche}
        </div>
      </div>
    </Link>
  );
}
