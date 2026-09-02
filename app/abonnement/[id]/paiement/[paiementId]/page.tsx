import Link from "next/link";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";

import { BacASable } from "@/components/checkout/bac-a-sable";
import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMoney, type Currency } from "@/lib/i18n/money";
import { declencherRappelAbonnement } from "@/lib/payments/encaissement/bac-a-sable";
import { piloteCourant } from "@/lib/payments/encaissement/pilotes";
import {
  BLANC,
  CADRE,
  ENCRE,
  JAUNE,
  LAVANDE,
  ORANGE,
  VERT,
} from "@/lib/systeme/charte";

export const metadata = { title: "Ton renouvellement — Baobart." };

/**
 * Où l'abonné atterrit en revenant de chez l'opérateur.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CETTE PAGE NE DÉCIDE DE RIEN
 *
 * On y arrive parce que l'opérateur a renvoyé l'abonné — pas parce qu'il a
 * payé. Les deux se ressemblent et n'ont rien à voir : on revient aussi ici en
 * ayant annulé, en ayant tapé un mauvais code, ou en ayant simplement fermé la
 * page. Elle **lit** donc l'état que le rappel a écrit, et dit franchement « on
 * attend » quand il n'est pas encore arrivé.
 *
 * Prolonger un accès sur la foi du retour navigateur donnerait un mois gratuit
 * à quiconque devine l'URL.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ELLE DIT LA PROCHAINE ÉCHÉANCE, PAS SEULEMENT « C'EST PAYÉ »
 *
 * Quelqu'un qui vient de payer veut savoir jusqu'à quand il est tranquille.
 * C'est la seule information qui évite de revenir vérifier chaque semaine.
 */
export const dynamic = "force-dynamic";

interface Etat {
  glyphe: string;
  fond: string;
  kicker: string;
  titre: string;
  texte: string;
}

const ETATS: Record<string, Etat> = {
  PENDING: {
    glyphe: "⏳",
    fond: JAUNE,
    kicker: "Paiement en cours",
    titre: "On attend la confirmation",
    texte:
      "Ton opérateur ne nous a pas encore répondu. C'est normal : il lui faut parfois une minute ou deux, et il arrive qu'il prenne plus longtemps après un incident chez lui. Ton accès n'est pas interrompu pendant ce temps.",
  },
  PAID: {
    glyphe: "✓",
    fond: VERT,
    kicker: "Paiement confirmé",
    titre: "C'est renouvelé",
    texte:
      "Ton paiement est confirmé et ton accès continue. Un reçu part vers ton adresse.",
  },
  FAILED: {
    glyphe: "✕",
    fond: ORANGE,
    kicker: "Paiement refusé",
    titre: "Le paiement n'est pas passé",
    texte:
      "Ton opérateur a refusé la transaction, ou tu l'as interrompue. Rien n'a été débité, et tu peux réessayer.",
  },
};

