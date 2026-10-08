import Link from "next/link";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";

import { ChoixPaiement } from "@/components/checkout/choix-paiement";
import { renouvelerAbonnement } from "@/lib/abonnements/actions";
import {
  MESSAGES,
  renouvellementPossible,
  type MotifRefus,
} from "@/lib/abonnements/renouvellement";
import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/i18n/money";
import {
  JOURS_DE_CADENCE,
  REGLAGES_PAR_DEFAUT,
  ajouterJours,
  cycleSuivant,
  joursEntre,
  type Cadence,
} from "@/lib/ndank/cycle";
import { etatDe } from "@/lib/ndank/etats";
import { piloteCourant } from "@/lib/payments/encaissement/pilotes";
import {
  BLANC,
  CADRE,
  ENCRE,
  GRIS,
  JAUNE,
  LAVANDE,
  ORANGE,
} from "@/lib/systeme/charte";

export const metadata = { title: "Renouveler ton abonnement — Baobart." };

/**
 * Où mène le lien d'une relance Ndank.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'ÉCRAN LE PLUS VU PAR QUELQU'UN SUR LE POINT DE PERDRE SON ACCÈS
 *
 * Toutes les relances y mènent — courriel, SMS, notification. Il doit donc
 * répondre à trois questions dans cet ordre, et sans les mélanger : où j'en
 * suis, combien, et qu'est-ce qui va se passer si je clique.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA PROMESSE EST UNE CARTE, PAS UN ENCART
 *
 * « Rien n'est prélevé sans ta validation » n'est pas une formule rassurante :
 * c'est la mécanique réelle du mobile money, et c'est ce qui distingue un
 * abonnement Baobart d'un abonnement à carte dont on a peur. La maquette lui
 * donne une carte entière et une comparaison — parce que c'est l'argument, pas
 * une note de bas de page.
 *
 * Traduit de « Baobart Parcours Achat.dc.html », écran `renew`.
 */
export const dynamic = "force-dynamic";

/** Ce que la maquette dessine, état par état. */
type Allure = {
  kicker: string;
  titre: string;
  texte: string;
  fond: string;
  encre: string;
  glyphe: string;
  pastille: string;
  jauge: number;
  jaugeTexte: string;
  cta: string;
  /** Un abonnement clos ne se renouvelle pas : le sélecteur disparaît. */
  mort: boolean;
};

