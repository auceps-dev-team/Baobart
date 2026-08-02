import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/**
 * Champ de saisie. États définis ici (manque relevé dans ANALYSE §5) :
 *  - focus  : ombre sticker + contour jaune (via :focus-visible global)
 *  - erreur : contour + message en orange sombre #B34A1F (jamais #E2622C)
 */
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  const inputId = id ?? props.name;

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="meta text-encre">
          {label}
        </label>
      ) : null}

      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error && inputId ? `${inputId}-error` : undefined}
        className={cn(
          "trait rounded-sticker-sm bg-lavande-clair px-4 py-3 text-[15px] font-medium",
          "transition-[box-shadow] duration-130 placeholder:text-encre/40",
          "focus:shadow-sticker focus:outline-none",
          error && "border-orange-sombre",
          className,
        )}
        {...props}
      />

      {error ? (
        <p
          id={inputId ? `${inputId}-error` : undefined}
          className="text-[13px] font-semibold text-orange-sombre"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
