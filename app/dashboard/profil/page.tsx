import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { DashboardFrame, DashboardPanel } from "@/components/dashboard/frame";
import { PanneauDeuxFacteurs } from "@/components/dashboard/deux-facteurs";
import { PanneauClesAcces } from "@/components/dashboard/cles-acces";
import { PanneauEffacement } from "@/components/dashboard/effacement";
import { FacturationSecurite } from "@/components/dashboard/facturation-securite";
import { envoyerLienMotDePasse } from "@/lib/auth/actions";
import { PanneauTelephone } from "@/components/dashboard/telephone";
import { FormulaireProfil } from "@/components/dashboard/profil-form";
import {
  confirmerDeuxFacteurs,
  couperDeuxFacteurs,
  demarrerDeuxFacteurs,
  renouvelerCodesSecours,
} from "@/lib/auth/actions-2fa";
import {
  demarrerEnrolementCle,
  retirerLaCle,
} from "@/lib/auth/actions-webauthn";
import {
  confirmerTelephone,
  demanderCodeVerification,
  retirerMonTelephone,
} from "@/lib/auth/actions-telephone";
import { etatDeuxFacteurs } from "@/lib/auth/deux-facteurs";
import { codesParSmsPossibles } from "@/lib/auth/telephone";
import { listerLesCles } from "@/lib/auth/webauthn";
import { sessionCourante } from "@/lib/auth/session";
import {
  annulerMonEffacement,
  demanderMonEffacement,
} from "@/lib/rgpd/actions";
import { etatEffacement } from "@/lib/rgpd/effacement";
import { lireProfilDashboard } from "@/lib/dashboard/lectures";
import { departDuProfil } from "@/lib/profil/depart";

export const metadata = { title: "Profil — Baobart." };
export const dynamic = "force-dynamic";

function ligne(label: string, valeur: string | null | undefined) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 18,
        padding: "10px 0",
        borderBottom: "1.5px solid #12121222",
      }}
    >
      <span style={{ fontSize: 13, opacity: 0.62, fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 850, textAlign: "right" }}>
        {valeur || "—"}
      </span>
    </div>
  );
}

/**
 * Le profil, enfin modifiable.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA VITRINE EXISTAIT DEPUIS v1.45.0, RIEN NE LA REMPLISSAIT
 *
 * `/createurs/[username]` affiche la spécialité, les liens, la disponibilité
 * et le tarif indicatif. Ces colonnes existaient au schéma — mais **aucune
 * action ne les écrivait**, et cet écran annonçait « Édition bientôt
 * disponible ». Un créateur découvrait donc une page publique vide sans aucun
 * moyen d'y remédier : c'est pourtant la page que les agences visitent.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * PUBLIC ET FACTURATION RESTENT SÉPARÉS
 *
 * C'est ce que cet écran disait déjà, et c'est maintenant visible dans sa
 * forme : un formulaire pour ce qui se montre, un panneau en lecture pour ce
 * qui ne se montre pas. Les mélanger ferait qu'un jour une adresse postale
 * partirait dans une vitrine.
 */
export default async function ProfilPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion?suite=/dashboard/profil");

  const [profil, deuxFacteurs, effacement, cles] = await Promise.all([
    lireProfilDashboard(utilisateur.id),
    etatDeuxFacteurs(utilisateur.id),
    etatEffacement(utilisateur.id),
    listerLesCles(utilisateur.id),
  ]);
  const p = profil?.profile;

  const depart = departDuProfil(p);

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Profil"
      description="L'identité s'affiche sur ta page publique et quand tu commentes. La facturation reste à part — une adresse privée n'a rien à faire dans une vitrine."
      action={
        p?.username ? (
          // « Voir mon profil public » de la maquette : jaune, ombre de 4 px.
          <Link
            href={`/@${p.username}` as Route}
            className="sticker-press"
            style={{
              padding: "11px 18px",
              border: "2.5px solid #121212",
              borderRadius: 13,
              background: "#FFD84A",
              boxShadow: "4px 4px 0 #121212",
              fontSize: 13,
              fontWeight: 800,
              color: "#121212",
            }}
          >
            Voir mon profil public
          </Link>
        ) : undefined
      }
    >
      {/*
        Deux colonnes, comme la maquette (« Identité » | « Facturation &
        sécurité ») — 27/10. Tout était empilé dans 900 px : 3 901 px de
        haut, un tiers de l'écran vide à droite. À gauche ce qui se montre,
        à droite ce qui protège ; sous 960 px, les colonnes se suivent.
      */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,460px),1fr))", gap: 20, alignItems: "start" }}>
      <FormulaireProfil
        depart={depart}
        visuels={{ avatarUrl: p?.avatarUrl ?? null, bannerUrl: p?.bannerUrl ?? null }}
        email={utilisateur.email}
      />

      <div style={{ display: "grid", gap: 20, minWidth: 0 }}>
        {/*
          « Facturation & sécurité » de la maquette : l'adresse, puis le mot de
          passe. En lecture seule, et à dessein — voir le composant. La devise
          et les deux statuts de conformité, que la maquette ne montre pas,
          restent en dessous : c'est ce qui explique un refus de versement.
        */}
        <DashboardPanel titre="Facturation & sécurité">
          <FacturationSecurite
            facturation={[
              ["Prénom", profil?.billing?.firstName],
              ["Nom de famille", profil?.billing?.lastName],
              ["Adresse ligne 1", profil?.billing?.addressLine1, "pleine"],
              ["Adresse ligne 2", profil?.billing?.addressLine2, "pleine"],
              ["Ville", profil?.billing?.city],
              ["Code postal", profil?.billing?.postalCode],
              ["Pays", profil?.billing?.country],
              ["Région", profil?.billing?.region],
            ]}
            envoyerLien={envoyerLienMotDePasse}
          />
          <div style={{ marginTop: 14 }}>
            {ligne("Devise", profil?.defaultCurrency)}
            {ligne("KYC", profil?.kycStatus)}
            {ligne("Risque", profil?.riskState)}
          </div>
        </DashboardPanel>

        <DashboardPanel titre="Double authentification">
          <PanneauDeuxFacteurs
            etat={deuxFacteurs}
            demarrer={demarrerDeuxFacteurs}
            confirmer={confirmerDeuxFacteurs}
            couper={couperDeuxFacteurs}
            renouveler={renouvelerCodesSecours}
          />
        </DashboardPanel>

        <DashboardPanel titre="Clés d'accès">
          <PanneauClesAcces
            cles={cles}
            demarrer={demarrerEnrolementCle}
            retirer={retirerLaCle}
          />
        </DashboardPanel>

        <DashboardPanel titre="Numéro de téléphone">
          <PanneauTelephone
            telephone={profil?.phone ?? null}
            verifieLe={profil?.phoneVerifiedAt ?? null}
            disponible={codesParSmsPossibles()}
            demander={demanderCodeVerification}
            confirmer={confirmerTelephone}
            retirer={retirerMonTelephone}
          />
        </DashboardPanel>

        <DashboardPanel titre="Effacer mon compte">
          <PanneauEffacement
            etat={effacement}
            courriel={utilisateur.email}
            demander={demanderMonEffacement}
            annuler={annulerMonEffacement}
          />
        </DashboardPanel>
      </div>
      </div>
    </DashboardFrame>
  );
}
