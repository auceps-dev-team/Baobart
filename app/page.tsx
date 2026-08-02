import { HomeShell } from "@/components/home/home-shell";
import { Feed } from "@/components/feed/feed";
import { Header } from "@/components/shell/header";
import { listerAlaUne, listerFeed } from "@/lib/feed/queries";

export const metadata = {
  title: "Baobart. — Le studio partagé de l'Afrique créative",
  description:
    "Illustrations, mockups, fonts, photos : tout est là, libre ou à petit prix.",
};

// Le feed change à chaque publication : on ne fige pas l'accueil au build.
export const dynamic = "force-dynamic";

export default async function AccueilPage() {
  const [page, alaUne] = await Promise.all([listerFeed(), listerAlaUne()]);

  return (
    <>
      <Header />
      <HomeShell>
        <Feed
          itemsInitiaux={page.items}
          curseurInitial={page.nextCursor}
          alaUne={alaUne}
        />
        <div style={{ height: 72 }} />
      </HomeShell>
    </>
  );
}
