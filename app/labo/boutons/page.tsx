import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Icone } from "@/components/icones/icone";
import { Button } from "@/components/ui/button";

/**
 * LABO — les six boutons de la planche, rendus par `components/ui/button.tsx`.
 *
 * À comparer à « Baobart Design System.dc.html », bloc Boutons : survoler,
 * appuyer, et regarder le geste (140 ms, réduit à 97 %).
 *
 * Fermée en production (`next build` pose NODE_ENV=production : 404), liée de
 * nulle part, exclue de l'indexation. Même garde que `app/labo/animata`.
 */
export const metadata: Metadata = {
  title: "Labo · Boutons — Baobart.",
  robots: { index: false, follow: false },
};

export default function LaboBoutons() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="min-h-screen bg-lavande-fond px-4 py-10 text-encre sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header>
          <p className="meta opacity-60">Labo · fermé en production</p>
          <h1 className="font-display text-4xl uppercase tracking-tight">Boutons</h1>
        </header>

        <section className="rounded-sticker-lg border-[2.5px] border-encre bg-blanc p-6 shadow-sticker-md">
          <h2 className="font-display uppercase">Six variantes · taille lg</h2>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Button variant="primaire">Primaire</Button>
            <Button variant="secondaire">Secondaire</Button>
            <Button variant="contraste">Contrasté</Button>
            <Button variant="tertiaire">Tertiaire</Button>
            <Button variant="puce">Puce / filtre</Button>
            <Button disabled>Désactivé</Button>
          </div>
        </section>

        <section className="rounded-sticker-lg border-[2.5px] border-encre bg-blanc p-6 shadow-sticker-md">
          <h2 className="font-display uppercase">Boutons d&apos;action · taille md, avec icône</h2>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Button variant="secondaire" size="md">
              <Icone nom="plus" taille={20} />
              Nouveau projet
            </Button>
            <Button variant="contraste" size="md">
              <Icone nom="upload" taille={20} trait="#FFFFFF" />
              Importer
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
