import { DashboardFrame } from "@/components/dashboard/frame";
import { BandeauGravite, Intro, PiedEcran, type Puce } from "@/components/systeme/bandeau";
import {
  PanneauOperations,
  type ActionOps,
  type FiltreOps,
  type LegendeOps,
  type LigneOps,
} from "@/components/systeme/panneau-operations";
import { exigerAdministrateur } from "@/lib/auth/acces-administration";
import { peut } from "@/lib/auth/administration";
import { formatMoney } from "@/lib/i18n/money";
import { fairePasserVersement } from "@/lib/payments/actions-admin";
import {
  ETATS,
  SUITES_PERMISES,
  vueDesVersements,
  type EtatVersement,
} from "@/lib/payments/supervision";
import { BLANC, JAUNE, ORANGE, TON_ETAT } from "@/lib/systeme/charte";
import { graviteGlobale } from "@/lib/systeme/diagnostic";

export const metadata = { title: "Système · Versements — Baobart." };
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** L'ordre de la légende suit le cycle de vie, pas l'alphabet. */
const ORDRE: EtatVersement[] = [
  "CREATING",
  "PROCESSING",
  "UNCLAIMED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "RETURNED",
  "REVERSED",
];

/**
 * Le mot du bouton dit ce qui se passe, pas le nom de l'état d'arrivée.
 *
 * Les transitions qui exigent une saisie l'exigent vraiment : un versement
 * échoué sans motif oblige à rouvrir le dossier chez l'opérateur pour savoir
 * ce qui s'est passé.
 */
const TRANSITIONS: Partial<
  Record<EtatVersement, { libelle: string; fond: string; demande?: ActionOps["demande"] }>
> = {
  PROCESSING: {
    libelle: "Marquer envoyé",
    fond: JAUNE,
    demande: { champ: "reference", etiquette: "Référence chez l'opérateur" },
  },
  COMPLETED: { libelle: "Confirmer réception", fond: JAUNE },
  FAILED: {
    libelle: "Marquer échoué",
    fond: BLANC,
    demande: { champ: "raison", etiquette: "Pourquoi l'ordre n'est pas passé" },
  },
  RETURNED: {
    libelle: "Marquer retourné",
    fond: BLANC,
    demande: { champ: "raison", etiquette: "Pourquoi l'argent est revenu" },
  },
  CANCELLED: {
    libelle: "Annuler",
    fond: BLANC,
    demande: { champ: "raison", etiquette: "Pourquoi tu annules" },
  },
};

/** Les états terminés d'où un nouvel essai a du sens. */
const REJOUABLES: EtatVersement[] = ["FAILED", "RETURNED", "CANCELLED"];

/**
 * Les gestes offerts à l'écran.
 *
 * Deux natures s'y mêlent, et c'est voulu. Les transitions font avancer **ce**
 * versement. « Verser à nouveau » n'en est pas une : elle en prépare un autre
 * sur les soldes que l'échec a déjà rendus. Recycler l'ancien effacerait la
 * trace de la première tentative auprès de l'opérateur — justement ce qu'on lui
 * montre le jour où il conteste.
 */
function actionsDe(etat: EtatVersement): ActionOps[] {
  const transitions: ActionOps[] = (SUITES_PERMISES[etat] ?? [])
    .filter((vers) => TRANSITIONS[vers] !== undefined)
    .map((vers) => {
      const t = TRANSITIONS[vers]!;
      return { cle: vers, libelle: t.libelle, fond: t.fond, demande: t.demande };
    });

  if (REJOUABLES.includes(etat)) {
    transitions.push({
      cle: "REJOUER",
      libelle: "Verser à nouveau",
      fond: JAUNE,
      demande: undefined,
    });
  }

  return transitions;
}

function filtreValide(brut: string | undefined): EtatVersement | undefined {
  return brut && brut in ETATS ? (brut as EtatVersement) : undefined;
}

