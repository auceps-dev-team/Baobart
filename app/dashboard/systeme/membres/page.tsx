import { DashboardFrame } from "@/components/dashboard/frame";
import { BandeauGravite, Intro, PiedEcran, type Puce } from "@/components/systeme/bandeau";
import {
  PanneauOperations,
  type FiltreOps,
  type LegendeOps,
  type LigneOps,
} from "@/components/systeme/panneau-operations";
import { exigerAdministrateur } from "@/lib/auth/acces-administration";
import { peut } from "@/lib/auth/administration";
import { deciderDuCompte } from "@/lib/domain/actions-risque";
import {
  decisionsPour,
  ETATS_MEMBRE,
  etatMembreDe,
  FILTRES_MEMBRES,
  filtreMembresValide,
  listerMembres,
  type EtatMembre,
} from "@/lib/domain/membres";
import { formatMoney } from "@/lib/i18n/money";
import { BLANC, JAUNE, ORANGE, TON_ETAT } from "@/lib/systeme/charte";

export const metadata = { title: "Membres · Décisions de risque — Baobart." };
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const ORDRE: EtatMembre[] = ["SAIN", "SIGNALE", "SUSPENDU"];

/**
 * Un signalement n'est pas visible par le membre ; une suspension l'est.
 *
 * C'est la phrase de la maquette, et elle porte une vraie règle : on peut
 * observer sans accuser. Le membre signalé continue de vendre et d'être payé —
 * ce qui change, c'est qu'un humain regarde.
 */
export default async function MembresRisquePage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  // Le layout garde la section, mais Next.js réutilise un layout entre pages
  // sœurs au lieu de le réexécuter. Une garde qui ne s'exécute pas est absente.
  const utilisateur = await exigerAdministrateur();
  const { filtre: brut } = await searchParams;
  const filtre = filtreMembresValide(brut);

  const { membres, total, suspendus } = await listerMembres(filtre);
  const peutAgir = peut(utilisateur.role, "agir_sur_l_exploitation");

  const signales = membres.filter(
    (m) => etatMembreDe(m.etatRisque) === "SIGNALE",
  ).length;

  const puces: Puce[] = [{ texte: `${total} comptes`, fond: BLANC }];
  if (suspendus > 0) puces.push({ texte: `${suspendus} suspendus`, fond: ORANGE });
  else if (signales > 0) puces.push({ texte: `${signales} signalés`, fond: JAUNE });

  const legende: LegendeOps[] = ORDRE.map((e) => {
    // Le nombre d'actions se lit sur un compte représentatif de l'état : c'est
    // ce que la maquette affiche dans le rond de la légende.
    const exemple =
      e === "SUSPENDU"
        ? "SUSPENDED_TOS"
        : e === "SIGNALE"
          ? "FLAGGED_TOS"
          : "NOT_REVIEWED";

    return {
      code: e,
      fond: TON_ETAT[ETATS_MEMBRE[e].ton]!.fond,
      encre: TON_ETAT[ETATS_MEMBRE[e].ton]!.encre,
      nombre: decisionsPour(exemple).length,
      sens: ETATS_MEMBRE[e].sens,
    };
  });

  const filtres: FiltreOps[] = FILTRES_MEMBRES.map((f) => ({
    code: f,
    libelle: f.toUpperCase(),
    actif: f === filtre,
    href:
      f === "Tous"
        ? "/dashboard/systeme/membres"
        : `/dashboard/systeme/membres?filtre=${encodeURIComponent(f)}`,
  }));

  const lignes: LigneOps[] = membres.map((m) => {
    const etat = etatMembreDe(m.etatRisque);
    const decisions = decisionsPour(m.etatRisque, m.kyc);

    return {
      id: m.id,
      colonnes: [
        m.id.slice(-8).toUpperCase(),
        m.nom,
        m.produits > 0 ? `créateur · ${m.produits} ressource(s)` : "acheteur",
        formatMoney(m.soldeGele, "XOF"),
        m.email,
      ],
      etat,
      etatFond: TON_ETAT[ETATS_MEMBRE[etat].ton]!.fond,
      etatEncre: TON_ETAT[ETATS_MEMBRE[etat].ton]!.encre,
      sens: ETATS_MEMBRE[etat].sens,
      motif: m.derniereDecision?.motif ?? null,
      trace: m.derniereDecision
        ? `${m.derniereDecision.auteur} · ${DATE.format(m.derniereDecision.le)} · ${m.etatRisque}`
        : `inscrit le ${DATE.format(m.inscritLe)} · aucune décision prise sur ce compte`,
      actions: decisions.map((d) => ({
        // La clé transporte l'événement ET la levée : deux gestes différents
        // peuvent viser le même état d'arrivée, et seul l'un des deux a le
        // droit de défaire une suspension.
        cle: `${d.event}:${d.leveSuspension ? "1" : "0"}`,
        libelle: d.libelle,
        fond: d.event.startsWith("SUSPEND") ? ORANGE : JAUNE,
        demande: { champ: "motif", etiquette: "Raison de cette décision" },
      })),
      sansAction:
        m.kyc === "NONE" && decisions.length === 0
          ? "Identité non vérifiée : ce compte ne peut être ni signalé ni suspendu."
          : "Aucune décision possible dans cet état.",
    };
  });

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Membres · Décisions de risque"
      description="Signaler, suspendre, lever."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <BandeauGravite
          gravite={suspendus > 0 ? "panne" : signales > 0 ? "attention" : "ok"}
          puces={puces}
        />

        <Intro>
          Signaler, suspendre, lever. Chaque geste exige un motif écrit avant
          validation, et laisse une ligne que personne ne peut effacer.
        </Intro>

        <PanneauOperations
          legendeTitre="Les trois états d'un compte"
          legende={legende}
          rechercherPlaceholder="Rechercher un membre…"
          filtres={filtres}
          colonnes={["Identifiant", "Membre", "Rôle", "Solde gelé", "Courriel"]}
          lignes={lignes}
          pied={`${membres.length} comptes affichés sur ${total} · un signalement n'est pas visible par le membre, une suspension l'est`}
          peutAgir={peutAgir}
          executer={deciderDuCompte}
        />

        <PiedEcran
          libelle="Ce que la machine refuse"
          qui="Lever une suspension exige une demande explicite"
          note="Une revue de routine ne doit pas défaire une sanction qu'elle n'a jamais examinée. Suspendre ferme les sessions et retire les ressources de la vente ; lever ne les remet pas en vente, parce qu'on ne sait pas lesquelles le créateur avait retirées lui-même."
        />
      </div>
    </DashboardFrame>
  );
}
