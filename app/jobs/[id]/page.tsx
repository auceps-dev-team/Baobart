import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { LIBELLE_MODE, LIBELLE_TYPE } from "@/lib/jobs/enums";
import { joursAvantCloture, offrePublique } from "@/lib/jobs/queries";
import { budget, ilYA } from "@/lib/jobs/format";
import {
  BLANC,
  CADRE,
  ENCRE,
  JAUNE,
  LAVANDE,
  MAUVE,
  ORANGE,
  VERT,
} from "@/lib/systeme/charte";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const offre = await offrePublique(id);
  if (!offre) return { title: "Mission introuvable — Baobart." };

  return {
    title: `${offre.titre} — Baobart.`,
    description: offre.extrait,
  };
}

/**
 * La fiche d'une mission.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUE VOIT UN CANDIDAT AVANT DE S'ENGAGER
 *
 * C'est l'écran où quelqu'un décide d'envoyer son CV — parfois à un inconnu.
 * Deux choses y comptent plus que la mise en page :
 *
 *   — **le badge « Offre vérifiée »**, quand il est là. Il ne dit pas
 *     « publiée » : toute offre en ligne l'est. Il dit qu'un humain a contrôlé
 *     que l'entreprise existe et qu'on ne demande pas d'argent au candidat ;
 *   — **l'avertissement sur les candidatures externes.** Partir chez un tiers
 *     n'est pas anodin, et le candidat doit savoir qu'il quitte Baobart avant
 *     de cliquer, pas après.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TROIS BLOCS DE LA MAQUETTE SONT ABSENTS
 *
 * « Livrables attendus », « Profil recherché » et le compteur de propositions
 * avec sa jauge. Les deux premiers ne sont pas des champs — la description les
 * porte en prose, et les structurer demande de les collecter au dépôt. Le
 * troisième attend J5 : afficher « 12 propositions » aujourd'hui serait inventer
 * le chiffre sur lequel un candidat décide de postuler ou non.
 *
 * Traduit de « Baobart Accueil.dc.html », section `FICHE MISSION`.
 */
