import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { FormulaireVerification } from "@/components/auth/formulaire-verification";
import { verifierDeuxFacteurs } from "@/lib/auth/actions";
import { COOKIE_DEFI, compteDuDefi } from "@/lib/auth/deux-facteurs";
import { db } from "@/lib/db";

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
  const jeton = magasin.get(COOKIE_DEFI)?.value;

  if (!jeton) {
    redirect("/connexion");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ON NE PROPOSE LA CLÉ QUE SI LE COMPTE EN A UNE
  //
  // Afficher le bouton dans tous les cas donnerait, à qui n'a que TOTP, un
  // bouton qui ouvre une fenêtre système vide puis échoue. Et l'afficher
  // d'après l'adresse saisie renseignerait un inconnu sur la façon dont un
  // compte est protégé.
  //
  // Le cookie de défi est la seule source légitime : il prouve qu'un mot de
  // passe correct vient d'être donné.
  const userId = await compteDuDefi(jeton);
  const avecCle =
    userId !== null && (await db.passkey.count({ where: { userId } })) > 0;

  return (
    <AuthShell
      argumentaire={{
        kicker: "Presque",
        titre: "Une dernière preuve",
        texte:
          "Le mot de passe seul n'ouvre pas ce compte, ni le code reçu par SMS. Le code de ton application change toutes les trente secondes et ne sert qu'une fois : même intercepté, il ne vaut plus rien.",
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
      <FormulaireVerification action={verifierDeuxFacteurs} avecCle={avecCle} />
    </AuthShell>
  );
}
