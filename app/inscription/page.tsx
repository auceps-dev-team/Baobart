import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { inscrire } from "@/lib/auth/actions";
import { listerFournisseurs } from "@/lib/auth/providers";
import { sessionCourante } from "@/lib/auth/session";
import { partDuCreateur } from "@/lib/domain/fees";

export const metadata = { title: "Créer un compte — Baobart." };
export const dynamic = "force-dynamic";

export default async function InscriptionPage() {
  if (await sessionCourante()) redirect("/dashboard");

  // Le même chiffre que l'accueil et l'écran des gains : `partDuCreateur`.
  const partCreateur = partDuCreateur().directe;

  return (
    <AuthShell
      argumentaire={{
        kicker: "Rejoins la communauté",
        titre: "Crée. Partage. Vends.",
        texte:
          "Un compte gratuit suffit pour télécharger, enregistrer et collaborer. Passe créateur quand tu veux, sans exclusivité.",
        points: [
          "Des téléchargements gratuits chaque mois",
          `${partCreateur} du prix reversé aux créateurs`,
          "Paiement Mobile Money et carte bancaire",
        ],
      }}
      lienBascule="/connexion"
      libelleBascule="Se connecter"
      indiceBascule="Déjà membre ?"
    >
      <AuthForm
        mode="inscription"
        titre="Créer un compte"
        sousTitre="Deux minutes, aucune carte bancaire demandée."
        cta="Créer mon compte gratuit"
        // Accepter ce qu'on ne peut pas lire n'a pas de sens : les deux pages
        // existent depuis le 04/10, et s'ouvrent à côté pour ne pas perdre la
        // saisie.
        libelleCase={
          <>
            J&apos;accepte les{" "}
            <a href="/conditions" target="_blank" rel="noopener" style={{ color: "inherit", textDecoration: "underline" }}>
              conditions générales
            </a>{" "}
            et les{" "}
            <a href="/regles-de-publication" target="_blank" rel="noopener" style={{ color: "inherit", textDecoration: "underline" }}>
              règles de publication
            </a>
          </>
        }
        action={inscrire}
        fournisseurs={listerFournisseurs()}
        champs={[
          {
            nom: "prenom",
            label: "Prénom",
            placeholder: "Awa",
            type: "text",
            pleineLargeur: false,
          },
          {
            nom: "nom",
            label: "Nom",
            placeholder: "Diallo",
            type: "text",
            pleineLargeur: false,
          },
          {
            nom: "username",
            label: "Nom d'utilisateur",
            placeholder: "awa-diallo",
            type: "text",
            pleineLargeur: true,
          },
          {
            nom: "email",
            label: "Email",
            placeholder: "toi@studio.africa",
            type: "email",
            pleineLargeur: true,
          },
          {
            nom: "motDePasse",
            label: "Mot de passe",
            placeholder: "••••••••",
            type: "password",
            pleineLargeur: true,
            jauge: true,
          },
        ]}
        texteBas="Déjà membre ?"
        lienBas="/connexion"
        libelleLienBas="Se connecter"
      />
    </AuthShell>
  );
}
