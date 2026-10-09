import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import "@/components/labo/explorations/explorations.css";
import { PackEtale } from "@/components/anime/pack-etale";
import { CarteInclinee } from "@/components/labo/explorations/carte-inclinee";
import { Carrousel } from "@/components/labo/explorations/carrousel";
import { CartesEtalees } from "@/components/labo/explorations/cartes-etalees";
import { PaiementConfettis } from "@/components/labo/explorations/confettis";
import { Faq } from "@/components/labo/explorations/faq";
import { Frise } from "@/components/labo/explorations/frise";
import { GrilleListe } from "@/components/labo/explorations/grille-liste";
import { BoutonJaime } from "@/components/labo/explorations/jaime";
import { MenuPartage } from "@/components/labo/explorations/menu-partage";
import { OngletsGlissants } from "@/components/labo/explorations/onglets";
import { AjoutPanier } from "@/components/labo/explorations/panier";
import { PileAvatars } from "@/components/labo/explorations/pile-avatars";
import { MotQuiTourne, RechercheTapee } from "@/components/labo/explorations/texte";

/**
 * LABO — explorations d'animations, au-delà du premier labo Animata.
 *
 * Page de banc d'essai, demandée le 08/10/2026 : d'autres composants
 * d'Animata, et des effets que le navigateur sait faire seul (View
 * Transitions, `@starting-style`, `interpolate-size`, `scroll-snap`…). Rien
 * ici n'appartient aux maquettes de `Baobart Design/`, qui font foi.
 *
 * Fermée en production (`next build` pose NODE_ENV=production : 404), liée de
 * nulle part, exclue de l'indexation. Même garde que `app/labo/animata`.
 */

export const metadata: Metadata = {
  title: "Labo · Explorations — Baobart.",
  robots: { index: false, follow: false },
};

/** Le bloc du labo Animata, avec une ligne de plus : où ça servirait. */
function Bloc({
  titre,
  source,
  usage,
  note,
  children,
}: {
  titre: string;
  source: string;
  usage: ReactNode;
  note: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-clip rounded-sticker-lg border-[2.5px] border-encre bg-blanc shadow-sticker-md">
      <header className="flex flex-wrap items-baseline gap-3 border-b-[2.5px] border-encre bg-lavande-clair px-5 py-3">
        <h2 className="font-display text-lg uppercase tracking-tight">{titre}</h2>
        <code className="font-mono text-[11px] opacity-60">{source}</code>
      </header>
      <div className="flex flex-wrap items-center gap-8 px-5 py-7">{children}</div>
      <div className="flex flex-col gap-2 border-t-[2.5px] border-encre px-5 py-3 text-[13px] font-medium leading-relaxed">
        <p>
          <span className="mr-2 inline-block rounded-pastille border-2 border-encre bg-jaune px-2 font-mono text-[10px] uppercase tracking-widest">
            Dans Baobart
          </span>
          {usage}
        </p>
        <p className="opacity-80">{note}</p>
      </div>
    </section>
  );
}

