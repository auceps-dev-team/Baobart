import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import "@/components/labo/animata/animata.css";
import { BoutonEnfonce, BoutonFleche, BoutonTache } from "@/components/labo/animata/boutons";
import { CarteRetournee } from "@/components/anime/carte-retournee";
import { Compteur, enFrancs } from "@/components/anime/compteur";
import { Defile } from "@/components/anime/defile";
import { SqueletteExplore } from "@/components/feed/squelette-explore";
import { LogoAnime } from "@/components/labo/animata/logo-anime";
import {
  Apparition,
  BarreLecture,
  Parallaxe,
  TexteQuiSAllume,
} from "@/components/labo/animata/defilement";
import { Rejouer } from "@/components/labo/animata/rejouer";
import { SectionsEmpilees } from "@/components/labo/animata/sections-empilees";
import { Rouleau } from "@/components/labo/animata/rouleau";
import { Soulignement } from "@/components/labo/animata/soulignement";
import { Squelette } from "@/components/labo/animata/squelette";
import { Vague } from "@/components/anime/vague";

/**
 * LABO — essai d'Animata (https://github.com/codse/animata).
 *
 * Page de banc d'essai, demandée le 08/10/2026 : voir ce que donnent les
 * composants d'Animata une fois passés à la charte, avant de décider s'ils
 * entrent dans une vraie vue. Les maquettes de `Baobart Design/` font foi pour
 * l'interface ; rien ici n'en fait partie.
 *
 * Fermée en production : `next build` pose NODE_ENV=production, la page y
 * répond donc 404. Liée de nulle part, et exclue de l'indexation.
 */

export const metadata: Metadata = {
  title: "Labo · Animata — Baobart.",
  robots: { index: false, follow: false },
};

function Bloc({
  titre,
  source,
  note,
  children,
}: {
  titre: string;
  source: string;
  note: ReactNode;
  children: ReactNode;
}) {
  return (
    // `overflow-clip` et non `overflow-hidden` : un ancêtre en `hidden` est un
    // conteneur de défilement, et `position: sticky` ne colle plus dedans
    // (les cartes empilées du bloc « Au défilement »).
    <section className="overflow-clip rounded-sticker-lg border-[2.5px] border-encre bg-blanc shadow-sticker-md">
      <header className="flex flex-wrap items-baseline gap-3 border-b-[2.5px] border-encre bg-lavande-clair px-5 py-3">
        <h2 className="font-display text-lg uppercase tracking-tight">{titre}</h2>
        <code className="font-mono text-[11px] opacity-60">{source}</code>
      </header>
      <div className="flex flex-wrap items-center gap-8 px-5 py-7">{children}</div>
      <p className="border-t-[2.5px] border-encre px-5 py-3 text-[13px] font-medium leading-relaxed opacity-80">
        {note}
      </p>
    </section>
  );
}

const CARTE =
  "flex h-full flex-col justify-between rounded-sticker-lg border-[2.5px] border-encre p-5 shadow-sticker";