export default async function FicheMissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [offre, visiteur] = await Promise.all([
    offrePublique(id),
    sessionCourante(),
  ]);

  // 404 couvre l'inconnue, la relecture, le refus, le retrait et l'expiration.
  // Un identifiant se devine mal mais se partage : un lien envoyé avant un
  // refus ne doit pas continuer de montrer l'offre.
  if (!offre) notFound();

  const jours = joursAvantCloture(offre.echeance);
  const externe = offre.commentPostuler === "EXTERNE" && offre.urlExterne;
  // Sur sa propre offre, le CTA « Postuler » ne veut rien dire — le module de
  // dépôt le refuse déjà. On propose à la place le lien vers les candidatures
  // reçues, qui est le seul écran privé du recruteur pour cette offre.
  const estMienne = visiteur?.id === offre.recruteurId;

  const faits: { k: string; v: string; fond: string }[] = [
    { k: "Contrat", v: LIBELLE_TYPE[offre.type], fond: LAVANDE },
    { k: "Travail", v: LIBELLE_MODE[offre.mode], fond: BLANC },
    {
      k: "Lieu",
      v: [offre.ville, offre.pays].filter(Boolean).join(", ") || "Non précisé",
      fond: BLANC,
    },
    {
      k: "Clôture",
      v: jours === null ? "Sans date" : `dans ${jours} jour${jours > 1 ? "s" : ""}`,
      fond: jours !== null && jours <= 3 ? ORANGE : BLANC,
    },
  ];

  return (
    <>
      <Header utilisateur={visiteur} />

      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 72 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 32px 0" }}>
          <Link
            href="/jobs"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              border: CADRE,
              borderRadius: 13,
              background: BLANC,
              fontSize: 13,
              fontWeight: 800,
              color: ENCRE,
            }}
          >
            ← Toutes les missions
          </Link>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1.55fr) minmax(0,1fr)",
              gap: 24,
              marginTop: 20,
              alignItems: "start",
            }}
          >
            {/* ── La mission ─────────────────────────────────────────────── */}
            <div
              style={{
                border: CADRE,
                borderRadius: 26,
                background: BLANC,
                boxShadow: `7px 7px 0 ${ENCRE}`,
                padding: 26,
                minWidth: 0,
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <Pastille fond={LAVANDE} mono>
                  {LIBELLE_TYPE[offre.type]}
                </Pastille>
                {offre.verifiee ? (
                  <Pastille fond={VERT}>✓ OFFRE VÉRIFIÉE</Pastille>
                ) : null}
                {jours !== null ? (
                  <Pastille fond={JAUNE}>
                    Clôture dans {jours} jour{jours > 1 ? "s" : ""}
                  </Pastille>
                ) : null}
              </div>

              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(26px,3.2vw,42px)",
                  lineHeight: 1.02,
                  letterSpacing: "-1.5px",
                  margin: "16px 0 0",
                  textTransform: "uppercase",
                }}
              >
                {offre.titre}
              </h1>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 18,
                  marginTop: 12,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11.5,
                  opacity: 0.65,
                }}
              >
                <span>publiée {ilYA(offre.publieeLe)}</span>
                <span>
                  par{" "}
                  {offre.recruteurUsername ? (
                    <Link
                      href={`/@${offre.recruteurUsername}` as Route}
                      style={{ color: ENCRE, textDecoration: "underline" }}
                    >
                      {offre.recruteur}
                    </Link>
                  ) : (
                    offre.recruteur
                  )}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
                  gap: 12,
                  marginTop: 20,
                }}
              >
                {faits.map((f) => (
                  <div
                    key={f.k}
                    style={{
                      border: CADRE,
                      borderRadius: 16,
                      background: f.fond,
                      color: f.fond === ORANGE ? BLANC : ENCRE,
                      padding: 14,
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
                      {f.k}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 18,
                        lineHeight: 1.2,
                        marginTop: 5,
                      }}
                    >
                      {f.v}
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  margin: "26px 0 10px",
                }}
              >
                La mission
              </div>
              {/*
                La description est du texte brut saisi par l'annonceur. React
                l'échappe : elle n'est jamais interprétée comme du balisage.
                `white-space: pre-wrap` garde ses paragraphes sans lui offrir de
                mise en forme.
              */}
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  lineHeight: 1.6,
                  margin: 0,
                  opacity: 0.85,
                  whiteSpace: "pre-wrap",
                  textWrap: "pretty",
                }}
              >
                {offre.description}
              </p>
            </div>

            {/* ── Postuler ───────────────────────────────────────────────── */}
            <div style={{ position: "sticky", top: 88, minWidth: 0 }}>
              <div
                style={{
                  border: CADRE,
                  borderRadius: 26,
                  background: MAUVE,
                  boxShadow: `7px 7px 0 ${ENCRE}`,
                  padding: 22,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: ".1em",
                    opacity: 0.7,
                  }}
                >
                  Budget annoncé
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 30,
                    lineHeight: 1.1,
                    marginTop: 4,
                  }}
                >
                  {budget(offre.salaireMin, offre.salaireMax, offre.devise)}
                </div>

                <div style={{ marginTop: 18, paddingTop: 16, borderTop: CADRE }}>
                  {estMienne ? (
                    /*
                      Le recruteur sur sa propre offre : on l'envoie voir ce
                      qu'elle a rapporté, plutôt qu'un « Postuler » qui
                      refuserait.
                    */
                    <Link
                      href={`/dashboard/jobs/${offre.id}/candidatures` as Route}
                      className="sticker-press"
                      style={{
                        display: "block",
                        padding: "15px 20px",
                        border: CADRE,
                        borderRadius: 15,
                        background: JAUNE,
                        boxShadow: `5px 5px 0 ${ENCRE}`,
                        textAlign: "center",
                        fontSize: 14.5,
                        fontWeight: 800,
                        color: ENCRE,
                      }}
                    >
                      Voir les candidatures reçues →
                    </Link>
                  ) : externe ? (
                    <>
                      {/*
                        Le candidat doit savoir qu'il quitte Baobart AVANT de
                        cliquer. L'hôte est affiché : c'est la seule information
                        qui lui permette de reconnaître une adresse qui n'a rien
                        à voir avec l'entreprise annoncée.
                      */}
                      <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>
                        La candidature se fait sur le site de l&apos;annonceur.
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          marginTop: 8,
                          padding: "8px 10px",
                          borderRadius: 10,
                          background: BLANC,
                          border: `2px solid ${ENCRE}`,
                          wordBreak: "break-all",
                        }}
                      >
                        {hoteDe(offre.urlExterne!)}
                      </div>
                      <a
                        href={offre.urlExterne!}
                        target="_blank"
                        // `noopener` empêche la page ouverte de manipuler la
                        // nôtre ; `nofollow` évite de prêter notre référencement
                        // à une adresse qu'on n'a pas choisie.
                        rel="noopener noreferrer nofollow"
                        className="sticker-press"
                        style={{
                          display: "block",
                          marginTop: 14,
                          padding: "15px 20px",
                          border: CADRE,
                          borderRadius: 15,
                          background: JAUNE,
                          boxShadow: `5px 5px 0 ${ENCRE}`,
                          textAlign: "center",
                          fontSize: 14.5,
                          fontWeight: 800,
                          color: ENCRE,
                        }}
                      >
                        Postuler sur leur site ↗
                      </a>
                    </>
                  ) : (
                    /*
                      La candidature sur Baobart, câblée en J5. Le bouton part
                      sur `/postuler`, qui refait toutes les gardes — offre
                      publique, pas la sienne, pas déjà postulé. La page peut
                      donc rediriger sans que le clic mente.
                    */
                    <Link
                      href={`/jobs/${offre.id}/postuler` as Route}
                      className="sticker-press"
                      style={{
                        display: "block",
                        padding: "15px 20px",
                        border: CADRE,
                        borderRadius: 15,
                        background: JAUNE,
                        boxShadow: `5px 5px 0 ${ENCRE}`,
                        textAlign: "center",
                        fontSize: 14.5,
                        fontWeight: 800,
                        color: ENCRE,
                      }}
                    >
                      Postuler sur Baobart
                    </Link>
                  )}
                </div>
              </div>

              {offre.verifiee ? null : (
                <div
                  style={{
                    marginTop: 16,
                    padding: 16,
                    border: CADRE,
                    borderRadius: 20,
                    background: BLANC,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 800 }}>
                    Cette offre a été relue, pas vérifiée
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      lineHeight: 1.5,
                      marginTop: 6,
                      opacity: 0.8,
                      textWrap: "pretty",
                    }}
                  >
                    Personne ne t&apos;enverra jamais d&apos;argent pour
                    commencer, et aucun recruteur sérieux ne t&apos;en demandera.
                    Si on te réclame des frais, c&apos;est une arnaque.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
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
        padding: "6px 13px",
        border: `2px solid ${ENCRE}`,
        borderRadius: 999,
        background: fond,
        fontSize: mono ? 11 : 11.5,
        fontWeight: mono ? 400 : 800,
        fontFamily: mono ? "var(--font-mono)" : undefined,
        textTransform: "uppercase",
        letterSpacing: mono ? ".08em" : undefined,
      }}
    >
      {children}
    </span>
  );
}

/** L'hôte seul : c'est ce qu'un candidat peut reconnaître d'un coup d'œil. */
function hoteDe(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
