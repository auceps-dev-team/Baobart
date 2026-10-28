import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { FileUploader } from "@/components/dashboard/file-uploader";
import { DashboardFrame, DashboardPanel } from "@/components/dashboard/frame";
import { FormulaireProduit } from "@/components/dashboard/product-form";
import { sessionCourante } from "@/lib/auth/session";
import { LIBELLE_STATUT } from "@/lib/dashboard/lectures";
import { db } from "@/lib/db";
import { dossiersQuiRetiennent } from "@/lib/juridique/retrait";
import { LIBELLE_PAR_FAMILLE } from "@/lib/feed/types";
import { formatPrice } from "@/lib/i18n/money";
import { hoteDuLien } from "@/lib/products/lien-externe";
import { extensionDe, formatDe, formatPoids } from "@/lib/upload/formats";
import { cleDeReference } from "@/lib/upload/provenance";
import { lireObjet } from "@/lib/upload/storage";
import {
  depublierRessource,
  modifierRessource,
  publierRessource,
  supprimerRessource,
} from "@/lib/products/actions";
import { PanneauChampsProduit } from "@/components/dashboard/champs-produit";
import { ReglageMontant } from "@/components/dashboard/reglage-montant";
import {
  declarerMonChamp,
  reglerLeMontant,
  retirerMonChamp,
} from "@/lib/commerce/actions-promo";
import { champsDe } from "@/lib/commerce/champs";
import { minimumLibre } from "@/lib/commerce/montant";

export const metadata = { title: "Ressource — Baobart." };
export const dynamic = "force-dynamic";

/**
 * Cette page héberge les actions d'envoi de fichiers.
 *
 * Confirmer un envoi rapatrie l'image et en tire une vignette : sur une
 * photographie de trente mégaoctets, c'est plus long que les dix secondes
 * qu'une fonction serverless s'accorde par défaut. Le dépassement se
 * traduirait par un fichier accepté au stockage mais jamais rattaché à la
 * ressource.
 */
export const maxDuration = 60;

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const JAUNE = "#FFD84A";
const ORANGE = "#E2622C";
const ORANGE_SOMBRE = "#B34A1F";
const CADRE = `2.5px solid ${ENCRE}`;


const MESSAGES_ERREUR: Record<string, string> = {
  vendue:
    "Cette ressource a déjà été vendue : elle ne peut plus être supprimée. Retire-la de la vente — les acheteurs gardent ce qu'ils ont payé.",
  "sans-fichier":
    "Attache au moins un fichier avant de publier : sans lui, un acheteur paierait sans rien recevoir.",
  // La garde de `lib/products/actions.ts`. Sans ce message, le clic échouerait
  // sans un mot, et l'auteur croirait à une panne.
  "retrait-juridique":
    "Cette ressource fait l'objet d'une notification juridique : tu ne peux ni la publier, ni la modifier, ni la supprimer tant que le dossier n'est pas tranché. Le détail est dans « Mes dossiers ».",
};

