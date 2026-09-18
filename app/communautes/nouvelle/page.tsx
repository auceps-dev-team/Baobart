import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";

import { FormulaireCommunaute } from "@/components/forum/formulaires";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { BLANC, CADRE, ENCRE, LAVANDE } from "@/lib/systeme/charte";

export const metadata = {
  title: "Ouvrir une communauté — Baobart.",
};

export const dynamic = "force-dynamic";

/**
 * Ouvrir une communauté.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * OUVRIR NE DEMANDE NI BADGE NI RÔLE
 *
 * C'est le seul des cinq espaces de contenu qui s'ouvre à tout compte
 * connecté. Le blog est réservé à l'équipe, les événements aux agences
 * badgées, les offres d'emploi et les services à qui les propose.
 *
 * Une communauté n'engage que ses membres : personne n'y arrive sans avoir
 * cliqué pour y entrer, et rien de ce qui s'y dit ne paraît sous la signature
 * de Baobart. La demander à l'administration reviendrait à n'en avoir aucune.
 *
 * La redirection vers `/connexion` n'est pas la garde — elle évite un
 * formulaire qui refuserait à l'envoi. La garde est dans l'action.
 */
export default async function NouvelleCommunautePage() {
  const visiteur = await sessionCourante();
  if (!visiteur) redirect("/connexion?suite=/communautes/nouvelle" as Route);

  return (
    <>
      <Header utilisateur={visiteur} />

      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 72 }}>
        <div style={{ maxWidth: 740, margin: "0 auto", padding: "36px 32px 0" }}>
          <Link
            href={"/communautes" as Route}
            style={{ fontSize: 13, fontWeight: 700, opacity: 0.7 }}
          >
            ← Toutes les communautés
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
            Ouvrir une communauté
          </h1>
          <p style={{ fontSize: 15.5, lineHeight: 1.5, margin: "12px 0 0", opacity: 0.8 }}>
            Tu en seras l&apos;administratrice ou l&apos;administrateur. Une
            rubrique « Général » est créée pour commencer.
          </p>

          <div
            style={{
              marginTop: 26,
              border: CADRE,
              borderRadius: 22,
              background: BLANC,
              boxShadow: `6px 6px 0 ${ENCRE}`,
              padding: 28,
            }}
          >
            <FormulaireCommunaute />
          </div>
        </div>
      </main>
    </>
  );
}
