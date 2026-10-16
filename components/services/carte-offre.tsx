import Link from "next/link";
import type { Route } from "next";

import { formatMoney, type Currency } from "@/lib/i18n/money";
import type { OffreEnListe } from "@/lib/services/queries";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE } from "@/lib/systeme/charte";

/**
 * Une offre de service, en carte.
 *
 * Sortie de `app/services/page.tsx` le 16/10, telle quelle, pour servir aussi
 * l'onglet « Services » du profil public : deux copies de la même carte
 * auraient divergé à la première retouche.
 */
export function CarteOffre({ offre: o }: { offre: OffreEnListe }) {
  return (
    <Link
      href={`/services/${o.id}` as Route}
      className="sticker-press"
      style={{
        display: "flex",
        flexDirection: "column",
        border: CADRE,
        borderRadius: 22,
        background: BLANC,
        boxShadow: `5px 5px 0 ${ENCRE}`,
        overflow: "hidden",
        color: ENCRE,
        padding: 18,
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          alignItems: "center",
        }}
      >
        <span
          style={{
            padding: "4px 10px",
            border: `2px solid ${ENCRE}`,
            borderRadius: 999,
            background: LAVANDE,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: ".08em",
          }}
        >
          {o.categorie.name}
        </span>
        {o.miseEnAvant ? (
          <span
            style={{
              padding: "4px 10px",
              border: `2px solid ${ENCRE}`,
              borderRadius: 999,
              background: JAUNE,
              fontSize: 10.5,
              fontWeight: 800,
            }}
          >
            MIS EN AVANT
          </span>
        ) : null}
      </div>

      <div style={{ fontSize: 16.5, fontWeight: 800, lineHeight: 1.25, flex: 1 }}>
        {o.titre}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 12,
          borderTop: CADRE,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              opacity: 0.6,
            }}
          >
            à partir de
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 19,
            }}
          >
            {formatMoney(o.prixDeDepart, o.devise as Currency)}
          </div>
        </div>
        <div
          style={{
            padding: "8px 13px",
            border: `2px solid ${ENCRE}`,
            borderRadius: 11,
            background: JAUNE,
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {o.delaiJours} j
        </div>
      </div>

      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          opacity: 0.65,
        }}
      >
        par {o.createur}
      </div>
    </Link>
  );
}
