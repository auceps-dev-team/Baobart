import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ChoixPaiement } from "@/components/checkout/choix-paiement";
import { renouvelerAbonnement } from "@/lib/abonnements/actions";
import {
  MESSAGES,
  renouvellementPossible,
  type MotifRefus,
} from "@/lib/abonnements/renouvellement";
import { sessionCourante } from "@/lib/auth/session";
import { piloteCourant } from "@/lib/payments/encaissement/pilotes";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/i18n/money";
import { REGLAGES_PAR_DEFAUT, ajouterJours } from "@/lib/ndank/cycle";
import { etatDe } from "@/lib/ndank/etats";
import {
  BLANC,
  CADRE,
  ENCRE,
  JAUNE,
  LAVANDE,
  ORANGE,
  VERT,
} from "@/lib/systeme/charte";

export const metadata = { title: "Renouveler ton abonnement — Baobart." };

/**
 * Où mène le lien d'une relance Ndank.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IL DOIT EXISTER AVANT QUE LES RELANCES PARTENT
 *
 * Un rappel qui ouvre sur une page absente est pire que pas de rappel : on a
 * dérangé quelqu'un pour rien, et on lui a fait croire que le service est cassé
 * au moment précis où on lui demande de payer.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IL DIT CE QUI VA SE PASSER, ET CE QUI NE SE PASSERA PAS
 *
 * La phrase qui compte est « rien n'est prélevé sans ta validation ». Elle est
 * vraie — le mobile money ne sait pas prélever — et c'est précisément ce qui
 * distingue un abonnement Ndank d'un abonnement à carte dont on a peur.
 */
export const dynamic = "force-dynamic";

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
      cycleStart: true,
      cycleEnd: true,
      cancelledAt: true,
      status: true,
      plan: { select: { name: true, priceMonthly: true } },
    },
  });

  // 404 et non « accès refusé » : dire qu'un abonnement existe mais n'est pas
  // le tien, c'est déjà en dire trop.
  if (!abonnement || abonnement.userId !== utilisateur.id) notFound();

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
    new Date(),
  );

  const jours = Math.round(
    (accesJusquA.getTime() - Date.now()) / 86_400_000,
  );
  const prix = formatMoney(abonnement.plan.priceMonthly, "XOF");

  const coupe = etat === "SUSPENDUE" || etat === "EXPIREE";
  const clos = etat === "EXPIREE" || etat === "RESILIEE";

  // Le bouton n'existe que là où l'action aboutirait. Un bouton qui apparaît
  // là où le paiement refuse promet un écran qui n'ouvre sur rien — au moment
  // précis où quelqu'un cherche à ne pas perdre son accès.
  const payable =
    abonnement.status !== "CANCELLED" && renouvellementPossible();
  const operateur = piloteCourant().nom;
  const message = refus && refus in MESSAGES ? MESSAGES[refus as MotifRefus] : null;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: LAVANDE,
        display: "grid",
        placeItems: "center",
        padding: "48px 20px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 620 }}>
        <div
          style={{
            border: CADRE,
            borderRadius: 24,
            background: BLANC,
            boxShadow: `8px 8px 0 ${ENCRE}`,
            padding: 30,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".8px",
              textTransform: "uppercase",
              opacity: 0.65,
            }}
          >
            {clos ? "Abonnement clos" : coupe ? "Accès suspendu" : "Renouvellement"}
          </div>

          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 30,
              lineHeight: 1.1,
              letterSpacing: "-.7px",
              textTransform: "uppercase",
              margin: "8px 0 0",
            }}
          >
            {abonnement.plan.name}
          </h1>

          <p
            style={{
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1.6,
              margin: "14px 0 0",
              textWrap: "pretty",
            }}
          >
            {clos
              ? "Cet abonnement est clos. Tu peux en reprendre un nouveau quand tu veux — il repartira de zéro."
              : coupe
                ? "Ton accès est suspendu. Un renouvellement le rétablit immédiatement, et ton ancienneté est conservée."
                : `Il te reste ${jours} jour${jours > 1 ? "s" : ""} d'accès. Renouvelle pour ne pas être interrompu.`}
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginTop: 24,
              paddingTop: 18,
              borderTop: CADRE,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 800, opacity: 0.75 }}>
              À payer
            </span>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 26,
                letterSpacing: "-.5px",
              }}
            >
              {prix}
            </span>
          </div>

          {/*
            La promesse qui distingue Ndank d'un abonnement à carte. Elle n'est
            pas rassurante par politesse : elle est mécaniquement vraie, parce
            que le mobile money ne sait pas prélever.
          */}
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              marginTop: 22,
              padding: 16,
              border: CADRE,
              borderRadius: 16,
              background: coupe ? ORANGE : VERT,
              color: coupe ? BLANC : ENCRE,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>✓</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.55 }}>
              Rien n&apos;est prélevé sans ta validation. Tu confirmes le
              paiement sur ton téléphone, à chaque fois — il n&apos;y a aucun
              prélèvement automatique.
            </div>
          </div>

          {/*
            Le refus, quand l'action vient d'en renvoyer un.

            Il passe par l'URL et non par un état de formulaire : cette page est
            servie, et un aller-retour la relit entièrement — l'état de
            l'abonnement compris, qui vient peut-être de changer.
          */}
          {message ? (
            <div
              style={{
                marginTop: 20,
                padding: 14,
                border: CADRE,
                borderRadius: 16,
                background: ORANGE,
                color: BLANC,
                fontSize: 13.5,
                fontWeight: 700,
                lineHeight: 1.5,
              }}
            >
              {message}
            </div>
          ) : null}

          {payable ? (
            <div style={{ marginTop: 24, paddingTop: 22, borderTop: CADRE }}>
              <ChoixPaiement
                action={renouvelerAbonnement.bind(null, abonnement.id)}
                operateur={operateur}
                prixFormate={prix}
              />
            </div>
          ) : (
            <div
              style={{
                marginTop: 22,
                padding: 16,
                border: CADRE,
                borderRadius: 16,
                background: JAUNE,
              }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 800 }}>
                {clos
                  ? "Cet abonnement est clos"
                  : "Le paiement n’est pas disponible"}
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
                {clos
                  ? "Il ne se renouvelle plus. Tu peux en reprendre un neuf quand tu veux."
                  : "Aucun opérateur n’est branché pour le moment. Écris-nous et nous prolongeons ton accès à la main."}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
            <Link
              href="/dashboard/abonnements"
              className="sticker-press"
              style={{
                padding: "12px 18px",
                border: CADRE,
                borderRadius: 14,
                background: ENCRE,
                color: BLANC,
                fontSize: 14,
                fontWeight: 800,
                boxShadow: `4px 4px 0 ${ORANGE}`,
              }}
            >
              Mes abonnements
            </Link>
            <Link
              href="/dashboard"
              style={{
                padding: "12px 18px",
                border: CADRE,
                borderRadius: 14,
                background: BLANC,
                fontSize: 14,
                fontWeight: 800,
              }}
            >
              Tableau de bord
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
