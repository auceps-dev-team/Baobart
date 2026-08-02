import { Feed } from "@/components/feed/feed";
import { Header } from "@/components/shell/header";
import { Rail } from "@/components/shell/rail";
import { listerAlaUne, listerFeed } from "@/lib/feed/queries";
import { FILTRES, type Filtre } from "@/lib/feed/types";

export const metadata = {
  title: "Explorer — Baobart.",
  description:
    "Découvre aujourd'hui : du vrai matériel local, pas de banque d'images générique.",
};

// Le feed change à chaque publication : on ne le fige pas au build.
export const dynamic = "force-dynamic";

export default async function ExplorerPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  const { filtre: demande } = await searchParams;
  const filtre: Filtre =
    demande && (FILTRES as readonly string[]).includes(demande)
      ? (demande as Filtre)
      : "Tous";

  const [page, alaUne] = await Promise.all([
    listerFeed({ filtre }),
    listerAlaUne(),
  ]);

  return (
    <>
      <Header />
      <div
        data-root="1"
        style={{
          minHeight: "100vh",
          background: "#EADFF9",
          overflowX: "hidden",
          paddingLeft: 112,
          paddingBottom: 72,
        }}
      >
        <Rail filtreActif={filtre} />
        <Feed
          itemsInitiaux={page.items}
          curseurInitial={page.nextCursor}
          alaUne={alaUne}
          filtreInitial={filtre}
        />
      </div>
    </>
  );
}
