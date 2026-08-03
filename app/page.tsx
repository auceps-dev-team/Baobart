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
import { BAREME_XOF } from "@/lib/domain/fees";
import {
  compterCommunaute,
  compterParFamille,
  listerAlaUne,
  listerCreateurs,
  listerFeed,
} from "@/lib/feed/queries";

export const metadata = {
  title: "Baobart. — Le studio partagé de l'Afrique créative",
  description:
    "Illustrations, mockups, fonts, photos : tout est là, libre ou à petit prix.",
};

// Le feed change à chaque publication : on ne fige pas l'accueil au build.
export const dynamic = "force-dynamic";

export default async function AccueilPage() {
  const [page, alaUne, familles, createurs, chiffres] = await Promise.all([
    listerFeed(),
    listerAlaUne(),
    compterParFamille(),
    listerCreateurs(),
    compterCommunaute(),
  ]);

  // La maquette annonçait « garde 80 % » — un taux de 20 % que la lecture du
  // dépôt Gumroad nous a fait abandonner (VERIFICATION_GUMROAD §2.1). On dérive
  // la promesse du barème réel plutôt que de laisser deux chiffres se
  // contredire entre le code et la page d'accueil.
  const partCreateur = `${100 - BAREME_XOF.directRateBp / 100} %`;

  return (
    <>
      <Header />
      <HomeShell chiffres={chiffres}>
        <Categories familles={familles} />
        <Feed
          itemsInitiaux={page.items}
          curseurInitial={page.nextCursor}
          alaUne={alaUne}
        />
        <CollectionsTrieesMain />
        <EspacesEquipe createurs={createurs} />
        <AppelAuxCreatifs partCreateur={partCreateur} />
        <Temoignages />
        <Blog />
        <Footer />
      </HomeShell>
    </>
  );
}
