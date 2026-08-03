"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

import { ENCRE, JAUNE, LAVANDE } from "@/components/shell/nav-data";

/**
 * Voile et cadre de la modale « Détail ressource ».
 *
 * La maquette ouvre la ressource par-dessus le feed. On garde ce comportement,
 * mais l'URL change quand même : la fiche reste partageable, et un accès direct
 * rend la page complète au lieu de la modale.
 *
 * Fermeture : la croix, la touche Échap, ou un clic sur le voile — trois sorties
 * plutôt qu'une, parce qu'une modale dont on ne sait pas sortir est un piège.
 */
export function ModaleProduit({ children }: { children: ReactNode }) {
  const router = useRouter();
  const voile = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const surEchap = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
    };
    document.addEventListener("keydown", surEchap);

    // Le fond ne doit pas défiler sous la modale.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", surEchap);
      document.body.style.overflow = overflow;
    };
  }, [router]);

  return (
    <div
      ref={voile}
      onClick={(e) => {
        if (e.target === voile.current) router.back();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Détail de la ressource"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(18,18,18,.55)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 24px",
        overflow: "auto",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1160,
          border: `3px solid ${ENCRE}`,
          borderRadius: 28,
          background: LAVANDE,
          boxShadow: `10px 10px 0 ${ENCRE}`,
          animation: "popin .2s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Croix de fermeture du bandeau. */
export function BoutonFermer() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Fermer"
      style={{
        width: 38,
        height: 38,
        border: `2.5px solid ${ENCRE}`,
        borderRadius: 12,
        background: JAUNE,
        display: "grid",
        placeItems: "center",
        fontSize: 16,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      ✕
    </button>
  );
}