export default async function VersementsSystemePage({
  searchParams,
}: {
  searchParams: Promise<{ etat?: string }>;
}) {
  // Le layout garde la section, mais Next.js réutilise un layout entre pages
  // sœurs au lieu de le réexécuter. Une garde qui ne s'exécute pas est absente.
  const utilisateur = await exigerAdministrateur();
  const { etat: brut } = await searchParams;
  const filtre = filtreValide(brut);

  const vue = await vueDesVersements(filtre);
  const peutAgir = peut(utilisateur.role, "agir_sur_l_exploitation");

  const compte = (e: EtatVersement) =>
    vue.parEtat.find((g) => g.etat === e) ?? { nombre: 0, montant: 0 };

  const aEnvoyer = compte("CREATING");
  const bloques =
    compte("FAILED").nombre + compte("RETURNED").nombre + compte("REVERSED").nombre;

  const gravite = graviteGlobale([
    {
      cle: "bloques",
      libelle: "",
      detail: "",
      gravite: bloques > 0 ? "panne" : "ok",
    },
    {
      cle: "aEnvoyer",
      libelle: "",
      detail: "",
      gravite: aEnvoyer.nombre > 0 ? "attention" : "ok",
    },
  ]);

  const puces: Puce[] = [{ texte: `${vue.total} versements`, fond: BLANC }];
  if (bloques > 0) puces.push({ texte: `${bloques} bloqués`, fond: ORANGE });
  else if (aEnvoyer.nombre > 0) {
    puces.push({ texte: `${aEnvoyer.nombre} à envoyer`, fond: JAUNE });
  }

  const legende: LegendeOps[] = ORDRE.map((e) => ({
    code: ETATS[e].libelle,
    fond: TON_ETAT[ETATS[e].ton]!.fond,
    encre: TON_ETAT[ETATS[e].ton]!.encre,
    nombre: actionsDe(e).length,
    sens: ETATS[e].sens,
  }));

  const filtres: FiltreOps[] = [
    {
      code: "Tous",
      libelle: "TOUS",
      actif: filtre === undefined,
      href: "/dashboard/systeme/versements",
    },
    ...ORDRE.map((e) => ({
      code: e,
      libelle: ETATS[e].libelle,
      actif: filtre === e,
      href: `/dashboard/systeme/versements?etat=${e}`,
    })),
  ];

  const lignes: LigneOps[] = vue.lignes.map((v) => ({
    id: v.id,
    colonnes: [
      v.id.slice(-12).toUpperCase(),
      v.beneficiaire,
      `${v.moyen} ${v.compte}`,
      formatMoney(v.montant, v.devise as "XOF"),
      v.reference ?? "—",
    ],
    etat: ETATS[v.etat].libelle,
    etatFond: TON_ETAT[ETATS[v.etat].ton]!.fond,
    etatEncre: TON_ETAT[ETATS[v.etat].ton]!.encre,
    sens: ETATS[v.etat].sens,
    motif: v.motifEchec,
    trace: `créé le ${DATE.format(v.creeLe)}`,
    actions: actionsDe(v.etat),
    sansAction: "État terminal — plus rien à décider ici.",
  }));

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Système · Versements"
      description="Les versements créés par le cycle, et leur avancée entre huit états."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <BandeauGravite gravite={gravite} puces={puces} />

        <Intro>
          Les versements déjà créés par le cycle, et leur avancée entre huit
          états. Cet écran ne calcule aucun montant : il fait avancer ce que le
          cycle a produit, et exige une trace écrite pour chaque geste
          irréversible.
        </Intro>

        <PanneauOperations
          legendeTitre="Les huit états"
          legende={legende}
          rechercherPlaceholder="Rechercher un bénéficiaire ou une référence…"
          filtres={filtres}
          colonnes={[
            "Référence",
            "Bénéficiaire",
            "Moyen",
            "Montant",
            "Réf. opérateur",
          ]}
          lignes={lignes}
          pied={`${vue.lignes.length} versements affichés sur ${vue.total} · le nombre d'actions dépend de l'état, jamais du rôle`}
          peutAgir={peutAgir}
          executer={fairePasserVersement}
        />

        <PiedEcran
          libelle="Règle à ne pas perdre"
          qui="Un versement annulé ou échoué rend ses soldes"
          note="Ils redeviennent versables et repartiront au cycle suivant, cumulés aux ventes de la période. C'est pourquoi « échoué » n'est pas une fin : c'est un report."
        />
      </div>
    </DashboardFrame>
  );
}
