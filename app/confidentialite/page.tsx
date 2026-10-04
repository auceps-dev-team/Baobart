import Link from "next/link";
import type { Route } from "next";

import { DocListe, DocSection, DocTexte, PageDocument } from "@/components/doc/page-document";
import { sessionCourante } from "@/lib/auth/session";
import { ADRESSE_DONNEES_PERSONNELLES } from "@/lib/config/contact";
import { dureeDesLimites } from "@/lib/consentement/regles";
import { ENCRE } from "@/lib/systeme/charte";

export const metadata = {
  title: "Confidentialité — Baobart.",
  description: "Ce que Baobart garde sur toi, pourquoi, combien de temps, et comment le reprendre.",
};

export const dynamic = "force-dynamic";

/**
 * La politique de confidentialité.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * RÉDIGÉE DEPUIS LE CODE, À FAIRE RELIRE
 *
 * Décidé le 04/10 : rédigée à partir de ce que la base garde vraiment
 * (`prisma/schema.prisma`), des durées écrites dans le code, et relue par un
 * juriste avant la mise en production. Chaque affirmation pointe vers ce qui
 * la rend vraie :
 *
 *   — le mot de passe : jamais en clair, une empreinte scrypt
 *     (`lib/auth/password.ts`) ;
 *   — l'adresse IP de connexion : avec la session, pour bloquer une adresse en
 *     cas de fraude (`Session.ipAddress`) ;
 *   — l'effacement : trente jours, annulable, puis caviardage
 *     (`lib/rgpd/effacement.ts`) ;
 *   — les cookies et ce qu'on garde sans cookie : `lib/consentement/regles.ts`.
 *
 * Ce qui reste à confirmer avec le juriste : les durées de conservation des
 * données de vente imposées par le droit comptable ivoirien, que le code ne
 * fixe pas — il garde les ventes, il ne dit pas jusqu'à quand.
 */
