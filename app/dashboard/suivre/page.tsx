import { redirect } from "next/navigation";

import { EcranDashboard, type Ligne } from "@/components/dashboard/ecran";
import { GrillePersonnes, type Personne } from "@/components/dashboard/personnes";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { MarqueFilVu } from "@/components/social/fil-vu";
import { BoutonSuiviCarte } from "@/components/social/suivi-carte";
import { sessionCourante } from "@/lib/auth/session";
import { connexionPuis } from "@/lib/auth/suite";
import { adressePaginee } from "@/lib/dashboard/pagination";
import { compteursDuFil, filDesSuivis, filVuJusquA, suivisRecents } from "@/lib/social/fil";
import { abonnesDe } from "@/lib/social/queries";
import { ilYA, suitDepuis } from "@/lib/social/regles";
import { BLANC, JAUNE } from "@/lib/systeme/charte";

export const metadata = { title: "Suivre les détails — Baobart." };
export const dynamic = "force-dynamic";

/**
 * « Suivre les détails » de la maquette (`Baobart Dashboard.dc.html`, `c_suivre`,
 * l. 1851) : qui te suit, qui tu suis, et ce qu'ils viennent de publier. Lot 5b.
 *
 * Dans l'ordre de la maquette : trois cartes de chiffres, les « Articles des
 * créateurs que tu suis » (NOUVEAU sur fond jaune, VU sur fond blanc — `rows`,
 * l. 1232), puis quatre cartes de personnes, deux abonnés et deux créateurs
 * suivis.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QUI S'ÉCARTE DE LA MAQUETTE, ET POURQUOI
 *
 * - **Les cartes « Abonnés » et « Abonnements » mènent à leur liste** : la
 *   maquette ne dessine aucun chemin vers `c_abonnes` (ni menu, ni
 *   `SUB_PARENT`), et c'est d'ici qu'on la cherche.
 * - **« abonnée », « suivie »** : la maquette accorde au féminin, mais un
 *   profil ne dit pas le genre de la personne. Les cartes disent « te suit »
 *   et « tu suis », qui ne supposent rien.
 * - **La ligne sous le nom** : la spécialité et la ville seulement si la
 *   vitrine de la personne les montre déjà (`presenterAbonne`), sinon depuis
 *   quand. La règle de la liste des abonnés (lot 5a).
 * - **« Message »** seulement vers une vitrine ouverte aux messages, comme
 *   dans la liste des abonnés.
 *
 * `PAR_PAGE` : trois, comme la maquette. Calculé le 24/11, pas mesuré : en-tête
 * et cartes de chiffres jusque vers 279 px, une ligne tous les 96 px, puis les
 * cartes de personnes (deux rangées). À trois lignes, la page finit vers 933 px,
 * sous un menu créateur d'environ 1 010 avec sa nouvelle entrée. La mesure qui
 * fait foi est celle de `e2e/pagination.spec.ts`.
 */
const PAR_PAGE = 3;

