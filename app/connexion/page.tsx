import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { connecter } from "@/lib/auth/actions";
import { listerFournisseurs } from "@/lib/auth/providers";
import { sessionCourante } from "@/lib/auth/session";

export const metadata = { title: "Se connecter — Baobart." };
export const dynamic = "force-dynamic";

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ reinitialise?: string }>;
}) {
  // Déjà connecté : cette page n'a rien à offrir.
  if (await sessionCourante()) redirect("/dashboard");

  const { reinitialise } = await searchParams;

  return (
    <AuthShell
      argumentaire={{
        kicker: "Bon retour",
        titre: "Ta bibliothèque t'attend",
        texte:
          "Retrouve tes collections, tes achats et les espaces partagés avec ton équipe, exactement là où tu les as laissés.",
        points: [
          "Tes collections synchronisées",
          // « et factures » : aucune facture n'est émise (relevé le 04/10).
          "Tes achats et leurs clés de licence",
          "Les nouveautés des créateurs que tu suis",
        ],
      }}
      lienBascule="/inscription"
      libelleBascule="Créer un compte"
      indiceBascule="Pas encore de compte ?"
    >
      <AuthForm
        annonce={
          reinitialise === "1"
            ? "Mot de passe changé. Connecte-toi avec le nouveau."
            : undefined
        }
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
