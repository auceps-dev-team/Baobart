import { DocTexte, PageDocument } from "@/components/doc/page-document";
import { BoutonLien } from "@/components/infolettre/bouton-lien";
import { sessionCourante } from "@/lib/auth/session";
import { confirmerDesinscription } from "@/lib/infolettre/actions";

export const metadata = { title: "Se désinscrire — Baobart.", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Où mène le lien de désinscription : sans compte, sans mot de passe. */
export default async function DesinscriptionInfolettrePage({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const [visiteur, { jeton }] = await Promise.all([sessionCourante(), searchParams]);

  return (
    <PageDocument visiteur={visiteur} kicker="Lettre d'information" titre="Se désinscrire" intro="Cette adresse ne recevra plus la lettre de Baobart. Tu pourras te réinscrire quand tu veux.">
      <div style={{ marginTop: 22 }}>
        {jeton ? (
          <BoutonLien action={confirmerDesinscription.bind(null, jeton)} libelle="Me désinscrire" fond="#FFFFFF" />
        ) : (
          <DocTexte>Ce lien est incomplet. Ouvre celui du courriel tel quel.</DocTexte>
        )}
      </div>
    </PageDocument>
  );
}
