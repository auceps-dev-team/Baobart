"use client";

import { useEffect, useState } from "react";

import { Pastille, PastilleAction } from "@/components/reseaux/logos";
import { absolue, courrielDePartage, destinationsDePartage } from "@/lib/reseaux/partage";
import { nomDuReseau } from "@/lib/reseaux/reseaux";

/**
 * « Partager cette ressource » : la rangée de boutons qu'on trouve sous un
 * article WordPress, en pastilles du Design System (« 05 · Logos réseaux »,
 * fond clair).
 *
 * Elle s'ajoute au bouton « Partager ↗ » de la fiche, qui reste celui de la
 * maquette. Le bouton se cherche ; la rangée se voit, à l'endroit où l'on a
 * fini de regarder — après le visuel, avant les commentaires.
 *
 * L'adresse se lit dans le navigateur, comme dans `MenuPartage` : la fiche
 * s'ouvre aussi en modale par-dessus le fil, et c'est l'adresse de la fiche
 * qu'on partage, pas celle du fil.
 */
export function BarrePartage({
  chemin,
  titre,
  image = null,
  intitule = "Partager",
  origineConfiguree = null,
}: {
  /** Le chemin de la page partagée : `/products/pack-wax`. */
  chemin: string;
  titre: string;
  /** L'image de la page, relative ou absolue — pour Pinterest. */
  image?: string | null;
  intitule?: string;
  /**
   * `APP_URL`, lue par le serveur (`urlDuSite`) : la rangée est complète dès
   * le premier rendu. Le navigateur la remplace ensuite par son origine.
   */
  origineConfiguree?: string | null;
}) {
  const [origine, setOrigine] = useState<string | null>(origineConfiguree);
  const [natif, setNatif] = useState(false);
  const [copie, setCopie] = useState<"" | "ok" | "echec">("");

  useEffect(() => {
    setOrigine(window.location.origin);
    setNatif(typeof navigator.share === "function");
  }, []);

  // Sans `APP_URL` et avant l'hydratation, pas d'adresse absolue : on ne
  // propose rien plutôt qu'un partage vers un chemin relatif, que le réseau
  // ne saurait pas ouvrir.
  if (!origine) return <div data-partage style={{ minHeight: 120 }} aria-hidden="true" />;

  const page = { url: absolue(chemin, origine)!, titre, image: absolue(image, origine) };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(page.url);
      setCopie("ok");
    } catch {
      // Refusé, ou hors HTTPS : on le dit plutôt que de faire semblant.
      setCopie("echec");
    }
    setTimeout(() => setCopie(""), 2500);
  };

  return (
    <section
      data-partage
      aria-label={intitule}
      style={{
        border: "2.5px solid #121212",
        borderRadius: 20,
        background: "#FFFFFF",
        boxShadow: "5px 5px 0 #121212",
        padding: 18,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em" }}>
        {intitule}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 14 }}>
        {destinationsDePartage(page).map((d) => (
          <Pastille
            key={d.reseau}
            reseau={d.reseau}
            href={d.href}
            libelle={`Partager sur ${nomDuReseau(d.reseau)} (nouvel onglet)`}
            legende={nomDuReseau(d.reseau)}
          />
        ))}
        <a
          href={courrielDePartage(page)}
          aria-label="Partager par courriel"
          title="Partager par courriel"
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 72, color: "#121212" }}
        >
          <span className="reseau-pastille" style={{ background: "#EADFF9" }}>
            <IconeCourriel />
          </span>
          <span style={legende}>Courriel</span>
        </a>
        <PastilleAction
          libelle={copie === "ok" ? "Lien copié" : "Copier le lien"}
          legende={copie === "ok" ? "Copié ✓" : copie === "echec" ? "Impossible" : "Copier"}
          fond={copie === "ok" ? "#B9E8C0" : "#FFFFFF"}
          onClick={copier}
        >
          <IconeLien />
        </PastilleAction>
        {natif ? (
          <PastilleAction
            libelle="Partager avec une autre application"
            legende="Plus"
            fond="#FFD84A"
            onClick={() => {
              navigator.share({ title: titre, url: page.url }).catch(() => {});
            }}
          >
            <IconePlus />
          </PastilleAction>
        ) : null}
      </div>
      {/* Annonce polie du résultat de la copie : le focus ne bouge pas. */}
      <span role="status" className="sr-only">
        {copie === "ok" ? "Lien copié" : copie === "echec" ? "Copie impossible" : ""}
      </span>
    </section>
  );
}

const legende = {
  fontFamily: "var(--font-mono)",
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  textAlign: "center",
} as const;

/*
 * Trois pictogrammes qui ne sont pas des marques, donc absents de la section
 * des logos : tracés au trait, à l'épaisseur du contour (2,5 px sur 24).
 */
function Trait({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      {children}
    </svg>
  );
}

function IconeLien() {
  return (
    <Trait>
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4l-1.4 1.4" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.4-1.4" />
    </Trait>
  );
}

function IconeCourriel() {
  return (
    <Trait>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="m4 7.5 8 6 8-6" />
    </Trait>
  );
}

function IconePlus() {
  return (
    <Trait>
      <path d="M12 15V4" />
      <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
      <path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" />
    </Trait>
  );
}
