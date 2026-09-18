import Link from "next/link";
import { notFound } from "next/navigation";
import type { Route } from "next";

import { Adhesion } from "@/components/forum/adhesion";
import { FormulaireSujet } from "@/components/forum/formulaires";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { categoriesDe, contexteDe, sujetsDe } from "@/lib/forum/queries";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, MAUVE, VERT } from "@/lib/systeme/charte";

export const dynamic = "force-dynamic";

/**
 * Une communauté : ses rubriques, ses sujets.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * `notFound()` RECOUVRE DEUX CAS, ET C'EST VOLONTAIRE
 *
 * `contexteDe` rend `null` aussi bien pour un espace qui n'existe pas que pour
 * un espace sur invitation dont on n'est pas membre. Les distinguer ici —
 * « privée » plutôt que « introuvable » — apprendrait son existence à qui tape
 * une adresse au hasard. C'est la même règle que pour l'annuaire.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * VOIR SANS LIRE EST UN ÉTAT À PART ENTIÈRE
 *
 * Sur une communauté privée dont on n'est pas membre, la page s'affiche : le
 * nom, la description, l'effectif, et rien d'autre. Pas de rubriques, pas de
 * sujets — non pas cachés par une condition d'affichage, mais **absents** :
 * `categoriesDe` et `sujetsDe` rendent des listes vides quand `lire` est faux.
 * L'écran ne peut donc pas les laisser fuir par distraction.
 */
