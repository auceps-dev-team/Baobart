import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { DashboardFrame } from "@/components/dashboard/frame";
import { ListeNotifications } from "@/components/notifications/liste";
import { sessionCourante } from "@/lib/auth/session";
import { combienNonLues, listerNotifications } from "@/lib/notifications/queries";
import { BLANC, CADRE, ENCRE, VERT } from "@/lib/systeme/charte";

export const metadata = { title: "Notifications — Baobart." };
export const dynamic = "force-dynamic";

/**
 * Le centre de notifications.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * NOTRE RÉFÉRENT N'A PAS CET ÉCRAN, ET C'EST UN CHOIX DE CONTEXTE
 *
 * Gumroad est courriel d'abord : vingt-et-un mailers, aucun modèle
 * `Notification`, et la sonnerie de vente passe par son application mobile
 * native. C'est cohérent pour lui — ses créateurs vivent dans leur boîte mail,
 * et il a une application à pousser.
 *
 * Baobart n'a ni l'un ni l'autre. Une part importante de ses utilisateurs
 * relève sa boîte rarement, et il n'y a pas d'application native. Le courriel
 * reste indispensable, mais il ne peut pas être le seul canal : ce qui s'y perd
 * est perdu.
 *
 * D'où cet écran, qui est le seul canal qu'on maîtrise de bout en bout.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL S'ADRESSE AUX DEUX PUBLICS
 *
 * Pas un écran vendeur. Un acheteur y trouve ses reçus, ses téléchargements,
 * et surtout l'annulation de l'événement où il s'était inscrit — l'avis qui
 * lui évite un déplacement pour rien.
 */
export default async function NotificationsPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) notFound();

  const [lignes, nonLues] = await Promise.all([
    listerNotifications(utilisateur.id),
    combienNonLues(utilisateur.id),
  ]);

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Notifications"
      description={
        nonLues === 0
          ? "Tout est lu."
          : `${nonLues} non lue${nonLues > 1 ? "s" : ""}.`
      }
      action={
        <Link
          href={"/dashboard/notifications/reglages" as Route}
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
          Réglages
        </Link>
      }
    >
      {lignes.length === 0 ? (
        <div
          style={{
            border: CADRE,
            borderRadius: 24,
            background: VERT,
            boxShadow: `6px 6px 0 ${ENCRE}`,
            padding: 28,
            maxWidth: 620,
          }}
        >
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>
            Rien pour l&apos;instant
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55, marginTop: 8 }}>
            Tes achats, tes ventes et les décisions sur ce que tu publies
            apparaîtront ici. Les réglages disent ce qui part aussi par
            courriel.
          </p>
        </div>
      ) : (
        <ListeNotifications lignes={lignes} nonLues={nonLues} />
      )}
    </DashboardFrame>
  );
}
