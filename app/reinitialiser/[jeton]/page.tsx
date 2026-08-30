import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { reinitialiserMotDePasse } from "@/lib/auth/actions";
import { verifierJeton } from "@/lib/auth/reinitialisation";

export const metadata = { title: "Nouveau mot de passe — Baobart." };

/**
 * Le lien n'est pas mis en cache, et pour deux raisons.
 *
 * La validité se juge à l'instant du clic — une page rendue d'avance dirait
 * « valable » d'un jeton périmé depuis. Et surtout, un jeton est un secret :
 * il n'a rien à faire dans un cache partagé.
 */
export const dynamic = "force-dynamic";

const ARGUMENTAIRE = {
  kicker: "Récupération",
  titre: "Choisis ta nouvelle clé",
  texte:
    "Le lien ne sert qu'une fois. Une fois le mot de passe changé, toutes tes sessions ouvertes se ferment.",
  points: [
    "Lien à usage unique, valable une heure",
    "Toutes les sessions ouvertes se ferment",
    "Aucun mot de passe stocké en clair",
  ],
};

export default async function ReinitialiserPage({
  params,
}: {
  params: Promise<{ jeton: string }>;
}) {
  const { jeton } = await params;
  const verif = await verifierJeton(jeton);

  if (!verif.valide) {
    return (
      <AuthShell
        argumentaire={ARGUMENTAIRE}
        lienBascule="/mot-de-passe-oublie"
        libelleBascule="Demander un lien"
        indiceBascule="Besoin d'un nouveau ?"
      >
        <div style={{ padding: 4 }}>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 30,
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "-.6px",
            }}
          >
            Ce lien ne marche plus
          </h1>
          <p
            style={{
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1.6,
              margin: "16px 0 0",
              textWrap: "pretty",
            }}
          >
            {verif.motif === "expire"
              ? "Il a déjà servi, ou l'heure de validité est passée. C'est voulu : un lien de réinitialisation est une clé, et une clé qui traîne indéfiniment dans une boîte mail finit par être ramassée par quelqu'un d'autre."
              : "Ce lien ne correspond à aucune demande. Vérifie que tu l'as copié en entier — les messageries en coupent parfois la fin."}
          </p>
          <Link
            href="/mot-de-passe-oublie"
            style={{
              display: "inline-block",
              marginTop: 22,
              fontSize: 14,
              fontWeight: 800,
              textDecoration: "underline",
              textUnderlineOffset: 4,
            }}
          >
            Demander un nouveau lien
          </Link>
        </div>
      </AuthShell>
    );
  }

  // Le jeton est lié à l'action côté serveur plutôt que posé dans un champ
  // caché. Il est déjà dans la barre d'adresse — ce n'est donc pas un secret de
  // plus à garder, seulement un aller-retour de moins à travers le formulaire.
  const action = reinitialiserMotDePasse.bind(null, jeton);

  return (
    <AuthShell
      argumentaire={ARGUMENTAIRE}
      lienBascule="/connexion"
      libelleBascule="Se connecter"
      indiceBascule="Tu t'en souviens ?"
    >
      <AuthForm
        mode="oubli"
        titre="Nouveau mot de passe"
        sousTitre="Choisis-le, puis retape-le pour être sûr."
        cta="Changer le mot de passe"
        libelleCase="Je comprends que mes autres sessions vont se fermer"
        action={action}
        champs={[
          {
            nom: "motDePasse",
            label: "Nouveau mot de passe",
            placeholder: "Au moins 8 caractères",
            type: "password",
            pleineLargeur: true,
            jauge: true,
          },
          {
            nom: "confirmation",
            label: "Confirmation",
            placeholder: "Le même, une seconde fois",
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
