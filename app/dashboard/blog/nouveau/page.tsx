import Link from "next/link";
import type { Route } from "next";

import { DashboardFrame } from "@/components/dashboard/frame";
import { FormulaireArticle } from "@/components/blog/formulaire";
import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import { toutesLesCategories } from "@/lib/blog/queries";
import { BLANC, CADRE, ENCRE } from "@/lib/systeme/charte";

export const metadata = { title: "Nouvel article — Baobart." };
export const dynamic = "force-dynamic";

/**
 * Écrire un article.
 *
 * Il naît en brouillon, toujours. On écrit rarement un article juste du
 * premier coup, et l'adresse publique suit le titre tant qu'il n'a pas paru —
 * ce qui laisse le droit de se raviser.
 */
export default async function NouvelArticlePage() {
  const utilisateur = await exigerLePouvoir("publier_du_contenu");
  const categories = await toutesLesCategories();

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Nouvel article"
      description="Il naîtra en brouillon. Tu le publieras quand il sera prêt."
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
      <div style={{ maxWidth: 960 }}>
        <FormulaireArticle categories={categories} />
      </div>
    </DashboardFrame>
  );
}
