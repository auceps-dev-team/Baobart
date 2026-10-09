import Link from "next/link";
import type { Route } from "next";

import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { LIBELLE_MODE, LIBELLE_TYPE, TYPES, type JobType } from "@/lib/jobs/enums";
import { budget, ilYA } from "@/lib/jobs/format";
import { joursAvantCloture, listerOffres } from "@/lib/jobs/queries";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE } from "@/lib/systeme/charte";

export const metadata = {
  title: "Jobs — Baobart.",
  description:
    "Les missions publiées par la communauté Baobart : illustration, motion, photo, design.",
};

export const dynamic = "force-dynamic";

/**
 * L'annuaire des missions.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LECTURE PUBLIQUE, ACTION AUTHENTIFIÉE
 *
 * On lit sans compte : un annuaire d'offres derrière une connexion n'est lu par
 * personne, et le référencement en dépend. Déposer et postuler demandent un
 * compte — c'est la seule asymétrie de Jobs.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS CHOSES DE LA MAQUETTE NE SONT PAS ICI
 *
 * Elle montre « N propositions » sur chaque carte, un bouton « Mes
 * propositions », et sur la fiche un délai de réponse moyen.
 *
 * Les candidatures arrivent avec J5 : afficher un compteur aujourd'hui serait
 * inventer le chiffre sur lequel un candidat décide de postuler ou non. Et le
 * délai de réponse ne se mesure nulle part — il vient d'être abandonné sur le
 * profil créateur pour cette raison exacte.
 *
 * Traduit de « Baobart Accueil.dc.html », section `PAGE JOBS`.
 */
