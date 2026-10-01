import Link from "next/link";
import { redirect } from "next/navigation";

import { EcranDashboard, type Ligne } from "@/components/dashboard/ecran";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { sessionCourante } from "@/lib/auth/session";
import { formatMoney } from "@/lib/i18n/money";
import { REFUS_COURT } from "@/lib/payments/eligibilite";
import { gainsDe } from "@/lib/payments/gains";

export const metadata = { title: "Revenus & versements — Baobart." };
export const dynamic = "force-dynamic";

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const JAUNE = "#FFD84A";
const PRUNE = "#C9A8F5";
const ORANGE = "#E2622C";
const CADRE = `2.5px solid ${ENCRE}`;

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const DATE_COURTE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Ce que chaque état de versement dit au créateur, dans ses mots. */
const ETATS: Record<string, { libelle: string; fond?: string }> = {
  CREATING: { libelle: "PRÉPARÉ", fond: PRUNE },
  PROCESSING: { libelle: "EN ROUTE", fond: PRUNE },
  UNCLAIMED: { libelle: "À RÉCLAMER", fond: PRUNE },
  COMPLETED: { libelle: "PAYÉ" },
  CANCELLED: { libelle: "ANNULÉ", fond: BLANC },
  FAILED: { libelle: "ÉCHOUÉ", fond: BLANC },
  RETURNED: { libelle: "REVENU", fond: BLANC },
  REVERSED: { libelle: "REPRIS", fond: BLANC },
};

