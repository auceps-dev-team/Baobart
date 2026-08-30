import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BacASable } from "@/components/checkout/bac-a-sable";
import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/i18n/money";
import { piloteCourant } from "@/lib/payments/encaissement/pilotes";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE, VERT } from "@/lib/systeme/charte";

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
 * page de l'opérateur. Elle se contente donc de **lire** l'état que le rappel
 * a écrit, et dit franchement « on attend » quand il n'est pas encore arrivé.
 *
 * Afficher « merci pour ton achat » sur la foi du retour navigateur donnerait
 * un accès gratuit à quiconque devine l'URL.
 */
export const dynamic = "force-dynamic";

const ETATS = {
  IN_PROGRESS: {
    titre: "On attend la confirmation",
    fond: JAUNE,
    texte:
      "Ton opérateur ne nous a pas encore répondu. C'est normal : il lui faut parfois une minute ou deux. Cette page se met à jour toute seule — tu peux aussi la recharger.",
  },
  SUCCESSFUL: {
    titre: "C'est payé",
    fond: VERT,
    texte:
      "Ton paiement est confirmé et la ressource est dans ton espace. Un reçu part vers ton adresse.",
  },
  NOT_CHARGED: {
    titre: "C'est à toi",
    fond: VERT,
    texte: "Rien n'a été encaissé, et la ressource est dans ton espace.",
  },
  FAILED: {
    titre: "Le paiement n'est pas passé",
    fond: ORANGE,
    texte:
      "Ton opérateur a refusé la transaction, ou tu l'as interrompue. Rien ne t'a été débité. Tu peux réessayer depuis la fiche.",
  },
} as const;

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
          product: { select: { name: true, slug: true } },
        },
      },
    },
  });

  // 404 et non « accès refusé » : dire qu'une commande existe mais n'est pas la
  // tienne, c'est déjà en dire trop.
  if (!commande || commande.buyerId !== utilisateur.id) notFound();

  const ligne = commande.items[0];
  if (!ligne) notFound();

  const etat = ETATS[ligne.state as keyof typeof ETATS] ?? ETATS.IN_PROGRESS;
  const enAttente = ligne.state === "IN_PROGRESS";

  // Le bac à sable n'est offert que s'il est vraiment le pilote actif — ce qui
  // exige son secret. La garde qui compte reste dans l'action serveur.
  const bac = piloteCourant().nom === "bac-a-sable";

  return (
    <main
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "56px 20px 80px",
      }}
    >
      {/*
        Rafraîchissement discret pendant l'attente. Une page qui dit « on
        attend » sans jamais changer d'avis pousse à recharger à la main, puis à
        repayer.
      */}
      {enAttente ? <meta httpEquiv="refresh" content="8" /> : null}

      <div
        style={{
          border: CADRE,
          borderRadius: 24,
          background: etat.fond,
          boxShadow: `8px 8px 0 ${ENCRE}`,
          padding: 28,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 30,
            textTransform: "uppercase",
            letterSpacing: "-.7px",
            lineHeight: 1.1,
          }}
        >
          {etat.titre}
        </div>

        <p
          style={{
            fontSize: 15,
            fontWeight: 600,
            lineHeight: 1.6,
            margin: "16px 0 0",
            textWrap: "pretty",
          }}
        >
          {etat.texte}
        </p>

        <div
          style={{
            marginTop: 22,
            paddingTop: 18,
            borderTop: CADRE,
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {ligne.product.name} · {formatMoney(commande.total, commande.currency)}
          <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.7, marginTop: 6 }}>
            Référence {commande.id.slice(-12).toUpperCase()}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, marginTop: 24, flexWrap: "wrap" }}>
        <Link
          href="/dashboard/telechargements"
          style={{
            padding: "12px 18px",
            border: CADRE,
            borderRadius: 14,
            background: BLANC,
            fontWeight: 800,
            fontSize: 14,
          }}
        >
          Mes achats
        </Link>
        <Link
          href={`/products/${ligne.product.slug}`}
          style={{
            padding: "12px 18px",
            border: CADRE,
            borderRadius: 14,
            background: BLANC,
            fontWeight: 800,
            fontSize: 14,
          }}
        >
          Revenir à la fiche
        </Link>
      </div>

      {bac && enAttente ? <BacASable orderId={commande.id} /> : null}
    </main>
  );
}
