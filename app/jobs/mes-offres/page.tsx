import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { connexionPuis } from "@/lib/auth/suite";
import { LIBELLE_ETAT, estPublic } from "@/lib/cms/cycle";
import { offresDe } from "@/lib/jobs/mes-offres";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, VERT } from "@/lib/systeme/charte";

export const metadata = { title: "Mes offres — Baobart." };
export const dynamic = "force-dynamic";

/**
 * Les offres déposées, et leurs candidatures.
 *
 * Q-26 (recette du 14/11/2026) : le recruteur ne retrouvait pas ses offres —
 * aucune entrée n'y menait, seul le lien d'une notification ouvrait leurs
 * candidatures. Pendant de « Mes propositions », qui sert le candidat.
 *
 * Toutes les offres, refusées et retirées comprises : c'est l'auteur qui
 * regarde (`lib/cms/cycle.ts`). Les candidatures ne s'ouvrent que pour une
 * offre qui se dépose sur Baobart ; une offre qui renvoie vers un site
 * extérieur n'en reçoit pas ici.
 */
export default async function MesOffresPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect(connexionPuis("/jobs/mes-offres"));

  const offres = await offresDe(utilisateur.id);

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
            Mes offres
          </h1>
          <p style={{ fontSize: 14, fontWeight: 600, opacity: 0.75, margin: 0 }}>
            Les missions que tu as publiées, et les candidatures qu&apos;elles ont reçues.
          </p>

          {offres.length === 0 ? (
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
              <div style={{ fontSize: 17, fontWeight: 800 }}>Tu n&apos;as encore publié aucune mission</div>
              <Link
                href="/jobs/deposer"
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
                Publier une mission
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
              {offres.map((o) => {
                const enLigne = estPublic(o.state, o.deadline);
                const recues = o._count.applications;
                return (
                  <article
                    key={o.id}
                    data-offre={o.id}
                    style={{
                      border: CADRE,
                      borderRadius: 20,
                      background: enLigne ? BLANC : "#F4EEFC",
                      boxShadow: `4px 4px 0 ${ENCRE}`,
                      padding: 18,
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, flex: "1 1 240px" }}>
                        {enLigne ? (
                          <Link href={`/jobs/${o.id}` as Route} style={{ color: ENCRE, textDecoration: "none" }}>
                            {o.title}
                          </Link>
                        ) : (
                          o.title
                        )}
                      </div>
                      <span
                        style={{
                          padding: "5px 11px",
                          border: `2px solid ${ENCRE}`,
                          borderRadius: 999,
                          background: enLigne ? VERT : "#DCDCDC",
                          fontFamily: "var(--font-mono)",
                          fontSize: 10.5,
                          fontWeight: 700,
                          textTransform: "uppercase",
                        }}
                      >
                        {enLigne ? "En ligne" : o.state === "PUBLIE" ? "Échue" : LIBELLE_ETAT[o.state]}
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
                      <span>déposée le {o.createdAt.toLocaleDateString("fr-FR")}</span>
                      {o.deadline ? <span>jusqu&apos;au {o.deadline.toLocaleDateString("fr-FR")}</span> : null}
                    </div>

                    {o.state === "REFUSE" && o.refusedReason ? (
                      <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5, marginTop: 8 }}>
                        Motif du refus : {o.refusedReason}
                      </p>
                    ) : null}

                    {o.applyMode === "BAOBART" ? (
                      <Link
                        href={`/dashboard/jobs/${o.id}/candidatures` as Route}
                        className="sticker-press"
                        style={{
                          display: "inline-block",
                          marginTop: 12,
                          padding: "10px 16px",
                          border: CADRE,
                          borderRadius: 13,
                          background: recues > 0 ? JAUNE : BLANC,
                          fontSize: 13,
                          fontWeight: 800,
                          color: ENCRE,
                        }}
                      >
                        {recues === 0 ? "Aucune candidature" : recues === 1 ? "1 candidature" : `${recues} candidatures`}
                      </Link>
                    ) : (
                      <p style={{ fontSize: 12.5, fontWeight: 600, marginTop: 10, opacity: 0.75 }}>
                        Les candidatures se déposent sur ton site : elles n&apos;arrivent pas ici.
                      </p>
                    )}
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
