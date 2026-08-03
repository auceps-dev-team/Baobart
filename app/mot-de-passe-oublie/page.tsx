import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { demanderReinitialisation } from "@/lib/auth/actions";

export const metadata = { title: "Mot de passe oublié — Baobart." };

export default function MotDePasseOubliePage() {
  return (
    <AuthShell
      argumentaire={{
        kicker: "Récupération",
        titre: "On te renvoie une clé",
        texte:
          "Indique l'adresse liée à ton compte : tu reçois un lien de réinitialisation valable une heure.",
        points: [
          "Lien sécurisé à usage unique",
          "Aucun mot de passe stocké en clair",
          "Support joignable sous 48 h",
        ],
      }}
      lienBascule="/connexion"
      libelleBascule="Se connecter"
      indiceBascule="Tu t'en souviens ?"
    >
      <AuthForm
        mode="oubli"
        titre="Mot de passe oublié"
        sousTitre="Indique l'adresse liée à ton compte."
        cta="Envoyer le lien"
        libelleCase="Je confirme que cette adresse est la mienne"
        action={demanderReinitialisation}
        avecSocial={false}
        champs={[
          {
            nom: "email",
            label: "Email",
            placeholder: "toi@studio.africa",
            type: "email",
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
