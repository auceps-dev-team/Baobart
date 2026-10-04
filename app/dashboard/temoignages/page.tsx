import Link from "next/link";
import type { Route } from "next";

import { DashboardFrame } from "@/components/dashboard/frame";
import { DecisionTemoignage } from "@/components/temoignages/decision";
import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import { LIBELLE_STATUT } from "@/lib/temoignages/regles";
import { aModerer } from "@/lib/temoignages/service";
import { BLANC, CADRE, ENCRE, GRIS, JAUNE, VERT } from "@/lib/systeme/charte";

export const metadata = { title: "Témoignages — Baobart." };
export const dynamic = "force-dynamic";

const FOND = { PENDING: JAUNE, APPROVED: VERT, REJECTED: GRIS } as const;

/**
 * La relecture des témoignages proposés par les membres.
 *
 * Décidé le 04/10 : rien ne paraît sur l'accueil sans passer par ici. Les
 * témoignages à relire viennent en tête ; les publiés et les refusés suivent,
 * pour qu'on puisse retirer un témoignage déjà en ligne.
 */
export default async function TemoignagesPage() {
  const utilisateur = await exigerLePouvoir("promouvoir_du_contenu");
  const liste = await aModerer();
  const enAttente = liste.filter((t) => t.status === "PENDING").length;

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Témoignages"
      description={
        enAttente > 0
          ? `${enAttente} à relire. Publié, un témoignage paraît sur l'accueil avec le nom et l'avatar de son auteur.`
          : "Rien à relire. Publié, un témoignage paraît sur l'accueil avec le nom et l'avatar de son auteur."
      }
    >
      {liste.length === 0 ? (
        <div style={{ border: CADRE, borderRadius: 24, background: BLANC, boxShadow: `6px 6px 0 ${ENCRE}`, padding: 28, maxWidth: 620 }}>
          <div style={{ fontSize: 17, fontWeight: 800 }}>Aucun témoignage proposé</div>
          <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55, marginTop: 8 }}>
            Les membres proposent le leur depuis « Mon témoignage ». Tant qu&apos;aucun n&apos;est publié, la
            section « Ils nous font confiance » n&apos;apparaît pas sur l&apos;accueil.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 900 }}>
          {liste.map((t) => (
            <div
              key={t.id}
              data-temoignage={t.id}
              style={{ border: CADRE, borderRadius: 20, background: BLANC, boxShadow: `4px 4px 0 ${ENCRE}`, padding: 16, color: ENCRE }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <span
                  style={{
                    padding: "3px 10px",
                    border: `2px solid ${ENCRE}`,
                    borderRadius: 999,
                    background: FOND[t.status],
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  {LIBELLE_STATUT[t.status]}
                </span>
                {t.author.profile?.username ? (
                  <Link href={`/@${t.author.profile.username}` as Route} style={{ fontSize: 14, fontWeight: 800, color: ENCRE }}>
                    {t.author.profile.displayName}
                  </Link>
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 800 }}>{t.author.profile?.displayName ?? "Membre"}</span>
                )}
                {t.role ? <span style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.65 }}>{t.role}</span> : null}
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.55 }}>
                  {t.updatedAt.toLocaleDateString("fr-FR", { timeZone: "UTC" })}
                </span>
              </div>
              <blockquote style={{ margin: "10px 0 0", fontSize: 14.5, fontWeight: 600, lineHeight: 1.5, overflowWrap: "anywhere" }}>
                « {t.body} »
              </blockquote>
              {t.status === "REJECTED" && t.refusedReason ? (
                <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, opacity: 0.75 }}>Motif donné : {t.refusedReason}</div>
              ) : null}
              <DecisionTemoignage id={t.id} statut={t.status} sien={t.authorId === utilisateur.id} />
            </div>
          ))}
        </div>
      )}
    </DashboardFrame>
  );
}
