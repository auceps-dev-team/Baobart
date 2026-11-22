import { redirect } from "next/navigation";

import { EcranDashboard, type Ligne } from "@/components/dashboard/ecran";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { sessionCourante } from "@/lib/auth/session";
import { connexionPuis } from "@/lib/auth/suite";
import {
  FILTRES_ACHATS,
  commandeTelechargeable,
  filtreAchats,
} from "@/lib/dashboard/historique";
import { encaissementPossible } from "@/lib/checkout/achat";
import { adressePaginee, paginer } from "@/lib/dashboard/pagination";
import { historiqueDesAchats } from "@/lib/dashboard/queries";
import { formatMoney, formatPrice } from "@/lib/i18n/money";
import { ORANGE_SOMBRE } from "@/lib/systeme/charte";

export const metadata = { title: "Historique des achats — Baobart." };
export const dynamic = "force-dynamic";

const PRUNE = "#C9A8F5";
const BLANC = "#FFFFFF";

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * Mesuré le 16/11/2026 à 1440 × 900, liste pleine (`pnpm design:remplir-listes`) :
 * la liste commence à 404 px, une ligne tous les 96 px (84 de haut). Sous un menu
 * qui descend au moins à 900 px, barre de pagination comprise (56 px) : 4 lignes.
 */
const PAR_PAGE = 4;

export default async function HistoriqueDesAchatsPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string; page?: string }>;
}) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect(connexionPuis("/dashboard/achats"));

  const parametres = await searchParams;
  const filtre = filtreAchats(parametres.filtre);
  const achats = await historiqueDesAchats(utilisateur.id, filtre);

  const lignesCommandes: Ligne[] = achats.commandes.map((c) => ({
    cle: c.id,
    titre: `Commande ${c.reference}`,
    meta: `${DATE.format(c.passeeLe)} · ${c.articles} article${c.articles > 1 ? "s" : ""}`,
    montant: formatPrice(c.total, c.devise),
    etat: c.etat,
    etatFond: c.etat === "PAYÉE" ? undefined : c.etat === "REMBOURSÉE" ? BLANC : PRUNE,
    visuel: c.visuel,
    // Une commande mène à ses fichiers, pas à une facture : la facturation
    // viendra avec le paiement. Proposer « Facture » ouvrirait sur rien.
    //
    // Vers la bibliothèque depuis le 31/10, et plus vers l'historique des
    // téléchargements : celui-ci ne liste que ce qu'on a déjà retiré, et un
    // achat jamais ouvert y était introuvable (audit du 31/10, Q2-3).
    action: commandeTelechargeable(c.etat)
      ? { label: "Mes fichiers", href: "/dashboard/bibliotheque" }
      : undefined,
  }));

  const lignesAbonnements: Ligne[] = achats.abonnements.map((a) => ({
    cle: a.id,
    titre: a.nom,
    // Un forfait gratuit n'a pas de prélèvement : son échéance n'est qu'un
    // cycle qui avance seul.
    meta: !a.actif
      ? `arrêté le ${DATE.format(a.prochainPrelevement)}`
      : a.prixMensuel === 0
        ? "gratuit · sans prélèvement"
        : `prélèvement mensuel · prochain le ${DATE.format(a.prochainPrelevement)}`,
    montant: formatPrice(a.prixMensuel, a.devise),
    etat: a.actif ? "EN COURS" : "ARRÊTÉ",
    etatFond: a.actif ? PRUNE : BLANC,
    action: undefined,
  }));

  const paginees = paginer([...lignesAbonnements, ...lignesCommandes], parametres.page, PAR_PAGE);
  const nb = achats.commandes.length;
  const { bilan } = achats;

  return (
    <div data-shell="1" style={{ display: "flex", minHeight: "100vh", background: "#EADFF9" }}>
      <DashboardSidebar
        etape={utilisateur.progression.etape}
        nom={utilisateur.nom}
        email={utilisateur.email}
        actif="achats"
      />

      <EcranDashboard
        titre="Historique des achats"
        // « avec le détail des licences » : la liste n'en montrait aucun. La
        // clé est par ressource, pas par commande — elle vit sur la fiche.
        intro="Toutes tes commandes. Les fichiers restent accessibles depuis tes téléchargements, la clé de licence de chaque ressource sur sa fiche, et un remboursement se demande depuis Remboursements."
        action={{ label: "Explorer les ressources", href: "/explore" }}
        // Le bilan décrit le compte, pas la liste : il ne bouge pas avec le
        // filtre.
        indicateurs={[
          {
            label: "Commandes",
            valeur: String(bilan.commandes),
            precision:
              bilan.commandes === 0
                ? "aucune pour l'instant"
                : "depuis ton inscription",
          },
          {
            label: "Total dépensé",
            // `formatMoney`, pas `formatPrice` : sur un cumul, zéro se dit
            // « 0 F ». « GRATUIT » est une étiquette de prix, pas de total.
            valeur: formatMoney(bilan.totalDepense, achats.devise),
            precision: "remboursements déduits",
            fond: "#FFD84A",
          },
          {
            label: "Abonnement",
            valeur: bilan.abonnementActif ? "Actif" : "Aucun",
            precision: bilan.abonnementActif
              ? "renouvellement mensuel"
              : "aucun forfait en cours",
          },
        ]}
        blocLignes={{
          titre:
            nb === 0
              ? "Historique"
              : `${nb} commande${nb > 1 ? "s" : ""}`,
          filtres: FILTRES_ACHATS.map((f) => ({
            label: f,
            href: `/dashboard/achats?filtre=${encodeURIComponent(f)}`,
            actif: f === filtre,
          })),
          lignes: paginees.visibles,
          pagination: {
            page: paginees.page,
            pages: paginees.pages,
            adresse: (n) => adressePaginee("/dashboard/achats", { filtre: parametres.filtre }, n),
          },
          vide: {
            titre:
              filtre === "Abonnement"
                ? "Aucun abonnement"
                : "Rien acheté pour l'instant",
            texte:
              filtre === "Abonnement"
                ? "Accès libre, gratuit, s'active depuis la page Tarifs."
                : "Tes commandes apparaîtront ici, avec leur état et le détail des articles.",
            action: { label: "Explorer les ressources", href: "/explore" },
          },
        }}
        enfants={
          // Seulement quand c'est vrai : écrit en dur, le bandeau s'affichait sous
          // une commande payée (D11, 25/09).
          encaissementPossible() ? null : <p
            style={{
              marginTop: 16,
              fontSize: 12.5,
              fontWeight: 700,
              color: ORANGE_SOMBRE,
              maxWidth: 640,
            }}
          >
            Le paiement n&apos;est pas encore branché : aucune commande ne peut
            être passée pour le moment.
          </p>
        }
      />
    </div>
  );
}
