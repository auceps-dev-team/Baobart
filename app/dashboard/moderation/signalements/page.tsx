import Link from "next/link";
import type { Route } from "next";

import { CorpsArticle } from "@/components/cms/corps";
import { DashboardFrame } from "@/components/dashboard/frame";
import { DecisionSignalement } from "@/components/forum/decision-signalement";
import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import { messagesSignales } from "@/lib/forum/signalements";
import { BLANC, CADRE, ENCRE, JAUNE, MAUVE, VERT } from "@/lib/systeme/charte";

export const metadata = { title: "Signalements — Baobart." };
export const dynamic = "force-dynamic";

/**
 * Les messages signalés.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UNE FILE SÉPARÉE DE CELLE DE RELECTURE
 *
 * `/dashboard/moderation` porte le cycle CMS : des contenus qui attendent
 * d'être publiés ou refusés. Un message de forum ne passe pas par là — il
 * paraît tout de suite, et le signalement arrive après. La décision n'est donc
 * pas la même : « laisser ou retirer », et non « publier ou refuser ».
 *
 * Les mêler dans une liste unique obligerait à inventer un état CMS aux
 * messages, et à lire deux verbes différents sur des cartes identiques.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE MESSAGE EST LU ICI, PAS DANS LA COMMUNAUTÉ
 *
 * Un modérateur de la plateforme n'a aucun droit particulier dans une
 * communauté : `droitsSur` lui donne exactement ce qu'un inconnu obtient. Le
 * lien vers le fil ne s'affiche donc que pour les espaces publics — ailleurs,
 * il mènerait à un « introuvable » qui ressemblerait à une panne.
 *
 * Ce qu'il voit, c'est le message signalé et son entourage immédiat : le nom
 * de la communauté et le titre du sujet. Pas le fil.
 */
export default async function SignalementsPage() {
  const utilisateur = await exigerLePouvoir("moderer_le_contenu");
  const file = await messagesSignales();

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Signalements"
      description="Les messages de forum qu'un membre a signalés. Le plus ancien d'abord — laisser, ou retirer."
    >
      <p style={{ marginBottom: 20, fontSize: 13.5, fontWeight: 600, opacity: 0.75 }}>
        <Link href={"/dashboard/moderation" as Route} style={{ textDecoration: "underline" }}>
          ← La file de relecture
        </Link>{" "}
        — pour les contenus qui attendent d&apos;être publiés.
      </p>

      {file.length === 0 ? (
        <div
          style={{
            border: CADRE,
            borderRadius: 24,
            background: VERT,
            boxShadow: `6px 6px 0 ${ENCRE}`,
            padding: 28,
          }}
        >
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>
            Aucun signalement
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55, marginTop: 8 }}>
            Rien n&apos;attend de décision. Un message signalé reste visible
            dans son fil, marqué, jusqu&apos;à ce qu&apos;il soit tranché ici.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 20 }}>
          {file.map((m) => (
            <article
              key={m.id}
              style={{
                border: CADRE,
                borderRadius: 22,
                background: BLANC,
                boxShadow: `5px 5px 0 ${ENCRE}`,
                padding: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                  paddingBottom: 14,
                  marginBottom: 16,
                  borderBottom: CADRE,
                }}
              >
                <Marque fond={JAUNE}>{m.communauteNom}</Marque>
                {m.communautePrivee ? <Marque fond={MAUVE}>Fermée</Marque> : null}
                <span style={{ fontSize: 13.5, fontWeight: 800 }}>{m.sujetTitre}</span>
                <span style={{ fontSize: 12.5, opacity: 0.6, marginLeft: "auto" }}>
                  {m.auteur} · {dateCourte(m.ecritLe)}
                </span>
              </div>

              <CorpsArticle corps={m.corps} />

              <div
                style={{
                  marginTop: 20,
                  paddingTop: 16,
                  borderTop: CADRE,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <DecisionSignalement messageId={m.id} />

                {m.communautePrivee ? (
                  <span style={{ fontSize: 12.5, opacity: 0.6 }}>
                    Communauté fermée : le fil ne s&apos;ouvre pas d&apos;ici.
                  </span>
                ) : (
                  <Link
                    href={`/communautes/${m.communauteSlug}/sujets/${m.sujetId}` as Route}
                    style={{ fontSize: 13, fontWeight: 700, textDecoration: "underline" }}
                  >
                    Voir le fil →
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </DashboardFrame>
  );
}

function Marque({ children, fond }: { children: React.ReactNode; fond: string }) {
  return (
    <span
      style={{
        padding: "4px 10px",
        border: CADRE,
        borderRadius: 999,
        background: fond,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: ".1em",
      }}
    >
      {children}
    </span>
  );
}

function dateCourte(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}
