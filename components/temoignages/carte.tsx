import { BLANC, ENCRE, JAUNE, LAVANDE, LAVANDE_PROFOND, ORANGE } from "@/components/shell/nav-data";

const CADRE = `2.5px solid ${ENCRE}`;

/** Les fonds de la maquette, dans son ordre : blanc, jaune, blanc, lavande. */
export const FONDS_TEMOIGNAGE = [BLANC, JAUNE, BLANC, LAVANDE_PROFOND];
const TRAMES = [
  `repeating-linear-gradient(135deg,${ORANGE} 0 5px,${JAUNE} 5px 12px)`,
  `repeating-linear-gradient(135deg,${ENCRE} 0 5px,${LAVANDE} 5px 12px)`,
  `repeating-linear-gradient(135deg,${LAVANDE_PROFOND} 0 5px,${BLANC} 5px 12px)`,
  `repeating-linear-gradient(135deg,${JAUNE} 0 5px,${ENCRE} 5px 12px)`,
];

/**
 * Une carte de témoignage, telle que la maquette la dessine (« Baobart
 * Accueil.dc.html », bloc « Ils nous font confiance »).
 *
 * Partagée par l'accueil et l'aperçu du formulaire : l'auteur voit exactement
 * ce qui paraîtra. Sans état ni effet, elle se rend côté serveur comme côté
 * navigateur.
 */
export function CarteTemoignage({
  texte,
  nom,
  presentation,
  avatarUrl,
  rang = 0,
}: {
  texte: string;
  nom: string;
  presentation: string | null;
  avatarUrl: string | null;
  rang?: number;
}) {
  return (
    <figure
      style={{
        margin: 0,
        border: CADRE,
        borderRadius: 22,
        background: FONDS_TEMOIGNAGE[rang % FONDS_TEMOIGNAGE.length],
        boxShadow: `5px 5px 0 ${ENCRE}`,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        color: ENCRE,
      }}
    >
      <div aria-hidden style={{ fontFamily: "var(--font-display)", fontSize: 34, lineHeight: 0.6 }}>
        &ldquo;
      </div>
      <blockquote style={{ margin: 0, fontSize: 14.5, fontWeight: 600, lineHeight: 1.5, flex: "1 1 auto", overflowWrap: "anywhere" }}>
        {texte}
      </blockquote>
      <figcaption style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 12, borderTop: CADRE }}>
        <span
          style={{
            width: 34,
            height: 34,
            flex: "0 0 auto",
            border: CADRE,
            borderRadius: 99,
            background: avatarUrl
              ? `url(${JSON.stringify(avatarUrl)}) center / cover no-repeat`
              : TRAMES[rang % TRAMES.length],
          }}
        />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 800 }}>{nom}</span>
          {presentation ? (
            <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, opacity: 0.65 }}>{presentation}</span>
          ) : null}
        </span>
      </figcaption>
    </figure>
  );
}
