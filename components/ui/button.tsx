import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/**
 * Bouton « Sticker ».
 *
 * Traduit de « Baobart Design System.dc.html », bloc Boutons, livraison
 * « Halo » (D1, 13/11/2026). Six variantes sur la planche :
 *
 *   | Variante   | Repos                            | Survol                    |
 *   | ---------- | -------------------------------- | ------------------------- |
 *   | primaire   | jaune, ombre 5 px                | −2/−2, ombre 8 px         |
 *   | secondaire | blanc, ombre 5 px                | −2/−2, ombre 8 px         |
 *   | contraste  | encre, texte blanc, ombre ORANGE | −2/−2, ombre 8 px orange  |
 *   | tertiaire  | lavande profond, sans ombre      | fond encre, texte blanc   |
 *   | puce       | blanc, pastille, contour 2 px    | fond jaune                |
 *   | désactivé  | lavande clair, texte à 40 %      | —                         |
 *
 * Toutes : au clic, réduites à 97 % en 140 ms (`pression`, `app/globals.css`).
 *
 * Tailles : `lg` est celle de la planche (15 × 28 px, texte 15 px), `md` celle
 * des boutons d'action de la même planche (13 × 22 px, texte 14 px). `sm`
 * n'y est pas dessinée : gardée telle qu'avant. La puce a sa propre taille,
 * quelle que soit celle demandée.
 *
 * Contraintes qui ne changent pas : tout est contouré, l'ombre est dure et à
 * 45°, le texte n'est JAMAIS jaune, et JAMAIS blanc sur lavande profond
 * (2,0:1) — d'où le texte encre de la tertiaire au repos.
 */

export type ButtonVariant =
  | "primaire" // jaune — action principale
  | "secondaire" // blanc — action neutre
  | "contraste" // encre — action forte sur fond clair
  | "tertiaire" // lavande profond — action de second plan
  | "puce"; // pastille — filtre, choix dans une liste

export type ButtonSize = "sm" | "md" | "lg";

// L'ombre de survol passe par `--ombre-survol`, que `sticker-press` lit.
const OMBRE_ENCRE =
  "shadow-[5px_5px_0_var(--color-encre)] [--ombre-survol:8px_8px_0_var(--color-encre)]";

const VARIANTS: Record<ButtonVariant, string> = {
  primaire: cn("sticker-press bg-jaune text-encre", OMBRE_ENCRE),
  secondaire: cn("sticker-press bg-blanc text-encre", OMBRE_ENCRE),
  // Ombre colorée : réservée aux blocs encre (ANALYSE §2.3).
  contraste:
    "sticker-press bg-encre text-blanc shadow-[5px_5px_0_var(--color-orange)] [--ombre-survol:8px_8px_0_var(--color-orange)]",
  tertiaire: "pression bg-lavande-profond text-encre hover:bg-encre hover:text-blanc",
  puce: "pression bg-blanc text-encre hover:bg-jaune",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-[13px] rounded-sticker-sm",
  md: "px-[22px] py-[13px] text-[14px] rounded-sticker-md",
  lg: "px-[28px] py-[15px] text-[15px] rounded-sticker-md",
};

/** La puce : contour de 2 px, pastille, 10 × 18 px, texte 13 px. */
const GEOMETRIE_PUCE =
  "border-2 border-encre px-[18px] py-[10px] text-[13px] rounded-pastille";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "primaire",
  size = "lg",
  className,
  disabled,
  ...props
}: ButtonProps) {
  const geometrie = variant === "puce" ? GEOMETRIE_PUCE : cn("trait", SIZES[size]);

  return (
    <button
      disabled={disabled}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 font-extrabold",
        geometrie,
        disabled
          ? "cursor-not-allowed bg-lavande-clair text-encre/40 shadow-none"
          : VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
