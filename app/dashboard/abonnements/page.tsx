import { redirect } from "next/navigation";

import { EcranDashboard, type Ligne } from "@/components/dashboard/ecran";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { sessionCourante } from "@/lib/auth/session";
import { formatCount } from "@/lib/i18n/money";
import { createursSuivis } from "@/lib/social/queries";
import { ilYA } from "@/lib/social/regles";

export const metadata = { title: "Abonnements — Baobart." };
export const dynamic = "force-dynamic";

export default async function AbonnementsPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const suivis = await createursSuivis(utilisateur.id);

  const lignes: Ligne[] = suivis.map((c) => ({
    cle: c.userId,
    titre: c.nom,
    meta: [
      c.ville,
      `${formatCount(c.abonnes)} abonné${c.abonnes > 1 ? "s" : ""}`,
      `suivi ${ilYA(c.suiviLe)}`,
    ]
      .filter((x): x is string => Boolean(x))
      .join(" · "),
    montant: `${c.ressourcesPubliees} ${c.ressourcesPubliees > 1 ? "ressources" : "ressource"}`,
    etat: c.ressourcesPubliees > 0 ? "ACTIF" : "RIEN EN LIGNE",
    etatFond: c.ressourcesPubliees > 0 ? undefined : "#FFFFFF",
    // Le profil public existe désormais (v1.45.0). Un créateur sans nom
    // d'utilisateur n'a pas d'adresse : on retombe alors sur l'explorateur
    // plutôt que de fabriquer un lien qui mènerait à un 404.
    action: c.username
      ? { label: "Voir son profil", href: `/@${c.username}` }
      : { label: "Explorer", href: "/explore" },
  }));

  const publiantes = suivis.filter((c) => c.ressourcesPubliees > 0).length;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#EADFF9" }}>
      <DashboardSidebar
        etape={utilisateur.progression.etape}
        nom={utilisateur.nom}
        email={utilisateur.email}
        actif="abonnements_suivis"
      />

      <EcranDashboard
        titre="Abonnements"
        intro="Les créateurs que tu suis. Leurs nouveautés apparaîtront ici quand le fil d'actualité sera en place."
        action={{ label: "Découvrir des créateurs", href: "/createurs" }}
        indicateurs={[
          {
            label: "Créateurs suivis",
            valeur: String(suivis.length),
            precision: suivis.length === 0 ? "aucun pour l'instant" : "abonnements",
            fond: "#FFD84A",
          },
          {
            label: "Qui publient",
            valeur: String(publiantes),
            precision: "au moins une ressource en ligne",
          },
          {
            label: "Tes abonnés",
            valeur: formatCount(utilisateur.abonnes),
            precision: "personnes qui te suivent",
            fond: "#C9A8F5",
          },
        ]}
        blocLignes={{
          titre: `${suivis.length} créateur${suivis.length > 1 ? "s" : ""}`,
          lignes,
          vide: {
            titre: "Tu ne suis personne",
            texte:
              "Le bouton « Suivre » sur une fiche ajoute son créateur ici. Tu seras averti de ses nouvelles ressources.",
            action: { label: "Découvrir des créateurs", href: "/createurs" },
          },
        }}
      />
    </div>
  );
}