export default async function RenouvelerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paiement?: string }>;
}) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const { id } = await params;
  const { paiement: refus } = await searchParams;

  const abonnement = await db.subscription.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
      cadence: true,
      cycleStart: true,
      cycleEnd: true,
      cancelledAt: true,
      createdAt: true,
      plan: { select: { name: true, priceMonthly: true } },
    },
  });

  // 404 et non « accès refusé » : dire qu'un abonnement existe mais n'est pas
  // le tien, c'est déjà en dire trop.
  if (!abonnement || abonnement.userId !== utilisateur.id) notFound();
  // Rien à payer pour un forfait gratuit : son cycle avance seul.
  if (abonnement.plan.priceMonthly === 0) redirect("/dashboard/forfait");

  const maintenant = new Date();
  const cadence = abonnement.cadence as Cadence;
  const joursDuCycle = JOURS_DE_CADENCE[cadence];

  const accesJusquA = ajouterJours(
    abonnement.cycleEnd,
    REGLAGES_PAR_DEFAUT.graceJours,
  );
  const repriseJusquA = ajouterJours(
    accesJusquA,
    REGLAGES_PAR_DEFAUT.repriseJours,
  );

  const etat = etatDe(
    {
      cycle: {
        debut: abonnement.cycleStart,
        echeance: abonnement.cycleEnd,
        accesJusquA,
        repriseJusquA,
      },
      resilieeLe: abonnement.cancelledAt,
    },
    maintenant,
  );

  const prix = formatMoney(abonnement.plan.priceMonthly, "XOF");
  const clos =
    abonnement.status === "CANCELLED" || etat === "EXPIREE" || etat === "RESILIEE";

  // Jours avant l'échéance. Négatif une fois qu'elle est passée.
  const avantEcheance = joursEntre(maintenant, abonnement.cycleEnd);
  const joursDAccesRestants = joursEntre(maintenant, accesJusquA);

  // Ce que le paiement d'aujourd'hui produirait. Calculé, jamais supposé : la
  // règle d'enchaînement change selon que l'accès est encore ouvert ou non, et
  // annoncer une mauvaise date sur l'écran de paiement serait le pire endroit.
  const prochain = cycleSuivant(
    {
      debut: abonnement.cycleStart,
      echeance: abonnement.cycleEnd,
      accesJusquA,
      repriseJusquA,
    },
    maintenant,
    cadence,
  );

  const anciennete = moisDepuis(abonnement.createdAt, maintenant);

  const allure: Allure = clos
    ? {
        kicker: "Abonnement clos",
        titre: "Cet abonnement est terminé",
        texte:
          "On n'y touche plus : pour retrouver l'accès, il faut en reprendre un neuf.",
        fond: GRIS,
        encre: ENCRE,
        glyphe: "✕",
        pastille: BLANC,
        jauge: 0,
        jaugeTexte: "clos définitivement",
        cta: "Prendre un nouvel abonnement",
        mort: true,
      }
    : avantEcheance > 0
      ? {
          kicker: "Ton accès court encore",
          titre: `Il te reste ${avantEcheance} jour${avantEcheance > 1 ? "s" : ""}`,
          texte: `Renouveler maintenant ajoute ${joursDuCycle} jours à la suite ${avantEcheance > 1 ? `des ${avantEcheance} qui restent` : "de celui qui reste"}. Tu ne perds aucun jour payé.`,
          fond: JAUNE,
          encre: ENCRE,
          glyphe: String(avantEcheance),
          pastille: BLANC,
          jauge: Math.min(100, Math.round((avantEcheance / joursDuCycle) * 100)),
          jaugeTexte: `${avantEcheance} jour${avantEcheance > 1 ? "s" : ""} sur ${joursDuCycle}`,
          cta: `Renouveler · ${prix}`,
          mort: false,
        }
      : {
          kicker: etat === "SUSPENDUE" ? "Accès suspendu" : "Échéance dépassée",
          titre:
            etat === "SUSPENDUE"
              ? "Ton accès est en pause"
              : "Ton échéance est passée",
          // ────────────────────────────────────────────────────────────────
          // DEUX SITUATIONS SOUS LA MÊME ALLURE
          //
          // La maquette dessine « accès suspendu ». Mais entre l'échéance et la
          // coupure vit la grâce : pendant ces jours-là, l'abonné a encore son
          // accès. Lui écrire « ton accès est en pause » serait faux, et le
          // ferait renoncer en croyant avoir déjà tout perdu.
          //
          // On garde donc l'allure de la maquette — orange, urgence — et l'on
          // dit la vérité sur ce qui reste.
          texte:
            etat === "SUSPENDUE"
              ? `L'accès est coupé faute de renouvellement. Un paiement le rétablit dans la minute, et ton ancienneté${anciennete ? ` de ${anciennete}` : ""} est conservée — tu ne repars pas de zéro.`
              : `L'échéance est passée. Ton accès continue encore ${joursDAccesRestants} jour${joursDAccesRestants > 1 ? "s" : ""}, le temps de renouveler.`,
          fond: ORANGE,
          encre: BLANC,
          glyphe: "!",
          pastille: JAUNE,
          jauge:
            etat === "SUSPENDUE"
              ? 0
              : Math.min(
                  100,
                  Math.round(
                    (joursDAccesRestants / REGLAGES_PAR_DEFAUT.graceJours) * 100,
                  ),
                ),
          jaugeTexte:
            etat === "SUSPENDUE"
              ? `0 jour restant · suspendu depuis ${Math.abs(joursEntre(accesJusquA, maintenant))} jour${Math.abs(joursEntre(accesJusquA, maintenant)) > 1 ? "s" : ""}`
              : `${joursDAccesRestants} jour${joursDAccesRestants > 1 ? "s" : ""} de grâce sur ${REGLAGES_PAR_DEFAUT.graceJours}`,
          cta: `Rétablir mon accès · ${prix}`,
          mort: false,
        };

  const faits: { k: string; v: string }[] = clos
    ? [
        { k: "Ancien forfait", v: `${abonnement.plan.name} · ${prix} / mois` },
        {
          k: "Clos le",
          v: abonnement.cancelledAt
            ? dateLongue(abonnement.cancelledAt)
            : dateLongue(repriseJusquA),
        },
        {
          k: "Ce que tu gardes",
          v: "tous tes achats et téléchargements, pour toujours",
        },
        {
          k: "Ce que tu perds",
          v: "le quota mensuel et les catalogues d'abonnement",
        },
      ]
    : avantEcheance > 0
      ? [
          { k: "Forfait", v: `${abonnement.plan.name} · ${prix} / mois` },
          { k: "Échéance actuelle", v: dateLongue(abonnement.cycleEnd) },
          {
            k: "Si tu renouvelles aujourd'hui",
            v: `nouvelle échéance : ${dateLongue(prochain.echeance)}`,
          },
          {
            k: "Ancienneté",
            v: anciennete ? `${anciennete} sans interruption` : "premier cycle",
          },
        ]
      : [
          { k: "Forfait", v: `${abonnement.plan.name} · ${prix} / mois` },
          {
            k: "Échéance dépassée",
            v: `${dateLongue(abonnement.cycleEnd)} · il y a ${Math.abs(avantEcheance)} jour${Math.abs(avantEcheance) > 1 ? "s" : ""}`,
          },
          {
            k: etat === "SUSPENDUE" ? "Rétablissement" : "Si tu renouvelles aujourd'hui",
            v:
              etat === "SUSPENDUE"
                ? "immédiat après confirmation de l'opérateur"
                : `nouvelle échéance : ${dateLongue(prochain.echeance)}`,
          },
          {
            k: "Ancienneté conservée",
            v: anciennete
              ? `${anciennete} · tes collections et achats sont intacts`
              : "tes collections et achats sont intacts",
          },
        ];

  const payable = !clos && renouvellementPossible();
  const operateur = piloteCourant().nom;
  const message =
    refus && refus in MESSAGES ? MESSAGES[refus as MotifRefus] : null;

  return (
    <main style={{ minHeight: "100vh", background: LAVANDE, padding: "36px 20px 60px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {message ? (
          <div
            style={{
              marginBottom: 20,
              padding: 14,
              border: CADRE,
              borderRadius: 16,
              background: ORANGE,
              color: BLANC,
              fontSize: 13.5,
              fontWeight: 700,
            }}
          >
            {message}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1.35fr) minmax(0,1fr)",
            gap: 24,
            alignItems: "start",
          }}
        >
          {/* ── Colonne de gauche : où j'en suis ─────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
            <div
              style={{
                border: `3px solid ${ENCRE}`,
                borderRadius: 28,
                overflow: "hidden",
                boxShadow: `8px 8px 0 ${ENCRE}`,
              }}
            >
              <div style={{ padding: "28px 26px", background: allure.fond, color: allure.encre }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 18 }}>
                  <div
                    style={{
                      width: 70,
                      height: 70,
                      flex: "0 0 auto",
                      border: `3px solid ${ENCRE}`,
                      borderRadius: 99,
                      background: allure.pastille,
                      color: ENCRE,
                      display: "grid",
                      placeItems: "center",
                      fontFamily: "var(--font-display)",
                      fontSize: 28,
                    }}
                  >
                    {allure.glyphe}
                  </div>
                  <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: ".14em",
                        opacity: 0.72,
                      }}
                    >
                      {allure.kicker}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "clamp(26px,3.4vw,40px)",
                        lineHeight: 1,
                        letterSpacing: "-1.7px",
                        marginTop: 8,
                        textTransform: "uppercase",
                      }}
                    >
                      {allure.titre}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 15.5,
                    fontWeight: 600,
                    lineHeight: 1.5,
                    marginTop: 16,
                    maxWidth: 620,
                    textWrap: "pretty",
                  }}
                >
                  {allure.texte}
                </div>

                <div style={{ marginTop: 20 }}>
                  <div
                    style={{
                      height: 20,
                      border: `3px solid ${ENCRE}`,
                      borderRadius: 999,
                      background: BLANC,
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ height: "100%", background: ENCRE, width: `${allure.jauge}%` }} />
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      marginTop: 8,
                      opacity: 0.8,
                    }}
                  >
                    {allure.jaugeTexte}
                  </div>
                </div>
              </div>

              <div style={{ padding: "22px 26px", background: BLANC }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {faits.map((f) => (
                    <div
                      key={f.k}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 12,
                        alignItems: "baseline",
                        paddingBottom: 10,
                        borderBottom: "2px solid rgba(18,18,18,.12)",
                      }}
                    >
                      <div
                        style={{
                          flex: "0 0 200px",
                          fontFamily: "var(--font-mono)",
                          fontSize: 10.5,
                          textTransform: "uppercase",
                          letterSpacing: ".08em",
                          opacity: 0.6,
                        }}
                      >
                        {f.k}
                      </div>
                      <div
                        style={{
                          flex: "1 1 180px",
                          minWidth: 0,
                          fontSize: 14,
                          fontWeight: 700,
                          lineHeight: 1.4,
                        }}
                      >
                        {f.v}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Promesse />

            {allure.mort ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 16,
                  padding: 22,
                  border: `3px solid ${ENCRE}`,
                  borderRadius: 24,
                  background: GRIS,
                  boxShadow: `7px 7px 0 ${ENCRE}`,
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    flex: "0 0 auto",
                    border: CADRE,
                    borderRadius: 99,
                    background: BLANC,
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "var(--font-display)",
                    fontSize: 19,
                  }}
                >
                  ✕
                </div>
                <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>
                    Aucun moyen de paiement à choisir
                  </div>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      lineHeight: 1.45,
                      marginTop: 5,
                      opacity: 0.78,
                      textWrap: "pretty",
                    }}
                  >
                    Un abonnement clos ne se renouvelle pas. Le sélecteur est
                    absent parce qu&apos;il n&apos;aurait rien à faire.
                  </div>
                </div>
                <Link
                  href="/dashboard/forfait"
                  className="sticker-press"
                  style={{
                    padding: "13px 20px",
                    border: CADRE,
                    borderRadius: 14,
                    background: ENCRE,
                    color: BLANC,
                    fontSize: 14,
                    fontWeight: 800,
                  }}
                >
                  {allure.cta}
                </Link>
              </div>
            ) : null}
          </div>

          {/* ── Colonne de droite : combien, et par où ───────────────────── */}
          {!allure.mort ? (
            <div style={{ position: "sticky", top: 88, minWidth: 0 }}>
              <div
                style={{
                  border: CADRE,
                  borderRadius: 26,
                  background: BLANC,
                  boxShadow: `7px 7px 0 ${ENCRE}`,
                  padding: 22,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    textTransform: "uppercase",
                    letterSpacing: ".12em",
                    opacity: 0.6,
                    marginBottom: 14,
                  }}
                >
                  Moyen de renouvellement
                </div>

                {payable ? (
                  <ChoixPaiement
                    action={renouvelerAbonnement.bind(null, abonnement.id)}
                    operateur={operateur}
                    prixFormate={prix}
                  />
                ) : (
                  <div
                    style={{
                      padding: 16,
                      border: CADRE,
                      borderRadius: 16,
                      background: JAUNE,
                    }}
                  >
                    <div style={{ fontSize: 13.5, fontWeight: 800 }}>
                      Le paiement n&apos;est pas disponible
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        lineHeight: 1.55,
                        marginTop: 6,
                        textWrap: "pretty",
                      }}
                    >
                      Aucun opérateur n&apos;est branché pour le moment.
                      Écris-nous et nous prolongeons ton accès à la main.
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
                <Petit href="/dashboard/forfait">Mon forfait</Petit>
                <Petit href="/dashboard">Tableau de bord</Petit>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

/**
 * La promesse, dessinée plutôt que mise en encart.
 *
 * La comparaison n'est pas une figure de style : la peur d'un abonnement, c'est
 * de ne plus savoir comment l'arrêter. Ici il n'y a rien à arrêter — on ne
 * renouvelle pas, et c'est fini.
 */
function Promesse() {
  return (
    <div
      style={{
        border: `3px solid ${ENCRE}`,
        borderRadius: 28,
        background: ENCRE,
        color: BLANC,
        boxShadow: `8px 8px 0 ${ORANGE}`,
        padding: "28px 26px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(24px,3.2vw,36px)",
          lineHeight: 1.02,
          letterSpacing: "-1.5px",
          textTransform: "uppercase",
          maxWidth: 520,
        }}
      >
        Rien n&apos;est prélevé sans ta validation
        <span style={{ color: JAUNE }}>.</span>
      </div>
      <div
        style={{
          fontSize: 15,
          fontWeight: 500,
          lineHeight: 1.55,
          marginTop: 14,
          maxWidth: 620,
          opacity: 0.88,
          textWrap: "pretty",
        }}
      >
        Ce n&apos;est pas une politesse commerciale. Le mobile money ne sait
        techniquement pas prélever : c&apos;est toi qui valides, chez ton
        opérateur, à chaque échéance. Personne chez Baobart ne peut déclencher un
        paiement à ta place.
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
          gap: 14,
          marginTop: 22,
        }}
      >
        <div style={{ border: `2.5px solid ${BLANC}`, borderRadius: 18, padding: 16 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              letterSpacing: ".1em",
              color: JAUNE,
            }}
          >
            ABONNEMENT À CARTE
          </div>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              lineHeight: 1.45,
              marginTop: 9,
              opacity: 0.85,
            }}
          >
            Le marchand garde tes coordonnées et débite tout seul. Pour arrêter,
            il faut trouver comment résilier.
          </div>
        </div>

        <div
          style={{
            border: `2.5px solid ${JAUNE}`,
            borderRadius: 18,
            background: "rgba(255,216,74,.12)",
            padding: 16,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              letterSpacing: ".1em",
              color: JAUNE,
            }}
          >
            ABONNEMENT BAOBART
          </div>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              lineHeight: 1.45,
              marginTop: 9,
              opacity: 0.95,
            }}
          >
            Rien n&apos;est stocké, rien ne part sans toi. Pour arrêter : tu ne
            renouvelles pas. C&apos;est tout.
          </div>
        </div>
      </div>
    </div>
  );
}

function Petit({ href, children }: { href: Route; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        padding: "11px 16px",
        border: CADRE,
        borderRadius: 14,
        background: BLANC,
        fontSize: 13.5,
        fontWeight: 800,
      }}
    >
      {children}
    </Link>
  );
}

/** « 8 septembre 2026 » — un abonné lit une date, il ne déchiffre pas une ISO. */
function dateLongue(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * L'ancienneté, en mois pleins.
 *
 * Rendue vide sous un mois : « 0 mois sans interruption » sonne comme un
 * reproche, et l'argument d'ancienneté n'a rien à dire à quelqu'un qui vient
 * d'arriver.
 */
function moisDepuis(debut: Date, maintenant: Date): string | null {
  const mois = Math.floor(
    (maintenant.getTime() - debut.getTime()) / (30 * 86_400_000),
  );
  if (mois < 1) return null;
  return `${mois} mois`;
}