export default async function ProduitDuTableauDeBord({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erreur?: string }>;
}) {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion");

  const { id } = await params;
  const { erreur } = await searchParams;

  const produit = await db.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      price: true,
      currency: true,
      family: true,
      description: true,
      sellerId: true,
      coverUrl: true,
      previewUrl: true,
      previewKind: true,
      pricingMode: true,
      minPrice: true,
      suggestedPrices: true,
      tipsEnabled: true,
      pppEnabled: true,
      pppMaxDiscountBp: true,
      tags: { select: { tag: { select: { name: true } } } },
      licenseType: { select: { code: true } },
      files: {
        where: { deletedAt: null },
        orderBy: { position: "asc" },
        select: {
          id: true,
          filename: true,
          sizeBytes: true,
          role: true,
          externalUrl: true,
          media: { select: { id: true, width: true, height: true } },
        },
      },
      _count: { select: { orderItems: true } },
    },
  });

  // Une ressource qui n'est pas la sienne répond comme si elle n'existait pas :
  // dire « accès refusé » confirmerait qu'elle existe.
  if (!produit || produit.sellerId !== utilisateur.id) notFound();

  const champsPersonnalises = await champsDe(produit.id);

  // Le récapitulatif ne décrit que ce que l'acheteur reçoit. Un extrait de
  // vingt secondes n'a pas à peser dans le « poids total » annoncé.
  const fichiersSources = produit.files.filter((f) => f.role === "SOURCE");
  const fichiersApercu = produit.files.filter((f) => f.role === "PREVIEW");

  // Les copies de référence existantes (litige). On ne montre un lien que s'il
  // mène quelque part : un fichier non image, ou envoyé avant cette fonction,
  // n'en a pas. Peu de fichiers par produit, et c'est le vendeur sur sa propre
  // page — le coût de ces lectures est borné.
  const copiesDeReference = (
    await Promise.all(
      fichiersSources
        .filter((f) => f.externalUrl === null && f.media)
        .map(async (f) =>
          (await lireObjet(cleDeReference(f.media!.id)))
            ? { mediaId: f.media!.id, nom: f.filename }
            : null,
        ),
    )
  ).filter((c): c is { mediaId: string; nom: string } => c !== null);

  const enLigne = produit.status === "PUBLISHED";
  const retiree = produit.status === "SUSPENDED";

  // Une seule requête, et seulement quand elle sert : la fiche d'une ressource
  // qui n'est pas retirée n'a aucune raison d'interroger les dossiers.
  const retenues = retiree ? await dossiersQuiRetiennent(produit.id) : [];
  const dejaVendue = produit._count.orderItems > 0;
  const sansFichier = fichiersSources.length === 0;

  // Ces trois lignes sont des faits, pas des déclarations : la maquette les
  // présente comme des champs de saisie, mais un poids annoncé et un poids réel
  // ne peuvent pas diverger sans tromper l'acheteur. On les lit des fichiers.
  const sources =
    [
      ...new Set(
        fichiersSources
          // Un lien n'annonce un format que s'il porte une extension connue :
          // « Fichier sur drive.google.com » ne doit pas s'afficher « COM ».
          .map((f) =>
            f.externalUrl
              ? (formatDe(f.filename)?.extension ?? "lien").toUpperCase()
              : extensionDe(f.filename).toUpperCase(),
          )
          .filter((e) => e.length > 0),
      ),
    ].join(", ") || "—";

  // Le poids ne compte que ce qu'on a mesuré. Un lien externe se dit à part :
  // l'additionner à zéro ferait passer « 12 Mo » pour le poids de tout.
  const poidsTotal = fichiersSources.reduce((somme, f) => somme + (f.sizeBytes ?? 0), 0);
  const liensExternes = fichiersSources.filter((f) => f.externalUrl !== null).length;
  const heberges = fichiersSources.length - liensExternes;
  const libelleLiens = `${liensExternes} lien${liensExternes > 1 ? "s" : ""} externe${liensExternes > 1 ? "s" : ""}`;
  const poidsAffiche = sansFichier
    ? "—"
    : heberges === 0
      ? libelleLiens
      : liensExternes > 0
        ? `${formatPoids(poidsTotal)} + ${libelleLiens}`
        : formatPoids(poidsTotal);

  const plusGrande = fichiersSources
    .flatMap((f) => (f.media && f.media.width !== null && f.media.height !== null ? [f.media] : []))
    .sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))[0];

  const dimensions = plusGrande
    ? `${plusGrande.width} × ${plusGrande.height}`
    : "—";

  const extrait =
    produit.previewUrl && produit.previewKind
      ? {
          url: produit.previewUrl,
          nature: produit.previewKind as "audio" | "video",
        }
      : null;

  const publier = publierRessource.bind(null, produit.id);
  const depublier = depublierRessource.bind(null, produit.id);
  const supprimer = supprimerRessource.bind(null, produit.id);
  const modifier = modifierRessource.bind(null, produit.id);

  // Ce que le formulaire d'édition affiche au premier rendu. Les champs
  // parlent la langue de l'écran — « Illustration », pas `ILLUSTRATION` —
  // et c'est `LIBELLE_PAR_FAMILLE` qui fait la traduction dans ce sens.
  const depart = {
    titre: produit.name,
    famille: produit.family ? (LIBELLE_PAR_FAMILLE[produit.family] ?? "") : "",
    licence: produit.licenseType?.code ?? "COMMERCIAL",
    motsCles: produit.tags.map((t) => t.tag.name).join(", "),
    description: produit.description ?? "",
    // Un prix nul s'affiche vide : le champ porte déjà la case « gratuite »,
    // et y écrire « 0 » donnerait deux façons de dire la même chose.
    prix: produit.price > 0 ? String(produit.price) : "",
    gratuit: produit.price === 0,
  };

  // L'action de l'en-tête : le retour, l'état, et le geste qui change l'état.
  // L'état était une pastille collée sous « ← Toutes mes ressources » (relevé
  // le 27/10) ; il vit maintenant à côté du geste qui le fait changer.
  const geste = enLigne ? (
    <form action={depublier}>
      <button
        type="submit"
        className="sticker-press"
        style={{ padding: "11px 18px", border: CADRE, borderRadius: 13, background: BLANC, boxShadow: `4px 4px 0 ${ENCRE}`, fontSize: 13, fontWeight: 800, cursor: "pointer" }}
      >
        Retirer de la vente
      </button>
    </form>
  ) : (
    <form action={publier}>
      <button
        type="submit"
        className={sansFichier ? undefined : "sticker-press"}
        disabled={sansFichier}
        title={sansFichier ? "Attache au moins un fichier avant de publier." : undefined}
        style={{
          padding: "11px 18px",
          border: CADRE,
          borderRadius: 13,
          background: sansFichier ? BLANC : ENCRE,
          color: sansFichier ? ENCRE : BLANC,
          boxShadow: sansFichier ? "none" : `4px 4px 0 ${ORANGE}`,
          fontSize: 13,
          fontWeight: 800,
          opacity: sansFichier ? 0.45 : 1,
          cursor: sansFichier ? "not-allowed" : "pointer",
        }}
      >
        Publier la ressource
      </button>
    </form>
  );

  const action = (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <Link href="/dashboard/produits" style={{ fontSize: 13, fontWeight: 700, opacity: 0.75 }}>
        ← Toutes mes ressources
      </Link>
      <span
        data-statut-produit
        style={{
          padding: "6px 12px",
          border: `2px solid ${ENCRE}`,
          borderRadius: 999,
          background: retiree ? ORANGE : enLigne ? JAUNE : BLANC,
          color: retiree ? BLANC : ENCRE,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: ".1em",
        }}
      >
        {LIBELLE_STATUT[produit.status]}
      </span>
      {geste}
    </div>
  );

  // Deux colonnes, comme « Publier une ressource » de la maquette (27/10) :
  // neuf blocs s'empilaient dans 640 px. À gauche ce que l'acheteur reçoit
  // et voit, à droite ce qui se règle. Sous 900 px, elles se suivent.
  const colonnes = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))",
    gap: 20,
    alignItems: "start",
    marginTop: 20,
  } as const;
  const pile = { display: "grid", gap: 20, minWidth: 0 } as const;
  const aide = (texte: string) => <p style={{ margin: "-6px 0 14px", fontSize: 13, fontWeight: 500, opacity: 0.7 }}>{texte}</p>;

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre={produit.name}
      description="Titre, prix, catégorie, mots-clés, description. L'adresse publique de la ressource ne change pas, même si tu la renommes : elle a peut-être déjà été partagée."
      action={action}
    >
      {/*
        Quel dossier la retient, et depuis quand.

        Une pastille « retirée » sans référence laisserait l'auteur sans rien
        à citer : il écrirait au support pour demander ce que la page aurait
        pu lui dire. La référence est celle qu'il retrouvera dans « Mes
        dossiers » et dans toute correspondance.
      */}
      {retenues.length > 0 ? (
        <div style={{ marginBottom: 16, padding: "13px 15px", border: CADRE, borderRadius: 14, background: BLANC, fontSize: 13, lineHeight: 1.55 }}>
          <strong>Retrait à titre provisoire.</strong>{" "}
          {retenues.length === 1
            ? `Dossier ${retenues[0]!.reference}, ouvert le ${retenues[0]!.suspendedAt.toLocaleDateString("fr-FR")}.`
            : `${retenues.length} dossiers : ${retenues.map((r) => r.reference).join(", ")}.`}{" "}
          <Link href="/dashboard/mes-dossiers" style={{ fontWeight: 700 }}>
            Répondre
          </Link>
        </div>
      ) : null}

      {MESSAGES_ERREUR[erreur ?? ""] ? (
        <div role="alert" style={{ marginBottom: 16, padding: "13px 15px", border: CADRE, borderRadius: 14, background: ORANGE, color: BLANC, fontSize: 13, fontWeight: 700 }}>
          {MESSAGES_ERREUR[erreur ?? ""]}
        </div>
      ) : null}

      <FormulaireProduit action={modifier} depart={depart} libelleBouton="Enregistrer les modifications" />

      <div style={colonnes}>
        <div style={pile}>
          <DashboardPanel titre="Fichiers">
            {aide("Ce que l'acheteur télécharge après paiement. Personne d'autre n'y accède.")}
            <FileUploader
              produitId={produit.id}
              role="SOURCE"
              couvertureInitiale={produit.coverUrl}
              fichiersInitiaux={fichiersSources.map((f) => ({
                id: f.id,
                nom: f.filename,
                taille: f.sizeBytes,
                externe: f.externalUrl ? hoteDuLien(f.externalUrl) : null,
              }))}
            />
            {copiesDeReference.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 15, textTransform: "uppercase" }}>Copies de référence (litige)</div>
                {aide(
                  "Pour chaque image vendue, une copie réduite marquée de ton auteur, du © et de ta licence, que toi seul peux voir. " +
                    "Si tu retrouves ton œuvre utilisée autrement que la licence ne l'autorise, télécharge-la : elle sert de preuve. " +
                    "L'acheteur ne la reçoit jamais.",
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {copiesDeReference.map((c) => (
                    // Un lien de téléchargement vers une route d'API (redirection
                    // signée), pas une navigation interne : `<a>` simple, pas `<Link>`.
                    <a key={c.mediaId} href={`/api/reference/${c.mediaId}`} style={{ fontSize: 14, fontWeight: 700, textDecoration: "underline", width: "fit-content" }}>
                      Copie de référence — {c.nom}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </DashboardPanel>

          <DashboardPanel titre="Aperçu">
            {aide(
              "Ce que les gens voient dans la grille et sur ta fiche. Une image pour tous les formats — un PSD, une police ou un ZIP " +
                "ne se montrent pas tout seuls. Pour la vidéo et l'audio, dépose aussi un extrait : il sera jouable avant achat.",
            )}
            <FileUploader
              produitId={produit.id}
              role="PREVIEW"
              couvertureInitiale={produit.coverUrl}
              extraitInitial={extrait}
              fichiersInitiaux={fichiersApercu.map((f) => ({ id: f.id, nom: f.filename, taille: f.sizeBytes }))}
            />
          </DashboardPanel>
        </div>

        <div style={pile}>
          <DashboardPanel titre="En résumé">
            {/*
              Seulement ce qui ne s'édite pas : ces trois-là se déduisent des
              fichiers envoyés. Le reste — titre, prix, catégorie, mots-clés,
              description — vit dans le formulaire, où il se corrige. Les
              afficher aux deux endroits donnerait deux vérités à tenir, et
              l'une des deux finirait périmée.
            */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                ["Prix affiché", formatPrice(produit.price, produit.currency)],
                ["Fichiers sources", sources],
                ["Dimensions", dimensions],
                ["Poids total", poidsAffiche],
              ].map(([cle, valeur]) => (
                <div key={cle} style={{ display: "flex", justifyContent: "space-between", gap: 16, paddingBottom: 8, borderBottom: "1.5px solid #12121222" }}>
                  <span style={{ opacity: 0.6, fontSize: 13, fontWeight: 600 }}>{cle}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, textAlign: "right" }}>{valeur}</span>
                </div>
              ))}
            </div>
          </DashboardPanel>

          {/*
            Le mode de prix, avant les questions : il décide de ce que
            l'acheteur voit en premier au moment de payer.
          */}
          <DashboardPanel titre="Montant et pourboire">
            <ReglageMontant
              produitId={produit.id}
              mode={produit.pricingMode}
              minPrice={produit.minPrice}
              suggeres={Array.isArray(produit.suggestedPrices) ? (produit.suggestedPrices as unknown[]).map(Number) : []}
              pourboires={produit.tipsEnabled}
              parite={produit.pppEnabled}
              paritePlafond={produit.pppMaxDiscountBp === null ? null : Math.round(produit.pppMaxDiscountBp / 100)}
              plancher={minimumLibre(null)}
              regler={reglerLeMontant}
            />
          </DashboardPanel>

          {/* Un réglage, pas une action : avant les gestes destructeurs. */}
          <DashboardPanel titre="Questions posées à l'achat">
            <PanneauChampsProduit produitId={produit.id} champs={champsPersonnalises} declarer={declarerMonChamp} retirer={retirerMonChamp} />
          </DashboardPanel>

          {/*
            La suppression n'est proposée que si rien n'a été vendu. L'afficher
            pour la refuser ensuite serait une promesse en trompe-l'œil.
          */}
          {dejaVendue ? null : (
            <form action={supprimer}>
              <button
                type="submit"
                style={{ padding: "12px 20px", border: CADRE, borderRadius: 14, background: BLANC, fontSize: 13.5, fontWeight: 800, color: ORANGE_SOMBRE, cursor: "pointer" }}
              >
                Supprimer la ressource
              </button>
            </form>
          )}
        </div>
      </div>
    </DashboardFrame>
  );
}
