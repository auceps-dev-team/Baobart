import type { Merite } from "@/lib/badges/merites";
import type { Ecusson } from "@/lib/badges/statuts";
import { BLANC, ENCRE } from "@/lib/systeme/charte";
import { encreLisible } from "@/lib/systeme/contraste";

const GRIS_ETEINT = "#5C5C5C";

/**
 * Les deux formes de la maquette des badges, et elles seules.
 *
 * « La forme le dit avant le texte — écusson pour ce que nous garantissons,
 * jeton rond pour ce que les chiffres constatent. » Un statut ne se dessine
 * jamais en jeton, un mérite jamais en écusson — VIP compris : « il se
 * dessine alors en jeton rond comme les autres, jamais en écusson ».
 */

/** Taille de police du chiffre, selon sa longueur : « 1 », « 10 », « 100 », « 24h ». */
function corps(glyphe: string, diametre: number): number {
  const parLongueur = [0.43, 0.43, 0.35, 0.28, 0.25];
  return Math.round(diametre * (parLongueur[glyphe.length] ?? 0.25));
}

/**
 * Le jeton rond d'un mérite. `eteint` : pointillés, pour « pas encore obtenu ».
 *
 * La couleur du chiffre passe par `encreLisible` : le blanc sur orange de la
 * maquette ne se lit pas sous 18,66 px (voir `lib/systeme/contraste.ts`).
 */
export function Jeton({ merite, diametre = 44, eteint = false }: { merite: Merite; diametre?: number; eteint?: boolean }) {
  const taille = corps(merite.glyphe, diametre);
  return (
    <span
      aria-hidden
      style={{
        width: diametre,
        height: diametre,
        flex: "0 0 auto",
        border: `${diametre >= 50 ? 3 : 2.5}px ${eteint ? "dashed" : "solid"} ${ENCRE}`,
        borderRadius: 99,
        background: eteint ? BLANC : merite.fond,
        // Éteint : un gris plein plutôt que l'opacité de la maquette (0,45),
        // qui donnait 3,13:1 — mesuré par axe le 08/11. #5C5C5C donne 6,7:1.
        color: eteint ? GRIS_ETEINT : encreLisible(merite.fond, merite.encre, taille),
        display: "inline-grid",
        placeItems: "center",
        fontFamily: "var(--font-display)",
        fontSize: taille,
        letterSpacing: "-.5px",
        lineHeight: 1,
      }}
    >
      {merite.glyphe}
    </span>
  );
}

/**
 * L'écusson d'un statut, en pastille : petit écusson blanc et nom, comme la
 * rangée « Garanti par Baobart » du profil. Dormant : grisé, sans couleur.
 */
export function PastilleStatut({ ecusson }: { ecusson: Ecusson }) {
  return (
    <span
      title={ecusson.dormant ? `${ecusson.nom} — en sommeil : l'abonnement n'est pas actif` : ecusson.nom}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px 6px 6px",
        border: `2.5px solid ${ENCRE}`,
        borderRadius: 999,
        background: ecusson.dormant ? "#EFEFEF" : ecusson.fond,
        opacity: ecusson.dormant ? 0.6 : 1,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 22,
          height: 26,
          flex: "0 0 auto",
          border: `2px ${ecusson.dormant ? "dashed" : "solid"} ${ENCRE}`,
          borderRadius: "5px 5px 11px 11px",
          background: BLANC,
          display: "grid",
          placeItems: "center",
          fontFamily: "var(--font-display)",
          fontSize: ecusson.glyphe.length > 1 ? 9 : 11,
        }}
      >
        {ecusson.glyphe}
      </span>
      <span style={{ fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>
        {ecusson.nom}
        {ecusson.dormant ? " · en sommeil" : ""}
      </span>
    </span>
  );
}

/**
 * Le grand écusson, à bandeau noir, de l'espace privé. Dormant : « grisé et
 * sans son bandeau noir ».
 */
export function GrandEcusson({ ecusson }: { ecusson: Ecusson }) {
  return (
    <span
      aria-hidden
      style={{
        width: 62,
        height: 74,
        flex: "0 0 auto",
        border: `3px ${ecusson.dormant ? "dashed" : "solid"} ${ENCRE}`,
        borderRadius: "13px 13px 32px 32px",
        background: ecusson.dormant ? "#EFEFEF" : ecusson.fond,
        boxShadow: ecusson.dormant ? "none" : `3px 3px 0 ${ENCRE}`,
        overflow: "hidden",
        textAlign: "center",
        display: "block",
        opacity: ecusson.dormant ? 0.6 : 1,
      }}
    >
      {ecusson.dormant ? null : (
        <span
          style={{
            display: "block",
            padding: "3px 0",
            background: ENCRE,
            color: BLANC,
            fontFamily: "var(--font-mono)",
            fontSize: 6,
            fontWeight: 700,
            letterSpacing: ".1em",
          }}
        >
          VÉRIFIÉ
        </span>
      )}
      <span
        style={{
          display: "block",
          fontFamily: "var(--font-display)",
          fontSize: ecusson.glyphe.length > 1 ? 18 : 24,
          lineHeight: 1,
          marginTop: ecusson.dormant ? 22 : 11,
        }}
      >
        {ecusson.glyphe}
      </span>
    </span>
  );
}

/**
 * L'écusson réduit des vignettes : 15 px de large, collé au nom. « Il
 * répond à “peut-on lui faire confiance”. »
 */
export function MiniEcusson({ ecusson, de }: { ecusson: { nom: string; glyphe: string; fond: string }; /** Le nom d'utilisateur de l'auteur, pour qu'un test retrouve cet écusson. */ de?: string | null }) {
  return (
    <span
      data-ecusson-de={de ?? undefined}
      role="img"
      aria-label={ecusson.nom}
      title={ecusson.nom}
      style={{
        width: 15,
        height: 18,
        flex: "0 0 auto",
        border: `1.5px solid ${ENCRE}`,
        borderRadius: "4px 4px 8px 8px",
        background: ecusson.fond,
        display: "inline-grid",
        placeItems: "center",
        fontFamily: "var(--font-display)",
        fontSize: ecusson.glyphe.length > 1 ? 5.5 : 7,
        lineHeight: 1,
        verticalAlign: "-3px",
        color: ENCRE,
      }}
    >
      {ecusson.glyphe}
    </span>
  );
}
