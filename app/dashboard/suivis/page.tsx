import { redirect } from "next/navigation";

import { EcranDashboard, type Ligne } from "@/components/dashboard/ecran";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { sessionCourante } from "@/lib/auth/session";
import { adressePaginee, paginer } from "@/lib/dashboard/pagination";
import { ilYA } from "@/lib/social/regles";
import { elementsAimes } from "@/lib/social/queries";

export const metadata = { title: "Éléments suivis — Baobart." };
export const dynamic = "force-dynamic";

/**
 * Mesuré le 16/11/2026 à 1440 × 900, liste pleine (`pnpm design:remplir-listes`) :
 * la liste commence à 370 px, une ligne tous les 96 px (84 de haut) : 5 lignes sous un menu qui descend au moins à 900 px, barre de pagination comprise.
 */
// Ramené de 5 à 4 par la mesure d'après (16/11) : à 5, la LISTE tenait sous le menu,
// mais la page entière descendait 9 px sous le menu (marges du panneau, 62 px sous la barre). Le choix retenu le 14/11 : la page s'arrête avec le menu.
const PAR_PAGE = 4;

export default async function ElementsSuivisPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const aimes = await elementsAimes(utilisateur.id);

  const lignes: Ligne[] = aimes.map((r) => ({
    cle: r.produitId,
    titre: r.titre,
    meta: `${r.auteur} · aimé ${ilYA(r.aimeLe)}`,
    montant: r.prixAffiche,
    etat: r.offerte ? "OFFERTE" : "EN VENTE",
    etatFond: r.offerte ? "#C9A8F5" : undefined,
    visuel: r.coverUrl,
    action: { label: "Voir", href: `/products/${r.slug}` },
  }));

  const offertes = aimes.filter((r) => r.offerte).length;

  const paginees = paginer(lignes, (await searchParams).page, PAR_PAGE);

  return (
    <div data-shell="1" style={{ display: "flex", minHeight: "100vh", background: "#EADFF9" }}>
      <DashboardSidebar
        etape={utilisateur.progression.etape}
        nom={utilisateur.nom}
        email={utilisateur.email}
        actif="suivis"
      />

      <EcranDashboard
        titre="Éléments suivis"
        intro="Les ressources que tu as aimées. Elles restent ici tant qu'elles sont en ligne."
        action={{ label: "Explorer les ressources", href: "/explore" }}
        indicateurs={[
          {
            label: "Ressources aimées",
            valeur: String(aimes.length),
            precision: aimes.length === 0 ? "aucune pour l'instant" : "en ligne",
            fond: "#FFD84A",
          },
          {
            label: "Dont offertes",
            valeur: String(offertes),
            precision: "téléchargeables tout de suite",
          },
        ]}
        blocLignes={{
          titre: `${aimes.length} ressource${aimes.length > 1 ? "s" : ""}`,
          lignes: paginees.visibles,
          pagination: { page: paginees.page, pages: paginees.pages, adresse: (n) => adressePaginee("/dashboard/suivis", {}, n) },
          vide: {
            titre: "Rien d'aimé pour l'instant",
            texte:
              "Le cœur sur une fiche met la ressource de côté ici. Une ressource retirée de la vente disparaît de la liste.",
            action: { label: "Explorer les ressources", href: "/explore" },
          },
        }}
      />
    </div>
  );
}
