import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { BLANC, CADRE, DashboardFrame, EmptyState, ENCRE, JAUNE, MetricCard } from "@/components/dashboard/frame";
import { Vignette } from "@/components/dashboard/vignette";
import { sessionCourante } from "@/lib/auth/session";
import { bibliothequeDe, type RessourcePossedee } from "@/lib/dashboard/bibliotheque";
import { poidsLisible } from "@/lib/dashboard/bibliotheque-regles";
import { formatCount } from "@/lib/i18n/money";

export const metadata = { title: "Ma bibliothèque — Baobart." };
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

/**
 * « Ma bibliothèque » de la maquette (`Baobart Dashboard.dc.html`, page
 * `bibliotheque`), le 31/10/2026 : tout ce que l'acheteur possède, par titre,
 * ce qu'il n'a pas encore retiré en premier. Pourquoi l'écran manquait et ce
 * qu'il lit : `lib/dashboard/bibliotheque-regles.ts`.
 *
 * Deux écarts avec la maquette :
 *   — pas de « Tout télécharger » : aucune archive groupée n'existe, et la
 *     route de livraison décide fichier par fichier (quota, remboursement,
 *     litige). Un bouton qui n'ouvrirait sur rien vaut moins que son absence ;
 *   — pas de ressources « PASS EXPIRÉ » : voir `lib/dashboard/bibliotheque.ts`.
 */
export default async function BibliothequePage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion?suite=/dashboard/bibliotheque");
  const b = await bibliothequeDe(utilisateur.id);
  const poidsTotal = poidsLisible(b.octets);

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Ma bibliothèque"
      description="Tout ce que tu possèdes, nommé par son titre — pas par un numéro de commande. Ce que tu n'as pas encore retiré apparaît en premier : c'est à toi, ça t'attend."
      action={
        <Link href="/explore" className="sticker-press" style={{ padding: "11px 18px", border: CADRE, borderRadius: 13, background: JAUNE, boxShadow: `4px 4px 0 ${ENCRE}`, fontSize: 13, fontWeight: 800 }}>
          Explorer les ressources
        </Link>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
        <MetricCard label="Ressources possédées" value={formatCount(b.ressources.length)} hint="toutes licences confondues" />
        <MetricCard label="Jamais retirées" value={formatCount(b.jamaisRetirees)} hint={b.jamaisRetirees > 0 ? "elles t'attendent" : "tout est retiré"} accent />
        <MetricCard label="Espace total" value={poidsTotal ?? "—"} hint={poidsTotal ? "les liens externes ne comptent pas" : "aucun poids connu"} />
        <MetricCard label="Licences commerciales" value={formatCount(b.commerciales)} hint="utilisables pour tes clients" mauve />
      </div>

      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 13 }}>
        {b.ressources.length === 0 ? (
          <EmptyState
            titre="Ta bibliothèque est vide"
            texte="Ce que tu achètes arrive ici, prêt à télécharger, même si tu ne l'as jamais ouvert."
          />
        ) : (
          b.ressources.map((r) => <Entree key={r.orderItemId} r={r} />)
        )}
      </div>
    </DashboardFrame>
  );
}

function Entree({ r }: { r: RessourcePossedee }) {
  const neuf = r.dernierRetrait === null;
  const poids = poidsLisible(r.octets);
  const note = neuf
    ? `Acheté le ${DATE.format(r.acheteLe)} · ${r.licence}`
    : `Retiré ${r.retraits} fois · le ${DATE.format(r.dernierRetrait!)}`;

  const bouton = {
    padding: "13px 22px",
    border: `2.5px solid ${ENCRE}`,
    borderRadius: 14,
    background: neuf ? ENCRE : JAUNE,
    color: neuf ? BLANC : ENCRE,
    boxShadow: neuf ? `4px 4px 0 ${BLANC}` : `4px 4px 0 ${ENCRE}`,
    fontSize: 13.5,
    fontWeight: 800,
  } as const;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 16,
        padding: 15,
        border: `2.5px solid ${ENCRE}`,
        borderRadius: 20,
        boxShadow: `5px 5px 0 ${ENCRE}`,
        background: neuf ? JAUNE : BLANC,
      }}
    >
      <Vignette couverture={r.couverture} titre={r.titre} taille={82} />
      <div style={{ flex: "1 1 240px", minWidth: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <Link href={`/products/${r.slug}` as Route} style={{ fontSize: 16.5, fontWeight: 800, lineHeight: 1.25 }}>
            {r.titre}
          </Link>
          <span
            style={{
              padding: "5px 12px",
              border: `2px solid ${ENCRE}`,
              borderRadius: 999,
              background: neuf ? ENCRE : BLANC,
              color: neuf ? BLANC : ENCRE,
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {neuf ? "À TÉLÉCHARGER" : "TÉLÉCHARGÉ"}
          </span>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, marginTop: 5, opacity: 0.72 }}>
          {[r.auteur, r.formats, poids].filter(Boolean).join(" · ")}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, marginTop: 6, opacity: 0.62 }}>{note}</div>
      </div>
      <div style={{ flex: "0 0 auto", display: "flex", flexWrap: "wrap", gap: 10 }}>
        {r.fichiers.length === 1 ? (
          // Droit à la route de livraison, qui redécide tout au clic : un
          // remboursement ou un litige survenu depuis le rendu de la page
          // refuse le fichier même si le bouton est encore affiché.
          <a href={`/api/telechargement/${r.fichiers[0]!.id}`} className="sticker-press" style={bouton}>
            {r.fichiers[0]!.externe ? "Ouvrir le lien" : neuf ? "Télécharger" : "Retélécharger"}
          </a>
        ) : (
          // Plusieurs fichiers : la fiche les liste un par un. Aucun n'en
          // a : la fiche dit pourquoi.
          <Link href={`/products/${r.slug}` as Route} className="sticker-press" style={bouton}>
            {r.fichiers.length > 1 ? `Les ${r.fichiers.length} fichiers` : "Voir la fiche"}
          </Link>
        )}
        <Link href="/licences" style={{ padding: "13px 18px", border: `2.5px solid ${ENCRE}`, borderRadius: 14, background: BLANC, fontSize: 13.5, fontWeight: 800 }}>
          Licence
        </Link>
      </div>
    </div>
  );
}
