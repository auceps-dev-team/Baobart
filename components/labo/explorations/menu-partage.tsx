/**
 * Un menu « Partager » qui se pose en douceur, sans une ligne de JavaScript.
 *
 * Hors Animata. Trois outils récents du navigateur :
 *
 * - l'attribut `popover` et `popovertarget` : ouverture, fermeture au clic
 *   dehors et à Échap, mise au premier plan — tout est natif ;
 * - `@starting-style` : le style d'où part la transition quand l'élément
 *   APPARAÎT. Sans lui, un élément qui passe de `display: none` à visible n'a
 *   pas d'« avant », et rien ne s'anime ;
 * - `transition-behavior: allow-discrete` sur `display` et `overlay` : le menu
 *   reste affiché le temps de sa sortie au lieu de disparaître d'un coup.
 *
 * Et, quand il est pris en charge, l'ancrage CSS (`anchor-name`) pour poser le
 * menu sous son bouton. Sans lui, le navigateur centre le popover à l'écran
 * (son placement par défaut) : moins joli, mais lisible.
 *
 * Replis, du plus moderne au plus ancien (dans `explorations.css`) :
 * - sans `@starting-style` : le menu apparaît sans transition ;
 * - sans l'API Popover : `[popover]` n'est pas masqué par le navigateur, le
 *   menu est simplement affiché sous le bouton, toujours lisible. Les règles
 *   d'animation sont dans `@supports selector(:popover-open)` : elles ne
 *   peuvent pas cacher un menu qui ne s'ouvrirait jamais.
 *
 * Composant serveur.
 */
export function MenuPartage() {
  return (
    <div className="relative">
      <button
        type="button"
        popoverTarget="explo-partage"
        className="explo-ancre cursor-pointer rounded-pastille border-[2.5px] border-encre bg-blanc px-5 py-2.5 font-bold shadow-sticker sticker-press"
      >
        Partager ▾
      </button>
      <div
        id="explo-partage"
        popover="auto"
        className="explo-pop w-56 rounded-sticker-md border-[2.5px] border-encre bg-blanc p-2 text-encre shadow-sticker-md"
      >
        <ul className="flex flex-col">
          {["Copier le lien", "WhatsApp", "Facebook", "Par courriel"].map((m) => (
            <li key={m}>
              <button
                type="button"
                popoverTarget="explo-partage"
                popoverTargetAction="hide"
                className="w-full cursor-pointer rounded-sticker-sm px-3 py-2 text-left font-semibold hover:bg-lavande-clair focus-visible:bg-lavande-clair"
              >
                {m}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
