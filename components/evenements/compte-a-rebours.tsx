"use client";

import { useEffect, useState } from "react";

import { BLANC, CADRE, ENCRE } from "@/lib/systeme/charte";

/**
 * Le compte à rebours de la maquette — jours, heures, minutes.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL NE CALCULE RIEN AU PREMIER RENDU, ET C'EST LA SEULE FAÇON DE L'ÉCRIRE
 *
 * Un compte à rebours lit l'heure courante. Le serveur rend le sien à
 * l'instant du rendu, le navigateur recalcule le sien à l'hydratation, et les
 * deux diffèrent forcément — d'une seconde ou de trente, selon le cache. React
 * signale alors une divergence, et c'est exactement le cas que la
 * documentation cite : « Variable input such as `Date.now()` which changes
 * each time it's called ».
 *
 * On n'y répond pas par `suppressHydrationWarning` : ce serait éteindre
 * l'alarme au lieu de traiter la cause. Le premier rendu affiche donc des
 * tirets — identiques des deux côtés — et le vrai décompte n'apparaît qu'après
 * le montage, quand seul le navigateur parle.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL BAT À LA MINUTE, PAS À LA SECONDE
 *
 * La maquette n'affiche pas les secondes. Les rafraîchir soixante fois par
 * minute ferait travailler le processeur pour une valeur qu'on ne montre pas —
 * sur un téléphone d'entrée de gamme, cela se paie en batterie.
 */
export function CompteARebours({ jusqua }: { jusqua: Date }) {
  const cible = jusqua.getTime();
  const [reste, setReste] = useState<number | null>(null);

  useEffect(() => {
    const calculer = () => setReste(Math.max(0, cible - Date.now()));

    calculer();
    const battement = setInterval(calculer, 30_000);
    return () => clearInterval(battement);
  }, [cible]);

  const jours = reste === null ? null : Math.floor(reste / 86_400_000);
  const heures = reste === null ? null : Math.floor((reste % 86_400_000) / 3_600_000);
  const minutes = reste === null ? null : Math.floor((reste % 3_600_000) / 60_000);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3,1fr)",
        gap: 10,
        marginTop: 16,
      }}
    >
      <Case valeur={jours} libelle="JOURS" />
      <Case valeur={heures} libelle="HEURES" />
      <Case valeur={minutes} libelle="MIN" />
    </div>
  );
}

function Case({ valeur, libelle }: { valeur: number | null; libelle: string }) {
  return (
    <div
      style={{
        border: CADRE,
        borderRadius: 14,
        padding: 10,
        textAlign: "center",
        background: BLANC,
      }}
    >
      <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: ENCRE }}>
        {/*
          « — » avant le montage : la même chaîne au serveur et au navigateur.
          Le zéro serait un mensonge d'une fraction de seconde — et un « 00 »
          qui saute à « 06 » se remarque.
        */}
        {valeur === null ? "—" : String(valeur).padStart(2, "0")}
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.65 }}>{libelle}</div>
    </div>
  );
}
