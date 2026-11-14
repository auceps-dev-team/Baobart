import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { DashboardFrame, DashboardPanel } from "@/components/dashboard/frame";
import { PanneauMessagesVitrine } from "@/components/dashboard/messages-vitrine";
import { FormulaireProfil } from "@/components/dashboard/profil-form";
import { sessionCourante } from "@/lib/auth/session";
import { reglerLesMessagesAction } from "@/lib/contact/actions-createur";
import { lireProfilDashboard } from "@/lib/dashboard/lectures";
import { departDuProfil } from "@/lib/profil/depart";

export const metadata = { title: "Profil de la boutique — Baobart." };
export const dynamic = "force-dynamic";

/**
 * « Profil public » de la maquette (Créateur › Profil de la boutique) :
 * « Vitrine » | « Liens & services ».
 *
 * L'écran annonçait « Éditeur de boutique à venir » alors que tout s'éditait
 * déjà, ailleurs, dans le Profil (relevé le 27/10). Le même formulaire sert ici
 * dans sa disposition « boutique » ; le Profil ne garde que l'identité. Les
 * ajouts d'après la maquette vivent ici, avec la vitrine qu'ils servent : la
 * bannière, les douze réseaux, le bouton « Contact ».
 */
export default async function BoutiquePage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion?suite=/dashboard/boutique");
  // Ouvert au palier ACHETEUR depuis le 09/11/2026 (option A de « Devenir
  // vendeur ») : l'étape 1 (« Complète ton profil ») demande la spécialité, le
  // portfolio et les réseaux, qui vivent ici dans la disposition « boutique »
  // depuis le partage du 29/10 (v1.102.0, `ee17e3e`). L'entrée de la barre
  // latérale reste masquée à l'acheteur ; on y arrive depuis `/dashboard/devenir-vendeur`.
  const profil = await lireProfilDashboard(utilisateur.id);
  const p = profil?.profile;

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Profil public"
      description="Ce que les acheteurs voient avant de te confier un projet."
      action={
        // `profilPublic(username)` (`lib/createurs/queries.ts:147`) rend `null`
        // tant qu'aucune ressource n'est publiée : n'afficher le lien vers la
        // vitrine publique qu'au palier `BOUTIQUE` évite un 404 à l'acheteur ou
        // au créateur en `ATELIER` qui prépare son profil.
        p?.username && utilisateur.progression.etape === "BOUTIQUE" ? (
          <Link
            href={`/@${p.username}` as Route}
            className="sticker-press"
            style={{ padding: "11px 18px", border: "2.5px solid #121212", borderRadius: 13, background: "#FFD84A", boxShadow: "4px 4px 0 #121212", fontSize: 13, fontWeight: 800, color: "#121212" }}
          >
            Voir mon profil public
          </Link>
        ) : undefined
      }
    >
      <FormulaireProfil
        depart={departDuProfil(p)}
        visuels={{ avatarUrl: p?.avatarUrl ?? null, bannerUrl: p?.bannerUrl ?? null }}
        email={utilisateur.email}
        disposition="boutique"
      />

      <div style={{ marginTop: 20, maxWidth: 640 }}>
        <DashboardPanel titre="Bouton « Contact »">
          <PanneauMessagesVitrine ouvert={p?.acceptsMessages ?? true} regler={reglerLesMessagesAction} />
        </DashboardPanel>
      </div>
    </DashboardFrame>
  );
}
