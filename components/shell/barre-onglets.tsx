"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

import { Icone } from "@/components/icones/icone";
import type { NomIcone } from "@/lib/icones/donnees";

/**
 * La barre d'onglets du téléphone — `Baobart Mobile.dc.html` (D2b, 20/11/2026).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QUE DIT LA MAQUETTE, À L'IDENTIQUE
 *
 * `NAV` (l. 454) : Accueil, Explorer, Achats, Atelier, Profil, avec les icônes
 * `home`, `compass`, `bag`, `dashboard`, `user`. La barre (l. 114) : collée en
 * bas, `padding: 10px 8px 12px`, filet du haut de 2,5 px, fond blanc. Chaque
 * onglet : une pastille de 52 × 32, bordée de 2 px et jaune quand il est actif,
 * l'icône en 20 px (aplat blanc si actif, lavande sinon), le libellé en 10,5 px
 * (800 si actif, 600 sinon), 56 px de large au moins.
 *
 * Elle figure sur les écrans 03 (Accueil), 04 (Tableau de bord), 06 (Badges),
 * 07 (Catalogue), 09 (Mes produits) et 10 (Statistiques) ; pas sur le
 * lancement, la connexion, le paiement ni la fiche, qui a sa barre d'achat.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * CE QUI S'AJOUTE, POUR UN VRAI TÉLÉPHONE
 *
 * - `position: fixed` et non `sticky` : la maquette la colle au bas d'un cadre
 *   de 800 px ; une page qui défile la colle au bas de l'écran.
 * - La marge de l'encoche (`env(safe-area-inset-bottom)`) : sans elle, la barre
 *   passe sous la barre d'accueil de l'iPhone (skill Halo `mobile-native` §7).
 * - Sous 620 px seulement : au-dessus, l'en-tête et les menus suffisent.
 */

const ONGLETS: { nom: NomIcone; libelle: string; href: string }[] = [
  { nom: "home", libelle: "Accueil", href: "/" },
  { nom: "compass", libelle: "Explorer", href: "/explore" },
  { nom: "bag", libelle: "Achats", href: "/dashboard/achats" },
  { nom: "dashboard", libelle: "Atelier", href: "/dashboard" },
  { nom: "user", libelle: "Profil", href: "/dashboard/profil" },
];

/** Les écrans que la maquette dessine sans la barre. */
const SANS_BARRE = [/^\/connexion/, /^\/inscription/, /^\/mot-de-passe-oublie/, /^\/reinitialiser/, /^\/acheter\//, /^\/achat\//, /^\/abonnement\//, /^\/products\//];

/** L'onglet de la page ouverte, ou aucun : une page hors des cinq n'allume rien. */
export function ongletActif(chemin: string): NomIcone | null {
  if (chemin === "/") return "home";
  if (chemin.startsWith("/explore")) return "compass";
  if (chemin.startsWith("/dashboard/achats")) return "bag";
  if (chemin.startsWith("/dashboard/profil") || chemin.startsWith("/dashboard/badges")) return "user";
  if (chemin === "/dashboard" || chemin.startsWith("/dashboard/")) return "dashboard";
  return null;
}

export function afficheBarre(chemin: string): boolean {
  return !SANS_BARRE.some((m) => m.test(chemin));
}

export function BarreOnglets() {
  const chemin = usePathname() ?? "/";
  if (!afficheBarre(chemin)) return null;
  const actif = ongletActif(chemin);

  return (
    <nav aria-label="Onglets" className="barre-onglets">
      {ONGLETS.map((o) => {
        const est = o.nom === actif;
        return (
          <Link
            key={o.nom}
            href={o.href as Route}
            aria-current={est ? "page" : undefined}
            className="barre-onglets-onglet pression"
          >
            <span
              className="barre-onglets-pastille"
              style={{ borderColor: est ? "#121212" : "transparent", background: est ? "#FFD84A" : "transparent" }}
            >
              <Icone nom={o.nom} taille={20} aplat={est ? "#FFFFFF" : "#EADFF9"} />
            </span>
            <span style={{ fontSize: 10.5, fontWeight: est ? 800 : 600 }}>{o.libelle}</span>
          </Link>
        );
      })}
    </nav>
  );
}
