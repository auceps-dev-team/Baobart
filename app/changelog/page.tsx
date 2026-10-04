import { DocSection, PageDocument } from "@/components/doc/page-document";
import { sessionCourante } from "@/lib/auth/session";
import { CHANGELOG } from "@/lib/changelog/entrees";
import { CADRE } from "@/lib/systeme/charte";

export const metadata = {
  title: "Changelog — Baobart.",
  description: "Ce qui a changé sur Baobart, du plus récent au plus ancien.",
};

const MOIS = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const JOUR = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });

/** Le changelog, rangé par mois — voir `lib/changelog/entrees.ts`. */
export default async function ChangelogPage() {
  const visiteur = await sessionCourante();

  const parMois = new Map<string, typeof CHANGELOG[number][]>();
  for (const e of CHANGELOG) {
    const cle = e.date.slice(0, 7);
    parMois.set(cle, [...(parMois.get(cle) ?? []), e]);
  }

  return (
    <PageDocument visiteur={visiteur} kicker="Produit" titre="Changelog" intro="Ce qui a changé sur la plateforme, du plus récent au plus ancien.">
      {[...parMois].map(([mois, entrees]) => {
        const titre = MOIS.format(new Date(`${mois}-01T00:00:00Z`));
        return (
          <DocSection key={mois} titre={titre.charAt(0).toUpperCase() + titre.slice(1)}>
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              {entrees.map((e) => (
                <div key={e.version} data-changelog={e.version} style={{ border: CADRE, borderRadius: 16, padding: "12px 14px", background: "#F4EEFC" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 800 }}>{e.titre}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.6 }}>
                      v{e.version} · {JOUR.format(new Date(`${e.date}T00:00:00Z`))}
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, opacity: 0.85 }}>{e.texte}</p>
                </div>
              ))}
            </div>
          </DocSection>
        );
      })}
    </PageDocument>
  );
}
