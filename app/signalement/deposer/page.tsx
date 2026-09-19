import Link from "next/link";
import type { Route } from "next";

import { FormulaireNotification } from "@/components/juridique/formulaire";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { CADRE, ENCRE, LAVANDE } from "@/lib/systeme/charte";

export const metadata = {
  title: "Déposer une notification — Baobart.",
  description:
    "Notifier un contenu litigieux à Baobart, selon l'article 47 de la loi ivoirienne n° 2013-451.",
};

export const dynamic = "force-dynamic";

/**
 * Le dépôt d'une notification.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * AUCUNE SESSION N'EST DEMANDÉE, ET C'EST VOULU
 *
 * La seule page publique du projet qui écrit en base sans compte. La personne
 * dont on a repris le travail n'est pas forcément inscrite sur Baobart, et lui
 * demander de créer un compte pour pouvoir se plaindre lui opposerait une
 * condition que la loi ne pose pas : l'article 47 parle de « la victime ou
 * d'une personne intéressée », sans autre qualité.
 *
 * Ce que ça coûte est réel — le formulaire est déposable en masse — et la
 * contrepartie n'est pas technique : l'article 49 punit la mauvaise foi d'un à
 * cinq ans, et le formulaire l'affiche juste avant le bouton. Une limitation
 * de débit reste à poser ; elle est notée dans la matrice, pas supposée.
 */
export default async function DeposerPage() {
  const visiteur = await sessionCourante();

  return (
    <>
      <Header utilisateur={visiteur} />

      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 80 }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "36px 32px 0" }}>
          <Link
            href={"/signalement" as Route}
            style={{ fontSize: 13, fontWeight: 700, opacity: 0.7 }}
          >
            ← Ce qu&apos;on fait de ton signalement
          </Link>

          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(28px,3.6vw,46px)",
              lineHeight: 1,
              letterSpacing: "-1.5px",
              margin: "18px 0 0",
              textTransform: "uppercase",
            }}
          >
            Notifier un contenu
          </h1>
          <p
            style={{
              fontSize: 15.5,
              lineHeight: 1.6,
              margin: "12px 0 0",
              opacity: 0.82,
              maxWidth: 620,
            }}
          >
            Six éléments sont exigés par l&apos;article 47 de la loi ivoirienne
            n° 2013-451. S&apos;il en manque, ta notification est quand même
            enregistrée avec sa date — nous te dirons lesquels compléter.
          </p>

          <div
            style={{
              marginTop: 26,
              border: CADRE,
              borderRadius: 24,
              boxShadow: `6px 6px 0 ${ENCRE}`,
              background: "transparent",
              padding: 0,
            }}
          >
            <div style={{ padding: 26, background: "transparent" }}>
              <FormulaireNotification />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
