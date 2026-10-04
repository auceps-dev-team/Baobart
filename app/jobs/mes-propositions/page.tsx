import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { estPublic } from "@/lib/cms/cycle";
import { candidaturesDe } from "@/lib/jobs/postuler";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, VERT } from "@/lib/systeme/charte";

export const metadata = { title: "Mes propositions — Baobart." };
export const dynamic = "force-dynamic";

/**
 * Les candidatures envoyées.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UNE OFFRE QUI N'EST PLUS PUBLIQUE APPARAÎT COMME « TERMINÉE »
 *
 * Le CV a été effacé par la purge — ou le sera au passage suivant. On le dit
 * franchement plutôt que d'afficher un lien vers une fiche qui répondrait 404.
 */
export default async function MesPropositionsPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion?suite=/jobs/mes-propositions");

  const candidatures = await candidaturesDe(utilisateur.id);

  return (
    <>
      <Header utilisateur={utilisateur} />

      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 72 }}>
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 32px 0" }}>
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

          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(28px,3.6vw,44px)",
              lineHeight: 1,
              letterSpacing: "-1.6px",
              textTransform: "uppercase",
              margin: "22px 0 8px",
            }}
          >
            Mes propositions
          </h1>
          <p style={{ fontSize: 14, fontWeight: 600, opacity: 0.75, margin: 0 }}>
            Les missions auxquelles tu as répondu. L&apos;annonceur te contacte
            directement.
          </p>

          {candidatures.length === 0 ? (
            <div
              style={{
                marginTop: 24,
                border: CADRE,
                borderRadius: 24,
                background: BLANC,
                boxShadow: `6px 6px 0 ${ENCRE}`,
                padding: 28,
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                Tu n&apos;as encore répondu à aucune mission
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55, marginTop: 8 }}>
                Parcours les offres et candidate en un clic sur celles qui te
                correspondent.
              </p>
              <Link
                href="/jobs"
                className="sticker-press"
                style={{
                  display: "inline-block",
                  marginTop: 14,
                  padding: "12px 20px",
                  border: CADRE,
                  borderRadius: 14,
                  background: JAUNE,
                  boxShadow: `4px 4px 0 ${ENCRE}`,
                  fontSize: 14,
                  fontWeight: 800,
                  color: ENCRE,
                }}
              >
                Voir les missions
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
              {candidatures.map((c) => {
                const active = estPublic(c.job.state, c.job.deadline);
                const nomRecruteur = c.job.recruiter.profile?.displayName ?? "l'annonceur";

                return (
                  <article
                    key={c.id}
                    style={{
                      border: CADRE,
                      borderRadius: 20,
                      background: active ? BLANC : "#F4EEFC",
                      boxShadow: `4px 4px 0 ${ENCRE}`,
                      padding: 18,
                      opacity: active ? 1 : 0.85,
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, flex: "1 1 240px" }}>
                        {active ? (
                          <Link
                            href={`/jobs/${c.job.id}` as Route}
                            style={{ color: ENCRE, textDecoration: "none" }}
                          >
                            {c.job.title}
                          </Link>
                        ) : (
                          c.job.title
                        )}
                      </div>
                      <span
                        style={{
                          padding: "5px 11px",
                          border: `2px solid ${ENCRE}`,
                          borderRadius: 999,
                          background: active ? VERT : "#DCDCDC",
                          fontFamily: "var(--font-mono)",
                          fontSize: 10.5,
                          fontWeight: 700,
                        }}
                      >
                        {active ? "OFFRE EN COURS" : "MISSION TERMINÉE"}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 14,
                        marginTop: 8,
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        opacity: 0.7,
                      }}
                    >
                      <span>envoyée le {c.createdAt.toLocaleDateString("fr-FR")}</span>
                      <span>à {nomRecruteur}</span>
                    </div>

                    {!active ? (
                      <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5, marginTop: 8, opacity: 0.75 }}>
                        La mission n&apos;est plus ouverte. Ton CV a été effacé
                        de nos serveurs — tu peux le renvoyer sur une autre offre
                        sans souci.
                      </p>
                    ) : null}
                  </article>
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
