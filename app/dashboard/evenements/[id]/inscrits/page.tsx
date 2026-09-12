import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { DashboardFrame } from "@/components/dashboard/frame";
import { clauseDePortee } from "@/lib/evenements/acces";
import { LIBELLE_GENRE, type EventKind } from "@/lib/evenements/enums";
import { accesAuxEvenements, exigerAccesAuxEvenements } from "@/lib/evenements/garde";
import { LIBELLE_PHASE, phaseDe, placesRestantes } from "@/lib/evenements/phases";
import { inscritsDe } from "@/lib/evenements/queries";
import { db } from "@/lib/db";
import { formatMoney, type Currency } from "@/lib/i18n/money";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, ORANGE, VERT } from "@/lib/systeme/charte";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Bornée à la portée, comme la page : un titre d'onglet est une fuite comme
  // une autre.
  const acces = await accesAuxEvenements();
  const e = acces
    ? await db.event.findFirst({
        where: { id, ...clauseDePortee(acces.portee) },
        select: { title: true },
      })
    : null;

  return { title: e ? `Inscrits — ${e.title}` : "Inscrits — Baobart." };
}

/**
 * Qui vient, et de quoi émarger le jour venu.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN ÉCRAN AVANT L'EXPORT, ET C'EST L'INVERSE DE CE QU'ON FAIT D'HABITUDE
 *
 * La spec (§5.2) demandait « export CSV ». On aurait pu s'arrêter là : un
 * bouton, un fichier. Mais un CSV ne se consulte qu'en le téléchargeant puis
 * en ouvrant un tableur — trois gestes et un ordinateur.
 *
 * Or le moment où cette liste sert vraiment, c'est **à l'entrée de
 * l'atelier**, sur un téléphone, quand on coche les présents. L'écran est donc
 * la fonction principale ; l'export vient à côté, pour ce qu'un tableur fait
 * mieux — trier, croiser, garder.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA PORTÉE GARDE CETTE PAGE, ET C'EST LA GARDE LA PLUS IMPORTANTE DU MODULE
 *
 * Une liste de noms, d'adresses de courriel et de présences à une date : c'est
 * ce qu'on trouve ici. Tant que les événements appartenaient à l'équipe, le
 * pouvoir `publier_du_contenu` suffisait. Depuis que les agences y écrivent,
 * il faut en plus que l'événement soit **le sien**.
 *
 * Le filtre est dans la requête qui charge l'événement, pas dans un `if` après
 * coup : si elle rend `null`, on répond 404 et `inscritsDe` n'est jamais
 * appelé.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'ADRESSE EST EN CLAIR, ET C'EST ASSUMÉ
 *
 * C'est la seule voie de retour vers un inscrit — il n'y a pas de messagerie
 * (§22.6). Un `mailto:` groupé permet de prévenir tout le monde d'un
 * changement de salle, ce qui est précisément ce dont on a besoin le jour où
 * l'on annule.
 */
