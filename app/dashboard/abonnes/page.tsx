import { redirect } from "next/navigation";

import { EcranDashboard } from "@/components/dashboard/ecran";
import { GrillePersonnes, type Personne } from "@/components/dashboard/personnes";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { sessionCourante } from "@/lib/auth/session";
import { connexionPuis } from "@/lib/auth/suite";
import { adressePaginee } from "@/lib/dashboard/pagination";
import { abonnesDe } from "@/lib/social/queries";
import { phraseDesAbonnes, suitDepuis } from "@/lib/social/regles";

export const metadata = { title: "Abonnés — Baobart." };
export const dynamic = "force-dynamic";

/**
 * « Abonnés » de la maquette (`Baobart Dashboard.dc.html`, `c_abonnes`, l. 1764) :
 * qui suit le créateur, en cartes de personnes. Lot 5a.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QUI S'ÉCARTE DE LA MAQUETTE, ET POURQUOI
 *
 * - **Pas de « Publier une actu ».** C'est l'infolettre du créateur à son
 *   audience (inventaire A12, `Post` et `PostDelivery` jamais écrits) : un
 *   bouton qui ne mènerait nulle part ne s'affiche pas.
 * - **« Message » seulement pour qui a une vitrine ouverte aux messages** : il
 *   ouvre sa fenêtre de contact (`#contact`). Ailleurs, pas de bouton.
 * - **La ligne sous le nom** dit la spécialité et la ville quand la vitrine de
 *   l'abonné les montre déjà ; sinon, depuis quand il suit. Un abonné sans
 *   vitrine n'a rendu public que son nom (`presenterAbonne`, lib/social/regles.ts).
 * - **Atteignable.** La maquette ne met `c_abonnes` ni au menu (l. 893-916) ni
 *   dans `SUB_PARENT` (l. 1995) : sa ligne 2481 la ramène au tableau de bord.
 *   Ici, la notification « Nouvel abonné » y mène, et « Suivre les détails »
 *   (lot 5b) y mènera. Faute d'entrée à elle, la barre allume « Tableau de
 *   bord », comme le repli de la maquette.
 *
 * `PAR_PAGE` : calculé le 21/11, pas mesuré à l'écran — la machine servait à
 * autre chose. À 1440 px, la grille a trois colonnes (1 100 px utiles, cartes de
 * 280 px au moins) et une rangée tous les 93 px (carte de 77, écart de 16). La
 * grille commence vers 161 px. À huit rangées (24), la page finirait vers
 * 984 px, sous un menu créateur d'environ 970 (mesuré pour #60). À sept (21),
 * la barre de pagination finit vers 851 px et la page vers 891. La mesure qui
 * fait foi est celle de `e2e/pagination.spec.ts`, « la page s'arrête avec le
 * menu » (règle du 14/11), avec trente abonnés.
 */
const PAR_PAGE = 21;

export default async function AbonnesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect(connexionPuis("/dashboard/abonnes"));
  // Écran de créateur : même règle que Statistiques et `/dashboard`.
  if (utilisateur.progression.etape === "ACHETEUR") redirect("/dashboard/apercu");

  const { total, page, pages, abonnes } = await abonnesDe(utilisateur.id, (await searchParams).page, PAR_PAGE);

  const personnes: Personne[] = abonnes.map((a) => ({
    cle: a.userId,
    nom: a.nom,
    // « Illustration · Dakar » quand sa vitrine le montre déjà ; sinon, depuis quand il suit.
    presentation: a.presentation ?? suitDepuis(a.suitDepuis),
    avatarUrl: a.avatarUrl,
    action: a.ecrire ? { label: "Message", href: a.ecrire, nomAccessible: `Message à ${a.nom}` } : undefined,
  }));

  return (
    <div data-shell="1" style={{ display: "flex", minHeight: "100vh", background: "#EADFF9" }}>
      <DashboardSidebar etape={utilisateur.progression.etape} nom={utilisateur.nom} email={utilisateur.email} />

      <EcranDashboard
        titre="Abonnés"
        intro={phraseDesAbonnes(total)}
        enfants={
          <GrillePersonnes
            etiquette="Tes abonnés"
            personnes={personnes}
            pagination={{ page, pages, adresse: (n) => adressePaginee("/dashboard/abonnes", {}, n) }}
            vide={{
              titre: "Personne ne te suit encore",
              texte: "Le bouton « Suivre » de ta vitrine et de tes fiches ajoute ici celles et ceux qui veulent voir tes prochaines publications.",
              // Sa vitrine, à partager ; sans pseudo, le réglage qui la nomme.
              action: utilisateur.username
                ? { label: "Voir ma vitrine", href: `/@${utilisateur.username}` }
                : { label: "Profil de la boutique", href: "/dashboard/boutique" },
            }}
          />
        }
      />
    </div>
  );
}
