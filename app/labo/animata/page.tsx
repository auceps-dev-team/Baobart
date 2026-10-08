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
import { Rejouer } from "@/components/labo/animata/rejouer";
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
    <section className="overflow-hidden rounded-sticker-lg border-[2.5px] border-encre bg-blanc shadow-sticker-md">
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
