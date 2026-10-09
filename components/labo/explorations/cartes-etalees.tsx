/**
 * Le contenu d'un pack : un paquet de fichiers qu'on étale d'un clic.
 *
 * Adapté d'Animata, `animata/card/card-spread.tsx` et `card-spread.css` (MIT,
 * voir `components/labo/animata/LICENCE-animata.md`). Ce qui a changé :
 *
 * - CONTENU : les quatre widgets d'Animata (notes, liste de courses…) qu'il
 *   importait d'autres composants deviennent quatre fichiers d'un pack.
 * - CSS SANS `@apply` : l'original passe par `@reference` vers ses propres
 *   styles ; ici des propriétés écrites et les jetons de la charte
 *   (`explorations.css`, classes `explo-etale*`).
 * - L'ombre de la carte est dure, et la pile garde son décalage : on voit
 *   qu'il y a plusieurs fichiers avant de l'ouvrir.
 * - Le jaune `#ffcc00` du contour de focus devient celui du site.
 *
 * Ce qui n'a pas changé, parce que c'était bien : AUCUN JAVASCRIPT. La case à
 * cocher porte l'état, `:has()` le lit. Composant serveur.
 *
 * Repli : un navigateur sans `:has()` ne lit aucune des deux règles de
 * placement ; les cartes restent dans leur grille, à plat, toutes visibles.
 */

const FICHIERS = [
  { nom: "motif-wax-01", format: "SVG", fond: "bg-lavande-profond" },
  { nom: "motif-wax-02", format: "PNG · 4K", fond: "bg-jaune" },
  { nom: "palette", format: "ASE", fond: "bg-blanc" },
  { nom: "licence", format: "PDF", fond: "bg-orange" },
];

export function CartesEtalees() {
  return (
    <div className="explo-etale flex w-full flex-col items-center gap-4">
      <label className="explo-etale-bouton">
        <input type="checkbox" className="explo-etale-case sr-only" />
        <span className="explo-etale-ouvrir">Voir les 4 fichiers</span>
        <span className="explo-etale-fermer">Ranger</span>
      </label>
      <div className="explo-etale-scene">
        <ul className="explo-etale-grille">
          {FICHIERS.map((f) => (
            <li key={f.nom} className="explo-etale-carte">
              <div className="explo-etale-survol">
                <div className="explo-etale-interne">
                  <div className="flex h-48 flex-col overflow-clip rounded-sticker-md border-[2.5px] border-encre bg-blanc shadow-sticker">
                    <div className={`flex-1 border-b-[2.5px] border-encre ${f.fond}`} />
                    <div className="px-3 py-2">
                      <div className="truncate font-bold">{f.nom}</div>
                      <div className="meta opacity-70">{f.format}</div>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
