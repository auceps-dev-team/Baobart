import { BlocReference, EcranEtat } from "@/components/etats/ecran-etat";
import { JAUNE } from "@/lib/systeme/charte";

export const metadata = { title: "Page introuvable — Baobart." };

/**
 * Ce qu'on montre quand l'adresse ne mène nulle part.
 *
 * Il n'y en avait aucune : une ressource inexistante rendait le 404 par défaut
 * de Next.js — fond blanc, police système, aucun rapport avec Baobart. Le
 * visiteur croyait le site cassé plutôt que l'adresse fausse.
 *
 * Traduit de « Baobart Parcours Achat.dc.html », écran `404`.
 */
export default function PageIntrouvable() {
  return (
    <EcranEtat
      glyphe="?"
      fondGlyphe={JAUNE}
      kicker="Erreur 404"
      titre="Cette page n'existe pas"
      texte="L'adresse est fausse, ou la ressource a été retirée par son créateur. Les deux se ressemblent de l'extérieur — et dans les deux cas, il n'y a rien à réessayer ici."
      actions={[
        { label: "Explorer les ressources", href: "/explore", principale: true },
        { label: "Revenir à l'accueil", href: "/" },
      ]}
    >
      <BlocReference
        libelle="Si tu es arrivé par un lien"
        valeur="Vérifie qu'il est complet"
        note="Les messageries coupent parfois la fin d'une adresse longue — c'est la cause la plus fréquente."
      />
    </EcranEtat>
  );
}
