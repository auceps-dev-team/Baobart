"use client";

import { type CSSProperties, useEffect, useState } from "react";

/**
 * Le menu « Partager » d'une fiche : il se pose en douceur sous son bouton.
 *
 * Repris de `components/labo/explorations/menu-partage.tsx` (hors Animata).
 * L'ouverture, la fermeture au clic dehors et à Échap, la mise au premier
 * plan : tout est natif (`popover`). L'animation est en CSS
 * (`@starting-style`, `.pop` dans globals.css), le placement sous le bouton
 * par l'ancrage CSS quand il est pris en charge.
 *
 * Ce qui change par rapport au labo : les entrées font quelque chose.
 * « Copier le lien » demande du JavaScript (le presse-papiers) — d'où
 * `"use client"` ; les autres sont de simples liens vers la page de partage
 * de chaque service, ouverts dans un nouvel onglet. L'adresse est celle de la
 * page, lue dans le navigateur : la fiche s'ouvre aussi en modale, et c'est
 * bien l'adresse de la fiche qu'on partage. Le partage du système
 * (`navigator.share`, surtout sur téléphone) s'ajoute quand il existe.
 *
 * Sans l'API Popover, le menu n'est pas masqué : il s'affiche sous le bouton,
 * toujours utilisable.
 *
 * Ce que ça ne règle pas : l'aperçu que montrera le service. Lu le 09/10 :
 * `generateMetadata` de `app/products/[slug]/page.tsx` ne pose ni
 * `openGraph` ni image, et aucun `opengraph-image` n'existe sous
 * `app/products/`. WhatsApp ou Facebook afficheront donc ce qu'ils trouvent.
 */
export function MenuPartage({ slug, titre }: { slug: string; titre: string }) {
  const chemin = `/products/${slug}`;
  const [url, setUrl] = useState(chemin);
  const [natif, setNatif] = useState(false);
  const [copie, setCopie] = useState<"" | "ok" | "echec">("");
  const id = `partage-${slug}`;
  const ancre = `--partage-${slug}`;

  // L'origine n'est connue que dans le navigateur.
  useEffect(() => {
    setUrl(`${window.location.origin}${chemin}`);
    setNatif(typeof navigator.share === "function");
  }, [chemin]);

  const e = encodeURIComponent;
  const services: Array<[string, string]> = [
    ["WhatsApp", `https://wa.me/?text=${e(`${titre} — ${url}`)}`],
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${e(url)}`],
    ["X", `https://twitter.com/intent/tweet?text=${e(titre)}&url=${e(url)}`],
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}`],
    ["Par courriel", `mailto:?subject=${e(titre)}&body=${e(url)}`],
  ];

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopie("ok");
    } catch {
      setCopie("echec");
    }
    setTimeout(() => setCopie(""), 2500);
  };

  const ligne =
    "block w-full cursor-pointer rounded-sticker-sm px-3 py-2 text-left text-[13.5px] font-semibold text-encre hover:bg-lavande-clair focus-visible:bg-lavande-clair";

  return (
    <div style={{ marginTop: 10 }}>
      <button
        type="button"
        popoverTarget={id}
        className="sticker-press w-full cursor-pointer rounded-[13px] border-[2.5px] border-encre bg-blanc p-[11px] text-center text-[13px] font-extrabold text-encre"
        style={{ anchorName: ancre } as CSSProperties}
      >
        Partager ↗
      </button>
      <div
        id={id}
        popover="auto"
        className="pop w-56 rounded-sticker-md border-[2.5px] border-encre bg-blanc p-2 text-encre shadow-sticker-md"
        style={{ positionAnchor: ancre } as CSSProperties}
      >
        <ul className="m-0 flex list-none flex-col p-0">
          <li>
            <button type="button" onClick={copier} className={ligne}>
              {copie === "ok" ? "Lien copié ✓" : copie === "echec" ? "Copie impossible" : "Copier le lien"}
            </button>
          </li>
          {natif ? (
            <li>
              <button
                type="button"
                onClick={() => {
                  navigator.share({ title: titre, url }).catch(() => {});
                }}
                className={ligne}
              >
                Partager avec…
              </button>
            </li>
          ) : null}
          {services.map(([nom, lien]) => (
            <li key={nom}>
              <a href={lien} target="_blank" rel="noopener noreferrer" className={ligne}>
                {nom}
              </a>
            </li>
          ))}
        </ul>
        {/* Annonce polie du résultat de la copie : le focus ne bouge pas. */}
        <span role="status" className="sr-only">
          {copie === "ok" ? "Lien copié" : copie === "echec" ? "Copie impossible" : ""}
        </span>
      </div>
    </div>
  );
}
