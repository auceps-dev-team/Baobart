import Link from "next/link";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";

import { BacASable } from "@/components/checkout/bac-a-sable";
import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatMoney, type Currency } from "@/lib/i18n/money";
import { REGLAGES_PAR_DEFAUT, ajouterJours, joursEntre } from "@/lib/ndank/cycle";
import { PALIERS } from "@/lib/ndank/etats";
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
 * ════════════════════════════════════════════════════════════════════════════
 * CETTE PAGE NE DÉCIDE DE RIEN
 *
 * On y arrive parce que l'opérateur a renvoyé l'abonné — pas parce qu'il a
 * payé. Les deux se ressemblent et n'ont rien à voir : on revient aussi ici en
 * ayant annulé, en ayant tapé un mauvais code, ou en ayant fermé la page. Elle
 * **lit** donc l'état que le rappel a écrit.
 *
 * Prolonger un accès sur la foi du retour navigateur donnerait un mois gratuit
 * à quiconque devine l'URL.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'INFORMATION PRINCIPALE EST LA DATE, PAS LE STATUT
 *
 * « C'est payé » ne dit pas ce que la personne est venue chercher. Ce qu'elle
 * veut savoir, c'est **jusqu'à quand elle est tranquille** — la seule chose qui
 * évite de revenir vérifier chaque semaine. La maquette lui donne donc le plus
 * gros bloc de l'écran.
 *
 * Traduit de « Baobart Parcours Achat.dc.html », écran `renewret`.
 */
export const dynamic = "force-dynamic";

