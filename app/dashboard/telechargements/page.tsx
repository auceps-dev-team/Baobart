import { redirect } from "next/navigation";

import { EcranDashboard, type Ligne } from "@/components/dashboard/ecran";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { sessionCourante } from "@/lib/auth/session";
import {
  FILTRES_TELECHARGEMENTS,
  filtreTelechargements,
  libelleRepetitions,
} from "@/lib/dashboard/historique";
import { historiqueDesTelechargements } from "@/lib/dashboard/queries";
import { formatCount } from "@/lib/i18n/money";

export const metadata = { title: "Historique des téléchargements — Baobart." };
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function HistoriqueDesTelechargementsPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const filtre = filtreTelechargements((await searchParams).filtre);
  const historique = await historiqueDesTelechargements(utilisateur.id, filtre);

  const lignes: Ligne[] = historique.ressources.map((r) => ({
    cle: r.produitId,
    titre: r.titre,
    meta: [r.formats, DATE.format(r.dernierRetrait)]
      .filter((x) => x.length > 0)
      .join(" · "),
    montant: libelleRepetitions(r.repetitions),
    etat: r.fichierId ? "DISPONIBLE" : "RETIRÉE",
    etatFond: r.fichierId ? undefined : "#FFFFFF",
    visuel: r.visuel,
    // Le lien va droit à la route de livraison, qui redécide de zéro : ce
    // qu'on a téléchargé hier n'est pas un droit acquis pour toujours si la
    // commande a été remboursée depuis.
    action: r.fichierId
      ? {
          label: "Télécharger",
          href: `/api/telechargement/${r.fichierId}`,
          telecharger: true,
        }
      : { label: "Voir la fiche", href: `/products/${r.slug}` },
  }));

  const quota = historique.quota;
  const indicateurQuota = quota
    ? {
        label: "Quota du mois",
        valeur:
          quota.limite === null
            ? "Illimité"
            : `${quota.utilises} / ${quota.limite}`,
        precision: "au titre de ton forfait",
        fond: "#C9A8F5",
      }
    : {
        label: "Forfait",
        valeur: "Aucun",
        precision: "tes achats restent accessibles sans forfait",
      };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#EADFF9" }}>
      <DashboardSidebar
        etape={utilisateur.progression.etape}
        nom={utilisateur.nom}
        email={utilisateur.email}
        actif="telechargements"
      />

      <EcranDashboard
        titre="Historique des téléchargements"
        intro={
          historique.totalCeMois === 0
            ? "Aucun téléchargement ce mois-ci. Les fichiers que tu as acquis restent accessibles indéfiniment."
            : `${formatCount(historique.totalCeMois)} téléchargement${historique.totalCeMois > 1 ? "s" : ""} ce mois-ci. Les fichiers restent accessibles indéfiniment.`
        }
        action={{ label: "Explorer les ressources", href: "/explore" }}
        indicateurs={[
          {
            label: "Ce mois",
            valeur: formatCount(historique.totalCeMois),
            precision: "retraits de fichiers",
            fond: "#FFD84A",
          },
          {
            label: "Depuis le début",
            valeur: formatCount(historique.totalGeneral),
            precision: `${historique.ressourcesDistinctes} ressource${historique.ressourcesDistinctes > 1 ? "s" : ""}`,
          },
          indicateurQuota,
        ]}
        blocLignes={{
          titre: "Derniers fichiers",
          filtres: FILTRES_TELECHARGEMENTS.map((f) => ({
            label: f,
            href: `/dashboard/telechargements?filtre=${encodeURIComponent(f)}`,
            actif: f === filtre,
          })),
          lignes,
          vide: {
            titre: "Rien téléchargé pour l'instant",
            texte:
              filtre === "Tous"
                ? "Les ressources que tu retires apparaîtront ici, avec le nombre de fois où tu les as reprises."
                : "Aucun téléchargement ne correspond à ce filtre.",
            action:
              filtre === "Tous"
                ? { label: "Explorer les ressources", href: "/explore" }
                : { label: "Voir tout", href: "/dashboard/telechargements" },
          },
        }}
      />
    </div>
  );
}
