import Link from "next/link";
import type { Route } from "next";

import { CompteARebours } from "@/components/evenements/compte-a-rebours";
import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { GENRES, LIBELLE_GENRE, type EventKind } from "@/lib/evenements/enums";
import { LIBELLE_PHASE, placesRestantes } from "@/lib/evenements/phases";
import { listerPublics, prochainEvenement } from "@/lib/evenements/queries";
import { formatMoney, type Currency } from "@/lib/i18n/money";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, ORANGE, VERT } from "@/lib/systeme/charte";

export const metadata = {
  title: "Concours & événements — Baobart.",
  description:
    "Un thème, deux semaines, un jury de créatifs du continent. Ateliers, conférences et expositions de la communauté Baobart.",
};

export const dynamic = "force-dynamic";

/**
 * Les concours et événements.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LECTURE PUBLIQUE, SANS CONDITION
 *
 * Voir ne demande rien. S'inscrire demandera un compte (E4) — la même
 * asymétrie que Jobs, et pour la même raison : un calendrier derrière une
 * connexion n'est lu par personne.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA MAQUETTE RÉSERVE L'ENCART AU CONCOURS EN COURS. ON L'ÉLARGIT.
 *
 * `Baobart Accueil.dc.html`, section `PAGE CONCOURS & EVENEMENTS`, montre
 * « Édition en cours » avec un compte à rebours. S'il fallait un concours pour
 * le remplir, la page serait vide toutes les semaines où il n'y en a pas — et
 * un bandeau vide vaut moins qu'un bandeau qui annonce l'atelier de jeudi.
 *
 * C'est donc le **prochain événement, tous genres confondus**, qui s'y
 * affiche. Quand il n'y en a aucun, l'encart cède la place à une invitation à
 * en proposer un.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX BLOCS DESSINÉS, ABSENTS
 *
 * Le bouton « Proposer un événement » ne mène nulle part : publier est réservé
 * à l'administration (§18.1), et un bouton qui ouvre sur un refus vaut moins
 * qu'une phrase qui explique. Les trois étapes « Comment ça se passe » sont du
 * texte éditorial que rien ne porte en base — les écrire en dur ici les ferait
 * vieillir sans que personne ne puisse les corriger.
 */
