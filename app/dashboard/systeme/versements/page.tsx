import Link from "next/link";

import { DashboardFrame } from "@/components/dashboard/frame";
import {
  BandeauGravite,
  Compteurs,
  Intro,
  Panneau,
  PiedEcran,
  type Puce,
} from "@/components/systeme/bandeau";
import {
  LigneVersement,
  type VersementAffiche,
} from "@/components/systeme/ligne-versement";
import { exigerAdministrateur } from "@/lib/auth/acces-administration";
import { peut } from "@/lib/auth/administration";
import { formatMoney } from "@/lib/i18n/money";
import {
  ETATS,
  vueDesVersements,
  type EtatVersement,
} from "@/lib/payments/supervision";
import { BLANC, ENCRE, JAUNE, ORANGE, TON } from "@/lib/systeme/charte";
import { graviteGlobale } from "@/lib/systeme/diagnostic";

export const metadata = { title: "Système · Versements — Baobart." };
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const FILTRES: Array<{ code: EtatVersement | "Tous"; libelle: string }> = [
  { code: "Tous", libelle: "Tous" },
  { code: "CREATING", libelle: "Préparés" },
  { code: "PROCESSING", libelle: "Envoyés" },
  { code: "COMPLETED", libelle: "Payés" },
  { code: "FAILED", libelle: "Échoués" },
  { code: "RETURNED", libelle: "Retournés" },
];

function filtreValide(brut: string | undefined): EtatVersement | undefined {
  return brut && brut in ETATS ? (brut as EtatVersement) : undefined;
}

/** Le mot du bouton dit ce qui se passe, pas le nom de l'état d'arrivée. */
const LIBELLE_TRANSITION: Partial<Record<EtatVersement, string>> = {
  PROCESSING: "Marquer envoyé",
  COMPLETED: "Confirmer l'arrivée",
  FAILED: "Marquer échoué",
  RETURNED: "Marquer retourné",
  CANCELLED: "Annuler",
};

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

  const prepares = compte("CREATING");
  const envoyes = compte("PROCESSING");
  const echoues = compte("FAILED");
  const retournes = compte("RETURNED");
  const bloques = echoues.nombre + retournes.nombre;

  const compteurs = [
    {
      cle: "prepares",
      libelle: "Préparés, non partis",
      valeur: String(prepares.nombre),
      note:
        prepares.nombre > 0
          ? `${formatMoney(prepares.montant, "XOF")} de soldes réservés`
          : "rien en attente d'envoi",
      // Un versement préparé est un versement qui n'est pas parti : c'est le
      // seul état où l'argent est immobilisé sans que personne n'agisse.
      gravite: prepares.nombre > 0 ? ("attention" as const) : ("ok" as const),
    },
    {
      cle: "envoyes",
      libelle: "Chez l'opérateur",
      valeur: String(envoyes.nombre),
      note: "en attente de confirmation",
      gravite: "ok" as const,
    },
    {
      cle: "bloques",
      libelle: "Échoués ou retournés",
      valeur: String(bloques),
      note: bloques > 0 ? "les soldes sont repartis au cycle suivant" : "rien à reprendre",
      gravite: bloques > 0 ? ("panne" as const) : ("ok" as const),
    },
    {
      cle: "total",
      libelle: "Versements enregistrés",
      valeur: String(vue.total),
      note: "toutes périodes confondues",
      gravite: "ok" as const,
    },
  ];

  const gravite = graviteGlobale(
    compteurs.map((c) => ({
      cle: c.cle,
      libelle: c.libelle,
      gravite: c.gravite,
      detail: "",
    })),
  );

  const puces: Puce[] = [
    { texte: `${vue.total} versements`, fond: BLANC },
  ];
  if (bloques > 0) {
    puces.push({ texte: `${bloques} bloqués`, fond: ORANGE });
  } else if (prepares.nombre > 0) {
    puces.push({ texte: `${prepares.nombre} à envoyer`, fond: JAUNE });
  }

  const lignes: VersementAffiche[] = vue.lignes.map((v) => ({
    id: v.id,
    beneficiaire: v.beneficiaire,
    moyen: v.moyen,
    compte: v.compte,
    montant: formatMoney(v.montant, v.devise as "XOF"),
    etat: v.etat,
    etatLibelle: ETATS[v.etat].libelle,
    gravite: ETATS[v.etat].gravite,
    fond: TON[ETATS[v.etat].gravite].ligneFond,
    reference: v.reference,
    motifEchec: v.motifEchec,
    creeLe: DATE.format(v.creeLe),
    suites: v.suites
      // UNCLAIMED et REVERSED viennent de l'opérateur, jamais d'un clic.
      .filter((s) => LIBELLE_TRANSITION[s] !== undefined)
      .map((s) => ({ vers: s, libelle: LIBELLE_TRANSITION[s]! })),
  }));

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Système · Versements"
      description="Faire avancer les versements, du solde réservé jusqu'à l'argent arrivé."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <BandeauGravite gravite={gravite} puces={puces} />

        <Intro>
          Le passage hebdomadaire prépare les versements ; il ne les envoie pas.
          C&apos;est ici qu&apos;on les fait avancer, et qu&apos;on consigne ce
          que l&apos;opérateur a répondu.
        </Intro>

        <Compteurs liste={compteurs} />

        <Panneau
          titre="Versements"
          mention="relu à chaque affichage · aucune mise en cache"
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 14 }}>
            {FILTRES.map((f) => {
              const actif =
                f.code === "Tous" ? filtre === undefined : filtre === f.code;
              return (
                <Link
                  key={f.code}
                  href={
                    f.code === "Tous"
                      ? "/dashboard/systeme/versements"
                      : `/dashboard/systeme/versements?etat=${f.code}`
                  }
                  style={{
                    padding: "7px 14px",
                    border: `2px solid ${ENCRE}`,
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 800,
                    background: actif ? ENCRE : BLANC,
                    color: actif ? BLANC : ENCRE,
                    textDecoration: "none",
                  }}
                >
                  {f.libelle}
                </Link>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginTop: 16,
            }}
          >
            {lignes.length === 0 ? (
              <p style={{ fontSize: 13.5, fontWeight: 600, opacity: 0.7 }}>
                {vue.total === 0
                  ? "Aucun versement n'a encore été préparé. Le passage hebdomadaire s'en charge."
                  : "Aucun versement dans cet état."}
              </p>
            ) : (
              lignes.map((v) => (
                <LigneVersement key={v.id} versement={v} peutAgir={peutAgir} />
              ))
            )}
          </div>

          {peutAgir ? null : (
            <div
              style={{
                marginTop: 16,
                padding: "11px 16px",
                border: `2.5px dashed ${ENCRE}`,
                borderRadius: 13,
                background: "#F4EEFC",
                fontSize: 12.5,
                fontWeight: 700,
              }}
            >
              Lecture seule — le pouvoir{" "}
              <span style={{ fontFamily: "var(--font-mono)" }}>
                agir_sur_l_exploitation
              </span>{" "}
              est requis pour agir.
            </div>
          )}
        </Panneau>

        <PiedEcran
          libelle="Règle à ne pas perdre"
          qui="Un versement annulé ou échoué rend ses soldes"
          note="Ils redeviennent versables et repartiront au cycle suivant, cumulés aux ventes de la période. C'est pourquoi « échoué » n'est pas une fin : c'est un report."
        />
      </div>
    </DashboardFrame>
  );
}
