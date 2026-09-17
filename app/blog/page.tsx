import Link from "next/link";
import type { Route } from "next";

import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import {
  articleALaUne,
  categoriesPubliques,
  listerPublics,
} from "@/lib/blog/queries";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, MAUVE } from "@/lib/systeme/charte";

export const metadata = {
  title: "Le blog — Baobart.",
  description:
    "Ce qu'on apprend en construisant une place de marché pour les créatifs du continent : métiers, outils, coulisses.",
};

export const dynamic = "force-dynamic";

/**
 * La liste des articles.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LECTURE PUBLIQUE, SANS CONDITION
 *
 * Voir ne demande rien, et il n'y a rien à « agir » sur un article : ni
 * inscription, ni candidature, ni commande. C'est le seul des quatre CMS dont
 * la page publique n'a aucun bouton.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN ARTICLE EN TÊTE, MÊME QUAND AUCUN N'EST « À LA UNE »
 *
 * `articleALaUne` retombe sur le plus récent. Un bandeau vide vaut moins qu'un
 * bandeau qui annonce le dernier texte — et personne ne pense à cocher la case
 * sur le premier article qu'il écrit.
 */
export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ rubrique?: string }>;
}) {
  const { rubrique } = await searchParams;

  const [visiteur, une, articles, rubriques] = await Promise.all([
    sessionCourante(),
    articleALaUne(),
    listerPublics({ categorie: rubrique }),
    categoriesPubliques(),
  ]);

  // L'article de tête n'est pas répété dans la liste — sauf si l'on filtre,
  // car il n'appartient peut-être pas à la rubrique demandée.
  const suite = rubrique ? articles : articles.filter((a) => a.id !== une?.id);

  return (
    <>
      <Header utilisateur={visiteur} />

      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 72 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 20px 0" }}>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(34px,5vw,58px)",
              letterSpacing: "-1.8px",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Le blog
          </h1>
          <p
            style={{
              fontSize: 16,
              fontWeight: 500,
              lineHeight: 1.6,
              maxWidth: 640,
              margin: "12px 0 0",
              opacity: 0.8,
            }}
          >
            Ce qu&apos;on apprend en construisant une place de marché pour les
            créatifs du continent.
          </p>

          {/* ── Les rubriques ───────────────────────────────────────────── */}
          {rubriques.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 24 }}>
              <Filtre href="/blog" actif={!rubrique}>
                Tout
              </Filtre>
              {rubriques.map((r) => (
                <Filtre
                  key={r.slug}
                  href={`/blog?rubrique=${r.slug}`}
                  actif={rubrique === r.slug}
                >
                  {r.nom} · {r.combien}
                </Filtre>
              ))}
            </div>
          ) : null}

          {/* ── L'article de tête ───────────────────────────────────────── */}
          {une && !rubrique ? (
            <Link
              href={`/blog/${une.slug}` as Route}
              className="sticker-press"
              style={{
                display: "block",
                marginTop: 28,
                border: CADRE,
                borderRadius: 26,
                background: JAUNE,
                boxShadow: `7px 7px 0 ${ENCRE}`,
                padding: 28,
                color: ENCRE,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  textTransform: "uppercase",
                  letterSpacing: ".12em",
                  opacity: 0.7,
                }}
              >
                {une.aLaUne ? "À la une" : "Le dernier"}
              </div>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(24px,3.4vw,38px)",
                  lineHeight: 1.15,
                  margin: "10px 0 0",
                }}
              >
                {une.titre}
              </h2>
              <p
                style={{
                  fontSize: 15.5,
                  fontWeight: 500,
                  lineHeight: 1.6,
                  maxWidth: 680,
                  margin: "12px 0 0",
                  textWrap: "pretty",
                }}
              >
                {une.extrait}
              </p>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  marginTop: 14,
                  opacity: 0.7,
                }}
              >
                {une.auteur}
                {une.publieLe
                  ? ` · ${une.publieLe.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}`
                  : ""}
              </div>
            </Link>
          ) : null}

          {/* ── La suite ────────────────────────────────────────────────── */}
          {suite.length === 0 ? (
            <div
              style={{
                marginTop: 28,
                border: CADRE,
                borderRadius: 24,
                background: BLANC,
                boxShadow: `6px 6px 0 ${ENCRE}`,
                padding: 28,
                maxWidth: 620,
              }}
            >
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>
                {rubrique ? "Rien dans cette rubrique" : "Rien pour l'instant"}
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55, marginTop: 8 }}>
                Reviens bientôt — ou parcours{" "}
                <Link href={"/explore" as Route} style={{ color: ENCRE }}>
                  le catalogue
                </Link>{" "}
                en attendant.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
                gap: 16,
                marginTop: 28,
              }}
            >
              {suite.map((a) => (
                <Link
                  key={a.id}
                  href={`/blog/${a.slug}` as Route}
                  className="sticker-press"
                  style={{
                    display: "block",
                    border: CADRE,
                    borderRadius: 20,
                    background: BLANC,
                    boxShadow: `5px 5px 0 ${ENCRE}`,
                    padding: 20,
                    color: ENCRE,
                  }}
                >
                  {a.categorie ? (
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 10px",
                        border: `2px solid ${ENCRE}`,
                        borderRadius: 999,
                        background: MAUVE,
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: ".06em",
                      }}
                    >
                      {a.categorie.nom}
                    </span>
                  ) : null}

                  <h3
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      lineHeight: 1.3,
                      margin: "10px 0 0",
                    }}
                  >
                    {a.titre}
                  </h3>
                  <p
                    style={{
                      fontSize: 13.5,
                      fontWeight: 500,
                      lineHeight: 1.55,
                      margin: "8px 0 0",
                      opacity: 0.8,
                      textWrap: "pretty",
                    }}
                  >
                    {a.extrait}
                  </p>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10.5,
                      marginTop: 12,
                      opacity: 0.6,
                    }}
                  >
                    {a.publieLe
                      ? a.publieLe.toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          timeZone: "UTC",
                        })
                      : ""}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function Filtre({
  href,
  actif,
  children,
}: {
  href: string;
  actif: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href as Route}
      style={{
        padding: "8px 15px",
        border: CADRE,
        borderRadius: 999,
        background: actif ? ENCRE : BLANC,
        color: actif ? BLANC : ENCRE,
        fontSize: 12.5,
        fontWeight: 800,
      }}
    >
      {children}
    </Link>
  );
}