export default async function GainsPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const gains = await gainsDe(utilisateur.id);

  const lignes: Ligne[] = gains.versements.map((v) => {
    const etat = ETATS[v.statut] ?? { libelle: v.statut };
    return {
      cle: v.id,
      titre: v.periodEnd
        ? `Versement arrêté au ${DATE_COURTE.format(v.periodEnd)}`
        : "Versement",
      meta: [
        `${v.rail} ${v.compte}`,
        v.date ? DATE_COURTE.format(v.date) : "date à venir",
        v.motifEchec ?? "",
      ]
        .filter((x) => x.length > 0)
        .join(" · "),
      montant: formatMoney(v.montant),
      etat: etat.libelle,
      etatFond: etat.fond,
    };
  });

  const maximum = Math.max(1, ...gains.parMois.map((m) => m.montant));

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#EADFF9" }}>
      <DashboardSidebar
        etape={utilisateur.progression.etape}
        nom={utilisateur.nom}
        email={utilisateur.email}
        actif="c_revenus"
      />

      <EcranDashboard
        titre="Revenus & versements"
        intro={introDe(gains)}
        indicateurs={[
          {
            label: "Solde disponible",
            valeur: formatMoney(gains.disponible),
            // Forme courte : le message complet est déjà dans l'intro, et le
            // lire deux fois dans le même écran donne l'impression d'un bug.
            precision: gains.prochainVersement
              ? `versement le ${DATE.format(gains.prochainVersement)}`
              : gains.blocage.payable
                ? "aucun versement prévu"
                : REFUS_COURT[gains.blocage.raison],
            fond: JAUNE,
          },
          // Une dette remplace « en attente » plutôt que de s'y cacher : la case
          // affichait « 0 F » pour un créateur qui devait 2 300 F (S40, 25/09).
          gains.aDeduire > 0
            ? {
                label: "À déduire",
                valeur: formatMoney(-gains.aDeduire),
                precision: "remboursé après ton dernier versement — retenu sur tes prochaines ventes",
              }
            : {
                label: "En attente de validation",
                valeur: formatMoney(gains.enAttente),
                precision: "ventes encore en période de rétention",
              },
          {
            label: `Cumul ${new Date().getFullYear()}`,
            valeur: formatMoney(gains.cumulAnnee),
            precision: "versements aboutis",
          },
        ]}
        blocLignes={{
          titre: "Historique des versements",
          lignes,
          vide: {
            titre: "Aucun versement pour l'instant",
            texte:
              "Tes versements apparaîtront ici dès que ton solde aura franchi le minimum et que la période de rétention sera passée.",
          },
        }}
        enfants={
          <>
            {/* Le graphique de la maquette, alimenté par les versements réels.
                Les mois sans versement restent à zéro : une barre absente
                laisserait croire à un trou dans les données. */}
            <div
              style={{
                marginTop: 20,
                border: CADRE,
                borderRadius: 24,
                background: BLANC,
                boxShadow: `6px 6px 0 ${ENCRE}`,
                padding: 22,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 800, flex: "1 1 auto" }}>
                  Versements par mois
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    opacity: 0.6,
                  }}
                >
                  6 derniers mois
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 14,
                  height: 190,
                  marginTop: 20,
                  paddingTop: 10,
                  borderTop: CADRE,
                }}
              >
                {gains.parMois.map((m) => (
                  <div
                    key={m.libelle}
                    style={{
                      flex: "1 1 0",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      gap: 8,
                      height: "100%",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10.5,
                        textAlign: "center",
                      }}
                    >
                      {m.montant === 0 ? "—" : formatMoney(m.montant)}
                    </div>
                    <div
                      style={{
                        border: CADRE,
                        borderRadius: "10px 10px 0 0",
                        background: PRUNE,
                        height: `${Math.max(2, (m.montant / maximum) * 100)}%`,
                      }}
                    />
                    <div
                      style={{ fontSize: 11, fontWeight: 800, textAlign: "center" }}
                    >
                      {m.libelle}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/*
              Le compte de versement se règle sur son propre onglet depuis que
              la maquette lui en donne un. Le dupliquer ici ferait deux
              formulaires pour une seule décision — et deux endroits où se
              tromper.
            */}
            <div style={{ marginTop: 20 }}>
              <Link
                href="/dashboard/versements"
                className="sticker-press"
                style={{
                  display: "inline-block",
                  padding: "13px 22px",
                  border: "2.5px solid #121212",
                  borderRadius: 14,
                  background: "#FFD84A",
                  boxShadow: "4px 4px 0 #121212",
                  fontSize: 14,
                  fontWeight: 800,
                  textDecoration: "none",
                  color: "#121212",
                }}
              >
                {gains.compte
                  ? "Changer de compte de versement"
                  : "Enregistrer un compte de versement"}
              </Link>
            </div>

            <p
              style={{
                marginTop: 16,
                maxWidth: 640,
                fontSize: 12.5,
                fontWeight: 700,
                color: ORANGE,
              }}
            >
              L&apos;envoi effectif chez l&apos;opérateur n&apos;est pas encore
              branché : les versements sont préparés et leurs montants réservés,
              mais l&apos;argent ne part pas tant que l&apos;intégration mobile
              money n&apos;existe pas.
            </p>
          </>
        }
      />
    </div>
  );
}

/**
 * Phrase d'introduction.
 *
 * La maquette annonce « 80 % du prix de vente te revient. Versement le 7 de
 * chaque mois. » — deux chiffres que la vérification a démentis. On dit la
 * part réelle et la cadence réelle, plutôt que de laisser l'écran contredire
 * le virement.
 */
function introDe(gains: Awaited<ReturnType<typeof gainsDe>>): string {
  const part = `${gains.partCreateur} du prix de vente te reviennent.`;
  if (gains.aDeduire > 0) {
    return `${part} Tu dois ${formatMoney(gains.aDeduire)} : des remboursements sont arrivés après ton dernier versement. Ils seront retenus sur tes prochaines ventes.`;
  }
  if (gains.prochainVersement) {
    return `${part} Prochain versement le ${DATE.format(gains.prochainVersement)}.`;
  }
  return `${part} ${messageBlocage(gains)}`;
}

function messageBlocage(gains: Awaited<ReturnType<typeof gainsDe>>): string {
  return gains.blocage.payable ? "Aucun versement prévu." : gains.blocage.message;
}
