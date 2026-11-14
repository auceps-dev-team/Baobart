import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { APLATS, Icone, TRAITS } from "@/components/icones/icone";
import { ICONES, type NomIcone } from "@/lib/icones/donnees";

/**
 * LABO — la planche des icônes, rendue par le composant React.
 *
 * Pour la comparer, à l'œil, à `Baobart Design/Baobart Icons.dc.html` : mêmes
 * groupes, mêmes tailles, mêmes aplats, même fond noir. Les tests prouvent
 * que les tracés sont ceux de la source ; seul un regard dit si le rendu
 * ressemble à la planche.
 *
 * Fermée en production (`next build` pose NODE_ENV=production : 404), liée de
 * nulle part, exclue de l'indexation. Même garde que `app/labo/animata`.
 */
export const metadata: Metadata = {
  title: "Labo · Icônes — Baobart.",
  robots: { index: false, follow: false },
};

/** Les icônes d'alerte, en orange sur la planche (`ALERT`). */
const ALERTE: ReadonlySet<string> = new Set(["trash", "alert", "heart", "logout", "bell"]);
/** La rotation des aplats de la planche, mode « Palette ». */
const ROTATION = [APLATS.jaune, APLATS.violet, APLATS.lavande, APLATS.jaune, APLATS.orange, APLATS.violet];

const noms = Object.keys(ICONES) as NomIcone[];
const groupes = [...new Set(noms.map((n) => ICONES[n].groupe))];

export default function LaboIcones() {
  if (process.env.NODE_ENV === "production") notFound();

  let k = 0;
  return (
    <main className="min-h-screen bg-lavande-fond px-4 py-10 text-encre sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header>
          <p className="meta opacity-60">Labo · fermé en production</p>
          <h1 className="font-display text-4xl uppercase tracking-tight">Icônes</h1>
          <p className="mt-2 max-w-2xl text-[15px]">
            {noms.length} icônes, grille de 24 px, trait de 2 px, aplat décalé de 1,6 px. À comparer
            avec <code className="font-mono text-[13px]">Baobart Icons.dc.html</code>.
          </p>
        </header>

        {groupes.map((g, gi) => (
          <section key={g} className="rounded-sticker-lg border-[2.5px] border-encre bg-blanc p-5 shadow-sticker-md">
            <h2 className="font-display text-lg uppercase">
              <span className="font-mono text-[12px] opacity-50">{String(gi + 1).padStart(2, "0")} · </span>
              {g}
            </h2>
            <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4">
              {noms
                .filter((n) => ICONES[n].groupe === g)
                .map((n) => {
                  // Le compteur avance pour CHAQUE icône, alertes comprises,
                  // comme `col(id, k++)` sur la planche : sans cela, les
                  // couleurs glissent d'une case après la première alerte.
                  const rang = k++;
                  const aplat = ALERTE.has(n) ? APLATS.orange : ROTATION[rang % ROTATION.length]!;
                  return (
                    <li key={n} data-icone={n} className="flex flex-col items-center gap-2 rounded-sticker-md bg-lavande-clair p-4">
                      <Icone nom={n} taille={34} aplat={aplat} />
                      <span className="text-[13px] font-bold">{ICONES[n].libelle}</span>
                      <code className="font-mono text-[11px] opacity-60">{n}</code>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}

        <section className="grid gap-5 sm:grid-cols-3">
          <div className="rounded-sticker-lg border-[2.5px] border-encre bg-blanc p-5">
            <h2 className="font-display uppercase">Tailles</h2>
            <div className="mt-4 flex items-end gap-6">
              {[
                [16, "en ligne"],
                [20, "bouton"],
                [24, "nav"],
                [40, "vide"],
              ].map(([px, usage]) => (
                <div key={px} className="flex flex-col items-center gap-2">
                  <Icone nom="folder" taille={px as number} />
                  <span className="font-mono text-[11px]">
                    {px} · {usage}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-sticker-lg border-[2.5px] border-encre bg-blanc p-5">
            <h2 className="font-display uppercase">Aplats</h2>
            <div className="mt-4 flex gap-6">
              {Object.entries(APLATS).map(([nom, hex]) => (
                <div key={nom} className="flex flex-col items-center gap-2">
                  <Icone nom="bell" taille={36} aplat={hex} />
                  <span className="font-mono text-[11px]">{nom}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-sticker-lg border-[2.5px] border-encre bg-encre p-5 text-blanc">
            <h2 className="font-display uppercase">Fond noir</h2>
            <div className="mt-4 flex gap-6">
              {(["home", "message", "bell", "wallet", "trend"] as const).map((n, i) => (
                <Icone
                  key={n}
                  nom={n}
                  taille={32}
                  trait={TRAITS.blanc}
                  aplat={[APLATS.jaune, APLATS.violet, APLATS.orange, APLATS.jaune, APLATS.violet][i]}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
