import Link from "next/link";
import { redirect } from "next/navigation";

import { FormulaireOffre } from "@/components/jobs/formulaire";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE } from "@/lib/systeme/charte";

export const metadata = { title: "Publier une mission — Baobart." };
export const dynamic = "force-dynamic";

/**
 * Déposer une offre d'emploi.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CET ÉCRAN MANQUAIT
 *
 * L'action de dépôt existait depuis J2, et aucune page ne l'appelait : du code
 * écrit et inatteignable, exactement la famille de défaut qu'on traque
 * ailleurs. Découvert en câblant la liste, qui voulait un lien vers ici.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL FAUT UN COMPTE, ET ON LE DIT AVANT DE FAIRE ÉCRIRE
 *
 * Voir les offres est public ; en déposer une ne l'est pas. Rediriger après
 * avoir laissé quelqu'un rédiger deux mille signes serait cruel — la garde est
 * donc ici, avant le formulaire, en plus de celle de l'action.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON ANNONCE LA RELECTURE
 *
 * Rien ne paraît sans avoir été lu. Le dire avant l'envoi évite qu'on
 * rafraîchisse la liste en cherchant son offre, puis qu'on la redépose.
 */
export default async function DeposerOffrePage() {
  const utilisateur = await sessionCourante();

  // La même redirection que l'action, mais avant la saisie plutôt qu'après.
  if (!utilisateur) redirect("/connexion?suite=/jobs/deposer");

  return (
    <>
      <Header utilisateur={utilisateur} />

      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 72 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 32px 0" }}>
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
              margin: "22px 0 0",
            }}
          >
            Publier une mission
          </h1>

          <div
            style={{
              display: "flex",
              gap: 13,
              marginTop: 18,
              padding: "16px 18px",
              border: CADRE,
              borderRadius: 18,
              background: JAUNE,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                flex: "0 0 auto",
                border: `2px solid ${ENCRE}`,
                borderRadius: 99,
                background: BLANC,
                display: "grid",
                placeItems: "center",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              !
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.5, textWrap: "pretty" }}>
              Ton offre passe par une relecture avant de paraître — compte un
              jour ou deux. C&apos;est ce qui protège les candidats des
              annonces frauduleuses, et ce qui donne son sens au badge
              « Offre vérifiée ».
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <FormulaireOffre />
          </div>
        </div>
      </main>
    </>
  );
}
