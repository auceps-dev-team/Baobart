import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { CorpsArticle } from "@/components/blog/corps";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { articlePublic } from "@/lib/blog/queries";
import { compterUneLecture } from "@/lib/blog/redaction";
import { urlDuSite } from "@/lib/config/site";
import { BLANC, CADRE, ENCRE, LAVANDE, MAUVE } from "@/lib/systeme/charte";

export const dynamic = "force-dynamic";

/**
 * Les métadonnées, et leurs replis.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE SEO SE REPLIE SUR LE CONTENU, IL NE LE RECOPIE PAS
 *
 * `seoTitle` et `seoDescription` sont facultatifs, et vides par défaut — c'est
 * le choix fait au schéma. Deux champs vides valent mieux que deux champs
 * recopiés à la création : recopiés, ils divergent au premier changement de
 * titre, et personne ne pense à les rouvrir.
 *
 * Le repli se fait donc ici, à l'affichage, où il est toujours à jour.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = await articlePublic(slug);

  if (!a) return { title: "Article introuvable — Baobart." };

  const base = urlDuSite();

  return {
    title: `${a.seoTitre ?? a.titre} — Baobart.`,
    description: a.seoDescription ?? a.extrait,
    // L'adresse canonique sert quand l'article a d'abord paru ailleurs : elle
    // dit aux moteurs qui est l'original, et évite qu'on se fasse compter en
    // double.
    ...(a.urlCanonique ? { alternates: { canonical: a.urlCanonique } } : {}),
    openGraph: {
      type: "article",
      title: a.seoTitre ?? a.titre,
      description: a.seoDescription ?? a.extrait,
      ...(a.publieLe ? { publishedTime: a.publieLe.toISOString() } : {}),
      ...(a.couvertureUrl
        ? {
            images: [
              a.couvertureUrl.startsWith("/") && base
                ? `${base}${a.couvertureUrl}`
                : a.couvertureUrl,
            ],
          }
        : {}),
    },
  };
}

/**
 * Un article.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE CORPS N'EST JAMAIS DE L'HTML
 *
 * `CorpsArticle` reçoit du texte et l'analyse en blocs que React affiche. Il
 * n'y a pas de `dangerouslySetInnerHTML` sur ce chemin — voir l'en-tête de
 * `lib/blog/corps.ts`.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE SEUL `dangerouslySetInnerHTML` DU PROJET, ET CE QU'IL COÛTE
 *
 * §4.3 demande un balisage JSON-LD `Article`. Il n'existe pas d'autre façon de
 * le poser : c'est un `<script>` dont le contenu doit rester du texte brut.
 *
 * La première version de ce fichier se contentait de `JSON.stringify`, avec un
 * commentaire affirmant qu'un titre contenant `</script>` en serait rendu
 * inoffensif. **C'était faux.** `JSON.stringify` échappe les guillemets et les
 * antislashs ; il ne touche pas aux chevrons. Un article intitulé
 * « Pourquoi </script> casse tout » aurait fermé la balise et laissé le reste
 * s'exécuter comme du HTML.
 *
 * `echapperPourScript` remplace donc `<` par sa forme unicode. Le JSON reste
 * valide — un analyseur JSON relit la sequence comme un chevron — et le
 * navigateur ne voit plus jamais de chevron ouvrant dans le script.
 *
 * C'est le seul endroit du projet où cette fonction React est appelée —
 * **mesuré le 17 septembre 2026**, par une recherche de
 * `dangerouslySetInnerHTML` sur tout le dépôt, une seule occurrence trouvée.
 *
 * Il ne doit pas y en avoir un second : partout ailleurs, on passe par du
 * texte que React échappe — voir `lib/blog/corps.ts`, dont l'en-tête dit ce
 * qui a été vérifié et ce qui ne l'a pas été.
 */
export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [a, visiteur] = await Promise.all([
    articlePublic(slug),
    sessionCourante(),
  ]);

  if (!a) notFound();

  // Après l'avoir trouvé, et sans attendre : un compteur qui rate ne doit pas
  // retarder l'affichage. `compterUneLecture` n'a pas le droit de lever.
  void compterUneLecture(a.id);

  const base = urlDuSite();

  return (
    <>
      <Header utilisateur={visiteur} />

      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 72 }}>
        <article style={{ maxWidth: 760, margin: "0 auto", padding: "36px 20px 0" }}>
          <Link
            href={"/blog" as Route}
            style={{ fontSize: 13, fontWeight: 800, color: ENCRE }}
          >
            ← Le blog
          </Link>

          {a.categorie ? (
            <div style={{ marginTop: 18 }}>
              <Link
                href={`/blog?rubrique=${a.categorie.slug}` as Route}
                style={{
                  display: "inline-block",
                  padding: "5px 12px",
                  border: `2px solid ${ENCRE}`,
                  borderRadius: 999,
                  background: MAUVE,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  textTransform: "uppercase",
                  letterSpacing: ".06em",
                  color: ENCRE,
                }}
              >
                {a.categorie.nom}
              </Link>
            </div>
          ) : null}

          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(30px,4.4vw,50px)",
              lineHeight: 1.12,
              letterSpacing: "-1.4px",
              margin: "16px 0 0",
            }}
          >
            {a.titre}
          </h1>

          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
              marginTop: 14,
              opacity: 0.7,
            }}
          >
            {a.auteurUsername ? (
              <Link href={`/@${a.auteurUsername}` as Route} style={{ color: ENCRE }}>
                {a.auteur}
              </Link>
            ) : (
              a.auteur
            )}
            {a.publieLe ? (
              <>
                {" · "}
                <time dateTime={a.publieLe.toISOString()}>
                  {a.publieLe.toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </time>
              </>
            ) : null}
          </div>

          <div
            style={{
              marginTop: 26,
              border: CADRE,
              borderRadius: 24,
              background: BLANC,
              boxShadow: `6px 6px 0 ${ENCRE}`,
              padding: "28px 26px",
            }}
          >
            <CorpsArticle corps={a.corps} />
          </div>
        </article>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: echapperPourScript({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: a.titre,
            description: a.seoDescription ?? a.extrait,
            author: { "@type": "Person", name: a.auteur },
            publisher: { "@type": "Organization", name: "Baobart" },
            ...(a.publieLe ? { datePublished: a.publieLe.toISOString() } : {}),
            ...(a.couvertureUrl ? { image: a.couvertureUrl } : {}),
            ...(base ? { url: `${base}/blog/${a.slug}` } : {}),
          }),
        }}
      />
    </>
  );
}

/**
 * Du JSON sûr à poser dans un `<script>`.
 *
 * `JSON.stringify` échappe les guillemets et les antislashs, pas les chevrons.
 * Un titre contenant `</script>` fermerait donc la balise, et tout ce qui
 * suit serait interprété comme du HTML.
 *
 * Remplacer `<` par `<` suffit et ne casse rien : un analyseur JSON lit
 * analyseur JSON la relit comme un chevron, et le navigateur n'en voit plus
 * aucun avant la vraie fermeture de la balise.
 */
function echapperPourScript(donnees: unknown): string {
  return JSON.stringify(donnees).replace(/</g, "\\u003c");
}
