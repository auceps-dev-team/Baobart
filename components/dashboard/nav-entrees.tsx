"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import { BLANC, ENCRE, JAUNE, LAVANDE, ORANGE } from "@/components/shell/nav-data";
import { entreeCourante, type Groupe } from "@/lib/dashboard/nav";

/**
 * Les entrées de la barre latérale, avec l'écran ouvert marqué.
 *
 * Client parce qu'il lit l'adresse (`usePathname`) : c'est elle qui dit quel
 * écran est ouvert — voir `entreeCourante`. La barre, elle, reste un composant
 * serveur : c'est elle qui lit la base (pastilles, accès aux événements).
 *
 * Les couleurs sont celles de la maquette, mesurées le 27/10 sur
 * « Baobart Dashboard.dc.html » rendue : l'écran ouvert sur fond JAUNE, les
 * autres sans fond — une pastille compte, elle ne colore pas sa ligne.
 * Le lavande clair des captures n'était que le survol.
 */
/**
 * Les onglets du haut de la barre — « Acheteur · Créateur · Super admin » de
 * la maquette. Ajoutés le 27/10 à la demande de l'utilisateur : une seule
 * famille d'entrées à la fois, la barre passe de vingt-sept lignes à treize,
 * et les pages ne s'allongent plus pour la suivre.
 */
type Onglet = "acheteur" | "createur" | "equipe" | "organiser";

function ongletDu(groupe: Groupe): Onglet {
  if (groupe.titre === "Ma boutique") return "createur";
  if (groupe.titre === "Plateforme") return "equipe";
  if (groupe.titre === "Organiser") return "organiser";
  // Le groupe principal, et « Vendre » — la porte vers la vente d'un acheteur,
  // que la maquette met au bas de l'onglet Acheteur.
  return "acheteur";
}

export function NavEntrees({ groupes, actif, libelleEquipe }: { groupes: Groupe[]; actif?: string; libelleEquipe: string }) {
  const chemin = usePathname();
  // Une clé passée par l'écran l'emporte : cinq écrans le faisaient déjà.
  const courante = actif ?? entreeCourante(groupes.flatMap((g) => g.entrees), chemin);

  const LIBELLES: Record<Onglet, string> = { acheteur: "Acheteur", createur: "Créateur", equipe: libelleEquipe, organiser: "Organiser" };
  const onglets = (["acheteur", "createur", "equipe", "organiser"] as const).filter((o) => groupes.some((g) => ongletDu(g) === o));
  // L'onglet ouvert est celui de l'écran affiché : arriver sur « Produits »
  // et voir la liste acheteur obligerait à chercher où l'on est.
  const deLaPage = groupes.find((g) => g.entrees.some((e) => e.cle === courante));
  const [ouvert, setOuvert] = useState<Onglet>(deLaPage ? ongletDu(deLaPage) : onglets.includes("createur") ? "createur" : "acheteur");
  const avecOnglets = onglets.length > 1;
  const visibles = avecOnglets ? groupes.filter((g) => ongletDu(g) === ouvert) : groupes;

  return (
    <>
      {avecOnglets ? (
        <div role="tablist" aria-label="Espace" style={{ display: "flex", gap: 2, padding: 4, border: `2.5px solid ${ENCRE}`, borderRadius: 16, background: "#F4EEFC" }}>
          {onglets.map((o) => (
            <button
              key={o}
              type="button"
              role="tab"
              aria-selected={o === ouvert}
              data-onglet-nav={o}
              onClick={() => setOuvert(o)}
              style={{
                flex: "1 1 auto",
                padding: "8px 6px",
                border: "none",
                borderRadius: 11,
                background: o === ouvert ? ENCRE : "transparent",
                color: o === ouvert ? BLANC : ENCRE,
                fontFamily: "inherit",
                fontSize: 12.5,
                fontWeight: 800,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {LIBELLES[o]}
            </button>
          ))}
        </div>
      ) : null}
      <Groupes groupes={visibles} courante={courante} sansTitres={avecOnglets} />
    </>
  );
}

function Groupes({ groupes, courante, sansTitres }: { groupes: Groupe[]; courante: string | null; sansTitres: boolean }) {
  return groupes.map((groupe) => (
    <div key={groupe.titre ?? "principal"} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {/* L'onglet nomme déjà le groupe ; « Vendre » garde le sien, il en suit un autre. */}
      {groupe.titre && (!sansTitres || groupe.titre === "Vendre") ? (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: ".12em",
            opacity: 0.55,
            margin: "8px 0 4px",
          }}
        >
          {groupe.titre}
        </div>
      ) : null}

      {groupe.entrees.map((n) => {
        const courant = courante === n.cle;
        const contenu = (
          <>
            <span
              style={{
                width: 30,
                height: 30,
                flex: "0 0 auto",
                border: `2px solid ${ENCRE}`,
                borderRadius: 9,
                display: "grid",
                placeItems: "center",
                fontSize: 13,
                fontWeight: 800,
                background: courant ? BLANC : n.actif ? LAVANDE : BLANC,
              }}
            >
              {n.glyph}
            </span>
            <span style={{ flex: "1 1 auto", fontSize: 13.5, fontWeight: 700, lineHeight: 1.25 }}>{n.label}</span>
            {n.badge ? (
              <span
                style={{
                  padding: "3px 8px",
                  border: `2px solid ${ENCRE}`,
                  borderRadius: 999,
                  background: ORANGE,
                  color: BLANC,
                  fontSize: 10.5,
                  fontWeight: 800,
                }}
              >
                {n.badge}
              </span>
            ) : null}
            {!n.actif ? (
              <span style={{ fontSize: 12, opacity: 0.5 }} aria-hidden>
                ⌁
              </span>
            ) : null}
          </>
        );

        const style = {
          display: "flex",
          alignItems: "center",
          gap: 11,
          padding: "9px 10px",
          borderRadius: 12,
          background: courant ? JAUNE : undefined,
          // Verrouillée : estompée mais lisible. Illisible, elle
          // n'apprendrait rien ; absente, elle ne promettrait rien.
          opacity: n.actif ? 1 : 0.45,
        } as const;

        if (!n.actif) {
          return (
            <div key={n.cle} aria-disabled="true" title={n.raisonVerrou ?? undefined} style={{ ...style, cursor: "not-allowed" }}>
              {contenu}
            </div>
          );
        }

        if (!n.href) {
          return (
            <div key={n.cle} title="Écran à venir" style={{ ...style, cursor: "default" }}>
              {contenu}
            </div>
          );
        }

        // `href` est une chaîne connue de notre table de navigation, mais
        // typedRoutes ne peut pas le prouver depuis une variable : une ancre
        // suffit, la navigation reste correcte.
        return (
          <a
            key={n.cle}
            href={n.href}
            className={courant ? undefined : "nav-entree"}
            aria-current={courant ? "page" : undefined}
            data-nav-courante={courant ? "1" : undefined}
            style={style}
          >
            {contenu}
          </a>
        );
      })}
    </div>
  ));
}
