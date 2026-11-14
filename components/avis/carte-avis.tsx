import { Etoiles } from "@/components/avis/etoiles";
import { Jeton } from "@/components/badges/formes";
import type { AvisAffiche } from "@/lib/avis/lecture";
import { meriteDe } from "@/lib/badges/merites";
import { BLANC, ENCRE, JAUNE, LAVANDE } from "@/lib/systeme/charte";

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/**
 * Un avis, comme la carte de témoignage de la maquette (« Baobart Accueil »,
 * avatar, nom, ligne d'étoiles, texte) et la carte d'avis de « Baobart
 * Badges » : à droite, « Bon public » — « le seul mérite qui s'affiche à côté
 * d'un avis : il dit que cette personne écrit des avis régulièrement, donc que
 * celui-ci vaut d'être lu ».
 *
 * La réponse du créateur suit, en retrait : elle répond à CET avis.
 */
export function CarteAvis({ avis, contexte }: { avis: AvisAffiche; contexte?: string }) {
  const bonPublic = meriteDe("HELPFUL_REVIEWER");
  return (
    <article data-avis={avis.id} style={{ border: `2.5px solid ${ENCRE}`, borderRadius: 18, background: BLANC, boxShadow: `4px 4px 0 ${ENCRE}`, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <span
          aria-hidden
          style={{
            width: 38,
            height: 38,
            flex: "none",
            border: `2.5px solid ${ENCRE}`,
            borderRadius: 99,
            background: avis.auteur.avatarUrl ? `center / cover no-repeat url(${avis.auteur.avatarUrl})` : `repeating-linear-gradient(135deg,${LAVANDE} 0 6px,${JAUNE} 6px 12px)`,
          }}
        />
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{avis.auteur.nom}</div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 2 }}>
            <Etoiles note={avis.note} taille={12} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, opacity: 0.7 }}>
              {contexte ? `${contexte} · ` : ""}
              {DATE.format(avis.le)}
            </span>
          </div>
        </div>
        {avis.auteur.bonPublic ? (
          <span role="img" aria-label={`${bonPublic.nom} — ${bonPublic.critere}`} title={`${bonPublic.nom} — ${bonPublic.critere}`} style={{ display: "inline-flex" }}>
            <Jeton merite={bonPublic} diametre={30} />
          </span>
        ) : null}
      </div>

      {avis.texte ? <p style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, margin: "10px 0 0", whiteSpace: "pre-line" }}>{avis.texte}</p> : null}

      {avis.reponse ? (
        <div style={{ marginTop: 12, marginLeft: 14, padding: "10px 12px", border: `2px solid ${ENCRE}`, background: "#F4EEFC", borderRadius: 12 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, opacity: 0.75 }}>Réponse du créateur · {DATE.format(avis.reponse.le)}</div>
          <p style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.5, margin: "4px 0 0", whiteSpace: "pre-line" }}>{avis.reponse.texte}</p>
        </div>
      ) : null}
    </article>
  );
}
