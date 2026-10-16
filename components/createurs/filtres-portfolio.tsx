"use client";

import type { CSSProperties } from "react";

/**
 * La rangée de filtres de l'onglet « Ressources » : « Chercher dans le
 * portfolio… », « Toutes les catégories ▼ », « Récent ▼ ».
 *
 * Traduite de `Baobart Accueil.dc.html`, section `PROFIL CREATEUR`. Les menus
 * de la maquette sont des pastilles ; ici ce sont de vrais `<select>` habillés
 * comme elles — le clavier, le lecteur d'écran et le téléphone savent s'en
 * servir sans aide.
 *
 * Un formulaire GET : la recherche vit dans l'adresse, se partage et survit au
 * rafraîchissement. Changer un menu soumet aussitôt (le seul JavaScript
 * d'ici) ; sans JavaScript, Entrée dans le champ soumet tout, menus compris.
 */
export function FiltresPortfolio({
  action,
  recherche,
  famille,
  tri,
  familles,
  tris,
}: {
  action: string;
  recherche: string;
  famille: string;
  tri: string;
  familles: Array<{ valeur: string; libelle: string }>;
  tris: ReadonlyArray<{ valeur: string; libelle: string }>;
}) {
  const soumettre = (e: React.ChangeEvent<HTMLSelectElement>) => e.currentTarget.form?.requestSubmit();

  return (
    <form
      action={action}
      method="get"
      role="search"
      style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 20, minWidth: 0 }}
    >
      <input
        type="search"
        name="q"
        defaultValue={recherche}
        maxLength={80}
        placeholder="Chercher dans le portfolio…"
        aria-label="Chercher dans le portfolio"
        style={{
          flex: "1 1 260px",
          minWidth: 0,
          fontFamily: "inherit",
          fontSize: 13.5,
          fontWeight: 500,
          padding: "12px 16px",
          border: "2.5px solid #121212",
          borderRadius: 14,
          background: "#FFFFFF",
          outline: "none",
          color: "#121212",
        }}
      />
      {familles.length > 1 ? (
        <Menu fond="#FFFFFF" etiquette="Catégorie">
          <select name="famille" defaultValue={famille} onChange={soumettre} style={select}>
            <option value="">Toutes les catégories</option>
            {familles.map((f) => (
              <option key={f.valeur} value={f.valeur}>
                {f.libelle}
              </option>
            ))}
          </select>
        </Menu>
      ) : null}
      <Menu fond="#FFD84A" etiquette="Trier">
        <select name="tri" defaultValue={tri} onChange={soumettre} style={select}>
          {tris.map((t) => (
            <option key={t.valeur} value={t.valeur}>
              {t.libelle}
            </option>
          ))}
        </select>
      </Menu>
    </form>
  );
}

function Menu({ fond, etiquette, children }: { fond: string; etiquette: string; children: React.ReactNode }) {
  return (
    <label
      aria-label={etiquette}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        border: "2.5px solid #121212",
        borderRadius: 14,
        background: fond,
        fontSize: 13,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {children}
      <span aria-hidden="true" style={{ position: "absolute", right: 16, fontSize: 9, pointerEvents: "none" }}>
        ▼
      </span>
    </label>
  );
}

const select: CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  border: "none",
  background: "transparent",
  padding: "12px 38px 12px 16px",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 800,
  color: "#121212",
  cursor: "pointer",
  outlineOffset: 4,
};
