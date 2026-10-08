import Link from "next/link";
import type { Route } from "next";

import { DocListe, DocSection, DocTexte, PageDocument } from "@/components/doc/page-document";
import { sessionCourante } from "@/lib/auth/session";
import { BAREME_XOF, partDuCreateur } from "@/lib/domain/fees";
import { RAILS_BAOBART } from "@/lib/payments/payout-schedule";
import { ENCRE } from "@/lib/systeme/charte";
import { TAILLE_MAX, formatPoids } from "@/lib/upload/formats";

export const metadata = {
  title: "Documentation — Baobart.",
  description: "Les guides de Baobart : démarrer, publier une ressource, vendre et être payé, licences, équipes.",
};

export const dynamic = "force-dynamic";

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/**
 * La documentation — les trois guides de la maquette (`DOCS.docs` : bien
 * démarrer, publier, formats et licences), avec deux de plus : être payé, et
 * vérifier une clé. Chaque étape nomme l'écran qui la fait, lien compris.
 */
export default async function DocumentationPage() {
  const visiteur = await sessionCourante();
  const lien = { color: ENCRE, fontWeight: 700 } as const;
  const vers = (href: string, texte: string) => (
    <Link href={href as Route} style={lien}>
      {texte}
    </Link>
  );
  const part = partDuCreateur().directe;
  const versements = Object.values(RAILS_BAOBART).map((r) => `${r.label} le ${JOURS[r.weekday]}`);

  return (
    <PageDocument visiteur={visiteur} kicker="Documentation" titre="Documentation Baobart" intro="Guides d'utilisation, pour les acheteurs comme pour les créateurs.">
      <DocSection titre="Bien démarrer" id="demarrer">
        <DocListe
          elements={[
            <>{vers("/inscription", "Crée un compte")} : une adresse e-mail, un nom d&apos;utilisateur, un mot de passe. Ton profil public est à /@ton-nom.</>,
            <>Parcours la bibliothèque depuis {vers("/explore", "Explorer")}, par famille. Les ressources offertes se téléchargent tout de suite ; les autres s&apos;achètent à l&apos;unité.</>,
            <>Range ce qui t&apos;intéresse dans {vers("/dashboard/collections", "tes collections")}, avec l&apos;épingle des cartes ou le bouton « Collection » d&apos;une fiche.</>,
            <>Rejoins une {vers("/communautes", "communauté")} pour travailler à plusieurs : sujets, réponses, et collections partagées.</>,
          ]}
        />
      </DocSection>

      <DocSection titre="Publier une ressource" id="publier">
        <DocListe
          elements={[
            <>Depuis {vers("/dashboard/produits/nouveau", "Publier une ressource")} : un titre, une famille, un prix — fixe, offert, ou libre au-dessus d&apos;un minimum —, une description et des mots-clés. La recherche de l&apos;en-tête lit le titre, puis les mots-clés : choisis ceux qu&apos;on taperait pour te trouver.</>,
            `Dépose tes fichiers, ${formatPoids(TAILLE_MAX)} au plus chacun, et un aperçu si le fichier ne se montre pas tout seul (une police, un PSD, une archive).`,
            "Choisis la licence sur l'écran de la ressource ; sans choix, c'est la licence commerciale.",
            "Publie : la ressource paraît aussitôt, pourvu qu'elle porte un fichier. Tu peux la dépublier à tout moment.",
            <>Les formats acceptés et ce qu&apos;on attend de toi : les {vers("/regles-de-publication", "règles de publication")}.</>,
          ]}
        />
      </DocSection>

      <DocSection titre="Vendre et être payé" id="vendre">
        <DocListe
          elements={[
            `Tu gardes ${part} de chaque vente : ${BAREME_XOF.directRateBp / 100} % de commission, et les frais de l'opérateur de paiement.`,
            <>Renseigne ton compte de versement dans {vers("/dashboard/versements", "Versements")} : mobile money ou virement. {vers("/dashboard/gains", "Gains")} dit ce qui est disponible et quand il part.</>,
            `Ton solde part une fois par semaine, le jour de ton moyen — ${versements.join(", ")} —, dès qu'il atteint le minimum.`,
            <>Ton délai de remboursement se règle dans {vers("/dashboard/ventes/remboursements", "Demandes de remboursement")}, où arrivent les demandes : réponds sous sept jours, sinon l&apos;équipe tranche.</>,
            <>Chaque vente, et son éventuel remboursement, est dans {vers("/dashboard/ventes", "Ventes")}. Les codes de réduction et l&apos;offre après achat sont dans {vers("/dashboard/promos", "Promotions")}.</>,
          ]}
        />
      </DocSection>

      <DocSection titre="Formats et licences" id="licences">
        <DocTexte>
          Les formats acceptés, famille par famille, sont dans les {vers("/regles-de-publication", "règles de publication")}. Ce
          que chaque licence permet et exclut, et la clé que reçoit chaque acheteur, sont sur la page {vers("/licences", "Licences")}.
        </DocTexte>
      </DocSection>

      <DocSection titre="Vérifier une clé de licence depuis ton programme" id="api-licences">
        <DocTexte>
          Tu vends un logiciel, un greffon, une police ? Ton programme peut demander la clé à l&apos;acheteur et la faire vérifier
          par Baobart : l&apos;appel et ses réponses sont décrits sur la page {vers("/licences#verifier", "Licences")}.
        </DocTexte>
      </DocSection>
    </PageDocument>
  );
}