export default async function InscritsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { utilisateur, portee } = await exigerAccesAuxEvenements();
  const { id } = await params;

  const evenement = await db.event.findFirst({
    where: { id, ...clauseDePortee(portee) },
    select: {
      id: true,
      title: true,
      kind: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
      participantsCount: true,
      cancelledAt: true,
      currency: true,
      ticketPrice: true,
    },
  });

  if (!evenement) notFound();

  const inscrits = await inscritsDe(evenement.id);
  const phase = phaseDe(evenement.startsAt, evenement.endsAt);
  const restantes = placesRestantes(evenement.capacity, evenement.participantsCount);

  // Toutes les adresses d'un coup : c'est ce qui sert à annoncer un
  // changement de salle ou une annulation. En copie cachée, pour que les
  // inscrits ne découvrent pas les adresses les uns des autres.
  const toutesLesAdresses = inscrits.map((i) => i.courriel).join(",");

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre={`Inscrits — ${evenement.title}`}
      description={`${LIBELLE_GENRE[evenement.kind as EventKind]} · ${LIBELLE_PHASE[phase]}${
        evenement.cancelledAt ? " · annulé" : ""
      }`}
      action={
        <Link
          href={`/dashboard/evenements/${evenement.id}` as Route}
          style={{
            padding: "10px 16px",
            border: CADRE,
            borderRadius: 13,
            background: BLANC,
            fontSize: 13,
            fontWeight: 800,
            color: ENCRE,
          }}
        >
          ← Retour à l&apos;événement
        </Link>
      }
    >
      {/* ── Le résumé ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
          gap: 12,
          marginBottom: 20,
          maxWidth: 900,
        }}
      >
        <Chiffre
          libelle="Inscrits"
          valeur={String(evenement.participantsCount)}
          fond={JAUNE}
        />
        <Chiffre
          libelle="Capacité"
          valeur={evenement.capacity === null ? "Sans limite" : String(evenement.capacity)}
          fond={BLANC}
        />
        <Chiffre
          libelle="Restantes"
          valeur={restantes === null ? "—" : String(restantes)}
          fond={restantes === 0 ? ORANGE : BLANC}
          clair={restantes === 0}
        />
        <Chiffre
          libelle="Lignes réelles"
          valeur={String(inscrits.length)}
          // Le compteur est dénormalisé : s'il diverge du nombre de lignes,
          // c'est un incident qu'il vaut mieux voir ici qu'en cherchant
          // pourquoi un atelier affiche complet sans l'être.
          fond={inscrits.length === evenement.participantsCount ? VERT : ORANGE}
          clair={inscrits.length !== evenement.participantsCount}
        />
      </div>

      {inscrits.length > 0 ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          <a
            href={`/api/evenements/${evenement.id}/inscrits`}
            className="sticker-press"
            style={{
              padding: "12px 20px",
              border: CADRE,
              borderRadius: 14,
              background: ENCRE,
              color: BLANC,
              fontSize: 13.5,
              fontWeight: 800,
            }}
          >
            Exporter en CSV
          </a>

          <a
            href={`mailto:?bcc=${encodeURIComponent(toutesLesAdresses)}&subject=${encodeURIComponent(evenement.title)}`}
            style={{
              padding: "12px 20px",
              border: CADRE,
              borderRadius: 14,
              background: BLANC,
              fontSize: 13.5,
              fontWeight: 800,
              color: ENCRE,
            }}
            title="Les adresses partent en copie cachée : personne ne verra celles des autres."
          >
            Écrire à tout le monde
          </a>
        </div>
      ) : null}

      {/* ── La liste ──────────────────────────────────────────────────── */}
      {inscrits.length === 0 ? (
        <div
          style={{
            border: CADRE,
            borderRadius: 24,
            background: BLANC,
            boxShadow: `6px 6px 0 ${ENCRE}`,
            padding: 28,
            maxWidth: 620,
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 800 }}>Personne pour l&apos;instant</div>
          <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55, marginTop: 8 }}>
            {evenement.cancelledAt
              ? "L'événement est annulé : plus personne ne peut s'inscrire."
              : evenement.ticketPrice
                ? "Les billets payants ne sont pas encore encaissés en ligne — l'inscription reste fermée sur cet événement."
                : "Les inscriptions apparaîtront ici au fur et à mesure."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 900 }}>
          {inscrits.map((i, rang) => (
            <article
              key={i.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                border: CADRE,
                borderRadius: 18,
                background: BLANC,
                boxShadow: `4px 4px 0 ${ENCRE}`,
                padding: 14,
              }}
            >
              {/*
                Le rang d'arrivée : c'est lui qui tranche une liste d'attente,
                et il ne se lit nulle part ailleurs.
              */}
              <span
                style={{
                  width: 34,
                  height: 34,
                  flex: "0 0 auto",
                  border: `2px solid ${ENCRE}`,
                  borderRadius: 99,
                  background: LAVANDE,
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                }}
              >
                {rang + 1}
              </span>

              <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800 }}>{i.nom}</div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11.5,
                    marginTop: 3,
                    wordBreak: "break-all",
                  }}
                >
                  <a href={`mailto:${i.courriel}`} style={{ color: ENCRE }}>
                    {i.courriel}
                  </a>
                  {i.username ? (
                    <>
                      {" · "}
                      <Link href={`/@${i.username}` as Route} style={{ color: ENCRE }}>
                        @{i.username}
                      </Link>
                    </>
                  ) : null}
                  {i.ville ? ` · ${i.ville}` : ""}
                </div>
              </div>

              <div style={{ textAlign: "right", flex: "0 0 auto" }}>
                {i.billetPaye ? (
                  <div style={{ fontSize: 13, fontWeight: 800 }}>
                    {formatMoney(i.billetPaye, evenement.currency as Currency)}
                  </div>
                ) : null}
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    opacity: 0.6,
                  }}
                >
                  {i.inscritLe.toLocaleDateString("fr-FR", { timeZone: "UTC" })}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </DashboardFrame>
  );
}

function Chiffre({
  libelle,
  valeur,
  fond,
  clair = false,
}: {
  libelle: string;
  valeur: string;
  fond: string;
  clair?: boolean;
}) {
  return (
    <div
      style={{
        border: CADRE,
        borderRadius: 18,
        background: fond,
        color: clair ? BLANC : ENCRE,
        padding: 16,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: ".1em",
          opacity: 0.65,
        }}
      >
        {libelle}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 26, marginTop: 4 }}>
        {valeur}
      </div>
    </div>
  );
}
