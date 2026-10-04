import Link from "next/link";
import type { Route } from "next";

import { FormulaireContact } from "@/components/contact/formulaire";
import { DocListe, DocSection, PageDocument } from "@/components/doc/page-document";
import { sessionCourante } from "@/lib/auth/session";
import { ADRESSE_DONNEES_PERSONNELLES } from "@/lib/config/contact";
import { SUJETS_CONTACT } from "@/lib/contact/regles";
import { ENCRE } from "@/lib/systeme/charte";

export const metadata = {
  title: "Contact — Baobart.",
  description: "Écrire à l'équipe Baobart : une licence, un paiement, un bug, un partenariat.",
};

export const dynamic = "force-dynamic";

/**
 * Contact.
 *
 * La maquette (`DOCS.contact`) promettait une réponse « sous 48 h ouvrées »
 * et publiait support@ et hello@baobart.africa. Rien ne garantit ce délai, et
 * rien ne dit que ces boîtes existent : la seule adresse confirmée est celle
 * des données personnelles (décidé le 04/10). Le formulaire écrit dans
 * « Messages reçus », que le support lit.
 */
export default async function ContactPage() {
  const visiteur = await sessionCourante();
  const lien = { color: ENCRE, fontWeight: 700 } as const;

  return (
    <PageDocument
      visiteur={visiteur}
      kicker="Communauté"
      titre="Contact"
      intro="Une question sur une licence, un paiement, un bug, un partenariat ? Écris-nous : le message arrive à l'équipe, qui te répond à l'adresse que tu donnes."
    >
      <DocSection titre="Avant d'écrire">
        <DocListe
          elements={[
            <>
              Les questions courantes — un fichier qui ne se télécharge pas, un remboursement — ont leur réponse sur la
              page{" "}
              <Link href={"/support" as Route} style={lien}>
                Support
              </Link>
              .
            </>,
            <>
              Un contenu qui porte atteinte à tes droits se signale par la{" "}
              <Link href={"/signalement" as Route} style={lien}>
                procédure de retrait
              </Link>
              , qui a ses délais légaux.
            </>,
            <>
              Tes données personnelles :{" "}
              <a href={`mailto:${ADRESSE_DONNEES_PERSONNELLES}`} style={lien}>
                {ADRESSE_DONNEES_PERSONNELLES}
              </a>
              .
            </>,
            <>
              Mettre ton produit en avant :{" "}
              <Link href={"/sponsoriser" as Route} style={lien}>
                Sponsoriser
              </Link>
              .
            </>,
          ]}
        />
      </DocSection>

      <DocSection titre="Nous écrire" id="ecrire">
        <div style={{ marginTop: 12 }}>
          <FormulaireContact genre="CONTACT" sujets={SUJETS_CONTACT} depart={{ nom: visiteur?.nom ?? "", email: visiteur?.email ?? "" }} />
        </div>
      </DocSection>
    </PageDocument>
  );
}
