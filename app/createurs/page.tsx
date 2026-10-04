import Link from "next/link";
import type { Route } from "next";

import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { listerCreateurs } from "@/lib/createurs/queries";
import { formatCount } from "@/lib/i18n/money";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, MAUVE } from "@/lib/systeme/charte";

export const metadata = {
  title: "Les créateurs — Baobart.",
  description:
    "Les créateurs qui publient sur Baobart : illustration, motion, photo, design.",
};

export const dynamic = "force-dynamic";

/**
 * L'annuaire des créateurs.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ON N'Y ENTRE QU'EN AYANT PUBLIÉ
 *
 * La liste part des ressources publiées, pas des comptes. Un annuaire construit
 * sur les profils listerait tous les inscrits, acheteurs compris — et
 * ressemblerait à un registre plutôt qu'à une vitrine.
 *
 * Traduit de « Baobart Accueil.dc.html », section `PAGE CREATEURS`.
 */
export default async function CreateursPage() {
  const [visiteur, createurs] = await Promise.all([
    sessionCourante(),
    listerCreateurs(),
  ]);

  return (
    <>
      <Header utilisateur={visiteur} />

      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 72 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "44px 32px 0" }}>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(30px,4vw,46px)",
              lineHeight: 1,
              letterSpacing: "-1.6px",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Les créateurs
          </h1>
          <p
            style={{
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1.55,
              margin: "12px 0 28px",
              maxWidth: 620,
              textWrap: "pretty",
            }}
          >
            Celles et ceux qui publient sur Baobart. Suis-les pour être averti de
            leurs nouvelles ressources.
          </p>

          {createurs.length === 0 ? (
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
                Personne n&apos;a encore publié
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55, marginTop: 8 }}>
                L&apos;annuaire se remplit tout seul : on y entre en publiant sa
                première ressource.
              </p>
              <Link
                href="/dashboard/produits/nouveau"
                className="sticker-press"
                style={{
                  display: "inline-block",
                  marginTop: 16,
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
                Publier une ressource
              </Link>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
                gap: 18,
              }}
            >
              {createurs.map((c) => (
                <Link
                  key={c.username}
                  href={`/@${c.username}` as Route}
                  className="sticker-press"
                  style={{
                    display: "block",
                    border: CADRE,
                    borderRadius: 22,
                    background: BLANC,
                    boxShadow: `5px 5px 0 ${ENCRE}`,
                    padding: 18,
                    color: ENCRE,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        flex: "0 0 auto",
                        border: CADRE,
                        borderRadius: 99,
                        background: c.avatarUrl
                          ? `center / cover no-repeat url(${c.avatarUrl})`
                          : `repeating-linear-gradient(135deg,${MAUVE} 0 6px,${JAUNE} 6px 13px)`,
                      }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 15.5,
                          fontWeight: 800,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {c.nom}
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.7 }}>
                        {[c.specialite, c.ville].filter(Boolean).join(" · ") ||
                          `@${c.username}`}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      marginTop: 14,
                      fontFamily: "var(--font-mono)",
                      fontSize: 10.5,
                    }}
                  >
                    <Pastille>
                      {formatCount(c.ressourcesPubliees)} ressource
                      {c.ressourcesPubliees > 1 ? "s" : ""}
                    </Pastille>
                    <Pastille>{formatCount(c.abonnes)} abonnés</Pastille>
                    {c.verifie ? <Pastille fond={JAUNE}>VÉRIFIÉ</Pastille> : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function Pastille({
  children,
  fond = "#F4EEFC",
}: {
  children: React.ReactNode;
  fond?: string;
}) {
  return (
    <span
      style={{
        padding: "6px 11px",
        border: `2px solid ${ENCRE}`,
        borderRadius: 999,
        background: fond,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}