export default async function EvenementsPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string }>;
}) {
  const { genre: demande } = await searchParams;
  const genre = (GENRES as readonly string[]).includes(demande ?? "")
    ? (demande as EventKind)
    : undefined;

  const [visiteur, prochain, evenements] = await Promise.all([
    sessionCourante(),
    prochainEvenement(),
    listerPublics({ genre }),
  ]);

  return (
    <>
      <Header utilisateur={visiteur} />

      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 72 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "44px 32px 0" }}>
          {/* ── Le bandeau jaune de la maquette ──────────────────────────── */}
          <div
            style={{
              border: CADRE,
              borderRadius: 28,
              background: JAUNE,
              boxShadow: `7px 7px 0 ${ENCRE}`,
              padding: 34,
              display: "grid",
              gridTemplateColumns: "minmax(0,1.1fr) minmax(0,.9fr)",
              gap: 30,
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-block",
                  padding: "6px 14px",
                  border: CADRE,
                  borderRadius: 999,
                  background: BLANC,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: ".12em",
                }}
              >
                Concours &amp; événements
              </div>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(34px,4.4vw,58px)",
                  lineHeight: 0.96,
                  letterSpacing: "-2px",
                  margin: "14px 0 0",
                  textTransform: "uppercase",
                }}
              >
                Montre ce que tu sais faire.
              </h1>
              <p
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  lineHeight: 1.5,
                  maxWidth: 520,
                  margin: "14px 0 0",
                  opacity: 0.8,
                }}
              >
                Un thème, deux semaines, un jury de créatifs du continent. Les
                gagnants sont mis en avant sur l&apos;accueil et rémunérés.
              </p>

              {prochain ? (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 22 }}>
                  <Link
                    href={`/evenements/${prochain.id}` as Route}
                    className="sticker-press"
                    style={{
                      padding: "14px 26px",
                      border: CADRE,
                      borderRadius: 16,
                      background: ENCRE,
                      color: BLANC,
                      fontSize: 14.5,
                      fontWeight: 800,
                    }}
                  >
                    {prochain.genre === "CONTEST"
                      ? "Participer au concours en cours"
                      : "Voir le prochain événement"}
                  </Link>
                </div>
              ) : null}
            </div>

            {/* ── L'encart « Édition en cours » ───────────────────────────── */}
            {prochain ? (
              <div
                style={{
                  border: CADRE,
                  borderRadius: 22,
                  background: BLANC,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: ".1em",
                    opacity: 0.6,
                  }}
                >
                  {prochain.phase === "EN_COURS" ? "En ce moment" : "Prochainement"}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 26,
                    lineHeight: 1.05,
                    marginTop: 8,
                  }}
                >
                  {prochain.titre}
                </div>

                {/*
                  Vers le début tant qu'il n'a pas commencé, vers la fin une
                  fois lancé : un décompte figé à zéro pendant deux semaines
                  d'exposition ne dirait plus rien.
                */}
                <CompteARebours
                  jusqua={prochain.phase === "EN_COURS" ? prochain.fin : prochain.debut}
                />

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 16,
                    paddingTop: 14,
                    borderTop: CADRE,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <span>
                    {prochain.dotation
                      ? `${formatMoney(prochain.dotation, prochain.devise as Currency)} de prix`
                      : LIBELLE_GENRE[prochain.genre]}
                  </span>
                  <span style={{ opacity: 0.65 }}>
                    {prochain.inscrits} inscrit{prochain.inscrits > 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            ) : (
              <div
                style={{
                  border: CADRE,
                  borderRadius: 22,
                  background: BLANC,
                  padding: 20,
                }}
              >
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>
                  Rien d&apos;annoncé pour l&apos;instant
                </div>
                <p
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    lineHeight: 1.5,
                    marginTop: 10,
                    opacity: 0.8,
                  }}
                >
                  Les prochains concours et ateliers paraîtront ici. Tu organises
                  quelque chose ? Écris-nous — les événements sont publiés par
                  l&apos;équipe Baobart.
                </p>
              </div>
            )}
          </div>

          {/* ── Le filtre par genre ──────────────────────────────────────── */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 9, margin: "22px 0 20px" }}>
            <Filtre href={"/evenements" as Route} actif={genre === undefined}>
              Tous
            </Filtre>
            {GENRES.map((g) => (
              <Filtre
                key={g}
                href={`/evenements?genre=${g}` as Route}
                actif={genre === g}
              >
                {LIBELLE_GENRE[g]}
              </Filtre>
            ))}
          </div>

          {evenements.length === 0 ? (
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
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                {genre ? "Aucun événement de ce type" : "Aucun événement en ligne"}
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55, marginTop: 8 }}>
                Reviens dans quelques jours — le calendrier se remplit au fil des
                éditions.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
                gap: 18,
              }}
            >
              {evenements.map((e) => {
                const restantes = placesRestantes(e.capacite, e.inscrits);

                return (
                  <Link
                    key={e.id}
                    href={`/evenements/${e.id}` as Route}
                    className="sticker-press"
                    style={{
                      display: "block",
                      border: CADRE,
                      borderRadius: 22,
                      background: BLANC,
                      boxShadow: `5px 5px 0 ${ENCRE}`,
                      overflow: "hidden",
                      color: ENCRE,
                    }}
                  >
                    <div
                      style={{
                        height: 160,
                        borderBottom: CADRE,
                        display: "grid",
                        placeItems: "center",
                        fontFamily: "var(--font-mono)",
                        fontSize: 11.5,
                        background: e.coverUrl
                          ? `center / cover no-repeat url(${e.coverUrl})`
                          : LAVANDE,
                      }}
                    >
                      {e.coverUrl ? null : LIBELLE_GENRE[e.genre]}
                    </div>

                    <div style={{ padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        {/*
                          Un annulé porte sa marque avant toute autre : c'est ce
                          qu'un inscrit doit lire en premier.
                        */}
                        <Pastille fond={e.annuleLe ? ORANGE : fondDePhase(e.phase)} clair={e.annuleLe !== null}>
                          {e.annuleLe ? "ANNULÉ" : LIBELLE_PHASE[e.phase]}
                        </Pastille>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            opacity: 0.6,
                          }}
                        >
                          {e.debut.toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            timeZone: "UTC",
                          })}
                        </span>
                      </div>

                      <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.25, marginTop: 10 }}>
                        {e.titre}
                      </div>

                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 500,
                          opacity: 0.75,
                          lineHeight: 1.45,
                          marginTop: 6,
                          textWrap: "pretty",
                        }}
                      >
                        {e.description.slice(0, 140)}
                        {e.description.length > 140 ? "…" : ""}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: 14,
                          paddingTop: 12,
                          borderTop: CADRE,
                          fontSize: 12.5,
                          fontWeight: 800,
                        }}
                      >
                        <span>
                          {e.dotation
                            ? formatMoney(e.dotation, e.devise as Currency)
                            : e.enLigne
                              ? "En ligne"
                              : (e.lieu ?? "Lieu à préciser")}
                        </span>
                        <span style={{ opacity: 0.6 }}>
                          {restantes === null
                            ? `${e.inscrits} inscrit${e.inscrits > 1 ? "s" : ""}`
                            : restantes === 0
                              ? "Complet"
                              : `${restantes} place${restantes > 1 ? "s" : ""}`}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function fondDePhase(phase: string): string {
  if (phase === "EN_COURS") return VERT;
  if (phase === "A_VENIR") return JAUNE;
  return BLANC;
}

function Filtre({
  href,
  actif,
  children,
}: {
  href: Route;
  actif: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        padding: "9px 16px",
        border: CADRE,
        borderRadius: 999,
        background: actif ? ENCRE : BLANC,
        color: actif ? BLANC : ENCRE,
        fontSize: 13,
        fontWeight: 800,
      }}
    >
      {children}
    </Link>
  );
}

function Pastille({
  children,
  fond,
  clair = false,
}: {
  children: React.ReactNode;
  fond: string;
  clair?: boolean;
}) {
  return (
    <span
      style={{
        padding: "5px 11px",
        border: `2px solid ${ENCRE}`,
        borderRadius: 999,
        background: fond,
        color: clair ? BLANC : ENCRE,
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