export default async function ConfidentialitePage() {
  const visiteur = await sessionCourante();
  const lien = { color: ENCRE, fontWeight: 700 } as const;

  return (
    <PageDocument
      visiteur={visiteur}
      kicker="Conditions générales"
      titre="Confidentialité"
      intro="Ce que Baobart garde sur toi, pourquoi, combien de temps — et comment le reprendre. Version du 4 octobre 2026."
    >
      <DocSection titre="Qui est responsable">
        <DocTexte>
          Baobart, établie à Abidjan. Tes données relèvent de la loi ivoirienne n° 2013-450 du 19 juin 2013 relative à
          la protection des données à caractère personnel. Pour toute question ou demande :{" "}
          <a href={`mailto:${ADRESSE_DONNEES_PERSONNELLES}`} style={lien}>
            {ADRESSE_DONNEES_PERSONNELLES}
          </a>
          .
        </DocTexte>
      </DocSection>

      <DocSection titre="Ce qu'on garde quand tu as un compte">
        <DocListe
          elements={[
            "Ton adresse e-mail, pour te connecter et t'écrire au sujet de tes achats et de tes ventes.",
            "Ton mot de passe — jamais en clair : seule une empreinte est gardée, d'où on ne peut pas le retrouver.",
            "Ton nom affiché, ton nom d'utilisateur, et ce que tu choisis d'ajouter à ton profil (photo, ville, spécialité, liens).",
            "L'adresse IP de chaque connexion, avec la session : elle sert à bloquer une adresse en cas de fraude, et part avec la session.",
            "Tes réglages de notifications, et, si tu les actives, tes abonnements aux notifications du navigateur.",
          ]}
        />
      </DocSection>

      <DocSection titre="Ce qu'on garde quand tu achètes">
        <DocListe
          elements={[
            "Chaque commande : ce que tu as acheté, le prix payé, la date, le moyen de paiement choisi et la référence de l'opérateur.",
            "Le pays que tu déclares au moment de payer, quand un créateur adapte ses prix au pays.",
            "Tes réponses aux questions qu'un créateur pose à l'achat, s'il en pose.",
            "Tes téléchargements : quelle ressource, quand — c'est ce qui décompte le quota d'un forfait.",
            "Ta clé de licence, une par ressource achetée.",
          ]}
        />
        <DocTexte>
          Le paiement lui-même se fait chez l&apos;opérateur (Paystack, ou l&apos;opérateur mobile money choisi) : Baobart ne voit
          ni ne garde ton numéro de carte.
        </DocTexte>
      </DocSection>

      <DocSection titre="Ce qu'on garde quand tu vends">
        <DocListe
          elements={[
            "Le compte où tu reçois tes versements : le moyen (mobile money ou virement), sa référence et le nom du titulaire.",
            "Tes numéros mobile money, avec leur pays et l'état de leur vérification.",
            "Tes informations de facturation, si tu les remplis : nom, adresse, ville, pays.",
            "Tes ventes, tes soldes et tes versements — le grand livre de ce qui t'est dû.",
          ]}
        />
      </DocSection>

      <DocSection titre="Ce que tu publies">
        <DocTexte>
          Tes ressources, tes commentaires, tes messages dans les communautés, tes collections et ton témoignage : ce
          que tu publies est visible selon les réglages que tu choisis (une collection privée reste privée ; un
          témoignage ne paraît qu&apos;avec ton accord et après relecture).
        </DocTexte>
      </DocSection>

      <DocSection titre="Ce qu'on garde sans compte">
        <DocListe
          elements={[
            "Les affichages et les clics des bannières, comptés par jour : un nombre, sans identifiant.",
            "Une empreinte de ton adresse IP par bannière, 26 heures, pour qu'une même connexion ne fasse pas compter des centaines de clics.",
            `Ton adresse IP dans les compteurs qui freinent les essais répétés — ${dureeDesLimites().toLowerCase()} selon le geste.`,
          ]}
        />
        <DocTexte>
          Les cookies sont détaillés dans la{" "}
          <Link href={"/cookies" as Route} style={lien}>
            politique de cookies
          </Link>
          .
        </DocTexte>
      </DocSection>

      <DocSection titre="Quand tu nous écris, ou t'inscris à la lettre">
        <DocListe
          elements={[
            "Les formulaires Contact et Sponsoriser : ton nom, ton adresse, ton message, et le budget indicatif s'il s'agit de sponsoring — lus par l'équipe qui te répond, et rattachés à ton compte si tu étais connecté.",
            "La lettre d'information : ton adresse, l'état de ton inscription, et la date à laquelle tu l'as confirmée. Sans clic sur le lien de confirmation, l'adresse n'est pas inscrite ; le même courriel porte déjà le lien pour te désinscrire.",
            "Les deux partent avec l'effacement de ton compte, retrouvés par ton adresse. Sans compte, écris-nous pour qu'on les retire.",
          ]}
        />
      </DocSection>

      <DocSection titre="Avec qui c'est partagé">
        <DocListe
          elements={[
            "L'opérateur de paiement, pour encaisser un achat ou envoyer un versement : ce qu'il lui faut pour le faire, rien d'autre.",
            "Le créateur dont tu achètes une ressource : ton nom affiché (ou ton adresse e-mail si ton profil n'a pas de nom), et tes réponses à ses questions s'il en pose.",
            "Les prestataires qui hébergent le site, stockent les fichiers et envoient les courriels, pour faire tourner le service.",
          ]}
        />
        <DocTexte>Baobart ne vend tes données à personne, et n&apos;installe aucun outil de publicité d&apos;un autre site.</DocTexte>
      </DocSection>

      <DocSection titre="Combien de temps">
        <DocListe
          elements={[
            "Ton compte et ce qu'il contient : tant que tu le gardes.",
            "Une session : 30 jours, ou jusqu'à ta déconnexion.",
            "Quand tu demandes l'effacement : 30 jours pour changer d'avis, puis ton compte est vidé — profil, messages, sessions, moyens de paiement partent.",
            "Tes ventes et tes achats restent, sans ce qui te désigne : un grand livre dont les écritures perdraient leur contrepartie ne serait plus un grand livre.",
          ]}
        />
      </DocSection>

      <DocSection titre="Tes droits">
        <DocTexte>
          Tu peux accéder à tes données, les rectifier, t&apos;opposer à un traitement, retirer ton consentement et
          demander l&apos;effacement de ton compte. L&apos;effacement se demande depuis ton profil ; le reste, en écrivant
          à{" "}
          <a href={`mailto:${ADRESSE_DONNEES_PERSONNELLES}`} style={lien}>
            {ADRESSE_DONNEES_PERSONNELLES}
          </a>
          . Si notre réponse ne te satisfait pas, tu peux saisir l&apos;autorité ivoirienne de protection des données
          personnelles.
        </DocTexte>
      </DocSection>
    </PageDocument>
  );
}
