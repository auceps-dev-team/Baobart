import { BLANC, CADRE, ENCRE, LAVANDE } from "@/lib/systeme/charte";

/** La lavande claire des zones internes. */
const LAVANDE_CLAIR = "#F4EEFC";

/** Les largeurs des puces de filtre, celles de la maquette. */
const PUCES = [96, 128, 108, 84, 142, 116];

/** Les hauteurs des visuels, celles de la maquette : une grille de rectangles
 *  identiques ne ressemblerait à rien de ce qui va s'afficher. */
const HAUTEURS = [230, 300, 190, 270, 210, 320, 180, 260, 220];

/**
 * Le contenu du squelette de `/explore` : bandeau, puces, colonnes.
 *
 * Séparé de `app/explore/loading.tsx` le 08/10 pour être montré aussi dans
 * le labo (`/labo/animata`) : un écran d'attente ne se voit qu'une fraction
 * de seconde, trop vite pour être relu. La raison d'être, la source dans la
 * maquette et l'historique sont dans `app/explore/loading.tsx`.
 */
export function SqueletteExplore() {
  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 26px 60px" }}>
      <div
        aria-hidden
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 14,
          padding: "14px 18px",
          border: CADRE,
          borderRadius: 18,
          background: BLANC,
          boxShadow: `5px 5px 0 ${ENCRE}`,
        }}
      >
        <div
          className="squelette-tourne"
          style={{
            width: 26,
            height: 26,
            flex: "0 0 auto",
            border: `3px solid ${ENCRE}`,
            borderTopColor: "transparent",
            borderRadius: 99,
          }}
        />
        <div style={{ flex: "1 1 auto", minWidth: 0, fontSize: 14.5, fontWeight: 800 }}>
          On charge tes ressources
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, opacity: 0.6 }}>
          le squelette garde la place exacte du contenu
        </div>
      </div>
  
      <div aria-hidden style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 20 }}>
        {PUCES.map((largeur, i) => (
          <div
            key={i}
            className="squelette-balaye"
            style={{ width: largeur, height: 38, border: CADRE, borderRadius: 999 }}
          />
        ))}
      </div>
  
      <div aria-hidden style={{ columns: "250px", columnGap: 20, marginTop: 22 }}>
        {HAUTEURS.map((hauteur, i) => (
          <div
            key={i}
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
            }}
          >
            <div
              className="squelette-balaye"
              style={{ height: hauteur, borderBottom: CADRE }}
            />
            <div style={{ padding: 13, display: "flex", alignItems: "center", gap: 10 }}>
              <div
                className="squelette-pulse"
                style={{ flex: "1 1 auto", height: 14, borderRadius: 99, background: LAVANDE }}
              />
              <div
                style={{
                  width: 52,
                  height: 24,
                  border: `2px solid ${ENCRE}`,
                  borderRadius: 9,
                  background: LAVANDE_CLAIR,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
