import type { Bloc, Inline } from "@/lib/cms/corps";
import { analyser } from "@/lib/cms/corps";
import { CADRE, ENCRE } from "@/lib/systeme/charte";

/** Le fond des citations. Même valeur que les champs de formulaire ailleurs. */
const LAVANDE_CLAIR = "#F4EEFC";

/**
 * Le corps d'un article, affiché.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * AUCUNE CHAÎNE D'HTML NE TRAVERSE CE COMPOSANT
 *
 * C'est tout l'intérêt de l'analyse en blocs. On ne reçoit pas du HTML qu'il
 * faudrait sanitiser, on reçoit une structure qu'on affiche — et React échappe
 * tout ce qui passe par lui.
 *
 * Il n'y a donc pas de `dangerouslySetInnerHTML` dans ce fichier, et il ne
 * faut pas en ajouter : ce serait retirer la seule chose qui rend l'ensemble
 * sûr, et remplacer une propriété démontrable par une liste de filtres à
 * tenir à jour.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES LIENS SONT DÉJÀ FILTRÉS
 *
 * `lib/cms/corps.ts` a écarté les schémas dangereux avant d'arriver ici : un
 * `javascript:` n'a plus d'adresse et n'est resté que du texte. Ce composant
 * n'a donc rien à revérifier — et surtout, il ne doit pas donner l'impression
 * que la garde est ici.
 *
 * `rel` et `target` restent posés sur les liens externes : `noopener` ferme
 * l'accès à la fenêtre appelante, `noreferrer` évite d'annoncer d'où l'on
 * vient.
 */
export function CorpsArticle({ corps }: { corps: string }) {
  const blocs = analyser(corps);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {blocs.map((bloc, rang) => (
        <BlocRendu key={rang} bloc={bloc} />
      ))}
    </div>
  );
}

function BlocRendu({ bloc }: { bloc: Bloc }) {
  switch (bloc.type) {
    case "titre": {
      const Balise = bloc.niveau === 2 ? "h2" : "h3";
      return (
        <Balise
          style={{
            fontFamily: "var(--font-display)",
            fontSize: bloc.niveau === 2 ? 26 : 20,
            lineHeight: 1.25,
            margin: "10px 0 0",
          }}
        >
          <Enligne contenu={bloc.contenu} />
        </Balise>
      );
    }

    case "paragraphe":
      return (
        <p
          style={{
            fontSize: 16,
            fontWeight: 500,
            lineHeight: 1.7,
            margin: 0,
            textWrap: "pretty",
          }}
        >
          <Enligne contenu={bloc.contenu} />
        </p>
      );

    case "liste":
      return (
        <ul style={{ margin: 0, paddingLeft: 22, display: "grid", gap: 8 }}>
          {bloc.items.map((item, rang) => (
            <li key={rang} style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.65 }}>
              <Enligne contenu={item} />
            </li>
          ))}
        </ul>
      );

    case "citation":
      return (
        <blockquote
          style={{
            margin: 0,
            padding: "14px 18px",
            borderLeft: `4px solid ${ENCRE}`,
            background: LAVANDE_CLAIR,
            borderRadius: "0 14px 14px 0",
            fontSize: 16.5,
            fontWeight: 600,
            lineHeight: 1.6,
          }}
        >
          <Enligne contenu={bloc.contenu} />
        </blockquote>
      );

    case "image":
      return (
        <figure style={{ margin: 0 }}>
          {/*
            `<img>` et non `<Image>` de Next : l'optimiseur n'accepte que les
            hôtes déclarés dans `next.config.ts`, et une image d'article peut
            venir d'ailleurs. Lui passer une adresse non déclarée ferait
            échouer le rendu de tout l'article pour une illustration.

            `loading="lazy"` parce qu'un article long en porte plusieurs, et
            qu'on ne descend pas toujours jusqu'en bas.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bloc.src}
            alt={bloc.alt}
            loading="lazy"
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              border: CADRE,
              borderRadius: 16,
            }}
          />
          {/*
            La légende reprend l'`alt`, et seulement s'il y en a un. Un `alt`
            vide est un choix — une image décorative — et inventer une légende
            à sa place trahirait l'auteur.
          */}
          {bloc.alt.length > 0 ? (
            <figcaption
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                marginTop: 8,
                opacity: 0.65,
                textAlign: "center",
              }}
            >
              {bloc.alt}
            </figcaption>
          ) : null}
        </figure>
      );

    case "code":
      return (
        <pre
          style={{
            margin: 0,
            padding: 16,
            border: CADRE,
            borderRadius: 14,
            background: "#F7F5FB",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            lineHeight: 1.6,
            // Un bloc de code est le seul endroit d'une page qui a le droit de
            // défiler horizontalement — le corps de la page, jamais.
            overflowX: "auto",
          }}
        >
          <code>{bloc.texte}</code>
        </pre>
      );
  }
}

function Enligne({ contenu }: { contenu: Inline[] }) {
  return (
    <>
      {contenu.map((morceau, rang) => {
        if (morceau.type === "gras") {
          return <strong key={rang}>{morceau.valeur}</strong>;
        }

        if (morceau.type === "lien") {
          // Interne ou externe : une adresse relative reste dans le site, et
          // lui poser `target="_blank"` ouvrirait un onglet pour rien.
          const externe = !morceau.href.startsWith("/");

          return (
            <a
              key={rang}
              href={morceau.href}
              {...(externe
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              style={{ color: ENCRE, textDecoration: "underline" }}
            >
              {morceau.valeur}
            </a>
          );
        }

        return <span key={rang}>{morceau.valeur}</span>;
      })}
    </>
  );
}
