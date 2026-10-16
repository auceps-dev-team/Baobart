"use client";

import { type CSSProperties, useEffect, useState } from "react";

import { Glyphe } from "@/components/reseaux/logos";
import { absolue, courrielDePartage, destinationsDePartage } from "@/lib/reseaux/partage";
import { nomDuReseau } from "@/lib/reseaux/reseaux";

/**
 * Le menu « Partager » : il se pose en douceur sous son bouton.
 *
 * Repris de `components/labo/explorations/menu-partage.tsx` (hors Animata).
 * L'ouverture, la fermeture au clic dehors et à Échap, la mise au premier
 * plan : tout est natif (`popover`). L'animation est en CSS
 * (`@starting-style`, `.pop` dans globals.css), le placement sous le bouton
 * par l'ancrage CSS quand il est pris en charge.
 *
 * « Copier le lien » demande du JavaScript (le presse-papiers) — d'où
 * `"use client"` ; les autres entrées sont de simples liens vers la page de
 * partage de chaque service, ouverts dans un nouvel onglet. L'adresse est
 * celle de la page, lue dans le navigateur : la fiche s'ouvre aussi en
 * modale, et c'est bien l'adresse de la fiche qu'on partage. Le partage du
 * système (`navigator.share`, surtout sur téléphone) s'ajoute quand il existe.
 *
 * Sans l'API Popover, le menu n'est pas masqué : il s'affiche sous le bouton,
 * toujours utilisable.
 *
 * Depuis v1.93.0 (16/10), il sert deux boutons de la maquette : « Partager ↗ »
 * dans la carte de prix de la fiche, et « Partager » dans l'en-tête du profil
 * (`Baobart Accueil.dc.html`, section `PROFIL CREATEUR`). Les adresses de
 * partage viennent de `lib/reseaux/partage.ts`, les mêmes que la rangée
 * `BarrePartage` ; avant, ce menu tenait sa propre liste.
 *
 * L'aperçu qu'affichera le service : la fiche déclare depuis v1.93.0 sa
 * couverture en `og:image` (`app/products/[slug]/page.tsx`). Avant, un lien
 * de fiche montrait l'image du site.
 */
export function MenuPartage({
  chemin,
  titre,
  image = null,
  cle,
  bouton = "fiche",
}: {
  /** Le chemin de la page partagée : `/products/pack-wax`, `/@awa`. */
  chemin: string;
  titre: string;
  image?: string | null;
  /** Unique sur la page : il nomme le popover et son ancre. */
  cle: string;
  /** Le bouton de la carte de prix, ou celui de l'en-tête du profil. */
  bouton?: "fiche" | "profil";
}) {
  const [url, setUrl] = useState(chemin);
  const [origine, setOrigine] = useState<string | null>(null);
  const [natif, setNatif] = useState(false);
  const [copie, setCopie] = useState<"" | "ok" | "echec">("");
  const id = `partage-${cle}`;
  const ancre = `--partage-${cle}`;

  // L'origine n'est connue que dans le navigateur.
  useEffect(() => {
    setOrigine(window.location.origin);
    setUrl(`${window.location.origin}${chemin}`);
    setNatif(typeof navigator.share === "function");
  }, [chemin]);

  const page = { url, titre, image: origine ? absolue(image, origine) : null };

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
    "flex w-full cursor-pointer items-center gap-2.5 rounded-sticker-sm px-3 py-2 text-left text-[13.5px] font-semibold text-encre hover:bg-lavande-clair focus-visible:bg-lavande-clair";

  return (
    <div style={bouton === "fiche" ? { marginTop: 10 } : undefined}>
      {bouton === "fiche" ? (
        <button
          type="button"
          popoverTarget={id}
          className="sticker-press w-full cursor-pointer rounded-[13px] border-[2.5px] border-encre bg-blanc p-[11px] text-center text-[13px] font-extrabold text-encre"
          style={{ anchorName: ancre } as CSSProperties}
        >
          Partager ↗
        </button>
      ) : (
        // La maquette du profil : blanc, sans ombre, à côté de « Suivre ».
        <button
          type="button"
          popoverTarget={id}
          className="cursor-pointer rounded-[14px] border-[2.5px] border-encre bg-blanc px-5 py-3 text-[13.5px] font-extrabold text-encre"
          style={{ anchorName: ancre, fontFamily: "inherit" } as CSSProperties}
        >
          Partager
        </button>
      )}
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
          {destinationsDePartage(page).map((d) => (
            <li key={d.reseau}>
              <a href={d.href} target="_blank" rel="noopener noreferrer" className={ligne}>
                <Glyphe reseau={d.reseau} taille={16} />
                {nomDuReseau(d.reseau)}
              </a>
            </li>
          ))}
          <li>
            <a href={courrielDePartage(page)} className={ligne}>
              Par courriel
            </a>
          </li>
        </ul>
        {/* Annonce polie du résultat de la copie : le focus ne bouge pas. */}
        <span role="status" className="sr-only">
          {copie === "ok" ? "Lien copié" : copie === "echec" ? "Copie impossible" : ""}
        </span>
      </div>
    </div>
  );
}
