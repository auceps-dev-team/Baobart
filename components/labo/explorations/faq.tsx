/**
 * Une FAQ dont les réponses se déplient en hauteur, au lieu d'apparaître.
 *
 * Hors Animata. CSS seulement, sur l'élément natif `<details>` :
 *
 * - `interpolate-size: allow-keywords` permet enfin d'animer vers
 *   `height: auto` — jusqu'ici, il fallait mesurer en JavaScript ;
 * - `::details-content` désigne la partie repliable du `<details>`, celle
 *   qu'on anime ;
 * - `content-visibility` passe en `allow-discrete` pour que le contenu reste
 *   visible pendant la fermeture.
 *
 * Tout est dans `@supports` (voir `explorations.css`) : sans prise en charge,
 * le `<details>` s'ouvre et se ferme d'un coup, comme partout ailleurs sur le
 * site. Le contenu n'est jamais caché autrement que par le navigateur lui-même.
 *
 * L'ouverture reste celle du navigateur : clavier, lecteur d'écran, et — lu,
 * non vérifié ici — la recherche dans la page de Chrome, qui ouvre le
 * `<details>` où se trouve le mot cherché. L'attribut `name` commun fait de la
 * liste un accordéon exclusif : en ouvrir un ferme l'autre.
 *
 * Composant serveur.
 */
const QUESTIONS = [
  {
    q: "Puis-je utiliser ce pack pour un client ?",
    r: "Oui : la licence commerciale couvre les travaux de commande. Seule la revente des fichiers eux-mêmes est exclue.",
  },
  {
    q: "Dans quel format sont les fichiers ?",
    r: "SVG pour les motifs, PNG en 4K pour les aperçus, ASE pour la palette. Tout est dans une archive unique.",
  },
  {
    q: "Et si le téléchargement échoue ?",
    r: "Ton lien reste valable dans « Mes achats ». Tu peux le relancer autant de fois que nécessaire.",
  },
];

export function Faq() {
  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
      {QUESTIONS.map(({ q, r }) => (
        <details
          key={q}
          name="explo-faq"
          className="explo-details rounded-sticker-md border-[2.5px] border-encre bg-blanc shadow-sticker"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-bold [&::-webkit-details-marker]:hidden">
            {q}
            <span aria-hidden className="explo-details-signe font-display text-xl leading-none">
              +
            </span>
          </summary>
          <p className="border-t-[2.5px] border-encre px-4 py-3 text-sm font-medium leading-relaxed">
            {r}
          </p>
        </details>
      ))}
    </div>
  );
}
