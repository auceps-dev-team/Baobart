import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { DashboardFrame } from "@/components/dashboard/frame";
import { ReglagesNotifications } from "@/components/notifications/reglages";
import { sessionCourante } from "@/lib/auth/session";
import { canauxPour, evenementsPour } from "@/lib/notifications/catalogue";
import { lirePreferences } from "@/lib/notifications/preferences";
import { BLANC, CADRE, ENCRE, JAUNE } from "@/lib/systeme/charte";

export const metadata = { title: "Réglages des notifications — Baobart." };
export const dynamic = "force-dynamic";

/**
 * Ce que chacun choisit de recevoir.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX SECTIONS, PARCE QU'IL Y A DEUX MÉTIERS
 *
 * Un acheteur n'a que faire des réglages de vente, et un vendeur qui cherche
 * « nouvelle vente » ne doit pas le trouver au milieu des reçus. Le catalogue
 * porte l'audience de chaque événement ; l'écran s'en sert pour séparer.
 *
 * Les deux sections sont montrées à tout le monde, sans condition sur l'étape
 * du compte. Quelqu'un qui n'a rien vendu verra la section vendeur, et c'est
 * voulu : elle apprend ce que la plateforme sait annoncer, et son réglage
 * l'attendra le jour où il vendra.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES IMPÉRATIFS SONT MONTRÉS, GRISÉS
 *
 * On aurait pu les cacher — un interrupteur qui ne bouge pas agace. Les
 * montrer répond à une question qu'on se pose vraiment : « est-ce que je serai
 * prévenu quand je serai payé ? » La réponse est oui, et elle doit se
 * constater.
 */
export default async function ReglagesNotificationsPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) notFound();

  const preferences = await lirePreferences(utilisateur.id);

  // Calculé côté serveur : le composant client n'a pas à relire la règle, il
  // affiche ce qui a été décidé ici. C'est aussi ce qui garantit que l'écran
  // et l'aiguilleur répondent la même chose — ils appellent la même fonction.
  const etat = (["acheteur", "vendeur"] as const).map((audience) => ({
    audience,
    evenements: evenementsPour(audience).map((e) => ({
      evenement: e,
      ouverts: canauxPour(e, preferences),
    })),
  }));

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Réglages des notifications"
      description="Ce que tu reçois, et par où. Chaque ligne se règle par canal."
      action={
        <Link
          href={"/dashboard/notifications" as Route}
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
          ← Mes notifications
        </Link>
      }
    >
      <div
        style={{
          display: "flex",
          gap: 13,
          marginBottom: 22,
          padding: "16px 18px",
          border: CADRE,
          borderRadius: 18,
          background: JAUNE,
          maxWidth: 860,
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
          Certains avis ne se coupent pas : ceux qui engagent de l&apos;argent —
          un reçu, un remboursement, un versement — et ceux qui t&apos;évitent
          un déplacement pour rien. Ils apparaissent grisés.
        </div>
      </div>

      <ReglagesNotifications sections={etat} />
    </DashboardFrame>
  );
}
