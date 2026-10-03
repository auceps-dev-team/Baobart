import { headers } from "next/headers";

import { Feed } from "@/components/feed/feed";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { Rail } from "@/components/shell/rail";
import { colonnesDepuisAgent } from "@/lib/feed/masonry";
import { listerAlaUne, listerFeed } from "@/lib/feed/queries";
import { FILTRES, type Filtre } from "@/lib/feed/types";
import { aimesParmi } from "@/lib/social/feed";
import { diffusion } from "@/lib/publicites/service";

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
  const [page, alaUne, pubs] = await Promise.all([
    listerFeed({ filtre }),
    listerAlaUne(),
    diffusion(),
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
        {/*
          ════════════════════════════════════════════════════════════════════
          LA CLÉ N'EST PAS DÉCORATIVE : SANS ELLE, LES FILTRES NE FILTRENT PAS

          `Feed` initialise son état avec `useState(itemsInitiaux)` et
          `useState(filtreInitial)`. Un `useState` n'utilise sa valeur initiale
          qu'au MONTAGE.

          Cliquer « Photos » dans le rail navigue vers `/explore?filtre=Photo`.
          Next re-rend la page côté serveur, envoie les bons props — et React
          réutilise la même instance de `Feed`, parce qu'elle occupe la même
          place dans l'arbre. Les initialisateurs sont ignorés, l'état garde
          l'ancienne liste.

          Résultat observé : l'URL change, le rail surligne la bonne entrée, et
          la grille ne bouge pas. Rien ne plante, rien ne prévient.

          La clé change avec le filtre, donc React démonte et remonte : les
          `useState` repartent des nouveaux props. C'est la façon documentée de
          réinitialiser un état quand l'identité de ce qu'on affiche change.
        */}
        <Feed
          key={filtre}
          itemsInitiaux={page.items}
          curseurInitial={page.nextCursor}
          alaUne={alaUne}
          aimesInitiaux={aimes}
          connecte={utilisateur !== null}
          filtreInitial={filtre}
          colonnesInitiales={colonnesDepuisAgent((await headers()).get("user-agent"))}
          diffusion={pubs}
        />
      </div>
    </>
  );
}
