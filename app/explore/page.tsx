import { Feed } from "@/components/feed/feed";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { Rail } from "@/components/shell/rail";
import { listerAlaUne, listerFeed } from "@/lib/feed/queries";
import { FILTRES, type Filtre } from "@/lib/feed/types";
import { aimesParmi } from "@/lib/social/feed";

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

  const utilisateur = await sessionCourante();
  const [page, alaUne] = await Promise.all([
    listerFeed({ filtre }),
    listerAlaUne(),
  ]);

  // Une seule requête pour toute la page : un `like` par carte ferait
  // vingt-cinq allers-retours pour dessiner un cœur.
  const aimes = await aimesParmi(
    utilisateur?.id ?? null,
    [...page.items, ...alaUne].map((r) => r.id),
  );

  return (
    <>
      <Header utilisateur={utilisateur} />
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
          aimesInitiaux={aimes}
          connecte={utilisateur !== null}
          filtreInitial={filtre}
        />
      </div>
    </>
  );
}
