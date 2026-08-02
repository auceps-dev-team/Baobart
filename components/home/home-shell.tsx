"use client";

import { useState, type ReactNode } from "react";

import { HeroA, HeroB, SelecteurHero, type VarianteHero } from "@/components/home/hero";
import { Rail } from "@/components/shell/rail";

/**
 * Enveloppe de l'accueil.
 *
 * La maquette lie trois choses à la variante de hero : le hero lui-même, la
 * présence du rail latéral, et le décalage à gauche de toute la page
 * (`padLeft`). C'est ici qu'on tient cet état commun.
 *
 * Le décalage suit l'ouverture du rail — 112 px replié, 268 px ouvert — et
 * retombe à zéro en variante A, où il n'y a pas de rail.
 */
export function HomeShell({ children }: { children: ReactNode }) {
  const [variante, setVariante] = useState<VarianteHero>("B");
  const [railOuvert, setRailOuvert] = useState(false);

  const decalage = variante === "B" ? (railOuvert ? 268 : 112) : 0;

  return (
    <div
      data-root="1"
      style={{
        minHeight: "100vh",
        background: "#EADFF9",
        overflowX: "hidden",
        transition: "padding-left .18s ease",
        paddingLeft: decalage,
      }}
    >
      {variante === "B" ? <Rail onOuvertureChange={setRailOuvert} /> : null}

      <SelecteurHero variante={variante} onChange={setVariante} />
      {variante === "A" ? <HeroA /> : <HeroB />}

      {children}
    </div>
  );
}
