import Link from "next/link";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";

import { DashboardFrame } from "@/components/dashboard/frame";
import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { candidaturesRecues } from "@/lib/jobs/postuler";
import { BLANC, CADRE, ENCRE, JAUNE } from "@/lib/systeme/charte";

export const metadata = { title: "Candidatures — Baobart." };
export const dynamic = "force-dynamic";

/**
 * Les candidatures reçues sur une offre — pour son propre auteur.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA GARDE VIT DANS LA REQUÊTE
 *
 * On lit l'offre par son identifiant AVEC la condition `recruiterId = moi`.
 * Un curieux qui devinerait l'identifiant d'une offre voisine y répond 404,
 * sans qu'aucun message ne lui apprenne pourquoi.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON AFFICHE UN LIEN, PAS L'URL SIGNÉE
 *
 * Le CV n'est pas rendu dans le HTML : la page pointe vers
 * `/api/jobs/candidatures/[id]/cv`, qui refait la garde et redirige vers une
 * URL signée de cinq minutes. C'est cette route qui décide qui peut lire quoi ;
 * la page ne fait que présenter les identifiants.
 */
export default async function CandidaturesRecuesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const { id } = await params;

  const offre = await db.jobPosting.findFirst({
    where: { id, recruiterId: utilisateur.id },
    select: { id: true, title: true, state: true, deadline: true },
  });

  if (!offre) notFound();

  const candidatures = await candidaturesRecues({
    offreId: offre.id,
    recruteurId: utilisateur.id,
  });

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Candidatures reçues"
      description={`Sur « ${offre.title} ». Les CV s'ouvrent en cliquant — le lien est éphémère.`}
    >
      <Link
        href={`/jobs/${offre.id}` as Route}
        style={{
          display: "inline-block",
          padding: "10px 16px",
          border: CADRE,
          borderRadius: 13,
          background: BLANC,
          fontSize: 13,
          fontWeight: 800,
          color: ENCRE,
          marginBottom: 20,
        }}
      >
        ← Voir la fiche publique
      </Link>

      {candidatures.length === 0 ? (
        <div
          style={{
            border: CADRE,
            borderRadius: 22,
            background: BLANC,
            boxShadow: `5px 5px 0 ${ENCRE}`,
            padding: 24,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 800 }}>
            Aucune candidature pour l&apos;instant
          </div>
          <p style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.5, marginTop: 8 }}>
            Les candidats te contactent directement par courriel. Nous ne
            gardons pas de fil de discussion ici.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {candidatures.map((c) => (
            <article
              key={c.id}
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
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 800, flex: "1 1 240px" }}>
                  {c.user.profile?.displayName ?? c.user.email}
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    opacity: 0.65,
                  }}
                >
                  reçue le {c.createdAt.toLocaleDateString("fr-FR")}
                </span>
              </div>

              {/*
                L'adresse est affichée en clair : c'est la seule voie de retour
                — nous ne gardons pas de messagerie ici. Un simple `mailto:`
                ouvre le client par défaut.
              */}
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11.5,
                  marginTop: 6,
                }}
              >
                <a
                  href={`mailto:${c.user.email}?subject=Ta%20candidature%20%C3%A0%20${encodeURIComponent(offre.title)}`}
                  style={{ color: ENCRE }}
                >
                  {c.user.email}
                </a>
                {c.user.profile?.username ? (
                  <>
                    {" · "}
                    <Link
                      href={`/@${c.user.profile.username}` as Route}
                      style={{ color: ENCRE }}
                    >
                      voir son profil ↗
                    </Link>
                  </>
                ) : null}
              </div>

              {c.message ? (
                <p
                  style={{
                    fontSize: 13.5,
                    fontWeight: 500,
                    lineHeight: 1.55,
                    marginTop: 12,
                    padding: 12,
                    border: CADRE,
                    borderRadius: 14,
                    background: "#F4EEFC",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {c.message}
                </p>
              ) : (
                <p style={{ fontSize: 12.5, fontWeight: 500, marginTop: 10, opacity: 0.6 }}>
                  Pas de mot d&apos;accompagnement.
                </p>
              )}

              {c.mediaId ? (
                <a
                  href={`/api/jobs/candidatures/${c.id}/cv`}
                  className="sticker-press"
                  style={{
                    display: "inline-block",
                    marginTop: 14,
                    padding: "10px 16px",
                    border: CADRE,
                    borderRadius: 13,
                    background: JAUNE,
                    boxShadow: `3px 3px 0 ${ENCRE}`,
                    fontSize: 13,
                    fontWeight: 800,
                    color: ENCRE,
                  }}
                  // Un CV est privé : le lien signé de la route API est
                  // éphémère (cinq minutes), et on évite le préchargement
                  // pour ne pas déclencher la génération à chaque survol.
                  rel="noopener nofollow"
                >
                  Télécharger le CV (PDF)
                </a>
              ) : (
                <div style={{ fontSize: 12.5, marginTop: 10, opacity: 0.6 }}>
                  CV non joint.
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </DashboardFrame>
  );
}