export default async function RetourRenouvellementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; paiementId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const { id, paiementId } = await params;
  const { t } = await searchParams;

  const paiement = await db.subscriptionPayment.findUnique({
    where: { id: paiementId },
    select: {
      id: true,
      status: true,
      amount: true,
      currency: true,
      provider: true,
      createdAt: true,
      subscription: {
        select: {
          id: true,
          userId: true,
          cycleStart: true,
          cycleEnd: true,
          plan: { select: { name: true } },
        },
      },
    },
  });

  // 404 et non « accès refusé » : dire qu'un paiement existe mais n'est pas le
  // tien, c'est déjà en dire trop. Le paiement doit aussi appartenir à
  // l'abonnement de l'URL — une paire mal assortie afficherait l'état d'un
  // paiement sous le nom d'un autre abonnement.
  if (
    !paiement ||
    paiement.subscription.userId !== utilisateur.id ||
    paiement.subscription.id !== id
  ) {
    notFound();
  }

  const enAttente = paiement.status === "PENDING";
  const echoue = paiement.status === "FAILED";
  const paye = paiement.status === "PAID";

  const montant = formatMoney(paiement.amount, paiement.currency as Currency);
  const echeance = paiement.subscription.cycleEnd;
  const accesJusquA = ajouterJours(echeance, REGLAGES_PAR_DEFAUT.graceJours);
  const joursRestants = joursEntre(new Date(), accesJusquA);

  // Le compteur de tentatives voyage dans l'URL, parce que le rafraîchissement
  // est un rechargement complet : rien ne survit d'une page à l'autre.
  const tentative = Math.min(99, Math.max(1, Number(t ?? "1") || 1));

  // ── Ce que la maquette dessine, état par état ─────────────────────────────
  const allure = enAttente
    ? {
        kicker: "Renouvellement en cours",
        titre: "On attend ton opérateur",
        texte:
          "La demande est partie. Ton opérateur répond généralement en une minute ou deux.",
        fond: JAUNE,
        encre: ENCRE,
        pastille: BLANC,
        glyphe: "⏱",
        dateLabel: "Prochaine échéance",
        dateValeur: "en attente",
        dateNote:
          "Elle s'affichera ici dès que l'opérateur aura confirmé. Ton accès actuel n'est pas interrompu pendant ce temps.",
      }
    : paye
      ? {
          kicker: "C'est renouvelé",
          titre: "Ton accès est prolongé",
          texte:
            "Le paiement est confirmé. Rien d'autre à faire jusqu'à la date ci-dessous — on te relancera avant.",
          fond: VERT,
          encre: ENCRE,
          pastille: BLANC,
          glyphe: "✓",
          dateLabel: "Prochaine échéance",
          dateValeur: dateLongue(echeance),
          dateNote: noteDesRelances(echeance),
        }
      : {
          kicker: "Paiement refusé",
          titre: "Le renouvellement n'est pas passé",
          texte:
            "Ton opérateur a refusé la transaction. Rien ne t'a été débité — tu peux réessayer, éventuellement avec un autre moyen.",
          fond: ORANGE,
          encre: BLANC,
          pastille: JAUNE,
          glyphe: "✕",
          dateLabel: "Échéance inchangée",
          dateValeur: dateLongue(echeance),
          dateNote:
            joursRestants > 0
              ? `Il te reste ${joursRestants} jour${joursRestants > 1 ? "s" : ""} d'accès. Passé cette date, l'accès se met en pause sans rien effacer.`
              : "Ton accès est en pause. Un paiement le rétablit dans la minute, sans rien effacer.",
        };

  const bac = piloteCourant().nom === "bac-a-sable";
  const lienRenouveler = `/abonnement/${paiement.subscription.id}/renouveler` as Route;

  return (
    <main style={{ minHeight: "100vh", background: LAVANDE, padding: "36px 20px 60px" }}>
      {/*
        Rafraîchissement pendant l'attente. Une page qui dit « on attend » sans
        jamais changer d'avis pousse à recharger, puis à repayer.

        Le compteur de tentatives part dans l'URL : c'est ce qui permet à la
        page de dire honnêtement où elle en est plutôt que de tourner en boucle
        avec le même texte.
      */}
      {enAttente ? (
        <meta httpEquiv="refresh" content={`8;url=?t=${tentative + 1}`} />
      ) : null}

      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div
          style={{
            border: `3px solid ${ENCRE}`,
            borderRadius: 28,
            overflow: "hidden",
            boxShadow: `8px 8px 0 ${ENCRE}`,
            background: BLANC,
          }}
        >
          {/* ── L'état ────────────────────────────────────────────────────── */}
          <div
            style={{
              padding: "30px 28px",
              borderBottom: `3px solid ${ENCRE}`,
              background: allure.fond,
              color: allure.encre,
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  width: 62,
                  height: 62,
                  flex: "0 0 auto",
                  border: `3px solid ${ENCRE}`,
                  borderRadius: 99,
                  background: allure.pastille,
                  color: ENCRE,
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--font-display)",
                  fontSize: 25,
                }}
              >
                {allure.glyphe}
              </div>
              <div style={{ flex: "1 1 280px", minWidth: 0 }}>
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
                    fontSize: "clamp(22px,2.8vw,32px)",
                    lineHeight: 1.04,
                    letterSpacing: "-1.2px",
                    marginTop: 7,
                    textTransform: "uppercase",
                  }}
                >
                  {allure.titre}
                </div>
              </div>
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                lineHeight: 1.5,
                marginTop: 14,
                maxWidth: 600,
                textWrap: "pretty",
              }}
            >
              {allure.texte}
            </div>
          </div>

          {/* ── L'information principale : la prochaine échéance ─────────── */}
          <div style={{ padding: 28, borderBottom: `3px solid ${ENCRE}`, background: BLANC }}>
            <div
              style={{
                border: `3px solid ${ENCRE}`,
                borderRadius: 24,
                background: LAVANDE,
                boxShadow: `6px 6px 0 ${ENCRE}`,
                padding: 26,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: ".16em",
                  opacity: 0.65,
                }}
              >
                {allure.dateLabel}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(32px,4.6vw,54px)",
                  lineHeight: 1,
                  letterSpacing: "-2.4px",
                  marginTop: 10,
                  textTransform: "uppercase",
                }}
              >
                {allure.dateValeur}
              </div>
              <div
                style={{
                  fontSize: 14.5,
                  fontWeight: 600,
                  lineHeight: 1.5,
                  marginTop: 14,
                  maxWidth: 560,
                  textWrap: "pretty",
                }}
              >
                {allure.dateNote}
              </div>
            </div>

            {enAttente ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 14,
                  marginTop: 18,
                  padding: "15px 18px",
                  border: CADRE,
                  borderRadius: 18,
                  background: JAUNE,
                }}
              >
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>
                    Cette page se met à jour toute seule
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      lineHeight: 1.4,
                      marginTop: 3,
                      opacity: 0.8,
                    }}
                  >
                    Vérification toutes les 8 secondes · tentative {tentative}. Ne
                    repaie pas : la demande est déjà chez ton opérateur.
                  </div>
                </div>
              </div>
            ) : null}

            {echoue ? (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 14,
                  marginTop: 18,
                  padding: "15px 18px",
                  border: CADRE,
                  borderRadius: 18,
                  background: JAUNE,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    flex: "0 0 auto",
                    border: CADRE,
                    borderRadius: 99,
                    background: BLANC,
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "var(--font-display)",
                    fontSize: 13,
                  }}
                >
                  0 F
                </div>
                <div style={{ flex: "1 1 240px", minWidth: 0, fontSize: 14.5, fontWeight: 800 }}>
                  Rien ne t&apos;a été débité, et ton accès actuel n&apos;a pas
                  bougé.
                </div>
              </div>
            ) : null}
          </div>

          {/* ── La référence, puis les sorties ───────────────────────────── */}
          <div style={{ padding: "24px 28px" }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 12,
                padding: "13px 15px",
                border: CADRE,
                borderRadius: 15,
                background: "#F4EEFC",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  textTransform: "uppercase",
                  letterSpacing: ".12em",
                  opacity: 0.6,
                }}
              >
                Référence du paiement
              </div>
              {/*
                Notre identifiant, pas celui de l'opérateur : c'est celui-là
                qu'on saura retrouver si la personne écrit pour se plaindre.
              */}
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700 }}>
                {paiement.id}
              </div>
              <div style={{ flex: "1 1 auto" }} />
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, opacity: 0.6 }}>
                {paiement.subscription.plan.name} · {montant} · {paiement.provider}
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 20 }}>
              {echoue ? (
                <>
                  <Sortie href={lienRenouveler} fond={JAUNE} ombre>
                    Réessayer
                  </Sortie>
                  <Sortie href="/dashboard/forfait">Mon forfait</Sortie>
                </>
              ) : paye ? (
                <>
                  <Sortie href="/explore" fond={ENCRE} encre={BLANC} ombre>
                    Explorer les ressources
                  </Sortie>
                  <Sortie href="/dashboard/forfait">Mon forfait</Sortie>
                </>
              ) : (
                <>
                  <Sortie href="/dashboard/forfait">Mon forfait</Sortie>
                  <Sortie href="/dashboard">Revenir au tableau de bord</Sortie>
                </>
              )}
            </div>
          </div>
        </div>

        {bac && enAttente ? (
          <BacASable jouerRappel={declencherRappelAbonnement.bind(null, paiement.id)} />
        ) : null}
      </div>
    </main>
  );
}

