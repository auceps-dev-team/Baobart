import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/**
 * Bouton « Sticker ».
 *
 * Contraintes du design system (ANALYSE §2.4, §4.2) :
 *  - tout est contouré ; l'ombre est dure, à 45°, jamais floue ;
 *  - micro-interaction : survol −2/−2 + ombre +3, clic +2/+2 ombre 0, 130 ms ;
 *  - le texte n'est JAMAIS jaune, et JAMAIS blanc sur lavande profond (2,0:1).
 */

export type ButtonVariant =
  | "primaire" // jaune — action principale
  | "secondaire" // blanc — action neutre
  | "contraste" // encre — action forte sur fond clair
  | "tertiaire"; // lavande profond — action de second plan

export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primaire: "bg-jaune text-encre shadow-sticker",
  secondaire: "bg-blanc text-encre shadow-sticker hover:bg-lavande-clair",
  // Ombre colorée : réservée aux blocs encre (ANALYSE §2.3).
  contraste: "bg-encre text-blanc shadow-[4px_4px_0_var(--color-orange)]",
  tertiaire: "bg-lavande-profond text-encre shadow-sticker",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-[13px] rounded-sticker-sm",
  md: "px-5 py-2.5 text-[14px] rounded-sticker-sm",
  lg: "px-7 py-3.5 text-[16px] rounded-sticker-md",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  variant = "primaire",
  size = "md",
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={cn(
        "trait inline-flex cursor-pointer items-center justify-center gap-2 font-extrabold",
        SIZES[size],
        disabled
          ? "cursor-not-allowed bg-lavande-clair text-encre/40 shadow-none"
          : cn(VARIANTS[variant], "sticker-press"),
        className,
      )}
      {...props}
    />
  );
}
