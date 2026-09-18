import Link from "next/link";
import { notFound } from "next/navigation";
import type { Route } from "next";

import { CorpsArticle } from "@/components/cms/corps";
import { FormulaireReponse } from "@/components/forum/formulaires";
import { GestesDeMessage, GestesDeSujet } from "@/components/forum/gestes";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import {
  compterUneVueDeSujet,
  contexteDe,
  sujetAvecMessages,
} from "@/lib/forum/queries";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE } from "@/lib/systeme/charte";

export const dynamic = "force-dynamic";

/**
 * Un sujet et sa conversation.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES MESSAGES PASSENT PAR LE MÊME LECTEUR QUE LES ARTICLES
 *
 * `CorpsArticle` lit la syntaxe de `lib/cms/corps.ts`, qui ne produit jamais
 * d'HTML : elle rend des blocs que React affiche comme du texte. C'est ce qui
 * rend sans danger d'afficher ici ce que **n'importe quel membre** a écrit —
 * une exigence plus forte que pour le blog, où trois personnes de l'équipe
 * écrivent.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA VUE EST COMPTÉE SANS ÊTRE ATTENDUE
 *
 * `compterUneVueDeSujet` n'est pas `await`é avant l'affichage : un compteur
 * lent ne doit pas retarder la page, et s'il échoue, la page se rend quand
 * même. Il dit « combien de fois la page a été servie », pas « combien de
 * personnes ont lu » — ce projet ne pose pas d'identifiant sur ses visiteurs.
 */
export default async function SujetPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;

  const visiteur = await sessionCourante();
  const ctx = await contexteDe(slug, visiteur);
  if (!ctx) notFound();

  const sujet = await sujetAvecMessages(ctx, id);
  if (!sujet) notFound();

  void compterUneVueDeSujet(id);

  return (
    <>
      <Header utilisateur={visiteur} />

      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 72 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 32px 0" }}>
          <Link
            href={`/communautes/${slug}` as Route}
            style={{ fontSize: 13, fontWeight: 700, opacity: 0.7 }}
          >
            ← {ctx.communaute.nom}
          </Link>

          <header
            style={{
              marginTop: 16,
              border: CADRE,
              borderRadius: 24,
              background: JAUNE,
              boxShadow: `6px 6px 0 ${ENCRE}`,
              padding: 26,
            }}
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <Marque>{sujet.categorieNom}</Marque>
              {sujet.epingle ? <Marque>Épinglé</Marque> : null}
              {sujet.verrouille ? <Marque>Verrouillé</Marque> : null}
            </div>

            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(24px,3vw,38px)",
                lineHeight: 1.05,
                letterSpacing: "-1px",
                margin: 0,
              }}
            >
              {sujet.titre}
            </h1>

            {ctx.droits.moderer ? (
              <div style={{ marginTop: 18 }}>
                <GestesDeSujet
                  slug={slug}
                  sujetId={sujet.id}
                  epingle={sujet.epingle}
                  verrouille={sujet.verrouille}
                />
              </div>
            ) : null}
          </header>

          {/* ── La conversation ────────────────────────────────────────── */}
          <section style={{ marginTop: 26, display: "grid", gap: 16 }}>
            {sujet.messages.map((m) => (
              <article
                key={m.id}
                style={{
                  border: CADRE,
                  borderRadius: 20,
                  background: BLANC,
                  boxShadow: `4px 4px 0 ${ENCRE}`,
                  padding: 24,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    paddingBottom: 14,
                    marginBottom: 16,
                    borderBottom: CADRE,
                  }}
                >
                  <div style={{ fontSize: 13.5, fontWeight: 800 }}>
                    {m.auteurUsername ? (
                      <Link href={`/createurs/${m.auteurUsername}` as Route}>
                        {m.auteur}
                      </Link>
                    ) : (
                      m.auteur
                    )}
                    <span style={{ fontWeight: 500, opacity: 0.6, marginLeft: 8 }}>
                      {/*
                        Par l'auteur du sujet, pas par le rang : la modération
                        peut avoir retiré le premier message, et le deuxième
                        porterait alors « a ouvert le sujet ».
                      */}
                      {m.auteurId === sujet.auteurId ? "a ouvert le sujet" : "a répondu"} ·{" "}
                      {dateCourte(m.ecritLe)}
                    </span>
                  </div>

                  <GestesDeMessage
                    slug={slug}
                    sujetId={sujet.id}
                    messageId={m.id}
                    sien={m.auteurId === visiteur?.id}
                    peutRetirer={m.auteurId === visiteur?.id || ctx.droits.moderer}
                    signale={m.signale}
                    connecte={visiteur !== null}
                  />
                </div>

                <CorpsArticle corps={m.corps} />
              </article>
            ))}
          </section>

          {/* ── Répondre ───────────────────────────────────────────────── */}
          <section style={{ marginTop: 28 }}>
            {sujet.verrouille ? (
              <p
                style={{
                  padding: 22,
                  border: CADRE,
                  borderRadius: 18,
                  background: BLANC,
                  fontSize: 14.5,
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                Ce sujet est verrouillé : la conversation est close.
              </p>
            ) : ctx.droits.ecrire ? (
              <div
                style={{
                  border: CADRE,
                  borderRadius: 20,
                  background: BLANC,
                  boxShadow: `4px 4px 0 ${ENCRE}`,
                  padding: 24,
                }}
              >
                <FormulaireReponse slug={slug} sujetId={sujet.id} />
              </div>
            ) : (
              <p
                style={{
                  padding: 22,
                  border: CADRE,
                  borderRadius: 18,
                  background: BLANC,
                  fontSize: 14.5,
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                {visiteur
                  ? "Rejoins cette communauté pour répondre."
                  : "Connecte-toi et rejoins cette communauté pour répondre."}
              </p>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function Marque({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: "4px 10px",
        border: CADRE,
        borderRadius: 999,
        background: BLANC,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: ".1em",
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
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
