import { BLANC, CADRE, ENCRE, LAVANDE } from "@/lib/systeme/charte";

/** Le gris des blocs d'attente : la lavande claire de la charte. */
const SQUELETTE = "#F4EEFC";

/**
 * Le squelette d'attente de l'explorateur.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IL GARDE LA PLACE EXACTE DU CONTENU
 *
 * C'est la phrase de la maquette, et c'est toute la règle. Un indicateur qui
 * tourne au milieu de l'écran annonce l'attente ; il ne prépare rien. Quand le
 * contenu arrive, la page saute — et le lecteur perd l'endroit où il allait
 * cliquer.
 *
 * Un squelette qui occupe la même surface ne saute pas. Le passage est alors
 * imperceptible, ce qui est exactement le but : on ne veut pas montrer une
 * attente, on veut la rendre supportable.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI IL EST ICI ET NON À LA RACINE
 *
 * Il y était. Les tests au navigateur l'ont refusé dans la minute, et pour une
 * raison qu'on n'aurait pas devinée : **un `loading.tsx` à la racine transforme
 * tous les 404 en 200.**
 *
 * La mécanique est implacable. Une frontière d'attente fait diffuser la réponse
 * en flux ; les en-têtes partent donc AVANT que la page ait décidé de son sort.
 * Quand `notFound()` s'exécute ensuite, le contenu affiché est bien celui de la
 * page introuvable, mais le code HTTP est déjà parti — et il dit 200.
 *
 * Concrètement : les cinq écrans d'exploitation répondaient 200 à un visiteur
 * anonyme. La page montrée était la bonne, le refus était réel, mais tout ce
 * qui lit le code — moteurs de recherche, supervision, tests — voyait une page
 * valide. La règle « 404 et non 403 » ne tient plus si le 404 n'en est pas un.
 *
 * D'où la règle : une frontière d'attente ne se pose que là où l'introuvable
 * n'est **pas** une issue possible. `/explore` existe toujours ; il la mérite,
 * et il en profite — la grille est lourde.
 *
 * Traduit de « Baobart Parcours Achat.dc.html », écran `loading`.
 */

/** Assez de cartes pour couvrir un premier écran, jamais plus. */
const CARTES = 9;
const FILTRES = 6;

/** Les hauteurs varient comme celles des vraies cartes : une grille de
 *  rectangles identiques ne ressemble à rien de ce qui va s'afficher. */
const HAUTEURS = [210, 260, 190, 240, 200, 280, 220, 250, 190];

function Bloc({
  hauteur,
  largeur,
  radius = 12,
}: {
  hauteur: number;
  largeur?: number | string;
  radius?: number;
}) {
  return (
    <div
      aria-hidden
      style={{
        height: hauteur,
        width: largeur ?? "100%",
        borderRadius: radius,
        background: SQUELETTE,
        border: `2px solid ${ENCRE}22`,
      }}
    />
  );
}

export default function Chargement() {
  return (
    <main
      // Une seule annonce pour les lecteurs d'écran : répéter « chargement »
      // pour chaque rectangle rendrait la page inaudible.
      role="status"
      aria-label="On charge tes ressources"
      style={{ minHeight: "100vh", background: LAVANDE, padding: "40px 20px" }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div
          style={{
            border: CADRE,
            borderRadius: 20,
            background: BLANC,
            padding: 20,
            marginBottom: 22,
          }}
        >
          <Bloc hauteur={26} largeur={220} radius={8} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            {Array.from({ length: FILTRES }, (_, i) => (
              <Bloc key={i} hauteur={34} largeur={92 + (i % 3) * 26} radius={999} />
            ))}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 18,
          }}
        >
          {Array.from({ length: CARTES }, (_, i) => (
            <div
              key={i}
              style={{
                border: CADRE,
                borderRadius: 18,
                background: BLANC,
                padding: 12,
              }}
            >
              <Bloc hauteur={HAUTEURS[i] ?? 220} radius={12} />
              <div style={{ marginTop: 12 }}>
                <Bloc hauteur={14} largeur="70%" radius={6} />
              </div>
              <div style={{ marginTop: 8 }}>
                <Bloc hauteur={12} largeur="45%" radius={6} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
