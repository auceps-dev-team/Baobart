import { redirect } from "next/navigation";

import { DashboardFrame } from "@/components/dashboard/frame";
import { PanneauVersement } from "@/components/dashboard/panneau-versement";
import { sessionCourante } from "@/lib/auth/session";
import { formatMoney } from "@/lib/i18n/money";
import { configurationDe } from "@/lib/payments/configuration";

export const metadata = { title: "Versements — Baobart." };
export const dynamic = "force-dynamic";

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const JAUNE = "#FFD84A";
const ORANGE = "#E2622C";
const LAVANDE = "#EADFF9";
const LILAS = "#F4EEFC";
const MAUVE = "#C9A8F5";
const CADRE = `2.5px solid ${ENCRE}`;

const TITRE = {
  fontFamily: "var(--font-display)",
  fontSize: 19,
  textTransform: "uppercase" as const,
  letterSpacing: "-.4px",
};

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function Carte({
  fond = BLANC,
  children,
}: {
  fond?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: CADRE,
        borderRadius: 24,
        background: fond,
        boxShadow: `6px 6px 0 ${ENCRE}`,
        padding: 22,
      }}
    >
      {children}
    </section>
  );
}

export default async function VersementsPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const config = await configurationDe(utilisateur.id);

  const conditions = [
    {
      titre: "Le délai de rétention",
      detail: `Une vente devient versable après ${config.retentionJours} jours. Ce délai absorbe les impayés et les contestations : une vente d'aujourd'hui n'est jamais versée demain.`,
    },
    {
      titre: "Le seuil minimum",
      detail: `Sous ${formatMoney(config.seuil, "XOF")}, rien ne part : la somme roule sur le cycle suivant plutôt que de payer des frais d'opérateur supérieurs au gain.`,
    },
    {
      titre: "Le nom du titulaire",
      detail:
        "Il doit correspondre à celui que l'opérateur connaît. Un écart est le premier motif de rejet d'un virement, et le versement revient sans explication.",
    },
  ];

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Versements"
      description="Où part ton argent, quand, et ce qui peut l'empêcher de partir."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {config.versementsSuspendus ? (
          <div
            role="alert"
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 16,
              padding: "20px 22px",
              border: CADRE,
              borderRadius: 22,
              background: ORANGE,
              color: BLANC,
              boxShadow: `6px 6px 0 ${ENCRE}`,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 46,
                height: 46,
                flex: "0 0 auto",
                border: CADRE,
                borderRadius: 99,
                background: JAUNE,
                color: ENCRE,
                display: "grid",
                placeItems: "center",
                fontFamily: "var(--font-display)",
                fontSize: 20,
              }}
            >
              !
            </span>
            <div style={{ flex: "1 1 300px", minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(19px,2.1vw,25px)",
                  lineHeight: 1.1,
                  letterSpacing: "-.7px",
                }}
              >
                Tes versements sont suspendus
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1.45,
                  marginTop: 7,
                  opacity: 0.95,
                  textWrap: "pretty",
                }}
              >
                {config.motifSuspension
                  ? `Motif : ${config.motifSuspension}`
                  : "Motif non précisé."}{" "}
                Ton solde reste acquis et continue de s&apos;accumuler — rien
                n&apos;est perdu, rien ne part tant que ce point n&apos;est pas
                réglé.
              </div>
            </div>
          </div>
        ) : null}

        <PanneauVersement
          actuel={
            config.actuel
              ? {
                  label: config.actuel.railLabel,
                  apercu: config.actuel.referenceMasquee,
                  code: config.actuel.railId,
                  titulaire: config.actuel.titulaire,
                }
              : null
          }
          cadence={config.cadence}
          jourDeVersement={config.jourDeVersement}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
            gap: 20,
            alignItems: "start",
          }}
        >
          <Carte>
            <div style={TITRE}>Ce qui conditionne un versement</div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginTop: 16,
              }}
            >
              {conditions.map((c) => (
                <div
                  key={c.titre}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: 14,
                    border: CADRE,
                    borderRadius: 16,
                    background: LILAS,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 22,
                      height: 22,
                      flex: "0 0 auto",
                      border: `2px solid ${ENCRE}`,
                      borderRadius: 7,
                      background: MAUVE,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    ▸
                  </span>
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{c.titre}</div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        lineHeight: 1.5,
                        marginTop: 5,
                        opacity: 0.82,
                        textWrap: "pretty",
                      }}
                    >
                      {c.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Carte>

          {/*
            Obligation d'information. Depuis la décision d'août 2026, un
            remboursement coûte au vendeur le prix entier — commission comprise,
            alors qu'il ne l'a jamais touchée. Le découvrir sur un solde négatif
            serait une mauvaise surprise ; on le dit avant.
          */}
          <Carte fond={JAUNE}>
            <div style={TITRE}>Ce qu&apos;un remboursement te coûte</div>
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.55,
                margin: "14px 0 0",
                textWrap: "pretty",
              }}
            >
              Quand un acheteur est remboursé, la totalité de ce qu&apos;il a payé
              lui est rendue — pas seulement la part que tu as touchée. La
              commission déjà prélevée par Baobart ne t&apos;est pas restituée :
              elle a servi au traitement du paiement, qui a bien eu lieu.
            </p>
            <div
              style={{
                border: CADRE,
                borderRadius: 16,
                background: BLANC,
                padding: 16,
                marginTop: 14,
              }}
            >
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1.6,
                  margin: 0,
                  textWrap: "pretty",
                }}
              >
                Sur une vente à <strong>{formatMoney(5_000, "XOF")}</strong> dont
                tu as reçu <strong>{formatMoney(4_425, "XOF")}</strong>, un
                remboursement intégral te débite{" "}
                <strong>{formatMoney(5_000, "XOF")}</strong>. Tu perds donc
                {" "}
                {formatMoney(575, "XOF")} de plus que ce que la vente
                t&apos;avait rapporté. Si ton solde disponible est inférieur à
                cette somme, il devient négatif et les versements suivants
                servent d&apos;abord à le ramener à zéro.
              </p>
            </div>
          </Carte>
        </div>

        <Carte fond={LAVANDE}>
          <div style={TITRE}>Moyens de paiement des acheteurs</div>
          <p
            style={{
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.55,
              margin: "12px 0 0",
              maxWidth: 780,
              textWrap: "pretty",
            }}
          >
            Tu n&apos;as rien à régler ici. Aucun opérateur n&apos;est branché sur
            ton compte : les acheteurs paient Baobart, jamais toi directement. Les
            moyens proposés au passage en caisse seront ceux de la plateforme,
            identiques pour toutes les boutiques.
          </p>
        </Carte>

        {config.anciens.length > 0 ? (
          <Carte>
            <div style={TITRE}>Comptes remplacés</div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                lineHeight: 1.5,
                marginTop: 9,
                opacity: 0.75,
                maxWidth: 720,
              }}
            >
              Conservés pour la traçabilité des versements déjà partis. Ils ne
              sont jamais supprimés et ne peuvent plus recevoir de fonds.
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginTop: 16,
              }}
            >
              {config.anciens.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 12,
                    padding: "13px 15px",
                    border: CADRE,
                    borderRadius: 15,
                    background: LILAS,
                  }}
                >
                  <div style={{ flex: "1 1 180px", minWidth: 0, fontSize: 14, fontWeight: 800 }}>
                    {c.railLabel} {c.referenceMasquee}
                  </div>
                  <div
                    style={{
                      flex: "1 1 140px",
                      minWidth: 0,
                      fontSize: 12.5,
                      fontWeight: 600,
                      opacity: 0.75,
                    }}
                  >
                    {c.titulaire ?? "—"}
                  </div>
                  <div
                    style={{
                      flex: "0 0 auto",
                      fontFamily: "var(--font-mono)",
                      fontSize: 10.5,
                      opacity: 0.6,
                    }}
                  >
                    retiré le {c.retireLe ? DATE.format(c.retireLe) : "—"}
                  </div>
                </div>
              ))}
            </div>
          </Carte>
        ) : null}
      </div>
    </DashboardFrame>
  );
}