function Sortie({
  href,
  children,
  fond = BLANC,
  encre = ENCRE,
  ombre = false,
}: {
  href: Route;
  children: React.ReactNode;
  fond?: string;
  encre?: string;
  ombre?: boolean;
}) {
  return (
    <Link
      href={href}
      className="sticker-press"
      style={{
        flex: "1 1 190px",
        padding: "15px 22px",
        border: CADRE,
        borderRadius: 15,
        textAlign: "center",
        fontSize: 14.5,
        fontWeight: 800,
        background: fond,
        color: encre,
        boxShadow: ombre ? `5px 5px 0 ${ENCRE}` : `4px 4px 0 ${ENCRE}`,
      }}
    >
      {children}
    </Link>
  );
}

function dateLongue(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Quand on relancera, dit avec les vraies dates.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LES JOURS VIENNENT DE `PALIERS`, JAMAIS D'UN NOMBRE RECOPIÉ
 *
 * Annoncer « première relance le 1er octobre » et relancer un autre jour serait
 * un mensonge que personne ne verrait — sauf l'abonné, une fois. Avancer un
 * palier doit changer cette phrase toute seule.
 */
function noteDesRelances(echeance: Date): string {
  const avant = PALIERS.filter((p) => p.jour < 0).map((p) =>
    ajouterJours(echeance, p.jour),
  );

  const premier = PALIERS.filter((p) => p.jour < 0);
  const premiere = avant[0];
  if (!premiere || !premier[0]) {
    return "Aucun prélèvement automatique : tu valideras toi-même le prochain paiement.";
  }

  // « La veille » n'est écrit que si c'est vrai. Un palier déplacé à J−2
  // rendrait la phrase fausse, et personne ne le verrait — sauf l'abonné, une
  // fois, le jour où le rappel n'arrive pas quand on le lui a promis.
  const second = premier[1];
  const suite = !second
    ? ""
    : second.jour === -1
      ? ", puis un rappel la veille"
      : `, puis un rappel le ${dateLongue(ajouterJours(echeance, second.jour))}`;

  return `Première relance le ${dateLongue(premiere)}${suite}. Aucun prélèvement automatique : tu valideras toi-même.`;
}
