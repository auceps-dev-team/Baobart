import Link from "next/link";
import type { Route } from "next";

import { DocListe, DocSection, DocTexte, PageDocument } from "@/components/doc/page-document";
import { sessionCourante } from "@/lib/auth/session";
import { BAREME_XOF, partDuCreateur } from "@/lib/domain/fees";
import { RAILS_BAOBART } from "@/lib/payments/payout-schedule";
import { ENCRE } from "@/lib/systeme/charte";

export const metadata = {
  title: "Conditions générales — Baobart.",
  description: "Les règles d'usage de Baobart : comptes, achats, licences, ventes, versements, contenus.",
};

export const dynamic = "force-dynamic";

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/**
 * Les conditions générales d'utilisation.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE BASE, À FAIRE RELIRE PAR UN JURISTE
 *
 * Décidé le 04/10 : rédigée sur le fonctionnement réel de la plateforme, à
 * faire relire avant la mise en production. Les chiffres viennent du code et
 * ne s'écrivent pas à la main :
 *
 *   — la part du créateur et les frais : `partDuCreateur`, `BAREME_XOF` ;
 *   — le jour de versement de chaque moyen : `RAILS_BAOBART` ;
 *   — le retrait sur notification : loi n° 2013-451, art. 46 à 54
 *     (`app/signalement`).
 *
 * Ce que le juriste doit trancher, et que le code ne dit pas : la juridiction
 * compétente, la limitation de responsabilité, l'âge minimal d'inscription, et
 * les obligations fiscales des créateurs. Ces points ne sont pas écrits plutôt
 * qu'écrits au hasard.
 */
export default async function ConditionsPage() {
  const visiteur = await sessionCourante();
  const part = partDuCreateur();
  const lien = { color: ENCRE, fontWeight: 700 } as const;
  const versements = Object.values(RAILS_BAOBART).map((r) => `${r.label} le ${JOURS[r.weekday]}`);

  return (
    <PageDocument
      visiteur={visiteur}
      kicker="Conditions générales"
      titre="Conditions générales"
      intro="Les règles qui valent pour tout le monde sur Baobart : acheteurs, créateurs, membres des communautés. Version du 4 octobre 2026."
    >
      <DocSection titre="Ce qu'est Baobart">
        <DocTexte>
          Une place de marché de ressources créatives numériques — illustrations, photos, mockups, polices, icônes,
          vidéos, sons — et des espaces pour travailler dessus à plusieurs. Baobart, établie à Abidjan, met en relation
          les créateurs qui publient et les membres qui achètent ou téléchargent ; elle encaisse les paiements pour le
          compte des créateurs et leur reverse leur part.
        </DocTexte>
      </DocSection>

      <DocSection titre="Ton compte">
        <DocListe
          elements={[
            "Tu es responsable de ce qui se fait depuis ton compte. Garde ton mot de passe pour toi ; la double authentification est disponible depuis ton profil.",
            "Les informations de ton profil doivent être exactes : elles sont montrées aux autres membres.",
            "Tu peux demander l'effacement de ton compte à tout moment, depuis ton profil — voir la page Confidentialité.",
          ]}
        />
      </DocSection>

      <DocSection titre="Acheter et télécharger">
        <DocListe
          elements={[
            "Le prix affiché sur la fiche est celui que tu paies, pourboire éventuel en plus. Il est fixé par le créateur — parfois libre, au-dessus d'un minimum qu'il choisit.",
            "Le paiement se fait chez l'opérateur : Paystack, ou le mobile money que tu choisis. L'accès s'ouvre quand l'opérateur confirme le paiement, pas avant.",
            "Accès libre, gratuit, s'active d'un clic et se quitte de même : il ouvre les ressources offertes, pas les payantes. Les forfaits payants (Découverte, Explorer, Studio) ne sont pas encore ouverts.",
            "Chaque achat porte une licence, qui dit ce que tu peux faire du fichier, et une clé de licence — voir la page Licences.",
            "Tu peux demander un remboursement dans le délai que le créateur affiche sur la fiche, depuis ton espace « Remboursements ». Le créateur répond ; sans réponse sous sept jours, l'équipe Baobart tranche. Un paiement contesté auprès de ta banque ne se rembourse pas en plus.",
          ]}
        />
      </DocSection>

      <DocSection titre="Vendre">
        <DocListe
          elements={[
            `Tu gardes ${part.directe} du prix de chaque vente : Baobart retient ${BAREME_XOF.directRateBp / 100} % de commission, et les frais de l'opérateur de paiement (${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(BAREME_XOF.processorRateBp / 100)} %) restent à ta charge. Une ressource offerte ne coûte rien à personne.`,
            "Tu publies sans exclusivité : tes ressources t'appartiennent, et tu peux les vendre ailleurs.",
            "Une ressource ne se publie qu'avec au moins un fichier : l'acheteur doit avoir quelque chose à télécharger.",
            `Ton solde t'est versé une fois par semaine, selon le moyen choisi — ${versements.join(", ")}. En dessous du minimum de versement, il roule sur l'échéance suivante.`,
            "Tu choisis ton délai de remboursement (aucun, 7, 14 ou 30 jours), affiché sur tes fiches et figé à chaque achat. Tu réponds aux demandes des acheteurs sous sept jours, faute de quoi l'équipe Baobart tranche ; un remboursement accepté débite ton solde du prix payé. Tu peux aussi rembourser une vente de toi-même, depuis ton écran Ventes.",
          ]}
        />
      </DocSection>

      <DocSection titre="Ce que tu publies">
        <DocListe
          elements={[
            "Tu dois être l'auteur de ce que tu publies, ou en détenir les droits de diffusion.",
            "Une ressource publiée paraît aussitôt : il n'y a pas de relecture préalable. Tu en restes responsable.",
            <>
              Un contenu qui porte atteinte aux droits d&apos;autrui peut être retiré sur notification, selon la procédure
              décrite sur la page{" "}
              <Link href={"/signalement" as Route} style={lien}>
                Signalement &amp; retrait
              </Link>{" "}
              (loi ivoirienne n° 2013-451, articles 46 à 54).
            </>,
            <>
              Le détail est dans les{" "}
              <Link href={"/regles-de-publication" as Route} style={lien}>
                règles de publication
              </Link>
              .
            </>,
          ]}
        />
      </DocSection>

      <DocSection titre="Les communautés">
        <DocTexte>
          Les messages et les collections partagées dans une communauté sont visibles de ses membres. Ses
          administrateurs et ses modérateurs peuvent retirer un message, et la plateforme retire ce qu&apos;on lui
          signale quand il enfreint ces conditions.
        </DocTexte>
      </DocSection>

      <DocSection titre="Ce qui est interdit">
        <DocListe
          elements={[
            "Publier ce qui ne t'appartient pas, ou revendre tel quel un fichier acheté.",
            "Tromper un acheteur sur ce qu'il achète.",
            "Contourner un paiement, un quota ou une limite technique.",
            "Gonfler artificiellement des compteurs — affichages, clics, ventes.",
          ]}
        />
        <DocTexte>
          Un compte qui s&apos;y livre peut être suspendu. Une suspension ferme la connexion et retire les ressources
          publiées ; elle se conteste en écrivant à Baobart.
        </DocTexte>
      </DocSection>

      <DocSection titre="Droit applicable">
        <DocTexte>
          Ces conditions relèvent du droit ivoirien. Elles peuvent évoluer ; la version en vigueur est toujours celle de
          cette page, datée en tête.
        </DocTexte>
      </DocSection>
    </PageDocument>
  );
}
