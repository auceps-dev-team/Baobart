import Link from "next/link";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";

import { BacASable } from "@/components/checkout/bac-a-sable";
import { declencherRappel } from "@/lib/payments/encaissement/bac-a-sable";
import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { offreApresAchat } from "@/lib/commerce/upsell";
import { formatMoney } from "@/lib/i18n/money";
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

export const metadata = { title: "Ton paiement — Baobart." };

/**
 * Où l'acheteur atterrit en revenant de chez l'opérateur.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CETTE PAGE NE DÉCIDE DE RIEN
 *
 * L'acheteur y arrive parce que l'opérateur l'a renvoyé — pas parce qu'il a
 * payé. Les deux se ressemblent et n'ont rien à voir : on revient aussi ici en
 * ayant annulé, en ayant tapé un mauvais code, ou en ayant simplement fermé la
 * page de l'opérateur. Elle se contente donc de **lire** l'état que le rappel a
 * écrit, et dit franchement « on attend » quand il n'est pas encore arrivé.
 *
 * Afficher « merci pour ton achat » sur la foi du retour navigateur donnerait
 * un accès gratuit à quiconque devine l'URL.
 *
 * Traduit de « Baobart Parcours Achat.dc.html », écran `return`.
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
  IN_PROGRESS: {
    glyphe: "⏳",
    fond: JAUNE,
    kicker: "Paiement en cours",
    titre: "On attend la confirmation",
    texte:
      "Ton opérateur ne nous a pas encore répondu. C'est normal : il lui faut parfois une minute ou deux, et il arrive qu'il prenne plus longtemps après un incident chez lui.",
  },
  SUCCESSFUL: {
    glyphe: "✓",
    fond: VERT,
    kicker: "Paiement confirmé",
    titre: "C'est payé",
    texte:
      "Ton paiement est confirmé et la ressource est dans ton espace. Un reçu part vers ton adresse.",
  },
  NOT_CHARGED: {
    glyphe: "✓",
    fond: VERT,
    kicker: "Ressource gratuite",
    titre: "C'est à toi",
    texte: "Rien n'a été encaissé, et la ressource est dans ton espace.",
  },
  FAILED: {
    glyphe: "✕",
    fond: ORANGE,
    kicker: "Paiement refusé",
    titre: "Le paiement n'est pas passé",
    texte:
      "Ton opérateur a refusé la transaction, ou tu l'as interrompue. Tu peux réessayer depuis la fiche.",
  },
};

function Carte({ children, fond = BLANC }: { children: React.ReactNode; fond?: string }) {
  return (
    <div
      style={{
        border: CADRE,
        borderRadius: 22,
        background: fond,
        boxShadow: `6px 6px 0 ${ENCRE}`,
        padding: 24,
      }}
    >
      {children}
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

export default async function RetourPaiementPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const { orderId } = await params;

  const commande = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      buyerId: true,
      total: true,
      currency: true,
      items: {
        select: {
          state: true,
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              seller: { select: { profile: { select: { displayName: true } } } },
            },
          },
        },
      },
    },
  });

  // 404 et non « accès refusé » : dire qu'une commande existe mais n'est pas la
  // tienne, c'est déjà en dire trop.
  if (!commande || commande.buyerId !== utilisateur.id) notFound();

  const ligne = commande.items[0];
  if (!ligne) notFound();

  const etat = ETATS[ligne.state] ?? ETATS.IN_PROGRESS!;
  const enAttente = ligne.state === "IN_PROGRESS";
  const echoue = ligne.state === "FAILED";
  const abouti = ligne.state === "SUCCESSFUL" || ligne.state === "NOT_CHARGED";

  // ══════════════════════════════════════════════════════════════════════════
  // L'OFFRE N'EST CHERCHÉE QUE SI L'ACHAT A ABOUTI
  //
  // Sur une commande en attente ou échouée, proposer autre chose serait
  // doublement maladroit : on n'a pas encore livré ce qui est payé, et l'on
  // demanderait déjà de repayer.
  //
  // C'est aussi une lecture de moins sur la page que l'acheteur recharge en
  // boucle pendant qu'il attend le rappel de l'opérateur.
  const offre = abouti
    ? await offreApresAchat({
        produitAchete: ligne.product.id,
        acheteurId: utilisateur.id,
      })
    : null;

  const vendeur = ligne.product.seller.profile?.displayName ?? "un créateur";
  const bac = piloteCourant().nom === "bac-a-sable";

  return (
    <main style={{ minHeight: "100vh", background: LAVANDE, padding: "48px 20px" }}>
      {/*
        Rafraîchissement pendant l'attente. Une page qui dit « on attend » sans
        jamais changer d'avis pousse à recharger, puis à repayer.
      */}
      {enAttente ? <meta httpEquiv="refresh" content="8" /> : null}

      <div
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 1fr)",
          gap: 22,
          alignItems: "start",
        }}
      >
        {/* ── L'état ────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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
                    fontSize: 30,
                    lineHeight: 1.1,
                    letterSpacing: "-.7px",
                    textTransform: "uppercase",
                    margin: "6px 0 0",
                  }}
                >
                  {etat.titre}
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
                  {etat.texte}
                </p>
              </div>
            </div>
          </Carte>

          {/*
            Le bandeau d'attente. Il ne décore pas : il dit explicitement de ne
            pas repayer. C'est la seule erreur coûteuse qu'un acheteur puisse
            commettre sur cette page.
          */}
          {enAttente ? (
            <div
              style={{
                display: "flex",
                gap: 14,
                alignItems: "center",
                border: CADRE,
                borderRadius: 18,
                background: BLANC,
                padding: 16,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800 }}>
                  Cette page se met à jour toute seule
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    lineHeight: 1.5,
                    opacity: 0.8,
                    marginTop: 5,
                    textWrap: "pretty",
                  }}
                >
                  Ne recharge pas et ne repaie pas : ton opérateur a bien reçu
                  la demande.
                </div>
              </div>
              <div
                style={{
                  flex: "0 0 auto",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "7px 11px",
                  border: CADRE,
                  borderRadius: 999,
                  background: JAUNE,
                }}
              >
                AUTO · 8 s
              </div>
            </div>
          ) : null}

          {/*
            Le rappel qui compte le plus quand un paiement échoue : personne
            n'a été débité. Sans lui, l'acheteur va vérifier son solde, doute,
            et écrit au support.
          */}
          {echoue ? (
            <div
              style={{
                border: CADRE,
                borderRadius: 18,
                background: BLANC,
                padding: 16,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 26,
                  letterSpacing: "-.5px",
                }}
              >
                0 F
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  lineHeight: 1.5,
                  marginTop: 6,
                  textWrap: "pretty",
                }}
              >
                Rien ne t&apos;a été débité. Vérifie ton solde si tu as un
                doute — aucune écriture n&apos;est partie.
              </div>
            </div>
          ) : null}

          {bac && enAttente ? (
            <BacASable jouerRappel={declencherRappel.bind(null, commande.id)} />
          ) : null}
        </div>

        {/* ── La commande ───────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Carte>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".8px",
                textTransform: "uppercase",
                opacity: 0.65,
              }}
            >
              Ta commande
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, marginTop: 8 }}>
              {ligne.product.name}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.75, marginTop: 4 }}>
              {vendeur}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginTop: 18,
                paddingTop: 14,
                borderTop: CADRE,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.75 }}>
                Montant
              </span>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 22,
                  letterSpacing: "-.4px",
                }}
              >
                {formatMoney(commande.total, commande.currency)}
              </span>
            </div>
          </Carte>

          <div
            style={{
              border: CADRE,
              borderRadius: 18,
              background: JAUNE,
              padding: 16,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: ".5px",
              }}
            >
              Référence de commande
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 16,
                fontWeight: 700,
                marginTop: 6,
                wordBreak: "break-all",
              }}
            >
              {commande.id.slice(-12).toUpperCase()}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.75, marginTop: 8 }}>
              à citer en cas de question au support
            </div>
          </div>

          {offre ? (
            <div
              style={{
                marginTop: 4,
                marginBottom: 20,
                padding: 18,
                border: CADRE,
                borderRadius: 18,
                background: LAVANDE,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: ".12em",
                  opacity: 0.6,
                }}
              >
                {vendeur} propose aussi
              </div>

              <div style={{ fontSize: 17, fontWeight: 800, marginTop: 8 }}>
                {offre.nom}
              </div>

              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>
                {offre.remisePourcent === null ? (
                  formatMoney(offre.prix, offre.devise as Parameters<typeof formatMoney>[1])
                ) : (
                  <>
                    <span style={{ textDecoration: "line-through", opacity: 0.55 }}>
                      {formatMoney(offre.prix, offre.devise as Parameters<typeof formatMoney>[1])}
                    </span>{" "}
                    <span style={{ color: ORANGE }}>
                      {formatMoney(offre.prixFinal, offre.devise as Parameters<typeof formatMoney>[1])}
                    </span>{" "}
                    <span style={{ fontSize: 12.5, opacity: 0.75 }}>
                      {`(−${offre.remisePourcent} %)`}
                    </span>
                  </>
                )}
              </div>

              <div style={{ marginTop: 14 }}>
                <Bouton href={`/products/${offre.slug}` as Route}>
                  Voir la ressource
                </Bouton>
              </div>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {abouti ? (
              <Bouton href="/dashboard/telechargements" principale>
                Télécharger maintenant
              </Bouton>
            ) : null}
            {echoue ? (
              <Bouton href={`/products/${ligne.product.slug}` as Route} principale>
                Réessayer le paiement
              </Bouton>
            ) : null}
            <Bouton href="/dashboard/achats">Mes achats</Bouton>
            <Bouton href={`/products/${ligne.product.slug}` as Route}>
              Revenir à la fiche
            </Bouton>
          </div>
        </div>
      </div>
    </main>
  );
}
