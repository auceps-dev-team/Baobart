import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { inscrire } from "@/lib/auth/actions";
import { sessionCourante } from "@/lib/auth/session";
import { BAREME_XOF } from "@/lib/domain/fees";

export const metadata = { title: "Créer un compte — Baobart." };
export const dynamic = "force-dynamic";

export default async function InscriptionPage() {
  if (await sessionCourante()) redirect("/dashboard");

  // Le même chiffre que l'accueil, dérivé du barème plutôt que recopié.
  const partCreateur = `${100 - BAREME_XOF.directRateBp / 100} %`;

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
        libelleCase="J'accepte les conditions générales et les règles de publication"
        action={inscrire}
        avecTypeDeCompte
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
