import { redirect } from "next/navigation";

import { DashboardFrame } from "@/components/dashboard/frame";
import {
  PanneauOperations,
  type ActionOps,
  type FiltreOps,
  type LegendeOps,
  type LigneOps,
} from "@/components/systeme/panneau-operations";
import { sessionCourante } from "@/lib/auth/session";
import { lireVentesCreateur } from "@/lib/dashboard/lectures";
import { formatMoney } from "@/lib/i18n/money";
import { BLANC, CADRE, ENCRE, JAUNE, TON_ETAT } from "@/lib/systeme/charte";
import { agirSurLaVente } from "@/lib/ventes/actions";
import {
  ETATS_VENTE,
  etatDeLaVente,
  ORDRE_VENTE,
  type EtatVente,
} from "@/lib/ventes/etats";

export const metadata = { title: "Ventes · Remboursement et accès — Baobart." };
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

type Vente = Awaited<ReturnType<typeof lireVentesCreateur>>[number];

/**
 * Ce qu'on peut faire d'une vente, selon son état.
 *
 * Rembourser et retirer l'accès sont deux gestes distincts : l'un rend
 * l'argent, l'autre coupe le téléchargement. On peut faire l'un sans l'autre —
 * les réunir obligerait à choisir entre punir et rembourser.
 *
 * « Contester le litige » figure dans la maquette et n'est pas ici : constituer
 * un dossier de contestation auprès d'un opérateur n'existe pas encore. Un
 * bouton qui n'ouvrirait sur rien vaut moins que son absence.
 */
function actionsDe(etat: EtatVente, restant: number): ActionOps[] {
  const rembourser: ActionOps = {
    cle: "rembourser",
    libelle: etat === "PARTIEL" ? "Rembourser le restant" : "Rembourser",
    fond: JAUNE,
    demande: {
      champ: "montant",
      etiquette: "Montant à rembourser",
      valeur: String(restant),
    },
  };

  const retirer: ActionOps = {
    cle: "retirer",
    libelle: "Retirer l'accès",
    fond: BLANC,
    demande: { champ: "motif", etiquette: "Pourquoi tu retires l'accès" },
  };

  switch (etat) {
    case "ENCAISSEE":
    case "PARTIEL":
      return [rembourser, retirer];
    case "CONTESTEE":
      // Pas de remboursement : l'opérateur a déjà repris l'argent. Le proposer
      // débiterait le vendeur une seconde fois pour la même vente.
      return [retirer];
    default:
      return [];
  }
}

export default async function VentesPage({
  searchParams,
}: {
  searchParams: Promise<{ etat?: string }>;
}) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const { etat: brut } = await searchParams;
  const filtre = brut && brut in ETATS_VENTE ? (brut as EtatVente) : undefined;

  const toutes = await lireVentesCreateur(utilisateur.id, 60);

  const decrites = toutes.map((v: Vente) => {
    const brutMontant = v.price * v.quantity;
    const litige = v.chargebackAt !== null && v.chargebackReversedAt === null;
    const etat = etatDeLaVente({
      state: v.state,
      brut: brutMontant,
      rembourse: v.refundedAmount,
      litige,
      accesRetire: v.accessRevokedAt !== null,
    });

    return { v, brutMontant, etat, restant: brutMontant - v.refundedAmount };
  });

  const visibles = filtre ? decrites.filter((d) => d.etat === filtre) : decrites;
  const devise = toutes[0]?.product.currency ?? "XOF";

  const legende: LegendeOps[] = ORDRE_VENTE.map((e) => ({
    code: e,
    fond: TON_ETAT[ETATS_VENTE[e].ton]!.fond,
    encre: TON_ETAT[ETATS_VENTE[e].ton]!.encre,
    nombre: actionsDe(e, 1).length,
    sens: ETATS_VENTE[e].sens,
  }));

  const filtres: FiltreOps[] = [
    {
      code: "Tous",
      libelle: "TOUTES",
      actif: filtre === undefined,
      href: "/dashboard/ventes",
    },
    ...ORDRE_VENTE.map((e) => ({
      code: e,
      libelle: e,
      actif: filtre === e,
      href: `/dashboard/ventes?etat=${e}`,
    })),
  ];

  const lignes: LigneOps[] = visibles.map(({ v, brutMontant, etat, restant }) => ({
    id: v.id,
    colonnes: [
      v.id.slice(-8).toUpperCase(),
      v.product.name,
      v.order.buyer.profile?.displayName ?? v.order.buyer.email,
      formatMoney(brutMontant, v.product.currency),
      formatMoney(restant, v.product.currency),
    ],
    etat,
    etatFond: TON_ETAT[ETATS_VENTE[etat].ton]!.fond,
    etatEncre: TON_ETAT[ETATS_VENTE[etat].ton]!.encre,
    sens: ETATS_VENTE[etat].sens,
    motif:
      etat === "CONTESTEE"
        ? "L'argent a été repris par l'opérateur et tes versements sont suspendus le temps que la contestation soit tranchée."
        : null,
    trace: `vendue le ${DATE.format(v.createdAt)}${
      v.refundedAmount > 0
        ? ` · ${formatMoney(v.refundedAmount, v.product.currency)} déjà remboursés`
        : ""
    }`,
    actions: actionsDe(etat, restant),
    sansAction: "État terminal — plus rien à décider sur cette vente.",
  }));

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Ventes · Remboursement et accès"
      description="Ce que tu as vendu, et ce que tu peux encore en faire."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
            opacity: 0.75,
            maxWidth: 760,
            textWrap: "pretty",
          }}
        >
          Rembourser et retirer l&apos;accès sont deux gestes distincts :
          l&apos;un rend l&apos;argent, l&apos;autre coupe le téléchargement. On
          peut faire l&apos;un sans l&apos;autre.
        </p>

        <PanneauOperations
          legendeTitre="États d'une vente"
          legende={legende}
          rechercherPlaceholder="Rechercher une vente ou un acheteur…"
          filtres={filtres}
          colonnes={[
            "Référence",
            "Ressource",
            "Acheteur",
            "Payé",
            "Reste remboursable",
          ]}
          lignes={lignes}
          pied={`${visibles.length} ventes sur ${toutes.length} · un remboursement te débite la totalité payée, pas seulement ta part`}
          peutAgir
          executer={agirSurLaVente}
        />

        {/*
          La même information que sur l'écran des versements, au moment où elle
          sert : juste avant de cliquer.
        */}
        <div
          style={{
            border: CADRE,
            borderRadius: 24,
            background: JAUNE,
            boxShadow: `6px 6px 0 ${ENCRE}`,
            padding: 22,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 19,
              textTransform: "uppercase",
              letterSpacing: "-.4px",
            }}
          >
            Ce qu&apos;un remboursement te coûte
          </div>
          <p
            style={{
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.55,
              margin: "14px 0 0",
              maxWidth: 780,
              textWrap: "pretty",
            }}
          >
            La totalité de ce que l&apos;acheteur a payé lui est rendue — pas
            seulement la part que tu as touchée. Sur une vente à{" "}
            {formatMoney(5_000, devise)} dont tu as reçu{" "}
            {formatMoney(4_425, devise)}, un remboursement intégral te débite{" "}
            {formatMoney(5_000, devise)}. Retirer l&apos;accès, lui, ne rend
            aucun argent.
          </p>
        </div>
      </div>
    </DashboardFrame>
  );
}
