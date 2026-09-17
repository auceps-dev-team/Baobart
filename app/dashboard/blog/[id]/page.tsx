import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { DashboardFrame } from "@/components/dashboard/frame";
import { FormulaireArticle } from "@/components/blog/formulaire";
import { GestesArticle } from "@/components/blog/gestes";
import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import { articleAEditer, toutesLesCategories } from "@/lib/blog/queries";
import { LIBELLE_ETAT } from "@/lib/cms/cycle";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE } from "@/lib/systeme/charte";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const a = await articleAEditer(id);
  return { title: a ? `${a.titre} — Baobart.` : "Article introuvable — Baobart." };
}

/**
 * Corriger un article, et décider de son sort.
 *
 * Le formulaire et les gestes cohabitent : séparer « corriger » de « publier »
 * obligerait à revenir en arrière entre les deux, alors que c'est le même
 * geste dans la tête de qui écrit.
 */
export default async function EditerArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const utilisateur = await exigerLePouvoir("publier_du_contenu");
  const { id } = await params;

  const [a, categories] = await Promise.all([
    articleAEditer(id),
    toutesLesCategories(),
  ]);

  if (!a) notFound();

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre={a.titre}
      description={`${LIBELLE_ETAT[a.etat]} · /${a.slug}`}
      action={
        <Link
          href={"/dashboard/blog" as Route}
          style={{
            padding: "10px 16px",
            border: CADRE,
            borderRadius: 13,
            background: BLANC,
            fontSize: 13,
            fontWeight: 800,
            color: ENCRE,
          }}
        >
          ← Tous les articles
        </Link>
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1.8fr) minmax(0,1fr)",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <FormulaireArticle
            articleId={a.id}
            categories={categories}
            depart={{
              titre: a.titre,
              corps: a.corps,
              extrait: a.extrait ?? "",
              categorieId: a.categorieId ?? "",
              couvertureUrl: a.couvertureUrl ?? "",
              seoTitre: a.seoTitre ?? "",
              seoDescription: a.seoDescription ?? "",
              urlCanonique: a.urlCanonique ?? "",
              aLaUne: a.aLaUne ? "on" : "",
              parutionPrevue: a.parutionPrevue
                ? a.parutionPrevue.toISOString().slice(0, 16)
                : "",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {/*
            Le motif de refus passe avant tout le reste : c'est la première
            chose que son auteur doit lire en rouvrant l'article.
          */}
          {a.raisonRefus ? (
            <div
              style={{
                border: CADRE,
                borderRadius: 20,
                background: ORANGE,
                color: BLANC,
                boxShadow: `4px 4px 0 ${ENCRE}`,
                padding: 18,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 800 }}>Refusé à la relecture</div>
              <p style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.5, marginTop: 10 }}>
                {a.raisonRefus}
              </p>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 10, opacity: 0.9 }}>
                Corrige, remets en brouillon, puis renvoie en relecture.
              </div>
            </div>
          ) : null}

          <GestesArticle articleId={a.id} etat={a.etat} />

          <div
            style={{
              border: CADRE,
              borderRadius: 20,
              background: BLANC,
              boxShadow: `4px 4px 0 ${ENCRE}`,
              padding: 18,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                textTransform: "uppercase",
                letterSpacing: ".12em",
                opacity: 0.6,
                marginBottom: 12,
              }}
            >
              Affichages
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 32, lineHeight: 1 }}>
              {a.vues}
            </div>
            {/*
              Dit franchement ce que le chiffre mesure. « Affichages » et non
              « lecteurs » : rien ne distingue deux visites d'une même personne,
              parce que ce projet ne pose pas d'identifiant sur ses visiteurs.
            */}
            <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 8, opacity: 0.7 }}>
              Nombre de fois où la page a été servie — pas un nombre de
              lecteurs distincts.
            </div>
          </div>

          {a.publieLe ? (
            <div
              style={{
                border: CADRE,
                borderRadius: 20,
                background: JAUNE,
                padding: 18,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800 }}>Paru</div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  marginTop: 6,
                  opacity: 0.8,
                }}
              >
                {a.publieLe.toLocaleDateString("fr-FR", { timeZone: "UTC" })}
              </div>
              <p style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.5, marginTop: 10 }}>
                L&apos;adresse <strong>/{a.slug}</strong> est figée depuis cette
                date : des gens l&apos;ont peut-être partagée. Changer le titre
                ne la changera plus.
              </p>
              <Link
                href={`/blog/${a.slug}` as Route}
                style={{
                  display: "block",
                  marginTop: 12,
                  padding: "10px 14px",
                  border: CADRE,
                  borderRadius: 12,
                  background: BLANC,
                  textAlign: "center",
                  fontSize: 13,
                  fontWeight: 800,
                  color: ENCRE,
                }}
              >
                Voir la page publique →
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </DashboardFrame>
  );
}