export default async function RetourRenouvellementPage({
  params,
}: {
  params: Promise<{ id: string; paiementId: string }>;
}) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const { id, paiementId } = await params;

  const paiement = await db.subscriptionPayment.findUnique({
    where: { id: paiementId },
    select: {
      id: true,
      status: true,
      amount: true,
      currency: true,
      subscription: {
        select: {
          id: true,
          userId: true,
          cycleEnd: true,
          plan: { select: { name: true } },
        },
      },
    },
  });

  // 404 et non « accès refusé » : dire qu'un paiement existe mais n'est pas le
  // tien, c'est déjà en dire trop. Le paiement doit aussi appartenir à
  // l'abonnement de l'URL — sans quoi une paire mal assortie afficherait l'état
  // d'un paiement sous le nom d'un autre abonnement.
  if (
    !paiement ||
    paiement.subscription.userId !== utilisateur.id ||
    paiement.subscription.id !== id
  ) {
    notFound();
  }

  const etat = ETATS[paiement.status] ?? ETATS.PENDING!;
  const enAttente = paiement.status === "PENDING";
  const echoue = paiement.status === "FAILED";
  const paye = paiement.status === "PAID";

  const montant = formatMoney(paiement.amount, paiement.currency as Currency);
  const prochaine = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(paiement.subscription.cycleEnd);

  const bac = piloteCourant().nom === "bac-a-sable";

  return (
    <main style={{ minHeight: "100vh", background: LAVANDE, padding: "48px 20px" }}>
      {/*
        Rafraîchissement pendant l'attente. Une page qui dit « on attend » sans
        jamais changer d'avis pousse à recharger, puis à repayer.
      */}
      {enAttente ? <meta httpEquiv="refresh" content="8" /> : null}

      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <Carte>
          <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
            <div
              style={{
                width: 54,
                height: 54,
                flex: "0 0 auto",
                border: CADRE,
                borderRadius: 99,
                background: etat.fond,
                display: "grid",
                placeItems: "center",
                fontSize: 22,
                fontWeight: 800,
              }}
            >
              {etat.glyphe}
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: ".8px",
                  textTransform: "uppercase",
                  opacity: 0.65,
                }}
              >
                {etat.kicker}
              </div>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 27,
                  lineHeight: 1.1,
                  letterSpacing: "-.6px",
                  textTransform: "uppercase",
                  margin: "6px 0 0",
                }}
              >
                {etat.titre}
              </h1>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1.6,
                  margin: "12px 0 0",
                  textWrap: "pretty",
                }}
              >
                {etat.texte}
              </p>
            </div>
          </div>

          <div
            style={{
              marginTop: 24,
              paddingTop: 18,
              borderTop: CADRE,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <Ligne titre="Offre" valeur={paiement.subscription.plan.name} />
            <Ligne titre="Montant" valeur={montant} />
            {/*
              La prochaine échéance n'a de sens QUE si le paiement est passé.
              L'afficher pendant l'attente montrerait l'ancienne date, et
              laisserait croire que le renouvellement n'a rien changé.
            */}
            {paye ? <Ligne titre="Prochaine échéance" valeur={prochaine} /> : null}
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
            {echoue ? (
              <Bouton
                href={`/abonnement/${paiement.subscription.id}/renouveler` as Route}
                principale
              >
                Réessayer
              </Bouton>
            ) : null}
            <Bouton href="/dashboard/abonnements" principale={!echoue}>
              Mes abonnements
            </Bouton>
            <Bouton href="/dashboard">Tableau de bord</Bouton>
          </div>
        </Carte>

        {bac && enAttente ? (
          <BacASable
            jouerRappel={declencherRappelAbonnement.bind(null, paiement.id)}
          />
        ) : null}
      </div>
    </main>
  );
}

function Carte({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: CADRE,
        borderRadius: 22,
        background: BLANC,
        boxShadow: `6px 6px 0 ${ENCRE}`,
        padding: 24,
      }}
    >
      {children}
    </div>
  );
}

function Ligne({ titre, valeur }: { titre: string; valeur: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        fontSize: 13.5,
        fontWeight: 600,
      }}
    >
      <span style={{ opacity: 0.75 }}>{titre}</span>
      <span style={{ fontWeight: 800, textAlign: "right" }}>{valeur}</span>
    </div>
  );
}

function Bouton({
  href,
  children,
  principale,
}: {
  href: Route;
  children: React.ReactNode;
  principale?: boolean;
}) {
  return (
    <Link
      href={href}
      className="sticker-press"
      style={{
        padding: "12px 18px",
        border: CADRE,
        borderRadius: 14,
        background: principale ? ENCRE : BLANC,
        color: principale ? BLANC : ENCRE,
        fontSize: 14,
        fontWeight: 800,
        boxShadow: principale ? `4px 4px 0 ${ORANGE}` : undefined,
      }}
    >
      {children}
    </Link>
  );
}
