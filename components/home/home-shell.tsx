"use client";

import { useState, type ReactNode } from "react";

import { HeroB, type ChiffresCommunaute, type Vitrine } from "@/components/home/hero";
import type { CreateurASuivre } from "@/lib/collections/espace";
import { Rail } from "@/components/shell/rail";

/**
 * Enveloppe de l'accueil.
 *
 * Le rail est une navigation permanente : la maquette le liait à la variante de
 * hero, mais ce couplage n'avait de sens que pour comparer deux directions.
 *
 * Le décalage de la page suit l'ouverture du rail — 112 px replié, 268 px
 * ouvert — comme dans la maquette.
 */
export function HomeShell({
  chiffres,
  vitrine,
  visages,
  children,
}: {
  chiffres: ChiffresCommunaute;
  vitrine: Vitrine;
  visages?: CreateurASuivre[];
  children: ReactNode;
}) {
  const [railOuvert, setRailOuvert] = useState(false);

  return (
    <div
      data-root="1"
      style={{
        minHeight: "100vh",
        background: "#EADFF9",
        // `clip` et non `hidden` (08/10) : coupe pareil ce qui déborde, mais
        // `hidden` force `overflow-y: auto` et fait de l'enveloppe un
        // conteneur de défilement — qui ne défile pas. Les animations au
        // défilement (`view()`) s'y accrochaient et restaient inertes.
        overflowX: "clip",
        transition: "padding-left .18s ease",
        paddingLeft: railOuvert ? 268 : 112,
      }}
    >
      <Rail onOuvertureChange={setRailOuvert} />
      <HeroB chiffres={chiffres} vitrine={vitrine} visages={visages} />
      {children}
    </div>
  );
}