export default async function CommunautePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ rubrique?: string }>;
}) {
  const { slug } = await params;
  const { rubrique } = await searchParams;

  const visiteur = await sessionCourante();
  const ctx = await contexteDe(slug, visiteur);
  if (!ctx) notFound();

  const rubriques = await categoriesDe(ctx);

  // La rubrique demandée si elle existe ici, la première sinon. Un identifiant
  // venu d'ailleurs ne désigne rien : `categoriesDe` n'a rendu que celles de
  // cette communauté.
  const courante =
    rubriques.find((r) => r.id === rubrique) ?? rubriques[0] ?? null;

  const sujets = courante ? await sujetsDe(ctx, courante.id) : [];

  return (
    <>
      <Header utilisateur={visiteur} />

      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 72 }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "36px 32px 0" }}>
          <Link
            href={"/communautes" as Route}
            style={{ fontSize: 13, fontWeight: 700, opacity: 0.7 }}
          >
            ← Toutes les communautés
          </Link>

          {/* ── L'en-tête ──────────────────────────────────────────────── */}
          <header
            style={{
              marginTop: 16,
              border: CADRE,
              borderRadius: 26,
              background: JAUNE,
              boxShadow: `7px 7px 0 ${ENCRE}`,
              padding: 30,
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) auto",
              gap: 24,
              alignItems: "center",
            }}
          >
            <div>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(28px,3.4vw,44px)",
                  lineHeight: 1,
                  letterSpacing: "-1.5px",
                  margin: 0,
                  textTransform: "uppercase",
                }}
              >
                {ctx.communaute.nom}
              </h1>

              {ctx.communaute.description ? (
                <p
                  style={{
                    fontSize: 15.5,
                    lineHeight: 1.5,
                    margin: "12px 0 0",
                    maxWidth: 620,
                    opacity: 0.82,
                  }}
                >
                  {ctx.communaute.description}
                </p>
              ) : null}

              <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                <Etiquette>
                  {ctx.communaute.membres} membre{ctx.communaute.membres > 1 ? "s" : ""}
                </Etiquette>
                {ctx.communaute.visibilite !== "PUBLIC" ? (
                  <Etiquette fond={ctx.communaute.visibilite === "PRIVATE" ? MAUVE : VERT}>
                    {ctx.communaute.visibilite === "PRIVATE" ? "Privée" : "Sur invitation"}
                  </Etiquette>
                ) : null}
                {ctx.communaute.monRole && ctx.communaute.monRole !== "MEMBER" ? (
                  <Etiquette fond={VERT}>
                    {ctx.communaute.monRole === "ADMIN" ? "Administratrice" : "Modération"}
                  </Etiquette>
                ) : null}
              </div>
            </div>

            <Adhesion
              slug={slug}
              estMembre={ctx.communaute.monRole !== null}
              estCreateur={ctx.communaute.createurId === visiteur?.id}
              visibilite={ctx.communaute.visibilite}
              connecte={visiteur !== null}
            />
          </header>

          {/* ── Ce qu'on ne peut pas lire ──────────────────────────────── */}
          {!ctx.droits.lire ? (
            <p
              style={{
                marginTop: 28,
                padding: 28,
                border: CADRE,
                borderRadius: 22,
                background: BLANC,
                fontSize: 15,
                fontWeight: 600,
                lineHeight: 1.5,
              }}
            >
              Les conversations de cette communauté sont réservées à ses
              membres.
            </p>
          ) : (
            <>
              {/* ── Les rubriques ──────────────────────────────────────── */}
              {rubriques.length > 1 ? (
                <nav style={{ display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap" }}>
                  {rubriques.map((r) => (
                    <Link
                      key={r.id}
                      href={`/communautes/${slug}?rubrique=${r.id}` as Route}
                      style={{
                        padding: "9px 16px",
                        border: CADRE,
                        borderRadius: 999,
                        background: r.id === courante?.id ? ENCRE : BLANC,
                        color: r.id === courante?.id ? BLANC : ENCRE,
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {r.nom} <span style={{ opacity: 0.6 }}>{r.sujets}</span>
                    </Link>
                  ))}
                </nav>
              ) : null}

              {/* ── Les sujets ─────────────────────────────────────────── */}
              <section style={{ marginTop: 28, display: "grid", gap: 14 }}>
                {sujets.map((s) => (
                  <Link
                    key={s.id}
                    href={`/communautes/${slug}/sujets/${s.id}` as Route}
                    className="sticker-press"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0,1fr) auto",
                      gap: 18,
                      alignItems: "center",
                      border: CADRE,
                      borderRadius: 18,
                      background: BLANC,
                      boxShadow: `4px 4px 0 ${ENCRE}`,
                      padding: "18px 22px",
                      color: ENCRE,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        {s.epingle ? <Marque>Épinglé</Marque> : null}
                        {s.verrouille ? <Marque>Verrouillé</Marque> : null}
                        <span style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.25 }}>
                          {s.titre}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, opacity: 0.65, marginTop: 6 }}>
                        par {s.auteur} · {dateCourte(s.ouvertLe)}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, opacity: 0.75 }}>
                      {s.reponses} réponse{s.reponses > 1 ? "s" : ""}
                      <div style={{ fontWeight: 500, opacity: 0.8 }}>{s.vues} vues</div>
                    </div>
                  </Link>
                ))}

                {sujets.length === 0 ? (
                  <p
                    style={{
                      padding: 24,
                      border: CADRE,
                      borderRadius: 18,
                      background: BLANC,
                      fontSize: 14.5,
                      fontWeight: 600,
                      margin: 0,
                    }}
                  >
                    Aucun sujet ici pour l&apos;instant.
                  </p>
                ) : null}
              </section>

              {/* ── Ouvrir un sujet ────────────────────────────────────── */}
              {ctx.droits.ecrire && courante ? (
                <section
                  style={{
                    marginTop: 32,
                    border: CADRE,
                    borderRadius: 22,
                    background: BLANC,
                    boxShadow: `5px 5px 0 ${ENCRE}`,
                    padding: 26,
                  }}
                >
                  <h2
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 22,
                      textTransform: "uppercase",
                      margin: "0 0 18px",
                    }}
                  >
                    Ouvrir un sujet dans « {courante.nom} »
                  </h2>
                  <FormulaireSujet slug={slug} categorieId={courante.id} />
                </section>
              ) : null}
            </>
          )}
        </div>
      </main>
    </>
  );
}

function Etiquette({
  children,
  fond = BLANC,
}: {
  children: React.ReactNode;
  fond?: string;
}) {
  return (
    <span
      style={{
        padding: "5px 12px",
        border: CADRE,
        borderRadius: 999,
        background: fond,
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        textTransform: "uppercase",
        letterSpacing: ".1em",
      }}
    >
      {children}
    </span>
  );
}

function Marque({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: "3px 9px",
        border: CADRE,
        borderRadius: 999,
        background: JAUNE,
        fontFamily: "var(--font-mono)",
        fontSize: 9.5,
        textTransform: "uppercase",
        letterSpacing: ".08em",
      }}
    >
      {children}
    </span>
  );
}

function dateCourte(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}
