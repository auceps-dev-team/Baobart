import { redirect } from "next/navigation";

import { EcranDashboard, type Ligne } from "@/components/dashboard/ecran";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { sessionCourante } from "@/lib/auth/session";
import { formatPrice } from "@/lib/i18n/money";
import { ilYA } from "@/lib/social/regles";
import { elementsAimes } from "@/lib/social/queries";

export const metadata = { title: "Éléments suivis — Baobart." };
export const dynamic = "force-dynamic";

export default async function ElementsSuivisPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const aimes = await elementsAimes(utilisateur.id);

  const lignes: Ligne[] = aimes.map((r) => ({
    cle: r.produitId,
    titre: r.titre,
    meta: `${r.auteur} · aimé ${ilYA(r.aimeLe)}`,
    montant: formatPrice(r.prix),
    etat: r.prix === 0 ? "OFFERTE" : "EN VENTE",
    etatFond: r.prix === 0 ? "#C9A8F5" : undefined,
    visuel: r.coverUrl,
    action: { label: "Voir", href: `/products/${r.slug}` },
  }));

  const offertes = aimes.filter((r) => r.prix === 0).length;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#EADFF9" }}>
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
          lignes,
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
