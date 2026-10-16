"use client";

import { useEffect, useRef } from "react";

/**
 * Signale une vue de la vitrine, une fois affichée.
 *
 * Par le navigateur, après l'affichage : un robot qui lit le HTML sans
 * exécuter de script ne la signale jamais. `sendBeacon` part même si l'on
 * quitte la page aussitôt, et n'attend aucune réponse. Le serveur décide
 * seul si elle compte (`app/api/vues/profils/[id]/route.ts`).
 *
 * Ne rend rien.
 */
export function CompteurDeVue({ profilId }: { profilId: string }) {
  // Le double effet du mode strict, en développement, enverrait deux fois :
  // le serveur dédoublonne, mais autant ne pas lui demander.
  const envoye = useRef(false);

  useEffect(() => {
    if (envoye.current) return;
    envoye.current = true;
    const adresse = `/api/vues/profils/${profilId}`;
    if (!navigator.sendBeacon?.(adresse)) {
      void fetch(adresse, { method: "POST", keepalive: true }).catch(() => {});
    }
  }, [profilId]);

  return null;
}
