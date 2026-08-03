import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { FileUploader } from "@/components/dashboard/file-uploader";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { sessionCourante } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/i18n/money";
import { extensionDe, formatPoids } from "@/lib/upload/formats";
import {
  depublierRessource,
  publierRessource,
  supprimerRessource,
} from "@/lib/products/actions";

export const metadata = { title: "Ressource — Baobart." };
export const dynamic = "force-dynamic";

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
      tags: { select: { tag: { select: { name: true } } } },
      files: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          filename: true,
          sizeBytes: true,
          media: { select: { width: true, height: true } },
        },
      },
      _count: { select: { files: true, orderItems: true } },
    },
  });

  // Une ressource qui n'est pas la sienne répond comme si elle n'existait pas :
  // dire « accès refusé » confirmerait qu'elle existe.
  if (!produit || produit.sellerId !== utilisateur.id) notFound();

  const enLigne = produit.status === "PUBLISHED";
  const dejaVendue = produit._count.orderItems > 0;
  const sansFichier = produit._count.files === 0;

  // Ces trois lignes sont des faits, pas des déclarations : la maquette les
  // présente comme des champs de saisie, mais un poids annoncé et un poids réel
  // ne peuvent pas diverger sans tromper l'acheteur. On les lit des fichiers.
  const sources =
    [
      ...new Set(
        produit.files
          .map((f) => extensionDe(f.filename).toUpperCase())
          .filter((e) => e.length > 0),
      ),
    ].join(", ") || "—";

  const poidsTotal = produit.files.reduce((somme, f) => somme + f.sizeBytes, 0);

  const plusGrande = produit.files
    .map((f) => f.media)
    .filter((m) => m.width !== null && m.height !== null)
    .sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0))[0];

  const dimensions = plusGrande
    ? `${plusGrande.width} × ${plusGrande.height}`
    : "—";

  const publier = publierRessource.bind(null, produit.id);
  const depublier = depublierRessource.bind(null, produit.id);
  const supprimer = supprimerRessource.bind(null, produit.id);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#EADFF9" }}>
      <DashboardSidebar
        etape={utilisateur.progression.etape}
        nom={utilisateur.nom}
        email={utilisateur.email}
      />

      <main style={{ flex: "1 1 auto", padding: "32px 36px", minWidth: 0 }}>
        <Link
          href="/dashboard/produits"
          style={{ fontSize: 13, fontWeight: 700, opacity: 0.7 }}
        >
          ← Toutes mes ressources
        </Link>

        <div
          style={{
            display: "inline-block",
            marginTop: 14,
            padding: "6px 12px",
            border: `2px solid ${ENCRE}`,
            borderRadius: 999,
            background: enLigne ? JAUNE : BLANC,
            fontFamily: "'Space Mono', monospace",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: ".1em",
          }}
        >
          {enLigne ? "En ligne" : "Brouillon"}
        </div>

        <h1
          style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: "clamp(28px,3.2vw,40px)",
            letterSpacing: "-1.4px",
            margin: "12px 0 0",
            textTransform: "uppercase",
          }}
        >
          {produit.name}
        </h1>

        {MESSAGES_ERREUR[erreur ?? ""] ? (
          <div
            role="alert"
            style={{
              marginTop: 16,
              maxWidth: 640,
              padding: "13px 15px",
              border: CADRE,
              borderRadius: 14,
              background: ORANGE,
              color: BLANC,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {MESSAGES_ERREUR[erreur ?? ""]}
          </div>
        ) : null}

        <div
          style={{
            marginTop: 24,
            maxWidth: 640,
            border: CADRE,
            borderRadius: 24,
            background: BLANC,
            boxShadow: `6px 6px 0 ${ENCRE}`,
            padding: 22,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {[
            ["Prix", formatPrice(produit.price, produit.currency)],
            ["Catégorie", produit.family ?? "—"],
            [
              "Mots-clés",
              produit.tags.map((t) => t.tag.name).join(", ") || "—",
            ],
            ["Description", produit.description ?? "—"],
            ["Fichiers sources", sources],
            ["Dimensions", dimensions],
            ["Poids total", sansFichier ? "—" : formatPoids(poidsTotal)],
          ].map(([cle, valeur]) => (
            <div
              key={cle}
              style={{ display: "flex", justifyContent: "space-between", gap: 16 }}
            >
              <span style={{ opacity: 0.6, fontSize: 13, fontWeight: 600 }}>
                {cle}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 700, textAlign: "right" }}>
                {valeur}
              </span>
            </div>
          ))}
        </div>

        <h2
          style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: 17,
            letterSpacing: "-.4px",
            margin: "28px 0 12px",
            textTransform: "uppercase",
          }}
        >
          Fichier &amp; aperçu
        </h2>

        <FileUploader
          produitId={produit.id}
          couvertureInitiale={produit.coverUrl}
          fichiersInitiaux={produit.files.map((f) => ({
            id: f.id,
            nom: f.filename,
            taille: f.sizeBytes,
          }))}
        />

        <div
          style={{
            marginTop: 24,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            maxWidth: 640,
          }}
        >
          {enLigne ? (
            <form action={depublier}>
              <button
                type="submit"
                className="sticker-press"
                style={{
                  padding: "14px 24px",
                  border: CADRE,
                  borderRadius: 14,
                  background: BLANC,
                  boxShadow: `4px 4px 0 ${ENCRE}`,
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
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
                title={
                  sansFichier
                    ? "Attache au moins un fichier avant de publier."
                    : undefined
                }
                style={{
                  padding: "14px 24px",
                  border: CADRE,
                  borderRadius: 14,
                  background: sansFichier ? BLANC : ENCRE,
                  color: sansFichier ? ENCRE : BLANC,
                  boxShadow: sansFichier ? "none" : `4px 4px 0 ${ORANGE}`,
                  fontSize: 14,
                  fontWeight: 800,
                  opacity: sansFichier ? 0.45 : 1,
                  cursor: sansFichier ? "not-allowed" : "pointer",
                }}
              >
                Publier la ressource
              </button>
            </form>
          )}

          {/*
            La suppression n'est proposée que si rien n'a été vendu. L'afficher
            pour la refuser ensuite serait une promesse en trompe-l'œil.
          */}
          {dejaVendue ? null : (
            <form action={supprimer}>
              <button
                type="submit"
                style={{
                  padding: "14px 24px",
                  border: CADRE,
                  borderRadius: 14,
                  background: BLANC,
                  fontSize: 14,
                  fontWeight: 800,
                  color: ORANGE_SOMBRE,
                  cursor: "pointer",
                }}
              >
                Supprimer
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