export default function LaboExplorations() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="min-h-screen bg-lavande-fond px-4 py-10 text-encre sm:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="rounded-sticker-lg border-[2.5px] border-encre bg-blanc p-7 shadow-sticker-md">
          <div className="inline-block rounded-pastille border-[2.5px] border-encre bg-jaune px-4 py-1.5 font-mono text-[11px] uppercase tracking-[.14em]">
            Labo · hors maquettes
          </div>
          <h1 className="mt-4 font-display text-4xl uppercase leading-none tracking-tight">
            Explorations<span className="text-orange">.</span>
          </h1>
          <p className="mt-3 max-w-2xl font-medium leading-relaxed opacity-80">
            Sept composants d&apos;Animata pas encore essayés, et sept effets que le navigateur
            sait faire seul. Chaque bloc dit d&apos;où vient l&apos;effet et où il servirait ;
            l&apos;en-tête de chaque fichier de <code>components/labo/explorations/</code> dit ce
            qui a changé. Active « réduire les animations » dans ton système pour voir les replis.
          </p>
        </div>

        <h2 className="font-display text-2xl uppercase">D&apos;Animata</h2>

        <Bloc
          titre="Recherche qui tape"
          source="text/typing-text"
          usage="La barre de recherche de /explore, vide : elle montre trois exemples, une fois, puis se tait. Elle s'interrompt dès qu'on clique dedans."
          note="Sans JavaScript ou sous mouvement réduit, le premier exemple s'affiche entier et immobile. Les lecteurs d'écran entendent les trois exemples d'un coup, pas la frappe."
        >
          <RechercheTapee exemples={["motif wax", "mockup de t-shirt", "police manuscrite"]} />
        </Bloc>

        <Bloc
          titre="Mot qui tourne"
          source="text/cycle-text"
          usage="Le titre de l'accueil ou de la page « Devenir créateur » : un mot qui fait le tour des familles de ressources, deux fois, puis s'arrête sur la première."
          note="L'original monte un motion.h1 dans un span ; ici deux images clés CSS. La largeur ne saute pas : la case prend celle du mot le plus long."
        >
          <p className="font-display text-3xl uppercase leading-tight sm:text-4xl">
            Des <MotQuiTourne mots={["illustrations", "polices", "gabarits", "mockups"]} /> faits à
            Abidjan.
          </p>
        </Bloc>

        <Bloc
          titre="Ajouter au panier"
          source="text/swap-text + rebond hors Animata"
          usage="Le bouton principal de la fiche produit, et la pastille du panier dans l'en-tête : le libellé dit l'état, la pastille confirme que quelque chose est arrivé ailleurs dans la page."
          note="L'original bascule au survol : survoler affichait « l'autre » libellé sans que rien ne soit arrivé. Ici seul le clic bascule, et un lecteur d'écran n'entend qu'un libellé."
        >
          <AjoutPanier />
        </Bloc>

        <Bloc
          titre="Pack qu'on étale"
          source="card/card-spread"
          usage={'La section « Ce que contient le pack » de la fiche produit : le paquet dit « plusieurs fichiers » au premier coup d\'œil, un clic les étale.'}
          note="Zéro JavaScript : une case à cocher et :has(). Sans :has(), les cartes restent étalées à plat."
        >
          <CartesEtalees />
        </Bloc>

        <Bloc
          titre="Pack qu'on étale — version des vues"
          source="components/anime/pack-etale.tsx"
          usage="Les collections partagées d'une communauté (app/communautes/[slug]), dès deux vignettes. Ici avec 3 et 6 vignettes : la base de développement n'a aucune collection partagée qui en ait plus d'une (relevé le 09/10)."
          note="N'importe quel nombre de cartes : chacune porte son rang (--i) et le total (--n), une seule formule les resserre."
        >
          <div className="flex w-full flex-col gap-6">
            {[3, 6].map((n) => (
              <PackEtale
                key={n}
                items={Array.from({ length: n }, (_, i) => ({
                  id: `${n}-${i}`,
                  titre: `Ressource ${i + 1}`,
                  couverture: null,
                }))}
              />
            ))}
          </div>
        </Bloc>

        <Bloc
          titre="Pile d'avatars"
          source="list/avatar-list"
          usage="Les créateurs d'une collection commune, les acheteurs récents sur le tableau de bord, ou les membres d'un collectif sur un profil."
          note="Tabule dessus : le nom s'ouvre aussi au clavier. Les tailles de l'original étaient inversées (« lg » plus petit que « md »)."
        >
          <PileAvatars
            createurs={[
              { nom: "Awa Koné", role: "Illustratrice", fond: "bg-lavande-profond" },
              { nom: "Yao Kouassi", role: "Typographe", fond: "bg-jaune" },
              { nom: "Fatou Bamba", role: "Photographe", fond: "bg-blanc" },
              { nom: "Ismaël Touré", role: "Motion", fond: "bg-orange" },
              { nom: "Mariam Diallo", role: "3D", fond: "bg-lavande-clair" },
            ]}
          />
          <PileAvatars
            taille="sm"
            createurs={[
              { nom: "Awa Koné", role: "Illustratrice", fond: "bg-lavande-profond" },
              { nom: "Yao Kouassi", role: "Typographe", fond: "bg-jaune" },
              { nom: "Fatou Bamba", role: "Photographe", fond: "bg-blanc" },
            ]}
          />
        </Bloc>

        <Bloc
          titre="Onglets glissants"
          source="tabs/fluid-tabs"
          usage="Le tableau de bord du créateur (Ventes · Ressources · Versements), et les filtres de « Mes achats »."
          note="Sans motion : on mesure l'onglet actif et la pastille glisse en CSS. Un seul arrêt de tabulation, les flèches changent d'onglet."
        >
          <OngletsGlissants
            onglets={[
              { titre: "Ventes", contenu: <p className="font-medium">12 ventes cette semaine.</p> },
              { titre: "Ressources", contenu: <p className="font-medium">8 ressources publiées.</p> },
              { titre: "Versements", contenu: <p className="font-medium">Prochain versement le 15/10.</p> },
            ]}
          />
        </Bloc>

        <Bloc
          titre="Frise d'étapes"
          source="progress/animatedtimeline"
          usage="Le suivi d'un versement côté créateur (vente → en attente → versement envoyé → reçu), ou d'une ressource soumise à relecture."
          note="L'original ne s'allume qu'au survol de la souris ; ici l'étape est une donnée et la cascade joue quand elle change. Sous mouvement réduit, les délais tombent à zéro."
        >
          <Frise
            initiale={1}
            etapes={[
              { titre: "Vente", detail: "Pack Wax, 4 500 F" },
              { titre: "En attente", detail: "Jusqu'au prochain cycle de versement (exemple)" },
              { titre: "Versement envoyé", detail: "Mobile money" },
              { titre: "Reçu", detail: "Ta part est sur ton compte" },
            ]}
          />
        </Bloc>

        <h2 className="font-display text-2xl uppercase">Hors Animata — le navigateur seul</h2>

        <Bloc
          titre="Grille ↔ liste"
          source="View Transitions API"
          usage="Le bouton d'affichage de /explore et de « Mes achats » : en passant de la grille à la liste, chaque carte voyage jusqu'à sa nouvelle place, on ne perd pas l'œil."
          note="Sans l'API, ou sous mouvement réduit, l'affichage change d'un coup. Aucune dépendance."
        >
          <GrilleListe />
        </Bloc>

        <Bloc
          titre="Menu « Partager »"
          source="popover + @starting-style + ancrage CSS"
          usage="Le bouton « Partager » de la fiche produit et du profil créateur, le menu du compte dans l'en-tête."
          note="Zéro JavaScript : ouverture, fermeture au clic dehors et à Échap sont natives. Sans @starting-style, le menu apparaît sans transition."
        >
          <MenuPartage />
        </Bloc>

        <Bloc
          titre="FAQ qui se déplie"
          source="<details> + interpolate-size + ::details-content"
          usage="La FAQ et la licence de la fiche produit, l'aide du tableau de bord."
          note="Zéro JavaScript. Sans prise en charge, le <details> s'ouvre d'un coup, comme aujourd'hui. Un seul ouvert à la fois (attribut name)."
        >
          <Faq />
        </Bloc>

        <Bloc
          titre="Paiement réussi"
          source="canvas maison"
          usage="L'écran de confirmation après un achat, et la première vente d'un créateur — une fois, pas à chaque visite."
          note="1,6 s, puis la boucle s'arrête d'elle-même. Sous mouvement réduit, pas de confettis : le message est le même."
        >
          <PaiementConfettis />
        </Bloc>

        <Bloc
          titre="Carte inclinée"
          source="pointer events + variables CSS"
          usage="La carte « à la une » d'une collection, ou l'aperçu principal de la fiche produit — pas toute la mosaïque de /explore, où l'effet fatiguerait."
          note="Souris et stylet seulement ; l'ombre dure glisse à l'opposé de l'inclinaison. Au doigt et sous mouvement réduit, rien ne bouge."
        >
          <CarteInclinee />
        </Bloc>

        <Bloc
          titre="J'aime qui éclate"
          source="CSS + aria-pressed"
          usage="Le bouton « j'aime » des cartes de /explore et de la fiche produit."
          note="Les éclats ne partent qu'en aimant, pas en retirant. Sous mouvement réduit, l'état change sans éclats."
        >
          <BoutonJaime />
        </Bloc>

        <Bloc
          titre="Carrousel aimanté"
          source="scroll-snap"
          usage="La galerie d'aperçus de la fiche produit, sur téléphone surtout : le doigt fait défiler, chaque aperçu s'aligne."
          note="Le défilement est celui du navigateur ; on ne fait que lui demander de s'arrêter sur une image. Les flèches sautent directement sous mouvement réduit."
        >
          <Carrousel />
        </Bloc>
      </div>
    </main>
  );
}
