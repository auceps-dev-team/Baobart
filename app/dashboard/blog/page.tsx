import Link from "next/link";
import type { Route } from "next";

import { DashboardFrame } from "@/components/dashboard/frame";
import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import { listerPourAdministration } from "@/lib/blog/queries";
import { LIBELLE_ETAT } from "@/lib/cms/cycle";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, ORANGE, VERT } from "@/lib/systeme/charte";

export const metadata = { title: "Blog — Baobart." };
export const dynamic = "force-dynamic";

/**
 * Les articles, vus de l'administration.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * TRIÉ PAR DERNIÈRE MODIFICATION, PAS PAR DATE DE PARUTION
 *
 * Cet écran sert à **reprendre** ce qu'on travaille. Un brouillon commencé il
 * y a six mois et corrigé ce matin doit remonter ; un article paru la semaine
 * dernière et plus touché depuis peut redescendre.
 *
 * La liste publique, elle, trie par date de parution — ce sont deux questions
 * différentes, et c'est pour ça qu'il y a deux requêtes.
 */
export default async function BlogAdminPage() {
  const utilisateur = await exigerLePouvoir("publier_du_contenu");
  const articles = await listerPourAdministration();

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Blog"
      description="Les articles de Baobart. Rien ne paraît tant que c'est un brouillon."
      action={
        <Link
          href={"/dashboard/blog/nouveau" as Route}
          className="sticker-press"
          style={{
            padding: "12px 20px",
            border: CADRE,
            borderRadius: 14,
            background: JAUNE,
            boxShadow: `4px 4px 0 ${ENCRE}`,
            fontSize: 13.5,
            fontWeight: 800,
            color: ENCRE,
          }}
        >
          Nouvel article
        </Link>
      }
    >
      {articles.length === 0 ? (
        <div
          style={{
            border: CADRE,
            borderRadius: 24,
            background: BLANC,
            boxShadow: `6px 6px 0 ${ENCRE}`,
            padding: 28,
            maxWidth: 620,
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 800 }}>Aucun article</div>
          <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55, marginTop: 8 }}>
            Écris le premier — il naîtra en brouillon, et ne paraîtra que
            lorsque tu le publieras.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {articles.map((a) => (
            <Link
              key={a.id}
              href={`/dashboard/blog/${a.id}` as Route}
              className="sticker-press"
              style={{
                display: "block",
                border: CADRE,
                borderRadius: 20,
                background: BLANC,
                boxShadow: `4px 4px 0 ${ENCRE}`,
                padding: 18,
                color: ENCRE,
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <Pastille fond={a.etat === "PUBLIE" ? VERT : BLANC}>
                  {LIBELLE_ETAT[a.etat]}
                </Pastille>
                {a.categorie ? (
                  <Pastille fond={LAVANDE} mono>
                    {a.categorie}
                  </Pastille>
                ) : null}
                {a.aLaUne ? <Pastille fond={ORANGE} clair>À LA UNE</Pastille> : null}
              </div>

              <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.3, marginTop: 10 }}>
                {a.titre}
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 16,
                  marginTop: 10,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11.5,
                  opacity: 0.65,
                }}
              >
                <span>/{a.slug}</span>
                <span>par {a.auteur}</span>
                <span>
                  {a.publieLe
                    ? `paru le ${a.publieLe.toLocaleDateString("fr-FR", { timeZone: "UTC" })}`
                    : "jamais paru"}
                </span>
                {/*
                  Le compteur dit « combien de fois la page a été servie », pas
                  « combien de personnes l'ont lue ». Le libellé le dit, sans
                  quoi l'écran promettrait une audience qu'on ne mesure pas.
                */}
                <span>{a.vues} affichage{a.vues > 1 ? "s" : ""}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </DashboardFrame>
  );
}

function Pastille({
  children,
  fond,
  mono = false,
  clair = false,
}: {
  children: React.ReactNode;
  fond: string;
  mono?: boolean;
  clair?: boolean;
}) {
  return (
    <span
      style={{
        padding: "5px 11px",
        border: `2px solid ${ENCRE}`,
        borderRadius: 999,
        background: fond,
        color: clair ? BLANC : ENCRE,
        fontSize: mono ? 10.5 : 11,
        fontWeight: mono ? 400 : 800,
        fontFamily: mono ? "var(--font-mono)" : undefined,
        textTransform: "uppercase",
        letterSpacing: mono ? ".06em" : undefined,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
