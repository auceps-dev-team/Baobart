import { Jeton, PastilleStatut } from "@/components/badges/formes";
import { vitrineDesMerites, type Merite } from "@/lib/badges/merites";
import type { Ecusson } from "@/lib/badges/statuts";
import { ENCRE } from "@/lib/systeme/charte";

/** « jusqu'au 30 sept. », la forme de la maquette. */
export function jusquAu(date: Date): string {
  return `jusqu'au ${date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" })}`;
}

const ETIQUETTE = {
  fontFamily: "var(--font-mono)",
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: ".12em",
  // 0,55 dans la maquette : 4,11:1, mesuré par axe le 08/11. 0,7 donne 7:1.
  opacity: 0.7,
} as const;

/**
 * « PROFIL PUBLIC · TOUT, EN DEUX RANGÉES SÉPARÉES » (Baobart Badges.dc.html).
 *
 * Les statuts d'abord, jamais tronqués ; un trait ; puis six mérites, du plus
 * rare au plus courant, et « +N » pour le reste. « Les deux ne se posent
 * jamais côte à côte sans séparation. »
 *
 * « +N » ouvre la liste complète par un `<details>` : rien à hydrater, et le
 * survol n'existe pas sur mobile — chaque jeton porte aussi son nom et son
 * critère en `title`, pour la souris.
 *
 * Rien à montrer, rien de rendu : une rangée vide n'apprend rien.
 */
export function RangeesDeBadges({
  ecussons,
  merites,
  createurDuMoisJusquAu = null,
}: {
  ecussons: readonly Ecusson[];
  merites: readonly Merite[];
  /** « TOP_CREATOR doit expirer, et le montrer » : sa date suit le jeton. */
  createurDuMoisJusquAu?: Date | null;
}) {
  if (ecussons.length === 0 && merites.length === 0) return null;
  const { visibles, reste } = vitrineDesMerites(merites);
  const finDuTitre = createurDuMoisJusquAu ? jusquAu(createurDuMoisJusquAu) : null;

  return (
    <div data-badges style={{ marginTop: 14, maxWidth: 620 }}>
      {ecussons.length > 0 ? (
        <>
          <div style={{ ...ETIQUETTE, marginBottom: 8 }}>Garanti par Baobart</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
            {ecussons.map((e) => (
              <PastilleStatut key={e.code} ecusson={e} />
            ))}
          </div>
        </>
      ) : null}

      {ecussons.length > 0 && merites.length > 0 ? (
        <div style={{ height: 2.5, background: ENCRE, margin: "14px 0" }} />
      ) : null}

      {merites.length > 0 ? (
        <>
          <div style={{ ...ETIQUETTE, marginBottom: 8 }}>Constaté par l&apos;activité</div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 9 }}>
            {visibles.map((m) => {
              const date = m.code === "TOP_CREATOR" ? finDuTitre : null;
              const libelle = `${m.nom}${date ? `, ${date}` : ""} — ${m.critere}`;
              return (
                <span key={m.code} role="img" aria-label={libelle} title={libelle} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {/* Le liseré de la maquette : un anneau jaune autour du jeton daté. */}
                  <span style={date ? { borderRadius: 99, boxShadow: `0 0 0 3px #FFD84A, 0 0 0 5px ${ENCRE}`, display: "inline-flex" } : { display: "inline-flex" }}>
                    <Jeton merite={m} />
                  </span>
                  {date ? (
                    <span aria-hidden style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {date}
                    </span>
                  ) : null}
                </span>
              );
            })}
          </div>
          <details style={{ marginTop: 10 }}>
            {reste.length > 0 ? (
              // Le « +4 » de la maquette : un jeton en pointillés, pas un lien.
              <summary
                aria-label={`Voir les ${merites.length} mérites`}
                style={{
                  cursor: "pointer",
                  listStyle: "none",
                  width: 44,
                  height: 44,
                  border: `2.5px dashed ${ENCRE}`,
                  borderRadius: 99,
                  background: "#F4EEFC",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                +{reste.length}
              </summary>
            ) : (
              <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 800, width: "fit-content" }}>Ce que disent ces jetons</summary>
            )}
            <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {merites.map((m) => (
                <li key={m.code} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Jeton merite={m} diametre={30} />
                  <span style={{ fontSize: 12.5, lineHeight: 1.35 }}>
                    <strong>{m.nom}</strong> — {m.critere}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
    </div>
  );
}
