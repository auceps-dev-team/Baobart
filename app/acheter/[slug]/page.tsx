import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ChoixPaiement } from "@/components/checkout/choix-paiement";
import { acheterRessource } from "@/lib/checkout/actions";
import { apercuDuCode } from "@/lib/commerce/actions-promo";
import { champsDe } from "@/lib/commerce/champs";
import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/i18n/money";
import { piloteCourant } from "@/lib/payments/encaissement/pilotes";
import { droitDeTelecharger } from "@/lib/products/queries";
import { BLANC, CADRE, ENCRE, LAVANDE, ORANGE } from "@/lib/systeme/charte";

export const metadata = { title: "Comment veux-tu payer ? — Baobart." };

/**
 * L'étape entre la fiche et l'opérateur.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI UN ÉCRAN À PART
 *
 * Le rail — Orange Money, Wave, MTN, Moov — doit être choisi **avant** que la
 * commande soit ouverte : c'est lui qui décide de l'invite que l'acheteur
 * recevra. Le demander après aurait obligé à rouvrir un paiement déjà ouvert.
 *
 * Rien n'est débité ici, et rien n'est même inscrit : la commande naît au clic
 * sur « Payer », dans l'action, une fois le rail connu.
 *
 * Traduit de « Baobart Parcours Achat.dc.html », écran `pay`.
 */
export const dynamic = "force-dynamic";

export default async function ChoisirLePaiementPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const { slug } = await params;

  const produit = await db.product.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      currency: true,
      seller: { select: { profile: { select: { displayName: true } } } },
    },
  });

  if (!produit) notFound();

  // La même question que sur la fiche, posée au même endroit du code : le
  // bouton n'apparaît que si l'achat peut aboutir. Arriver ici par l'URL ne
  // doit pas contourner ce que la fiche a refusé d'afficher.
  const droit = await droitDeTelecharger(produit.id, utilisateur.id);
  if (droit.etat !== "A_ACHETER" || !droit.achatPossible) {
    redirect(`/products/${produit.slug}`);
  }

  const operateur = piloteCourant().nom;
  const prix = formatMoney(produit.price, produit.currency);
  const vendeur = produit.seller.profile?.displayName ?? "un créateur";

  return (
    <main style={{ minHeight: "100vh", background: LAVANDE, padding: "48px 20px" }}>
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
        {/* ── Le choix ──────────────────────────────────────────────────── */}
        <div
          style={{
            border: CADRE,
            borderRadius: 22,
            background: BLANC,
            boxShadow: `6px 6px 0 ${ENCRE}`,
            padding: 26,
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
            Étape 1 sur 2
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
            Comment veux-tu payer ?
          </h1>
          <p
            style={{
              fontSize: 14.5,
              fontWeight: 600,
              lineHeight: 1.6,
              margin: "12px 0 24px",
              textWrap: "pretty",
            }}
          >
            On te redirige ensuite vers ton opérateur pour valider. Le montant
            n&apos;est débité qu&apos;après ta confirmation chez lui.
          </p>

          <ChoixPaiement
            action={acheterRessource.bind(null, produit.id)}
            operateur={operateur}
            prixFormate={prix}
            produitId={produit.id}
            apercu={apercuDuCode}
            champs={await champsDe(produit.id)}
          />
        </div>

        {/* ── Ce qu'on achète ───────────────────────────────────────────── */}
        <div
          style={{
            border: CADRE,
            borderRadius: 22,
            background: BLANC,
            boxShadow: `6px 6px 0 ${ENCRE}`,
            padding: 24,
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 800 }}>{produit.name}</div>
          <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.75, marginTop: 4 }}>
            {vendeur}
          </div>

          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 600 }}>
              <span style={{ opacity: 0.75 }}>Prix</span>
              <span>{prix}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, fontWeight: 600 }}>
              <span style={{ opacity: 0.75 }}>Frais opérateur</span>
              {/*
                Zéro, et ce n'est pas un espace réservé : les frais de
                l'opérateur sont déduits de la part du vendeur, jamais ajoutés
                au prix affiché. L'acheteur paie ce qu'il voit.
              */}
              <span>{formatMoney(0, produit.currency)}</span>
            </div>
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
            <div style={{ fontSize: 13, fontWeight: 800 }}>Total</div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 24,
                letterSpacing: "-.4px",
              }}
            >
              {prix}
            </div>
          </div>

          <Link
            href={`/products/${produit.slug}`}
            style={{
              display: "block",
              textAlign: "center",
              marginTop: 20,
              padding: "11px 16px",
              border: CADRE,
              borderRadius: 14,
              background: BLANC,
              fontSize: 13.5,
              fontWeight: 800,
            }}
          >
            Revenir à la fiche
          </Link>

          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              opacity: 0.7,
              marginTop: 14,
              textAlign: "center",
              textWrap: "pretty",
            }}
          >
            Paiement traité par{" "}
            <span style={{ color: ORANGE, fontWeight: 800 }}>{operateur}</span>.
          </div>
        </div>
      </div>
    </main>
  );
}
