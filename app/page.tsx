import { Feed } from "@/components/feed/feed";
import { HomeShell } from "@/components/home/home-shell";
import {
  AppelAuxCreatifs,
  Blog,
  Categories,
  CollectionsTrieesMain,
  EspacesEquipe,
  Temoignages,
} from "@/components/home/sections";
import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { headers } from "next/headers";

import { sessionCourante } from "@/lib/auth/session";
import { colonnesDepuisAgent } from "@/lib/feed/masonry";
import { BAREME_XOF } from "@/lib/domain/fees";
import { aimesParmi } from "@/lib/social/feed";
import { diffusion } from "@/lib/publicites/service";
import { listerPublics } from "@/lib/blog/queries";
import { temoignagesPublies } from "@/lib/temoignages/service";
import {
  compterCommunaute,
  compterParFamille,
  listerAlaUne,
  listerCreateurs,
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
  const [page, alaUne, familles, createurs, chiffres, pubs, rayons, articles, vitrine, temoignages] = await Promise.all([
    listerFeed(),
    listerAlaUne(),
    compterParFamille(),
    listerCreateurs(),
    compterCommunaute(),
    diffusion(),
    rayonsDeLaBibliotheque(),
    listerPublics({ limite: 3 }),
    vitrineDuHero(),
    temoignagesPublies(4),
  ]);

  // Une seule requête pour toute la page : un `like` par carte ferait
  // vingt-cinq allers-retours pour dessiner un cœur.
  const aimes = await aimesParmi(
    utilisateur?.id ?? null,
    [...page.items, ...alaUne].map((r) => r.id),
  );

  // La maquette annonçait « garde 80 % » — un taux de 20 % que la lecture du
  // dépôt Gumroad nous a fait abandonner (VERIFICATION_GUMROAD §2.1). On dérive
  // la promesse du barème réel plutôt que de laisser deux chiffres se
  // contredire entre le code et la page d'accueil.
  const partCreateur = `${100 - BAREME_XOF.directRateBp / 100} %`;

  return (
    <>
      <Header utilisateur={utilisateur} />
      <HomeShell chiffres={chiffres} vitrine={vitrine}>
        <Categories familles={familles} />
        <Feed
          itemsInitiaux={page.items}
          curseurInitial={page.nextCursor}
          alaUne={alaUne}
          aimesInitiaux={aimes}
          connecte={utilisateur !== null}
          colonnesInitiales={colonnes}
          diffusion={pubs}
        />
        <CollectionsTrieesMain total={chiffres.ressources} rayons={rayons} />
        <EspacesEquipe createurs={createurs} />
        <AppelAuxCreatifs partCreateur={partCreateur} />
        <Temoignages temoignages={temoignages} />
        <Blog articles={articles} />
        <Footer />
      </HomeShell>
    </>
  );
}
