"use client";

import { usePathname, useRouter } from "next/navigation";
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
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ELLE SE FERME AUSSI QUAND L'URL PART AILLEURS
 *
 * Un créneau parallèle **survit à une navigation client** : Next ne retombe sur
 * `@modal/default.tsx` qu'au rechargement complet. Une navigation douce — un
 * invité qui clique « Acheter » et se fait envoyer vers `/connexion`, ou le lien
 * vers le profil du créateur — laissait donc la fiche affichée par-dessus la
 * page d'arrivée, avec son voile qui bloque tout.
 *
 * On lit donc le chemin courant : la modale ne se rend que tant qu'il désigne
 * une fiche produit. C'est la garde qui manquait, et elle vaut pour toutes les
 * sorties présentes et futures — aucune n'a à penser à fermer avant de partir.
 */
export function ModaleProduit({ children }: { children: ReactNode }) {
  const router = useRouter();
  const chemin = usePathname();
  const voile = useRef<HTMLDivElement>(null);

  const ouverte = chemin?.startsWith("/products/") ?? false;

  useEffect(() => {
    // Rien à écouter ni à bloquer quand la modale ne s'affiche pas : le
    // nettoyage du passage précédent a déjà rendu le défilement au fond.
    if (!ouverte) return;

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
  }, [router, ouverte]);

  if (!ouverte) return null;

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
