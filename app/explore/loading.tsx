import { SqueletteExplore } from "@/components/feed/squelette-explore";
import { LAVANDE } from "@/lib/systeme/charte";

/**
 * Le squelette d'attente de l'explorateur.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IL GARDE LA PLACE EXACTE DU CONTENU
 *
 * C'est la phrase de la maquette, et c'est toute la règle. Un indicateur qui
 * tourne au milieu de l'écran annonce l'attente ; il ne prépare rien. Quand le
 * contenu arrive, la page saute — et le lecteur perd l'endroit où il allait
 * cliquer.
 *
 * Un squelette qui occupe la même surface ne saute pas. Le passage est alors
 * imperceptible, ce qui est exactement le but : on ne veut pas montrer une
 * attente, on veut la rendre supportable.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI IL EST ICI ET NON À LA RACINE
 *
 * Il y était. Les tests au navigateur l'ont refusé dans la minute, et pour une
 * raison qu'on n'aurait pas devinée : **un `loading.tsx` à la racine transforme
 * tous les 404 en 200.**
 *
 * La mécanique est implacable. Une frontière d'attente fait diffuser la réponse
 * en flux ; les en-têtes partent donc AVANT que la page ait décidé de son sort.
 * Quand `notFound()` s'exécute ensuite, le contenu affiché est bien celui de la
 * page introuvable, mais le code HTTP est déjà parti — et il dit 200.
 *
 * Concrètement : les cinq écrans d'exploitation répondaient 200 à un visiteur
 * anonyme. La page montrée était la bonne, le refus était réel, mais tout ce
 * qui lit le code — moteurs de recherche, supervision, tests — voyait une page
 * valide. La règle « 404 et non 403 » ne tient plus si le 404 n'en est pas un.
 *
 * D'où la règle : une frontière d'attente ne se pose que là où l'introuvable
 * n'est **pas** une issue possible. `/explore` existe toujours ; il la mérite,
 * et il en profite — la grille est lourde.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TRADUIT DE LA MAQUETTE, CETTE FOIS À LA LETTRE (08/10/2026)
 *
 * Source : « Baobart Parcours Achat.dc.html », bloc `CHARGEMENT` (l. 483-510)
 * et ses listes `skelChips` / `skelCards` (l. 808-809).
 *
 * La version précédente disait en être traduite, et s'en écartait partout :
 * blocs figés au lieu du balayage et de la pulsation, contour d'encre à 13 %
 * d'opacité (`${ENCRE}22`) au lieu du trait plein, aucune ombre, pas de
 * bandeau « On charge tes ressources » avec son indicateur, une grille au lieu
 * des colonnes, et d'autres hauteurs. Elle est reprise ici telle que dessinée.
 *
 * Le balisage vit dans `components/feed/squelette-explore.tsx`, pour être
 * montré aussi dans le labo. Les animations (`squelette-balaye`,
 * `squelette-pulse`, `squelette-tourne`) vivent dans `app/globals.css`, et
 * s'arrêtent sous mouvement réduit.
 */
export default function Chargement() {
  return (
    <main
      // Une seule annonce pour les lecteurs d'écran : répéter « chargement »
      // pour chaque rectangle rendrait la page inaudible.
      role="status"
      aria-label="On charge tes ressources"
      style={{ minHeight: "100vh", background: LAVANDE }}
    >
      <SqueletteExplore />
    </main>
  );
}
