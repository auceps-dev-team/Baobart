import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { EtapesTelephone } from "@/components/auth/etapes-telephone";
import { BLANC, ENCRE } from "@/components/shell/nav-data";
import {
  demanderCodeConnexion,
  verifierCodeConnexion,
} from "@/lib/auth/actions-telephone";
import { sessionCourante } from "@/lib/auth/session";
import { codesParSmsPossibles } from "@/lib/auth/telephone";

export const metadata = { title: "Se connecter par téléphone — Baobart." };
export const dynamic = "force-dynamic";

/**
 * Se connecter avec un numéro de téléphone déjà vérifié.
 *
 * Sans opérateur SMS utilisable, la page le dit au lieu d'afficher un
 * formulaire qui n'enverrait rien : on n'y arrive alors que par une adresse
 * tapée à la main, le bouton restant « Bientôt disponible »
 * (`lib/auth/providers.ts`).
 */
export default async function ConnexionTelephonePage() {
  if (await sessionCourante()) redirect("/dashboard");

  const disponible = codesParSmsPossibles();

  return (
    <AuthShell
      argumentaire={{
        kicker: "Par SMS",
        titre: "Ton numéro suffit",
        texte:
          "Un code à six chiffres arrive par SMS sur le numéro que tu as vérifié dans ton profil. Il ne sert qu'une fois et expire dans dix minutes.",
        points: [
          "Pour un compte dont le numéro est déjà vérifié",
          "Ta double authentification reste exigée si tu l'as activée",
          "Personne chez Baobart ne te demandera jamais ce code",
        ],
      }}
      lienBascule="/connexion"
      libelleBascule="Avec ton adresse"
      indiceBascule="Plutôt le mot de passe ?"
    >
      <div
        style={{
          border: `2.5px solid ${ENCRE}`,
          borderRadius: 26,
          background: BLANC,
          boxShadow: `7px 7px 0 ${ENCRE}`,
          padding: "30px 28px",
          maxWidth: 440,
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 30,
            lineHeight: 1.05,
            margin: "0 0 14px",
          }}
        >
          Se connecter par téléphone
        </h1>

        {disponible ? (
          <EtapesTelephone
            demander={demanderCodeConnexion}
            verifier={verifierCodeConnexion}
            libelleEnvoi="Recevoir un code"
            libelleValidation="Se connecter"
            avecAntiBot
          />
        ) : (
          <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>
            {"La connexion par téléphone n'est pas disponible pour le moment. "}
            <Link href="/connexion" style={{ fontWeight: 800 }}>
              Connecte-toi avec ton adresse
            </Link>
            .
          </p>
        )}
      </div>
    </AuthShell>
  );
}