export default async function SuivrePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect(connexionPuis("/dashboard/suivre"));
  // Écran de créateur : même règle que Statistiques et les abonnés.
  if (utilisateur.progression.etape === "ACHETEUR") redirect("/dashboard/apercu");

  // L'instant du rendu, et la visite précédente : lue AVANT d'être marquée.
  const rendueLe = new Date();
  const vuJusquA = await filVuJusquA(utilisateur.id);
  const brutPage = (await searchParams).page;

  const [fil, compteurs, abonnes, suivis] = await Promise.all([
    filDesSuivis(utilisateur.id, brutPage, PAR_PAGE, vuJusquA),
    compteursDuFil(utilisateur.id, rendueLe),
    abonnesDe(utilisateur.id, undefined, 2),
    suivisRecents(utilisateur.id, 2),
  ]);

  const exact = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

  const lignes: Ligne[] = fil.publications.map((p) => ({
    cle: p.produitId,
    titre: `${p.auteur} a publié « ${p.titre} »`,
    meta: [ilYA(p.publieeLe, rendueLe), p.famille].filter(Boolean).join(" · "),
    montant: p.prix,
    etat: p.etat,
    etatFond: p.etat === "VU" ? BLANC : JAUNE,
    visuel: p.coverUrl,
    action: { label: "Voir", href: `/products/${p.slug}` },
  }));

  const personnes: Personne[] = [
    ...abonnes.abonnes.map((a) => ({
      cle: `abonne-${a.userId}`,
      nom: a.nom,
      presentation: a.presentation ? `${a.presentation} · te suit` : suitDepuis(a.suitDepuis, rendueLe),
      avatarUrl: a.avatarUrl,
      action: a.ecrire ? { label: "Message", href: a.ecrire, nomAccessible: `Message à ${a.nom}` } : undefined,
    })),
    ...suivis.map((s) => ({
      cle: `suivi-${s.userId}`,
      nom: s.nom,
      presentation: s.presentation ? `${s.presentation} · tu suis` : suitDepuis(s.suitDepuis, rendueLe, "tu suis"),
      avatarUrl: s.avatarUrl,
      bouton: <BoutonSuiviCarte createurId={s.userId} nom={s.nom} />,
    })),
  ];

  const suitQuelquUn = compteurs.abonnements > 0;

  return (
    <div data-shell="1" style={{ display: "flex", minHeight: "100vh", background: "#EADFF9" }}>
      <DashboardSidebar etape={utilisateur.progression.etape} nom={utilisateur.nom} email={utilisateur.email} />

      <EcranDashboard
        titre="Suivre les détails"
        intro="Qui te suit, qui tu suis, et ce qu'ils viennent de publier."
        action={{ label: "Découvrir des créateurs", href: "/createurs" }}
        indicateurs={[
          {
            label: "Abonnés",
            valeur: exact(compteurs.abonnes),
            precision: compteurs.abonnesCeMois > 0 ? `+${exact(compteurs.abonnesCeMois)} ce mois` : "aucun nouveau ce mois",
            fond: JAUNE,
            href: "/dashboard/abonnes",
          },
          {
            label: "Abonnements",
            valeur: exact(compteurs.abonnements),
            precision: compteurs.abonnements > 1 ? "créateurs suivis" : "créateur suivi",
            href: "/dashboard/abonnements",
          },
          {
            label: "Publications suivies",
            valeur: exact(compteurs.publicationsCetteSemaine),
            precision: "cette semaine",
          },
        ]}
        blocLignes={{
          titre: "Articles des créateurs que tu suis",
          lignes,
          pagination: { page: fil.page, pages: fil.pages, adresse: (n) => adressePaginee("/dashboard/suivre", {}, n) },
          vide: suitQuelquUn
            ? {
                titre: "Rien de publié pour l'instant",
                texte: "Les créateurs que tu suis n'ont encore rien mis en ligne. Leurs prochaines ressources apparaîtront ici.",
                action: { label: "Découvrir des créateurs", href: "/createurs" },
              }
            : {
                titre: "Tu ne suis encore personne",
                texte: "Le bouton « Suivre » d'une vitrine ou d'une fiche ajoute son créateur ici : ce qu'il publie apparaîtra dans ce fil.",
                action: { label: "Découvrir des créateurs", href: "/createurs" },
              },
        }}
        enfants={
          <>
            {personnes.length > 0 ? (
              <GrillePersonnes
                etiquette="Tes derniers abonnés et les créateurs que tu suis"
                personnes={personnes}
                vide={{ titre: "", texte: "" }}
              />
            ) : null}
            {/* La visite ne compte que depuis la première page : ouvrir la deuxième
                directement ne doit pas faire passer « VU » ce qu'on n'a pas eu sous les yeux. */}
            {fil.page === 1 ? <MarqueFilVu rendueLe={rendueLe.toISOString()} /> : null}
          </>
        }
      />
    </div>
  );
}
