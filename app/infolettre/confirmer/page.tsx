import { DocTexte, PageDocument } from "@/components/doc/page-document";
import { BoutonLien } from "@/components/infolettre/bouton-lien";
import { sessionCourante } from "@/lib/auth/session";
import { confirmerInscription } from "@/lib/infolettre/actions";
import { JAUNE } from "@/lib/systeme/charte";

export const metadata = { title: "Confirmer l'inscription — Baobart.", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Où mène le lien du courriel de confirmation. La page n'inscrit rien à
 * l'ouverture — voir `confirmer` dans lib/infolettre/service.ts.
 */
export default async function ConfirmerInfolettrePage({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const [visiteur, { jeton }] = await Promise.all([sessionCourante(), searchParams]);

  return (
    <PageDocument visiteur={visiteur} kicker="Lettre d'information" titre="Confirmer l'inscription" intro="Un clic, et cette adresse recevra la lettre de Baobart.">
      <div style={{ marginTop: 22 }}>
        {jeton ? (
          <BoutonLien action={confirmerInscription.bind(null, jeton)} libelle="Confirmer mon inscription" fond={JAUNE} />
        ) : (
          <DocTexte>Ce lien est incomplet. Ouvre celui du courriel de confirmation tel quel.</DocTexte>
        )}
      </div>
    </PageDocument>
  );
}
