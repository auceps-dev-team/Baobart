import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { FormulaireCandidature } from "@/components/jobs/formulaire-candidature";
import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { offrePublique } from "@/lib/jobs/queries";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, ORANGE } from "@/lib/systeme/charte";

export const metadata = { title: "Postuler — Baobart." };
export const dynamic = "force-dynamic";

/**
 * L'écran où l'on envoie sa candidature.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * QUATRE REFUS, TROIS PAGES
 *
 * Si l'offre n'est pas publique → 404. Si elle est externe → on renvoie sur la
 * fiche, qui pointe le site de l'annonceur. Si l'on essaie de postuler chez
 * soi → un message franc plutôt qu'une candidature qui s'écrase en base. Et si
 * l'on a déjà postulé → on le dit avant de faire remplir le formulaire une
 * seconde fois.
 *
 * Chacune de ces quatre décisions est prise à l'affichage : les mêmes gardes
 * vivent dans `postuler`, parce qu'un formulaire se contourne — mais afficher
 * un formulaire qui refuserait à l'envoi ferait perdre un temps qu'on demande
 * précisément à un candidat pressé.
 */
export default async function PostulerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect(`/connexion?suite=/jobs/${id}/postuler`);

  const offre = await offrePublique(id);
  if (!offre) notFound();

  if (offre.commentPostuler === "EXTERNE") {
    redirect(`/jobs/${id}`);
  }

  if (offre.recruteurUsername && utilisateur.id === undefined) {
    // Impossible en pratique — la session le donne — mais la condition existe
    // pour rappeler que le vrai contrôle vit dans `postuler`.
  }

  const dejaPostule = await db.jobApplication.findUnique({
    where: { jobId_userId: { jobId: id, userId: utilisateur.id } },
    select: { id: true, createdAt: true },
  });

  return (
    <>
      <Header utilisateur={utilisateur} />

      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 72 }}>
        <div style={{ maxWidth: 780, margin: "0 auto", padding: "32px 32px 0" }}>
          <Link
            href={`/jobs/${id}`}
            style={retour}
          >
            ← Retour à la mission
          </Link>

          <div style={{ marginTop: 22 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: ".12em",
                opacity: 0.65,
              }}
            >
              Mission
            </div>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(24px,3vw,36px)",
                lineHeight: 1.05,
                letterSpacing: "-1.2px",
                textTransform: "uppercase",
                margin: "6px 0 0",
              }}
            >
              {offre.titre}
            </h1>
          </div>

          {dejaPostule ? (
            <div
              style={{
                marginTop: 24,
                padding: 22,
                border: CADRE,
                borderRadius: 22,
                background: BLANC,
                boxShadow: `6px 6px 0 ${ENCRE}`,
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                Ta candidature est partie
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55, marginTop: 8 }}>
                Envoyée le{" "}
                {dejaPostule.createdAt.toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                })}
                . L&apos;annonceur te répondra directement — nous ne gardons pas
                de fil de discussion ici.
              </p>
              <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.55, marginTop: 8, opacity: 0.75 }}>
                Ton CV est conservé le temps que la mission reste ouverte. Il est
                supprimé de nos serveurs à la clôture — tu n&apos;as rien à faire.
              </p>
              <Link
                href="/jobs/mes-propositions"
                className="sticker-press"
                style={{
                  display: "inline-block",
                  marginTop: 14,
                  padding: "11px 18px",
                  border: CADRE,
                  borderRadius: 14,
                  background: JAUNE,
                  boxShadow: `4px 4px 0 ${ENCRE}`,
                  fontSize: 13.5,
                  fontWeight: 800,
                  color: ENCRE,
                }}
              >
                Mes propositions
              </Link>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  gap: 13,
                  marginTop: 22,
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
                  Ton CV part directement à l&apos;annonceur. Nous le conservons
                  le temps que la mission reste ouverte, puis nous l&apos;effaçons
                  automatiquement à la clôture.
                </div>
              </div>

              {!offre.verifiee ? (
                <div
                  style={{
                    marginTop: 14,
                    padding: 16,
                    border: CADRE,
                    borderRadius: 18,
                    background: ORANGE,
                    color: BLANC,
                  }}
                >
                  <div style={{ fontSize: 13.5, fontWeight: 800 }}>
                    Cette offre n&apos;est pas vérifiée
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5, marginTop: 6 }}>
                    Personne ne t&apos;enverra jamais d&apos;argent pour commencer,
                    et aucun recruteur sérieux ne t&apos;en demandera. Si on te
                    réclame des frais, c&apos;est une arnaque.
                  </div>
                </div>
              ) : null}

              <div style={{ marginTop: 22 }}>
                <FormulaireCandidature offreId={id} />
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

const retour = {
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
} as const;
