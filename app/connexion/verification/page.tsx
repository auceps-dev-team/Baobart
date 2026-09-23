import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { FormulaireVerification } from "@/components/auth/formulaire-verification";
import { verifierDeuxFacteurs } from "@/lib/auth/actions";
import { COOKIE_DEFI } from "@/lib/auth/deux-facteurs";

export const metadata = { title: "Vérification — Baobart." };
export const dynamic = "force-dynamic";

/**
 * Le second facteur, après le mot de passe.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * SANS COOKIE DE DÉFI, ON RENVOIE À LA CONNEXION
 *
 * Arriver ici sans défi en cours n'a qu'une explication : l'URL a été ouverte
 * à la main, ou le défi a expiré pendant qu'on cherchait son téléphone.
 *
 * Afficher le formulaire quand même donnerait un écran qui refuse tous les
 * codes sans jamais dire pourquoi — le pire des deux, parce qu'on croit que
 * son application est déréglée.
 *
 * Le cookie n'est pas une preuve : il est vérifié pour de bon à la soumission,
 * contre la table `TotpChallenge`. Sa présence ici ne sert qu'à choisir entre
 * deux écrans.
 */
export default async function VerificationPage() {
  const magasin = await cookies();

  if (!magasin.get(COOKIE_DEFI)?.value) {
    redirect("/connexion");
  }

  return (
    <AuthShell
      argumentaire={{
        kicker: "Presque",
        titre: "Une dernière preuve",
        texte:
          "Le mot de passe seul n'ouvre pas ce compte. Le code change toutes les trente secondes et ne sert qu'une fois : même intercepté, il ne vaut plus rien.",
        points: [
          "Six chiffres depuis ton application",
          "Ou un code de secours, si le téléphone manque",
          "Cinq minutes pour répondre, puis on recommence",
        ],
      }}
      lienBascule="/connexion"
      libelleBascule="Reprendre la connexion"
      indiceBascule="Changé d'avis ?"
    >
      <FormulaireVerification action={verifierDeuxFacteurs} />
    </AuthShell>
  );
}
