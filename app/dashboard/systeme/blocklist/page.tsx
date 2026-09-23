import { DashboardFrame } from "@/components/dashboard/frame";
import {
  BandeauGravite,
  Intro,
  Panneau,
  PiedEcran,
  type Puce,
} from "@/components/systeme/bandeau";
import {
  PanneauOperations,
  type FiltreOps,
  type LegendeOps,
  type LigneOps,
} from "@/components/systeme/panneau-operations";
import { PoseBlocage } from "@/components/systeme/pose-blocage";
import { exigerAdministrateur } from "@/lib/auth/acces-administration";
import { peut } from "@/lib/auth/administration";
import {
  leverUnBlocage,
  poserUnBlocage,
} from "@/lib/securite/actions-blocklist";
import {
  TYPES_BLOQUABLES,
  listerBlocages,
  type TypeBloquable,
} from "@/lib/securite/blocklist";
import { BLANC, GRIS, JAUNE, ORANGE, TON_ETAT } from "@/lib/systeme/charte";

export const metadata = { title: "Liste de blocage — Baobart." };
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * Ce qu'on bloque, et ce que chaque type veut dire.
 *
 * Dérivé de `TYPES_BLOQUABLES` — pas recopié. Un type ajouté au module et
 * oublié ici ne compile pas : `Record<TypeBloquable, …>` exige la liste
 * complète. C'est le seul moyen que cet écran ne mente pas par omission le
 * jour où la liste bouge.
 */
const SENS: Record<TypeBloquable, string> = {
  EMAIL: "Ni connexion, ni réinscription avec cette adresse.",
  IP: "Ni connexion, ni inscription depuis ce réseau. Six mois.",
  PHONE: "Numéro refusé à la vérification.",
  CARD: "Empreinte de moyen de paiement refusée au paiement.",
  OBJECT: "Identifiant libre, pour ce qui n'entre dans aucune autre case.",
};

const FILTRES = ["Tous", ...TYPES_BLOQUABLES] as const;

function filtreValide(brut: string | undefined): (typeof FILTRES)[number] {
  return FILTRES.includes(brut as (typeof FILTRES)[number])
    ? (brut as (typeof FILTRES)[number])
    : "Tous";
}

/**
 * La liste de blocage — ce qui ferme la porte, et à qui.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES ENTRÉES EXPIRÉES SONT MONTRÉES
 *
 * Grisées, marquées « EXPIRÉ », et toujours là. Les cacher répondrait à la
 * mauvaise question : on ouvre cet écran quand quelqu'un est repassé, et
 * l'entrée qui explique pourquoi est précisément celle qui vient d'expirer.
 *
 * Elles disparaissent au ménage de nuit (`/api/cron/securite`), pas à
 * l'affichage.
 */
export default async function BlocklistPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  // Le layout garde la section, mais Next.js réutilise un layout entre pages
  // sœurs au lieu de le réexécuter. Une garde qui ne s'exécute pas est absente.
  const utilisateur = await exigerAdministrateur();
  const { filtre: brut } = await searchParams;
  const filtre = filtreValide(brut);

  const toutes = await listerBlocages();
  const lignesFiltrees =
    filtre === "Tous" ? toutes : toutes.filter((l) => l.type === filtre);

  const peutAgir = peut(utilisateur.role, "gerer_la_conformite");

  const actives = toutes.filter((l) => !l.expiree).length;
  const expirees = toutes.length - actives;

  const puces: Puce[] = [
    { texte: `${actives} actifs`, fond: actives > 0 ? JAUNE : BLANC },
  ];
  if (expirees > 0) puces.push({ texte: `${expirees} expirés`, fond: GRIS });

  const legende: LegendeOps[] = TYPES_BLOQUABLES.map((t) => ({
    code: t,
    fond: t === "IP" ? TON_ETAT.attend!.fond : TON_ETAT.neutre!.fond,
    encre: TON_ETAT.neutre!.encre,
    nombre: toutes.filter((l) => l.type === t && !l.expiree).length,
    sens: SENS[t],
  }));

  const filtres: FiltreOps[] = FILTRES.map((f) => ({
    code: f,
    libelle: f === "Tous" ? "TOUS" : f,
    actif: f === filtre,
    href:
      f === "Tous"
        ? "/dashboard/systeme/blocklist"
        : `/dashboard/systeme/blocklist?filtre=${encodeURIComponent(f)}`,
  }));

  const lignes: LigneOps[] = lignesFiltrees.map((l) => ({
    id: l.id,
    colonnes: [
      l.type,
      l.valeur,
      l.expireLe === null ? "sans échéance" : DATE.format(l.expireLe),
      l.userId ? "suspension d'un compte" : "posé à la main",
      DATE.format(l.poseeLe),
    ],
    etat: l.expiree ? "EXPIRÉ" : "ACTIF",
    etatFond: l.expiree ? TON_ETAT.dort!.fond : TON_ETAT.attend!.fond,
    etatEncre: TON_ETAT.dort!.encre,
    sens: l.expiree
      ? "Cette entrée ne bloque plus personne ; elle attend le ménage de nuit."
      : SENS[l.type],
    motif: l.raison,
    trace: l.userId
      ? `posé automatiquement à la suspension du compte ${l.userId.slice(-8).toUpperCase()}`
      : null,
    actions: [
      {
        cle: "lever",
        libelle: l.expiree ? "Retirer" : "Lever",
        fond: ORANGE,
      },
    ],
  }));

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Liste de blocage"
      description="Fermer la porte à une identité, et savoir jusqu'à quand."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <BandeauGravite gravite={actives > 0 ? "attention" : "ok"} puces={puces} />

        <Intro>
          {"Bloquer n'est pas ralentir. La limitation de débit gêne tout le " +
            "monde pareil ; ceci interdit à quelqu'un de précis, et ce n'est " +
            "pas non plus une suspension de compte — c'est ce qui sert quand " +
            "la personne revient sous un autre nom."}
        </Intro>

        <Panneau
          titre="Poser un blocage"
          mention="La durée découle du type, elle ne se choisit pas"
        >
          <PoseBlocage peutAgir={peutAgir} poser={poserUnBlocage} />
        </Panneau>

        <PanneauOperations
          legendeTitre="Ce qu'on sait bloquer"
          legende={legende}
          rechercherPlaceholder="Rechercher une valeur…"
          filtres={filtres}
          colonnes={["Type", "Valeur", "Échéance", "Origine", "Posé le"]}
          lignes={lignes}
          pied={`${lignesFiltrees.length} entrées affichées sur ${toutes.length} · les expirées sont montrées jusqu'au ménage de nuit`}
          peutAgir={peutAgir}
          executer={leverUnBlocage}
        />

        <PiedEcran
          libelle="Ce que la machine fait toute seule"
          qui="Suspendre un compte bloque ses adresses de connexion"
          note="Six mois, et la levée de la suspension les débloque. L'expiration s'applique à la lecture : une entrée périmée ne bloque plus personne, même si le ménage de nuit n'a pas tourné. Le message opposé à une personne bloquée ne dit jamais ce qui l'a bloquée — le dire apprendrait comment contourner."
        />
      </div>
    </DashboardFrame>
  );
}
