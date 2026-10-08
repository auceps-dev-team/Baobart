import Link from "next/link";
import type { Route } from "next";

import { DocListe, DocSection, DocTexte, PageDocument } from "@/components/doc/page-document";
import { sessionCourante } from "@/lib/auth/session";
import { ENCRE } from "@/lib/systeme/charte";

export const metadata = {
  title: "Support — Baobart.",
  description: "Les réponses aux questions courantes : téléchargement, remboursement, compte, licence, versements.",
};

export const dynamic = "force-dynamic";

/**
 * Support.
 *
 * La maquette (`DOCS.support`) annonçait des fichiers « remboursables sous 14
 * jours s'ils n'ont pas été téléchargés », un « ticket » et un « bouton
 * Signaler sur la fiche ». Lu le 04/10 : aucune règle de quatorze jours
 * (c'est le créateur qui rembourse, depuis Ventes — `rembourserLigne`), aucun
 * système de tickets, aucun bouton sur la fiche. Chaque réponse dit ce que le
 * site fait, et mène à l'écran qui le fait.
 */
export default async function SupportPage() {
  const visiteur = await sessionCourante();
  const lien = { color: ENCRE, fontWeight: 700 } as const;
  const vers = (href: string, texte: string) => (
    <Link href={href as Route} style={lien}>
      {texte}
    </Link>
  );

  return (
    <PageDocument visiteur={visiteur} kicker="Aide" titre="Support" intro="La plupart des questions se règlent ici. Sinon, écris-nous.">
      <DocSection titre="Un fichier ne se télécharge pas" id="telechargement">
        <DocListe
          elements={[
            <>L&apos;achat est-il payé ? Tant que l&apos;opérateur n&apos;a pas confirmé le paiement, le fichier reste fermé. L&apos;état de chaque commande est dans {vers("/dashboard/achats", "tes achats")}.</>,
            <>Accès libre ouvre les ressources offertes, pas les payantes : celles-ci s&apos;achètent à l&apos;unité. Ton forfait est sur {vers("/dashboard/forfait", "la page Forfait")}.</>,
            "Le lien de téléchargement est temporaire : s'il a expiré, relance le téléchargement depuis la fiche ou tes téléchargements.",
            "Une ressource retirée à la suite d'un signalement n'est plus livrée, même à ceux qui l'ont achetée.",
          ]}
        />
      </DocSection>

      <DocSection titre="Être remboursé" id="remboursement">
        <DocTexte>
          C&apos;est le créateur qui rembourse, en tout ou en partie, depuis son écran Ventes. Écris-lui — son profil donne
          ses liens — ou, s&apos;il ne répond pas, écris à l&apos;équipe avec la référence de ta commande. Un remboursement
          intégral referme l&apos;accès au fichier.
        </DocTexte>
      </DocSection>

      <DocSection titre="Ta clé de licence" id="licence">
        <DocTexte>
          Elle est sur la fiche de la ressource, sous le bouton de téléchargement, dès que l&apos;achat est payé. Ce que ta
          licence permet est sur la page {vers("/licences", "Licences")}.
        </DocTexte>
      </DocSection>

      <DocSection titre="Ton compte" id="compte">
        <DocListe
          elements={[
            <>Mot de passe oublié : {vers("/mot-de-passe-oublie", "un lien par courriel")}, valable une heure.</>,
            <>Double authentification, clés d&apos;accès et effacement du compte : depuis {vers("/dashboard/profil", "ton profil")}.</>,
          ]}
        />
      </DocSection>

      <DocSection titre="Tes versements, si tu vends" id="versements">
        <DocTexte>
          Ce qui est disponible, en attente, et la date du prochain versement sont sur {vers("/dashboard/gains", "l'écran Gains")},
          avec la raison quand rien ne part — un compte de versement à renseigner, un minimum pas encore atteint.
        </DocTexte>
      </DocSection>

      <DocSection titre="Signaler un contenu" id="signaler">
        <DocTexte>
          Un contenu qui porte atteinte à tes droits se signale par la {vers("/signalement", "procédure de retrait")}, selon
          la loi ivoirienne.
        </DocTexte>
      </DocSection>

      <DocSection titre="Toujours bloqué ?">
        <DocTexte>
          Écris-nous depuis la page {vers("/contact", "Contact")}, avec la référence de ta commande s&apos;il s&apos;agit
          d&apos;un achat.
        </DocTexte>
      </DocSection>
    </PageDocument>
  );
}
