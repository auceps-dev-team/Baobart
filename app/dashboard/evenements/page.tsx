import Link from "next/link";
import type { Route } from "next";

import { DashboardFrame } from "@/components/dashboard/frame";
import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import { LIBELLE_ETAT } from "@/lib/cms/cycle";
import { LIBELLE_GENRE } from "@/lib/evenements/enums";
import { LIBELLE_PHASE } from "@/lib/evenements/phases";
import { listerPourAdministration } from "@/lib/evenements/queries";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, ORANGE, VERT } from "@/lib/systeme/charte";

export const metadata = { title: "Événements — Baobart." };
export const dynamic = "force-dynamic";

/**
 * Les événements, vus de l'administration.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * PAS SOUS `/dashboard/systeme`
 *
 * Ce dossier-là est gardé par le pouvoir de lire l'état technique de la
 * plateforme. Quelqu'un dont le métier est d'écrire des événements ne l'a pas,
 * et n'a aucune raison de l'avoir. Y ranger cet écran le lui fermerait — ou
 * obligerait à élargir la garde du dossier, ce qui ouvrirait la base à
 * plusieurs rôles d'un coup. C'est la leçon de §20.1.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX COLONNES D'ÉTAT, PARCE QU'IL Y A DEUX HORLOGES
 *
 * L'état éditorial — brouillon, publié, retiré — et la phase — à venir, en
 * cours, terminé. Les afficher ensemble est le seul moyen de voir d'un coup
 * ce qui manque : un brouillon dont la date approche est le cas qu'on cherche.
 */
export default async function EvenementsAdminPage() {
  const utilisateur = await exigerLePouvoir("publier_du_contenu");
  const evenements = await listerPourAdministration();

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Événements"
      description="Concours, ateliers, conférences, expositions. Rien ne paraît tant que c'est un brouillon."
      action={
        <Link
          href={"/dashboard/evenements/nouveau" as Route}
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
          Nouvel événement
        </Link>
      }
    >
      {evenements.length === 0 ? (
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
          <div style={{ fontSize: 17, fontWeight: 800 }}>Aucun événement</div>
          <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55, marginTop: 8 }}>
            Crée le premier — il naîtra en brouillon, et ne paraîtra que
            lorsque tu le publieras.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {evenements.map((e) => (
            <Link
              key={e.id}
              href={`/dashboard/evenements/${e.id}` as Route}
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
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <Pastille fond={LAVANDE} mono>
                  {LIBELLE_GENRE[e.genre]}
                </Pastille>
                <Pastille fond={e.etat === "PUBLIE" ? VERT : BLANC}>
                  {LIBELLE_ETAT[e.etat]}
                </Pastille>
                <Pastille fond={e.phase === "EN_COURS" ? JAUNE : BLANC} mono>
                  {LIBELLE_PHASE[e.phase]}
                </Pastille>
                {/*
                  Un annulé reste dans la liste, et se signale — il reste en
                  ligne pour ses inscrits, donc il doit rester sous les yeux
                  de qui l'administre.
                */}
                {e.annuleLe ? (
                  <Pastille fond={ORANGE} clair>
                    ANNULÉ
                  </Pastille>
                ) : null}
              </div>

              <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.3, marginTop: 10 }}>
                {e.titre}
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
                <span>
                  {e.debut.toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </span>
                <span>{e.enLigne ? "en ligne" : (e.lieu ?? "lieu non précisé")}</span>
                <span>
                  {e.inscrits} inscrit{e.inscrits > 1 ? "s" : ""}
                  {e.capacite !== null ? ` / ${e.capacite}` : ""}
                </span>
                <span>par {e.organisateur}</span>
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
