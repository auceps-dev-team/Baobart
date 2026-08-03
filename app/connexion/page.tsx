import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { connecter } from "@/lib/auth/actions";
import { listerFournisseurs } from "@/lib/auth/providers";
import { sessionCourante } from "@/lib/auth/session";

export const metadata = { title: "Se connecter — Baobart." };
export const dynamic = "force-dynamic";

export default async function ConnexionPage() {
  // Déjà connecté : cette page n'a rien à offrir.
  if (await sessionCourante()) redirect("/dashboard");

  return (
    <AuthShell
      argumentaire={{
        kicker: "Bon retour",
        titre: "Ta bibliothèque t'attend",
        texte:
          "Retrouve tes collections, tes achats et les espaces partagés avec ton équipe, exactement là où tu les as laissés.",
        points: [
          "Tes collections synchronisées",
          "Tes licences et factures au même endroit",
          "Les nouveautés des créateurs que tu suis",
        ],
      }}
      lienBascule="/inscription"
      libelleBascule="Créer un compte"
      indiceBascule="Pas encore de compte ?"
    >
      <AuthForm
        mode="connexion"
        titre="Se connecter"
        sousTitre="Content de te revoir. Entre tes identifiants pour reprendre là où tu en étais."
        cta="Se connecter"
        libelleCase="Rester connecté sur cet appareil"
        action={connecter}
        fournisseurs={listerFournisseurs()}
        avecMotDePasseOublie
        champs={[
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
          },
        ]}
        texteBas="Pas encore de compte ?"
        lienBas="/inscription"
        libelleLienBas="Créer un compte"
      />
    </AuthShell>
  );
}
