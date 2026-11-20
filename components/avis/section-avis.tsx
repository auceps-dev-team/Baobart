import { CarteAvis } from "@/components/avis/carte-avis";
import { Etoiles } from "@/components/avis/etoiles";
import { FormulaireAvis } from "@/components/avis/formulaire-avis";
import { Icone } from "@/components/icones/icone";
import type { AvisDeLaRessource } from "@/lib/avis/lecture";
import { BLANC, ENCRE, JAUNE } from "@/lib/systeme/charte";

/**
 * Les avis d'une ressource, sur sa fiche : le résumé (moyenne, nombre,
 * répartition par étoile), le formulaire pour qui peut noter, puis les avis.
 *
 * « Une page par ressource : aperçus, formats, dimensions, licence et avis »
 * (Baobart Accueil). La note affichée est la vraie moyenne, avec son nombre :
 * « 4,9 sur 128 avis » ; un « 5,0 » sur deux avis se lit comme tel.
 */
export function SectionAvis({ produitId, donnees, connecte }: { produitId: string; donnees: AvisDeLaRessource; connecte: boolean }) {
  const { resume } = donnees;
  const montrerFormulaire = donnees.peutNoter || donnees.monAvis !== null;

  return (
    <section id="avis" data-section-avis aria-labelledby="titre-avis" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2 id="titre-avis" style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
        Avis{resume.total > 0 ? ` (${resume.total})` : ""}
      </h2>

      {resume.total > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", border: `2.5px solid ${ENCRE}`, borderRadius: 18, background: BLANC, padding: 16 }}>
          <div style={{ minWidth: 110 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 34, lineHeight: 1 }}>{resume.moyenne!.toLocaleString("fr-FR")}</div>
            <Etoiles note={resume.moyenne!} />
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>
              sur {resume.total} avis
            </div>
          </div>
          <ul aria-label="Répartition des notes" style={{ listStyle: "none", margin: 0, padding: 0, flex: "1 1 220px", display: "flex", flexDirection: "column", gap: 5 }}>
            {resume.repartition.map((r) => (
              <li key={r.note} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700 }}>
                <span style={{ width: 22, fontFamily: "var(--font-mono)" }}>{r.note}
                  <Icone nom="star" taille={11} decalage={1} style={{ verticalAlign: "-1px", marginLeft: 1 }} />
                </span>
                <span
                  role="progressbar"
                  aria-label={`${r.note} étoiles : ${r.pourcentage} %`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={r.pourcentage}
                  style={{ flex: "1 1 auto", height: 10, border: `2px solid ${ENCRE}`, borderRadius: 999, background: BLANC, overflow: "hidden" }}
                >
                  <span style={{ display: "block", height: "100%", width: `${r.pourcentage}%`, background: JAUNE }} />
                </span>
                <span style={{ width: 34, textAlign: "right", fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>{r.pourcentage} %</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Aucun avis pour l&apos;instant. Les avis viennent de ceux qui ont obtenu la ressource.</p>
      )}

      {montrerFormulaire ? <FormulaireAvis produitId={produitId} monAvis={donnees.monAvis} /> : null}
      {!connecte && resume.total > 0 ? (
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600 }}>Seul qui a obtenu la ressource peut la noter.</p>
      ) : null}

      {donnees.avis.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {donnees.avis.map((a) => (
            <CarteAvis key={a.id} avis={a} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
