import { redirect } from "next/navigation";

import { DashboardFrame } from "@/components/dashboard/frame";
import { FormulaireTemoignage } from "@/components/temoignages/formulaire";
import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { LIBELLE_STATUT } from "@/lib/temoignages/regles";
import { monTemoignage } from "@/lib/temoignages/service";
import { BLANC, CADRE, ENCRE, GRIS, JAUNE, ORANGE, VERT } from "@/lib/systeme/charte";

export const metadata = { title: "Mon témoignage — Baobart." };
export const dynamic = "force-dynamic";

const FOND = { PENDING: JAUNE, APPROVED: VERT, REJECTED: GRIS } as const;

/**
 * Le témoignage d'un membre : le proposer, le corriger, le retirer.
 *
 * Décidé le 04/10 : les témoignages de l'accueil viennent des membres, et
 * l'équipe les relit avant publication. Cet écran dit où en est le sien — et,
 * s'il a été refusé, pourquoi.
 */
export default async function MonTemoignagePage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const [t, profil] = await Promise.all([
    monTemoignage(utilisateur.id),
    db.profile.findUnique({ where: { userId: utilisateur.id }, select: { displayName: true, avatarUrl: true } }),
  ]);

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Mon témoignage"
      description="Dis ce que Baobart a changé pour toi. L'équipe le relit avant qu'il paraisse sur l'accueil."
    >
      <div style={{ display: "grid", gap: 20, maxWidth: 1000 }}>
        {t ? (
          <div
            data-statut={t.status}
            style={{ border: CADRE, borderRadius: 18, background: BLANC, boxShadow: `4px 4px 0 ${ENCRE}`, padding: 16, display: "grid", gap: 8 }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  padding: "4px 11px",
                  border: `2px solid ${ENCRE}`,
                  borderRadius: 999,
                  background: FOND[t.status],
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: ".06em",
                }}
              >
                {LIBELLE_STATUT[t.status]}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.75 }}>
                {t.status === "PENDING"
                  ? "L'équipe ne l'a pas encore relu."
                  : t.status === "APPROVED"
                    ? `Sur l'accueil depuis le ${t.publishedAt?.toLocaleDateString("fr-FR", { timeZone: "UTC" })}.`
                    : "Il ne paraît pas. Corrige-le et renvoie-le si tu le souhaites."}
              </span>
            </div>
            {t.status === "REJECTED" && t.refusedReason ? (
              <div style={{ fontSize: 13.5, fontWeight: 700, color: ORANGE }}>Motif : {t.refusedReason}</div>
            ) : null}
          </div>
        ) : null}

        <FormulaireTemoignage
          depart={{ corps: t?.body ?? "", role: t?.role ?? "" }}
          nom={profil?.displayName ?? utilisateur.nom}
          avatarUrl={profil?.avatarUrl ?? null}
          existe={t !== null}
        />
      </div>
    </DashboardFrame>
  );
}