export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type: demande } = await searchParams;
  const type = (TYPES as readonly string[]).includes(demande ?? "")
    ? (demande as JobType)
    : undefined;

  const [visiteur, offres] = await Promise.all([
    sessionCourante(),
    listerOffres({ type }),
  ]);

  return (
    <>
      <Header utilisateur={visiteur} />

      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 72 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "44px 32px 0" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(32px,4vw,52px)",
                  letterSpacing: "-1.8px",
                  margin: 0,
                  textTransform: "uppercase",
                }}
              >
                Jobs
              </h1>
              <p style={{ fontSize: 15.5, fontWeight: 600, opacity: 0.75, margin: "8px 0 0" }}>
                Les missions publiées par la communauté. Réponds, chiffre,
                décroche.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link
                href="/jobs/deposer"
                className="sticker-press"
                style={{
                  padding: "12px 20px",
                  border: CADRE,
                  borderRadius: 14,
                  background: JAUNE,
                  boxShadow: `4px 4px 0 ${ENCRE}`,
                  fontSize: 13.5,
                  fontWeight: 800,
                  color: ENCRE,
                }}
              >
                Publier une mission
              </Link>
              {/*
                Le bouton « Mes propositions » ne s'affiche qu'à quelqu'un de
                connecté. À un visiteur, il mènerait à la connexion : autant ne
                pas la lui promettre.
              */}
              {visiteur ? (
                <Link
                  href="/jobs/mes-propositions"
                  className="sticker-press"
                  style={{
                    padding: "12px 20px",
                    border: CADRE,
                    borderRadius: 14,
                    background: BLANC,
                    fontSize: 13.5,
                    fontWeight: 800,
                    color: ENCRE,
                  }}
                >
                  Mes propositions
                </Link>
              ) : null}
            </div>
          </div>

          {/* ── Le filtre par type de contrat ─────────────────────────────── */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 22 }}>
            <Filtre href="/jobs" actif={type === undefined}>
              Tous
            </Filtre>
            {TYPES.map((t) => (
              <Filtre key={t} href={`/jobs?type=${t}` as Route} actif={type === t}>
                {LIBELLE_TYPE[t]}
              </Filtre>
            ))}
          </div>

          {offres.length === 0 ? (
            <div
              style={{
                marginTop: 24,
                border: CADRE,
                borderRadius: 24,
                background: BLANC,
                boxShadow: `6px 6px 0 ${ENCRE}`,
                padding: 28,
                maxWidth: 620,
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                {type ? "Aucune mission de ce type" : "Aucune mission en ligne"}
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55, marginTop: 8 }}>
                Les offres paraissent après relecture. Reviens dans un jour ou
                deux — ou publie la tienne.
              </p>
              {/* La phrase invitait à publier sans y mener (relevé aux tests QA
                  du 09/10 : « pas d'appel à l'action ») : le bouton suit. */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                <Link
                  href="/jobs/deposer"
                  className="sticker-press"
                  style={{
                    padding: "11px 18px",
                    border: CADRE,
                    borderRadius: 14,
                    background: JAUNE,
                    boxShadow: `4px 4px 0 ${ENCRE}`,
                    fontSize: 13.5,
                    fontWeight: 800,
                    color: ENCRE,
                  }}
                >
                  Publier une mission
                </Link>
                {type ? (
                  <Link
                    href={"/jobs" as Route}
                    style={{
                      padding: "11px 18px",
                      border: CADRE,
                      borderRadius: 14,
                      background: BLANC,
                      fontSize: 13.5,
                      fontWeight: 800,
                      color: ENCRE,
                    }}
                  >
                    Voir toutes les missions
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 24 }}>
              {offres.map((o) => {
                const jours = joursAvantCloture(o.echeance);
                return (
                  <Link
                    key={o.id}
                    href={`/jobs/${o.id}` as Route}
                    className="sticker-press"
                    style={{
                      display: "block",
                      border: CADRE,
                      borderRadius: 20,
                      background: BLANC,
                      boxShadow: `4px 4px 0 ${ENCRE}`,
                      padding: 18,
                      color: ENCRE,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.3, flex: "1 1 260px" }}>
                        {o.titre}
                      </div>
                      <Pastille fond={LAVANDE} mono>
                        {LIBELLE_TYPE[o.type]}
                      </Pastille>
                      {o.nouvelle ? <Pastille fond={JAUNE}>NOUVEAU</Pastille> : null}
                      {/*
                        Le badge « vérifiée » est le seul signal d'anti-arnaque
                        que voit un candidat. Il dit qu'un humain a contrôlé
                        l'entreprise, pas seulement que l'offre a été relue.
                      */}
                      {o.verifiee ? <Pastille fond="#B9E8C0">OFFRE VÉRIFIÉE</Pastille> : null}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 16,
                        marginTop: 10,
                        fontFamily: "var(--font-mono)",
                        fontSize: 11.5,
                        opacity: 0.65,
                      }}
                    >
                      <span>{budget(o.salaireMin, o.salaireMax, o.devise)}</span>
                      <span>{LIBELLE_MODE[o.mode]}</span>
                      {o.ville ? <span>{o.ville}</span> : null}
                      <span>publiée {ilYA(o.publieeLe)}</span>
                      {jours !== null ? (
                        <span>clôture dans {jours} jour{jours > 1 ? "s" : ""}</span>
                      ) : null}
                      {/*
                        Le compteur ne s'affiche pas sur une offre externe : ses
                        candidatures partent sur le site de l'annonceur, on ne
                        les compte pas. « 0 propositions » serait un mensonge
                        que le candidat prend pour une opportunité.
                      */}
                      {o.candidatures !== null ? (
                        <span>
                          {o.candidatures} proposition{o.candidatures > 1 ? "s" : ""}
                        </span>
                      ) : null}
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        lineHeight: 1.5,
                        marginTop: 10,
                        opacity: 0.82,
                        textWrap: "pretty",
                      }}
                    >
                      {o.extrait}
                      {o.extrait.length >= 220 ? "…" : ""}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        marginTop: 14,
                        paddingTop: 14,
                        borderTop: CADRE,
                      }}
                    >
                      <span
                        style={{
                          padding: "9px 16px",
                          border: CADRE,
                          borderRadius: 12,
                          background: LAVANDE,
                          fontSize: 12.5,
                          fontWeight: 800,
                        }}
                      >
                        Voir la mission →
                      </span>
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
  mono = false,
}: {
  children: React.ReactNode;
  fond: string;
  mono?: boolean;
}) {
  return (
    <span
      style={{
        padding: "5px 11px",
        border: `2px solid ${ENCRE}`,
        borderRadius: 999,
        background: fond,
        fontSize: mono ? 10.5 : 11,
        fontWeight: mono ? 400 : 800,
        fontFamily: mono ? "var(--font-mono)" : undefined,
        textTransform: "uppercase",
        letterSpacing: mono ? ".06em" : undefined,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/*
  `budget` et `ilYA` vivaient ici, et la fiche les importait de cette page.
  Next refuse qu'un `page.tsx` exporte autre chose que ce qu'il reconnaît —
  la construction échouait. Ils sont dans `lib/jobs/format.ts`.
*/
