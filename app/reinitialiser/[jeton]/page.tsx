import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { reinitialiserMotDePasse } from "@/lib/auth/actions";
import { verifierJeton } from "@/lib/auth/reinitialisation";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE } from "@/lib/systeme/charte";

export const metadata = { title: "Nouveau mot de passe — Baobart." };

/**
 * Le lien n'est pas mis en cache, et pour deux raisons.
 *
 * La validité se juge à l'instant du clic — une page rendue d'avance dirait
 * « valable » d'un jeton périmé depuis. Et surtout, un jeton est un secret :
 * il n'a rien à faire dans un cache partagé.
 */
export const dynamic = "force-dynamic";

/**
 * Trois écrans, et deux d'entre eux n'ont aucun formulaire.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN LIEN MORT MÉRITE SA PROPRE PAGE
 *
 * On arrive ici en ayant cliqué un lien reçu par courriel, souvent dans un
 * moment d'agacement — on ne se souvient plus de son mot de passe. Servir le
 * formulaire habituel avec un message d'erreur au-dessus ferait remplir des
 * champs qui ne mènent nulle part.
 *
 * La maquette retire donc le formulaire entier et le remplace par un bloc qui
 * dit *pourquoi*, puis par une seule sortie. « Rien à remplir sur cet écran »
 * est écrit noir sur jaune, parce que c'est exactement ce qu'on cherche à
 * savoir en trois secondes.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX MORTS DIFFÉRENTES, DEUX TEXTES DIFFÉRENTS
 *
 * « Périmé » veut dire : le lien a existé, et il a fait son temps. C'est
 * rassurant — le système fonctionne, il faut juste en redemander un.
 *
 * « Inconnu » veut dire : ce lien n'a jamais rien désigné. La cause la plus
 * fréquente n'est pas une attaque, c'est une messagerie qui a coupé la fin de
 * l'adresse. Le dire évite qu'on croie son compte compromis.
 *
 * Traduit de « Baobart Auth.dc.html », écrans `nouveau`, `perime`, `inconnu`.
 */

const ARGUMENTAIRES = {
  nouveau: {
    kicker: "Nouvelle clé",
    titre: "Choisis ta nouvelle clé",
    texte:
      "Le lien que tu viens d'ouvrir ne sert qu'une fois et n'est valable qu'une heure. Après ce changement, toutes tes sessions ouvertes se ferment.",
    points: [
      "Lien à usage unique, valable une heure",
      "Toutes les sessions ouvertes se ferment",
      "Aucun mot de passe stocké en clair",
    ],
  },
  perime: {
    kicker: "Lien épuisé",
    titre: "Ce lien a fait son temps",
    texte:
      "Un lien de réinitialisation est une clé. Une clé qui traîne indéfiniment dans une boîte mail finit par être ramassée par quelqu'un d'autre.",
    points: [
      "Chaque lien ne sert qu'une seule fois",
      "Une heure de validité, pas plus",
      "En demander un nouveau prend dix secondes",
    ],
  },
  inconnu: {
    kicker: "Lien introuvable",
    titre: "On ne reconnaît pas ce lien",
    texte:
      "Il ne correspond à aucune demande de réinitialisation. Le plus souvent, c'est la fin de l'adresse qui manque.",
    points: [
      "Les messageries coupent parfois la fin du lien",
      "Copie-le en entier depuis le message",
      "Sinon, demande-en un nouveau",
    ],
  },
};

const MORTS = {
  perime: {
    titre: "Ce lien ne marche plus",
    sousTitre:
      "Il a déjà servi, ou l'heure de validité est passée. C'est voulu : un lien de réinitialisation est une clé, et une clé qui traîne indéfiniment dans une boîte mail finit par être ramassée par quelqu'un d'autre.",
    glyphe: "⏱",
    etiquette: "Lien périmé ou déjà utilisé",
  },
  inconnu: {
    titre: "Ce lien est inconnu",
    sousTitre:
      "Il ne correspond à aucune demande. Vérifie que tu l'as copié en entier — les messageries en coupent parfois la fin.",
    glyphe: "?",
    etiquette: "Aucune demande correspondante",
  },
};

export default async function ReinitialiserPage({
  params,
}: {
  params: Promise<{ jeton: string }>;
}) {
  const { jeton } = await params;
  const verif = await verifierJeton(jeton);

  if (!verif.valide) {
    // `expire` couvre le lien déjà servi comme celui qui a passé l'heure : de
    // l'extérieur, les deux sont la même chose — il a existé, il est fini.
    const cas = verif.motif === "expire" ? "perime" : "inconnu";
    const mort = MORTS[cas];

    return (
      <AuthShell
        argumentaire={ARGUMENTAIRES[cas]}
        lienBascule="/connexion"
        libelleBascule="Se connecter"
        indiceBascule="Tu te souviens de ton mot de passe ?"
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(26px,3vw,36px)",
            lineHeight: 1,
            letterSpacing: "-1.4px",
            margin: "22px 0 0",
            textTransform: "uppercase",
          }}
        >
          {mort.titre}
        </h2>
        <p
          style={{
            fontSize: 14.5,
            fontWeight: 500,
            lineHeight: 1.45,
            margin: "8px 0 0",
            opacity: 0.75,
            textWrap: "pretty",
          }}
        >
          {mort.sousTitre}
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginTop: 22,
            padding: 18,
            border: CADRE,
            borderRadius: 18,
            background: JAUNE,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              flex: "0 0 auto",
              border: CADRE,
              borderRadius: 99,
              background: BLANC,
              display: "grid",
              placeItems: "center",
              fontFamily: "var(--font-display)",
              fontSize: 21,
            }}
          >
            {mort.glyphe}
          </div>
          <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{mort.etiquette}</div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                marginTop: 4,
                opacity: 0.7,
              }}
            >
              Rien à remplir sur cet écran
            </div>
          </div>
        </div>

        {/*
          Une seule sortie, et elle est la principale. Proposer aussi « se
          connecter » ici ferait hésiter quelqu'un qui, par définition, ne
          connaît plus son mot de passe — c'est déjà dans la colonne de gauche.
        */}
        <Link
          href="/mot-de-passe-oublie"
          className="sticker-press"
          style={{
            display: "block",
            marginTop: 18,
            padding: 16,
            border: CADRE,
            borderRadius: 16,
            background: ENCRE,
            color: BLANC,
            boxShadow: `5px 5px 0 ${ORANGE}`,
            textAlign: "center",
            fontSize: 15.5,
            fontWeight: 800,
          }}
        >
          Demander un nouveau lien
        </Link>
      </AuthShell>
    );
  }

  // Le jeton est lié à l'action côté serveur plutôt que posé dans un champ
  // caché. Il est déjà dans la barre d'adresse — ce n'est donc pas un secret de
  // plus à garder, seulement un aller-retour de moins à travers le formulaire.
  const action = reinitialiserMotDePasse.bind(null, jeton);

  return (
    <AuthShell
      argumentaire={ARGUMENTAIRES.nouveau}
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
            placeholder: "8 caractères minimum",
            type: "password",
            pleineLargeur: true,
            jauge: true,
          },
          {
            nom: "confirmation",
            label: "Retape-le",
            placeholder: "••••••••",
            type: "password",
            pleineLargeur: true,
          },
        ]}
        texteBas="Tu t'en souviens finalement ?"
        lienBas="/connexion"
        libelleLienBas="Retour à la connexion"
      />
    </AuthShell>
  );
}
