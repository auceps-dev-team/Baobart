import Link from "next/link";
import type { Route } from "next";

import { DocListe, DocSection, DocTexte, PageDocument } from "@/components/doc/page-document";
import { sessionCourante } from "@/lib/auth/session";
import { ENCRE } from "@/lib/systeme/charte";
import { FORMATS, TAILLE_MAX, TAILLE_MAX_APERCU, formatPoids } from "@/lib/upload/formats";

export const metadata = {
  title: "Règles de publication — Baobart.",
  description: "Ce qu'on peut publier sur Baobart, ce que le site vérifie, et ce qui se passe après.",
};

export const dynamic = "force-dynamic";

const FAMILLES: Record<string, string> = {
  image: "Images",
  vecteur: "Vecteurs",
  source: "Fichiers de travail",
  document: "Documents",
  police: "Polices",
  video: "Vidéo",
  audio: "Audio",
  "3d": "3D",
  archive: "Archives",
};

/**
 * Les règles de publication.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUE LA MAQUETTE PROMETTAIT, ET CE QUI EXISTE
 *
 * La maquette (« Baobart Accueil.dc.html », `DOCS.regles`) annonçait une «
 * validation manuelle sous 72 h » et « deux refus motivés » suspendant la
 * publication automatique. Rien de cela n'existe, lu le 04/10 : une ressource
 * paraît dès que son créateur la publie, pourvu qu'elle porte un fichier
 * (`publierRessource`, lib/products/actions.ts). La page dit donc ce qui est
 * vérifié par le site, ce qui est attendu du créateur sans être vérifié, et
 * ce qui arrive après.
 *
 * Les formats et les poids viennent de `lib/upload/formats.ts` — la liste
 * que le téléversement applique, pas une liste recopiée.
 */
export default async function ReglesDePublicationPage() {
  const visiteur = await sessionCourante();
  const lien = { color: ENCRE, fontWeight: 700 } as const;

  const parFamille = new Map<string, string[]>();
  for (const f of FORMATS) {
    const ext = f.extension.toUpperCase();
    if (ext === "JPEG" || ext === "TIFF") continue; // doublons de JPG et TIF
    parFamille.set(f.famille, [...(parFamille.get(f.famille) ?? []), ext]);
  }

  return (
    <PageDocument
      visiteur={visiteur}
      kicker="Conditions générales"
      titre="Règles de publication"
      intro="Ce que tu peux publier, ce que le site vérifie avant, et ce qui se passe après."
    >
      <DocSection titre="Tu dois être l'auteur">
        <DocTexte>
          Chaque fichier publié est ton travail original, ou une œuvre dont tu détiens les droits de diffusion. Publier ce
          qui ne t&apos;appartient pas est la première cause de retrait.
        </DocTexte>
      </DocSection>

      <DocSection titre="Ce que le site vérifie">
        <DocListe
          elements={[
            "Une ressource ne se publie qu'avec au moins un fichier : l'acheteur doit avoir quelque chose à télécharger.",
            `Chaque fichier pèse au plus ${formatPoids(TAILLE_MAX)} ; un aperçu, au plus ${formatPoids(TAILLE_MAX_APERCU)} — c'est un extrait, pas la livraison.`,
            "Seuls ces formats sont acceptés :",
          ]}
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(200px,100%),1fr))", gap: 8, marginTop: 10 }}>
          {[...parFamille].map(([famille, exts]) => (
            <div key={famille} data-famille-format={famille} style={{ fontSize: 13, lineHeight: 1.5 }}>
              <strong>{FAMILLES[famille] ?? famille}</strong> — {exts.join(", ")}
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection titre="Ce qu'on attend de toi">
        <DocTexte>Le site ne peut pas le vérifier ; une ressource qui ne le respecte pas peut être retirée.</DocTexte>
        <DocListe
          elements={[
            "Un aperçu fidèle : ce qu'on voit sur la fiche est ce qu'on télécharge.",
            "Une description honnête : formats, dimensions, contenu d'un pack. Tromper un acheteur est interdit.",
            "Les fichiers sources quand tu les annonces (AI, PSD, polices).",
            "Une autorisation écrite pour tout visage reconnaissable, et aucune marque déposée visible sans l'accord de son titulaire.",
          ]}
        />
      </DocSection>

      <DocSection titre="Après la publication">
        <DocListe
          elements={[
            "Ta ressource paraît aussitôt : il n'y a pas de relecture préalable. Tu en restes responsable.",
            "Tu peux la dépublier à tout moment. Ceux qui l'ont achetée gardent leurs fichiers, depuis leurs téléchargements.",
            "Une ressource déjà vendue ne se supprime pas — un acheteur garde un droit sur ce qu'il a payé : elle se dépublie.",
            <>
              Un contenu qui porte atteinte aux droits d&apos;autrui peut être retiré sur notification, selon la{" "}
              <Link href={"/signalement" as Route} style={lien}>
                procédure de signalement
              </Link>{" "}
              (loi ivoirienne n° 2013-451, articles 46 à 54). Pendant l&apos;examen, la ressource n&apos;est plus livrée,
              et tu ne peux ni la modifier, ni la remettre en ligne, ni la supprimer.
            </>,
            "Un compte suspendu voit ses ressources retirées de la vente.",
          ]}
        />
      </DocSection>
    </PageDocument>
  );
}
