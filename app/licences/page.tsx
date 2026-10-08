import { DocListe, DocSection, DocTexte, PageDocument } from "@/components/doc/page-document";
import { sessionCourante } from "@/lib/auth/session";
import { urlDuSite } from "@/lib/config/site";
import { db } from "@/lib/db";
import { BLANC, CADRE, ENCRE, LAVANDE } from "@/lib/systeme/charte";

export const metadata = {
  title: "Licences — Baobart.",
  description: "Ce que chaque licence permet, ce qu'est ta clé de licence, et comment un programme la vérifie.",
};

export const dynamic = "force-dynamic";

/** Les conditions rangées avec chaque type (`LicenseType.conditions`), dites en clair. */
const CONDITIONS: Record<string, string> = {
  commercial: "projets commerciaux et travaux pour un client",
  print: "impression",
  edition: "édition (livres, magazines, affiches grand format)",
  broadcast: "diffusion (télévision, cinéma, plateformes vidéo)",
  merchandising: "produits dérivés (textile, objets)",
  resale: "revente du fichier tel quel",
};

/**
 * Les licences.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * INSPIRÉE DE GUMROAD, DÉCIDÉ LE 04/10
 *
 * Gumroad distingue deux choses que la maquette confondait : ce qu'on a le
 * droit de faire d'un fichier (ses conditions), et la clé qui prouve qu'on l'a
 * acheté (`app/models/license.rb`, et l'article d'aide « license keys » du
 * dépôt antiwork/gumroad). Baobart avait les deux en base — trois types de
 * licence, une clé par vente — et n'en montrait aucune : relevé le 04/10, la
 * clé était créée à chaque achat et affichée nulle part. Elle paraît désormais
 * sur la fiche de la ressource, pour qui la possède.
 *
 * Les types viennent de la base (`LicenseType`), pas de la maquette, qui en
 * annonçait deux et leur prêtait « 500 000 impressions » que rien ne décompte.
 */
export default async function LicencesPage() {
  const [visiteur, types] = await Promise.all([
    sessionCourante(),
    db.licenseType.findMany({ orderBy: { code: "asc" }, select: { code: true, title: true, description: true, conditions: true } }),
  ]);
  const ordre = { PERSONAL: 0, COMMERCIAL: 1, EXTENDED: 2 } as const;
  types.sort((a, b) => ordre[a.code] - ordre[b.code]);
  const site = urlDuSite() ?? "";

  return (
    <PageDocument
      visiteur={visiteur}
      kicker="Conditions générales"
      titre="Licences Baobart"
      intro="Chaque achat porte deux choses : une licence, qui dit ce que tu peux faire du fichier, et une clé, qui prouve que tu l'as acheté."
    >
      <DocSection titre="Les licences">
        <DocTexte>
          Le créateur choisit la licence de chaque ressource ; elle est écrite sur sa fiche, à côté du prix. Sans choix
          de sa part, c&apos;est la licence commerciale.
        </DocTexte>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(260px,100%),1fr))", gap: 12, marginTop: 12 }}>
          {types.map((t) => {
            const c = (t.conditions ?? {}) as Record<string, boolean>;
            const permis = Object.entries(CONDITIONS).filter(([k]) => c[k] === true).map(([, v]) => v);
            const interdits = Object.entries(CONDITIONS).filter(([k]) => c[k] === false).map(([, v]) => v);
            return (
              <div key={t.code} data-licence-type={t.code} style={{ border: CADRE, borderRadius: 18, background: t.code === "COMMERCIAL" ? LAVANDE : BLANC, padding: 16 }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>{t.title}</div>
                <p style={{ margin: "6px 0 0", fontSize: 13.5, fontWeight: 500, lineHeight: 1.5 }}>{t.description}</p>
                {permis.length > 0 ? <p style={{ margin: "8px 0 0", fontSize: 12.5, fontWeight: 700 }}>Permis : {permis.join(", ")}.</p> : null}
                {interdits.length > 0 ? <p style={{ margin: "4px 0 0", fontSize: 12.5, fontWeight: 700, opacity: 0.75 }}>Exclu : {interdits.join(", ")}.</p> : null}
              </div>
            );
          })}
        </div>
      </DocSection>

      <DocSection titre="Ce qui vaut pour toutes">
        <DocListe
          elements={[
            "Revendre ou redistribuer le fichier tel quel est interdit, quelle que soit la licence.",
            "La licence vaut pour celui qui a acheté : elle ne se transmet pas avec une copie du fichier.",
            "Accès libre ne change pas la licence d'une ressource : c'est celle que son créateur a choisie. Les forfaits payants, quand ils ouvriront, porteront la leur : la personnelle pour Explorer, la commerciale pour Studio.",
          ]}
        />
      </DocSection>

      <DocSection titre="Ta clé de licence" id="cle">
        <DocTexte>
          Chaque achat reçoit une clé, au format XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX — sans 0, O, 1, I ni L, qui se
          confondent quand on recopie. Tu la retrouves sur la fiche de la ressource, sous le bouton de téléchargement,
          dès que l&apos;achat est payé.
        </DocTexte>
        <DocTexte>
          Elle ne donne aucun droit par elle-même : l&apos;accès aux fichiers se décide sur ta commande. Elle sert à
          prouver ton achat ailleurs — dans le logiciel ou la police que tu installes, auprès du support, dans ta
          comptabilité.
        </DocTexte>
      </DocSection>

      <DocSection titre="Pour les créateurs : vérifier une clé" id="verifier">
        <DocTexte>
          Tu vends un logiciel, un greffon, une police ? Ton programme peut demander la clé à l&apos;acheteur et la faire
          vérifier par Baobart. Chaque vérification compte une utilisation, sauf si tu passes{" "}
          <code>incrementer=false</code> ; c&apos;est à toi de décider combien d&apos;utilisations une clé autorise.
        </DocTexte>
        <pre
          style={{
            margin: "10px 0 0",
            padding: 14,
            border: CADRE,
            borderRadius: 14,
            background: ENCRE,
            color: BLANC,
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
            lineHeight: 1.6,
            overflowX: "auto",
          }}
        >
          {`curl ${site}/api/licences/verifier \\
  -d "produit=<identifiant de ta ressource>" \\
  -d "cle=XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"`}
        </pre>
        <DocListe
          elements={[
            "Réponse 200 quand la clé vaut pour cette ressource : le nombre d'utilisations, la date de l'achat, et s'il a été remboursé ou contesté — à ton programme de décider quoi en faire.",
            "Réponse 404 quand elle ne correspond à aucun achat de cette ressource, ou qu'elle a été désactivée.",
            "La réponse ne contient aucune donnée personnelle de l'acheteur : une clé recopiée sur un forum ne livre personne.",
          ]}
        />
      </DocSection>
    </PageDocument>
  );
}
