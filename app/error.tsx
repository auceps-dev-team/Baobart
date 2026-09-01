"use client";

import { useEffect } from "react";

import { BlocReference, EcranEtat } from "@/components/etats/ecran-etat";
import { BLANC, CADRE, ENCRE, ORANGE } from "@/lib/systeme/charte";

/**
 * Ce qu'on montre quand quelque chose a cassé de notre côté.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QU'IL NE FAUT SURTOUT PAS AFFICHER ICI
 *
 * Le message de l'exception. Il porte des chemins de fichiers, des noms de
 * colonnes, parfois un fragment de requête — de quoi dessiner la forme interne
 * du système à qui cherche une prise. Next.js le masque déjà en production ;
 * on ne le remet pas.
 *
 * Ce qu'on montre à la place est le `digest` : un identifiant court que Next
 * associe à la trace complète côté serveur. Le visiteur peut le citer, le
 * support peut le retrouver, et personne n'apprend rien du fonctionnement
 * interne.
 *
 * Traduit de « Baobart Parcours Achat.dc.html », écran `error`.
 */
export default function ErreurGlobale({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // La console du navigateur, et rien d'autre : le journal serveur a déjà la
    // trace complète, associée au même digest.
    console.error("écran d'erreur affiché", error.digest ?? "sans digest");
  }, [error]);

  return (
    <EcranEtat
      glyphe="!"
      fondGlyphe={ORANGE}
      kicker="Erreur de notre côté"
      titre="Quelque chose a cassé"
      texte="Ce n'est pas toi. La page n'a pas pu être construite, et l'incident est déjà enregistré chez nous. Réessayer suffit souvent — une panne passagère de base de données, par exemple, se rétablit toute seule."
      actions={[
        { label: "Revenir à l'accueil", href: "/" },
        { label: "Explorer les ressources", href: "/explore" },
      ]}
    >
      {/*
        Le bouton de reprise est un vrai bouton, pas un lien : `reset()` refait
        le rendu là où l'on est, sans perdre la navigation. Il vit donc hors de
        la liste d'actions, qui ne connaît que des liens.
      */}
      <div style={{ marginTop: 24 }}>
        <button
          type="button"
          onClick={reset}
          className="sticker-press"
          style={{
            padding: "12px 20px",
            border: CADRE,
            borderRadius: 14,
            background: ENCRE,
            color: BLANC,
            fontSize: 14,
            fontWeight: 800,
            boxShadow: `4px 4px 0 ${ORANGE}`,
            cursor: "pointer",
          }}
        >
          Réessayer
        </button>
      </div>

      {error.digest ? (
        <BlocReference
          libelle="Référence de l'incident"
          valeur={error.digest}
          note="à citer si tu écris au support — elle nous mène directement à la trace"
        />
      ) : null}
    </EcranEtat>
  );
}
