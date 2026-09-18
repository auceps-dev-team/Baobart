import Link from "next/link";
import type { Route } from "next";

import { DashboardFrame } from "@/components/dashboard/frame";
import { CarteAModerer } from "@/components/moderation/carte";
import { peut } from "@/lib/auth/administration";
import { exigerUnDesPouvoirs } from "@/lib/auth/acces-administration";
import { typesRelusPar } from "@/lib/cms/droits";
import { fileDeModeration } from "@/lib/cms/moderation";
import { BLANC, CADRE, ENCRE, VERT } from "@/lib/systeme/charte";

export const metadata = { title: "File de modération — Baobart." };
export const dynamic = "force-dynamic";

/**
 * La file de relecture.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ELLE N'EST PAS SOUS `/dashboard/systeme`
 *
 * Ce dossier-là est gardé par `exigerAdministrateur`, c'est-à-dire par le
 * pouvoir de **lire l'état technique** de la plateforme. Un modérateur ne l'a
 * pas, et n'a aucune raison de l'avoir : il n'a rien à faire dans la base ni
 * dans les interrupteurs.
 *
 * Y ranger cet écran l'aurait fermé à ceux dont c'est le métier — ou aurait
 * obligé à élargir la garde du dossier, ce qui aurait ouvert la base à six
 * rôles d'un coup.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE PLUS ANCIEN EN HAUT
 *
 * Une file se vide du plus ancien. Trier à l'envers ferait vieillir
 * indéfiniment les offres du bas pendant que les nouvelles passent devant.
 */
export default async function ModerationPage() {
  // Deux pouvoirs ouvrent cet écran, et ils ne montrent pas la même chose :
  // `moderer_le_contenu` donne Jobs et Services, `publier_du_contenu` donne les
  // événements. Exiger les deux l'aurait fermé à tout le monde sauf
  // l'administrateur.
  const utilisateur = await exigerUnDesPouvoirs(
    "moderer_le_contenu",
    "publier_du_contenu",
  );
  const file = await fileDeModeration(utilisateur.role);
  const types = typesRelusPar(utilisateur.role);

  // Le forum ne passe pas par le cycle CMS : ses messages paraissent tout de
  // suite et se signalent après. Ils ont donc leur propre file, ouverte au
  // seul `moderer_le_contenu` — `publier_du_contenu` relit les événements,
  // pas les conversations.
  const voitLesSignalements = peut(utilisateur.role, "moderer_le_contenu");

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="File de modération"
      description={`${LIBELLES_TYPE.filter((l) => types.includes(l.type)).map((l) => l.pluriel).join(", ")} — rien ne paraît sans être passé par ici. Le plus ancien d'abord.`}
    >
      {voitLesSignalements ? (
        <p style={{ marginBottom: 20, fontSize: 13.5, fontWeight: 600, opacity: 0.75 }}>
          <Link
            href={"/dashboard/moderation/signalements" as Route}
            style={{ textDecoration: "underline" }}
          >
            Les signalements du forum →
          </Link>{" "}
          — des messages déjà publiés, à laisser ou à retirer.
        </p>
      ) : null}

      {file.length === 0 ? (
        <div
          style={{
            border: CADRE,
            borderRadius: 24,
            background: VERT,
            boxShadow: `6px 6px 0 ${ENCRE}`,
            padding: 28,
          }}
        >
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>
            La file est vide
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55, marginTop: 8 }}>
            Rien n&apos;attend de décision. Ce qui sera soumis apparaîtra ici,
            du plus ancien au plus récent.
          </p>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "inline-block",
              padding: "8px 14px",
              border: CADRE,
              borderRadius: 999,
              background: BLANC,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 700,
              marginBottom: 18,
            }}
          >
            {file.length} EN ATTENTE
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {file.map((element) => (
              <CarteAModerer key={element.id} element={element} />
            ))}
          </div>
        </>
      )}
    </DashboardFrame>
  );
}

/**
 * Ce que la description annonce, selon ce que la personne peut trancher.
 *
 * Écrire « offres, services et événements » à un modérateur qui ne verra
 * jamais d'événement lui ferait chercher pourquoi il n'en a pas. Le titre d'un
 * écran fait partie de sa garde : il dit ce qu'on regarde.
 */
const LIBELLES_TYPE = [
  { type: "job" as const, pluriel: "Offres d'emploi" },
  { type: "service" as const, pluriel: "services" },
  { type: "evenement" as const, pluriel: "événements" },
];
