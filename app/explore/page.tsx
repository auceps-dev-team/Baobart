import { Feed } from "@/components/feed/feed";
import {
  compterRessources,
  listerAlaUne,
  listerFeed,
} from "@/lib/feed/queries";

export const metadata = {
  title: "Explorer — Baobart.",
  description: "Découvre aujourd'hui : du vrai matériel local, pas de banque d'images générique.",
};

// Le feed change à chaque publication : on ne le fige pas au build.
export const dynamic = "force-dynamic";

export default async function ExplorerPage() {
  const [page, alaUne, total] = await Promise.all([
    listerFeed(),
    listerAlaUne(),
    compterRessources(),
  ]);

  return (
    <main style={{ minHeight: "100vh", background: "#EADFF9", paddingBottom: 72 }}>
      <Feed
        itemsInitiaux={page.items}
        curseurInitial={page.nextCursor}
        alaUne={alaUne}
        total={total}
      />
    </main>
  );
}
