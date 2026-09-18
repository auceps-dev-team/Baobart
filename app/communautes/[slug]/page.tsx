import Link from "next/link";
import { notFound } from "next/navigation";
import type { Route } from "next";

import { CorpsArticle } from "@/components/cms/corps";
import { Adhesion } from "@/components/forum/adhesion";
import { FormulaireFil } from "@/components/forum/formulaires";
import { GestesDeMessage } from "@/components/forum/gestes";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { filDe } from "@/lib/forum/fil";
import { contexteDe } from "@/lib/forum/queries";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, VERT } from "@/lib/systeme/charte";

export const dynamic = "force-dynamic";

/**
 * Une communauté et son fil.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA FORME VIENT DE LA MAQUETTE, PAS D'UN CHOIX D'ARCHITECTURE
 *
 * `Baobart Design/Baobart Accueil.dc.html`, section `#collab` — « Vos espaces
 * d'équipe » : un en-tête avec le nom, l'effectif et un bouton, puis un flux de
 * messages, puis une zone de saisie. Rien entre les deux — pas de rubriques,
 * pas de liste de sujets à ouvrir avant de pouvoir lire.
 *
 * Ce que la maquette promet est un remplacement du groupe WhatsApp
 * (« Fini les captures d'écran par WhatsApp »), et un groupe WhatsApp n'a pas
 * de table des matières.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * `notFound()` RECOUVRE DEUX CAS
 *
 * `contexteDe` rend `null` pour une communauté qui n'existe pas **et** pour une
 * communauté fermée par l'administration. Les distinguer dirait publiquement
 * qu'un espace a été fermé, ce qui est une information sur les personnes qui
 * l'animaient.
 */
export default async function CommunautePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const visiteur = await sessionCourante();
  const ctx = await contexteDe(slug, visiteur);
  if (!ctx) notFound();

  const fil = await filDe(ctx);

  return (
    <>
      <Header utilisateur={visiteur} />

      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 72 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 32px 0" }}>
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
                <Etiquette>
                  {fil.length} message{fil.length > 1 ? "s" : ""}
                </Etiquette>
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
              connecte={visiteur !== null}
            />
          </header>

          {/* ── Le fil ─────────────────────────────────────────────────── */}
          <section style={{ marginTop: 26, display: "grid", gap: 14 }}>
            {fil.map((m) => (
              <article
                key={m.id}
                style={{
                  border: CADRE,
                  borderRadius: 18,
                  background: BLANC,
                  boxShadow: `4px 4px 0 ${ENCRE}`,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    paddingBottom: 12,
                    marginBottom: 14,
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
                      {quand(m.ecritLe)}
                    </span>
                  </div>

                  <GestesDeMessage
                    slug={slug}
                    messageId={m.id}
                    sien={m.auteurId === visiteur?.id}
                    peutRetirer={m.auteurId === visiteur?.id || ctx.droits.moderer}
                    signale={m.signale}
                    connecte={visiteur !== null}
                  />
                </div>

                {/*
                  Le même lecteur que les articles de blog. Il ne produit
                  jamais d'HTML : il rend des blocs que React affiche. C'est ce
                  qui rend sans danger d'afficher ici ce que n'importe quel
                  membre a écrit.
                */}
                <CorpsArticle corps={m.corps} />
              </article>
            ))}

            {fil.length === 0 ? (
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
                Personne n&apos;a encore écrit ici.
              </p>
            ) : null}
          </section>

          {/* ── Écrire ─────────────────────────────────────────────────── */}
          <section style={{ marginTop: 24 }}>
            {ctx.droits.ecrire ? (
              <div
                style={{
                  border: CADRE,
                  borderRadius: 20,
                  background: BLANC,
                  boxShadow: `4px 4px 0 ${ENCRE}`,
                  padding: 22,
                }}
              >
                <FormulaireFil slug={slug} />
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
                  ? "Rejoins cette communauté pour écrire."
                  : "Connecte-toi et rejoins cette communauté pour écrire."}
              </p>
            )}
          </section>
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

/**
 * « il y a 2 h », comme la maquette.
 *
 * Elle écrit « mise à jour il y a 2 h » ; une date complète sur chaque ligne
 * d'un fil serait plus précise et moins lisible. Au-delà d'une semaine, la
 * date reprend la main : « il y a 63 jours » ne dit plus rien à personne.
 */
function quand(d: Date): string {
  const minutes = Math.floor((Date.now() - d.getTime()) / 60_000);

  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;

  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;

  const jours = Math.floor(heures / 24);
  if (jours < 7) return `il y a ${jours} j`;

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}