export default function LaboAnimata() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="min-h-screen bg-lavande-fond px-4 py-10 text-encre sm:px-8">
      <BarreLecture />
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="rounded-sticker-lg border-[2.5px] border-encre bg-blanc p-7 shadow-sticker-md">
          <div className="inline-block rounded-pastille border-[2.5px] border-encre bg-jaune px-4 py-1.5 font-mono text-[11px] uppercase tracking-[.14em]">
            Labo · hors maquettes
          </div>
          <h1 className="mt-4 font-display text-4xl uppercase leading-none tracking-tight">
            Animata, passé à la charte<span className="text-orange">.</span>
          </h1>
          <p className="mt-3 max-w-2xl font-medium leading-relaxed opacity-80">
            Chaque bloc nomme le composant d&apos;origine. Les adaptations sont décrites
            dans l&apos;en-tête de chaque fichier de <code>components/labo/animata/</code>. Active
            « réduire les animations » dans ton système pour voir le repli.
          </p>
        </div>

        <Bloc
          titre="Logo"
          source="wave-reveal + popin/floaty des maquettes"
          note="La maquette du logo ne prévoit aucune animation : ce sont trois propositions. Survole ou tabule sur le deuxième."
        >
          <Rejouer>
            <LogoAnime variante="vague" />
          </Rejouer>
          <LogoAnime variante="survol" />
          <Rejouer>
            <LogoAnime variante="sticker" />
          </Rejouer>
          <Rejouer>
            <LogoAnime variante="vague" taille={2} />
          </Rejouer>
        </Bloc>

        <Bloc
          titre="Texte animé"
          source="text/wave-reveal · text/counter · text/ticker · text/underline-hover-text"
          note={
            <>
              Compteur et rouleau sont les deux seuls composants qui utilisent{" "}
              <code>motion</code>. Leur valeur est juste même sans JavaScript (l&apos;original du
              compteur affichait 0).
            </>
          }
        >
          <Rejouer>
            {/* Les réglages d'origine d'Animata : lettre à lettre, vers le bas, flou. */}
            <Vague
              texte="Créer. Partager. Inspirer."
              mode="lettre"
              sens="down"
              duree="2000ms"
              flou
              className="font-display text-3xl uppercase sm:text-5xl"
            />
          </Rejouer>
          <div className="flex flex-col gap-1">
            <Compteur cible={12480} className="font-display text-5xl" />
            <span className="font-mono text-[11px] uppercase tracking-widest opacity-70">
              ressources publiées
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <Compteur cible={2350000} format={enFrancs} delai={300} className="font-display text-4xl" />
            <span className="font-mono text-[11px] uppercase tracking-widest opacity-70">
              versés aux créateurs
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <Rouleau valeur="88,5 %" delai={400} className="font-display text-5xl" />
            <span className="font-mono text-[11px] uppercase tracking-widest opacity-70">
              part du créateur
            </span>
          </div>
          <Soulignement texte="Explorer les ressources" className="text-xl font-bold" />
        </Bloc>

        <Bloc
          titre="Ruban"
          source="container/marquee"
          note="Le masque en dégradé d'Animata est retiré : un fondu contredit « jamais flou ». Le second ruban s'arrête au survol."
        >
          <div className="-mx-5 flex w-[calc(100%+2.5rem)] flex-col gap-3">
            <Defile className="border-y-[2.5px] border-encre bg-jaune py-2.5 [--duration:25s]">
              {["CREATE.", "SHARE.", "INSPIRE.", "●"].map((m, i) => (
                <span key={i} className="font-display text-lg uppercase">
                  {m}
                </span>
              ))}
            </Defile>
            <Defile
              inverse
              pauseAuSurvol
              className="border-y-[2.5px] border-encre bg-encre py-2.5 [--duration:35s] [--gap:28px]"
            >
              {["Illustrations", "Polices", "Gabarits", "Photos", "Sons", "3D"].map((m) => (
                <span
                  key={m}
                  className="rounded-pastille border-2 border-blanc px-3 py-0.5 font-mono text-xs uppercase tracking-widest text-blanc"
                >
                  {m}
                </span>
              ))}
            </Defile>
          </div>
        </Bloc>

        <Bloc
          titre="Boutons"
          source="button/duolingo · button/slide-arrow-button · button/ripple-button"
          note="Le premier garde l'idée de Duolingo (le bouton s'enfonce) avec l'ombre dure à la place de la bordure basse. Le troisième ne réagit qu'à la souris."
        >
          <BoutonEnfonce>Publier</BoutonEnfonce>
          <BoutonFleche>Commencer</BoutonFleche>
          <BoutonTache>Devenir créateur</BoutonTache>
        </Bloc>

        <Bloc
          titre="Cartes et squelettes"
          source="card/flip-card · skeleton/list"
          note={
            <>
              La carte se retourne au survol et au focus clavier. Le squelette d&apos;Animata est
              statique (à gauche) ; à droite, le même avec le balayage des maquettes, désormais
              celui du squelette de <code>/explore</code>.
            </>
          }
        >
          <CarteRetournee
            className="h-72 w-56 rounded-sticker-lg"
            etiquette="Pack d'illustrations Wax — retourner pour le détail"
            recto={
              <div className={`${CARTE} bg-lavande-profond`}>
                <span className="font-mono text-[11px] uppercase tracking-widest">Illustration</span>
                <span className="font-display text-2xl uppercase leading-none">Pack Wax</span>
              </div>
            }
            verso={
              <div className={`${CARTE} bg-jaune`}>
                <span className="font-mono text-[11px] uppercase tracking-widest">48 fichiers</span>
                <span className="text-sm font-semibold">SVG et PNG, licence commerciale.</span>
              </div>
            }
          />
          <CarteRetournee
            className="h-72 w-56 rounded-sticker-lg"
            axe="x"
            etiquette="Carte retournée sur l'axe horizontal"
            recto={
              <div className={`${CARTE} bg-blanc`}>
                <span className="font-display text-2xl uppercase leading-none">Axe x</span>
              </div>
            }
            verso={
              <div className={`${CARTE} bg-orange text-blanc`}>
                <span className="font-display text-2xl uppercase leading-none">Verso</span>
              </div>
            }
          />
          <Squelette />
          <Squelette balaye />
        </Bloc>

        <Bloc
          titre="Au défilement"
          source="text/scroll-reveal · scroll/stacked-sections · animation-timeline"
          note={
            <>
              Tout est en CSS (<code>animation-timeline</code>) sauf les cartes empilées. Sans
              prise en charge ou sous mouvement réduit, rien ne bouge et tout reste visible. La
              barre orange en haut de l&apos;écran suit la lecture de la page.
            </>
          }
        >
          <div className="flex w-full flex-col gap-14">
            <div>
              <p className="mb-4 font-mono text-[11px] uppercase tracking-widest opacity-60">
                Apparition — chaque carte se pose en entrant à l&apos;écran
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {["Illustration", "Mockup", "Police", "Photo", "Icône", "Audio"].map((f, i) => (
                  <Apparition key={f}>
                    <div
                      className={`flex h-28 items-end rounded-sticker-md border-[2.5px] border-encre p-4 shadow-sticker ${
                        ["bg-lavande-profond", "bg-jaune", "bg-blanc"][i % 3]
                      }`}
                    >
                      <span className="font-display text-xl uppercase">{f}</span>
                    </div>
                  </Apparition>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-4 font-mono text-[11px] uppercase tracking-widest opacity-60">
                Parallaxe — trois vitesses
              </p>
              <div className="flex h-56 items-center justify-center gap-6 overflow-clip rounded-sticker-md border-[2.5px] border-encre bg-lavande-clair">
                <Parallaxe amplitude={-60}>
                  <div className="h-24 w-24 rounded-pastille border-[2.5px] border-encre bg-orange shadow-sticker" />
                </Parallaxe>
                <Parallaxe amplitude={0}>
                  <div className="h-24 w-24 rounded-sticker-md border-[2.5px] border-encre bg-blanc shadow-sticker" />
                </Parallaxe>
                <Parallaxe amplitude={120}>
                  <div className="h-24 w-24 rotate-6 rounded-sticker-md border-[2.5px] border-encre bg-jaune shadow-sticker" />
                </Parallaxe>
              </div>
            </div>

            <div>
              <p className="mb-4 font-mono text-[11px] uppercase tracking-widest opacity-60">
                Texte qui s&apos;allume — mot à mot, pendant qu&apos;il traverse l&apos;écran
              </p>
              <TexteQuiSAllume
                className="max-w-3xl font-display text-3xl uppercase leading-tight tracking-tight sm:text-4xl"
                texte="Dépose tes fichiers, fixe ton prix ou offre-les, et garde l'essentiel de chaque vente. On s'occupe du reste."
              />
            </div>

            <div>
              <p className="mb-4 font-mono text-[11px] uppercase tracking-widest opacity-60">
                Cartes empilées — chacune recouvre la précédente
              </p>
              <SectionsEmpilees>
                {[
                  ["1", "Dépose", "Tes fichiers, ta description, ton prix.", "bg-lavande-profond"],
                  ["2", "Publie", "Relue par l'équipe, ta ressource entre au catalogue.", "bg-jaune"],
                  ["3", "Vends", "Mobile money ou carte, chaque achat t'est notifié.", "bg-blanc"],
                  ["4", "Encaisse", "Ta part est versée à chaque cycle.", "bg-orange"],
                ].map(([n, titre, texte, fond]) => (
                  <div
                    key={n}
                    className={`flex h-64 flex-col justify-between rounded-sticker-lg border-[2.5px] border-encre p-7 shadow-sticker-md ${fond}`}
                  >
                    <span className="font-mono text-[11px] uppercase tracking-widest">Étape {n}</span>
                    <div>
                      <div className="font-display text-4xl uppercase leading-none">{titre}</div>
                      <p className="mt-2 max-w-md font-semibold">{texte}</p>
                    </div>
                  </div>
                ))}
              </SectionsEmpilees>
            </div>
          </div>
        </Bloc>

        <Bloc
          titre="Squelette de /explore"
          source="Baobart Parcours Achat.dc.html · écran loading"
          note={
            <>
              Le vrai, celui de <code>app/explore/loading.tsx</code>, figé ici pour qu&apos;on
              puisse le regarder : en situation, il ne dure qu&apos;une fraction de seconde.
            </>
          }
        >
          <div className="-mx-5 -my-7 w-[calc(100%+2.5rem)] bg-lavande-fond">
            <SqueletteExplore />
          </div>
        </Bloc>
      </div>
    </main>
  );
}
