import { Apparition } from "@/components/anime/defilement";
import { Feed } from "@/components/feed/feed";
import { HomeShell } from "@/components/home/home-shell";
import {
  AppelAuxCreatifs,
  Blog,
  Categories,
  CollectionsTrieesMain,
  EspacesEquipe,
  RubanBaseline,
  Temoignages,
} from "@/components/home/sections";
import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { headers } from "next/headers";

import { sessionCourante } from "@/lib/auth/session";
import { colonnesDepuisAgent } from "@/lib/feed/masonry";
import { partDuCreateur } from "@/lib/domain/fees";
import { createursASuivre, espaceDuVisiteur } from "@/lib/collections/espace";
import { epinglesParmi, mesCollections } from "@/lib/collections/service";
import { aimesParmi } from "@/lib/social/feed";
import { diffusion } from "@/lib/publicites/service";
import { listerPublics } from "@/lib/blog/queries";
import { temoignagesPublies } from "@/lib/temoignages/service";
import {
  compterCommunaute,
  compterParFamille,
  listerAlaUne,
  listerFeed,
  rayonsDeLaBibliotheque,
  vitrineDuHero,
} from "@/lib/feed/queries";

export const metadata = {
  title: "Baobart. — Le studio partagé de l'Afrique créative",
  description:
    "Illustrations, mockups, fonts, photos : tout est là, libre ou à petit prix.",
};

// Le feed change à chaque publication : on ne fige pas l'accueil au build.
export const dynamic = "force-dynamic";

export default async function AccueilPage() {
  const utilisateur = await sessionCourante();
  const colonnes = colonnesDepuisAgent((await headers()).get("user-agent"));
  const [page, alaUne, familles, createurs, chiffres, pubs, rayons, articles, vitrine, temoignages, visages] = await Promise.all([
    listerFeed(),
    listerAlaUne(),
    compterParFamille(),
    createursASuivre(utilisateur?.id ?? null),
    compterCommunaute(),
    diffusion(),
    rayonsDeLaBibliotheque(),
    listerPublics({ limite: 3 }),
    vitrineDuHero(),
    temoignagesPublies(4),
    // Les visages du hero : les cinq créateurs les plus suivis, pour tout le
    // monde — sans visiteur, la requête n'exclut personne.
    createursASuivre(null, 5),
  ]);
  const [espace, mesCollectionsAccueil] = utilisateur
    ? await Promise.all([espaceDuVisiteur(utilisateur.id), mesCollections(utilisateur.id, 3)])
    : [null, []];

  // Une seule requête pour toute la page : un `like` par carte ferait
  // vingt-cinq allers-retours pour dessiner un cœur.
  const ids = [...page.items, ...alaUne].map((r) => r.id);
  const [aimes, epingles] = await Promise.all([
    aimesParmi(utilisateur?.id ?? null, ids),
    epinglesParmi(utilisateur?.id ?? null, ids),
  ]);

  // « 90 % », calculé ici comme `100 − commission` : les frais d'opérateur
  // manquaient. La phrase vit dans `partDuCreateur`, avec le barème.
  const partCreateur = partDuCreateur().directe;

  return (
    <>
      <Header utilisateur={utilisateur} />
      <HomeShell chiffres={chiffres} vitrine={vitrine} visages={visages}>
        <RubanBaseline />
        {/* Les sections se posent en entrant à l'écran (08/10). Pas le feed :
            il s'allonge sans fin, et ses cartes ont déjà leur `popin`. */}
        <Apparition>
          <Categories familles={familles} />
        </Apparition>
        <Feed
          itemsInitiaux={page.items}
          curseurInitial={page.nextCursor}
          alaUne={alaUne}
          aimesInitiaux={aimes}
          epinglesInitiaux={epingles}
          connecte={utilisateur !== null}
          colonnesInitiales={colonnes}
          diffusion={pubs}
        />
        <Apparition>
          <CollectionsTrieesMain total={chiffres.ressources} rayons={rayons} />
        </Apparition>
        <Apparition>
          <EspacesEquipe
            connecte={utilisateur !== null}
            espace={espace}
            collections={mesCollectionsAccueil}
            createurs={createurs}
          />
        </Apparition>
        <Apparition>
          <AppelAuxCreatifs partCreateur={partCreateur} connecte={utilisateur !== null} />
        </Apparition>
        <Apparition>
          <Temoignages temoignages={temoignages} />
        </Apparition>
        <Apparition>
          <Blog articles={articles} />
        </Apparition>
        <Footer />
      </HomeShell>
    </>
  );
}
