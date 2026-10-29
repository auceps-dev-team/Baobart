"use client";

import { usePathname } from "next/navigation";

import { espaceDuChemin } from "@/lib/dashboard/nav";

/** « CRÉATEUR · ESPACE PERSONNEL », au-dessus du titre (`Baobart Dashboard.dc.html`). */
export function LigneEspace() {
  const espace = espaceDuChemin(usePathname());
  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".14em", opacity: 0.6 }}>
      {espace} · espace personnel
    </div>
  );
}
