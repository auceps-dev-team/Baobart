import Link from "next/link";
import type { Route } from "next";

import { DashboardFrame } from "@/components/dashboard/frame";
import { LIBELLE_ETAT } from "@/lib/cms/cycle";
import { intitule } from "@/lib/evenements/acces";
import { LIBELLE_GENRE } from "@/lib/evenements/enums";
import { exigerAccesAuxEvenements } from "@/lib/evenements/garde";
import { LIBELLE_PHASE } from "@/lib/evenements/phases";
import { listerDansLaPortee } from "@/lib/evenements/queries";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, ORANGE, VERT } from "@/lib/systeme/charte";

export const metadata = { title: "Événements — Baobart." };
export const dynamic = "force-dynamic";

/**
 * Les événements — tous, ou les siens.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN SEUL ÉCRAN POUR DEUX PUBLICS, ET C'EST LE POINT
 *
 * L'équipe éditoriale y voit tout ; une agence badgée n'y voit que ce qu'elle
 * organise. Ce n'est pas le même contenu, mais c'est le même écran — et c'est
 * ce qui fait que l'ouverture aux agences n'a rien coûté en surface.
 *
 * Écrire un second tableau de bord « organisateur » aurait paru plus propre.
 * Il aurait surtout créé deux endroits où corriger le même bogue, dont un
 * qu'on relit deux fois moins souvent.
 *
 * Ce qui change entre les deux publics tient dans une `Portee`, calculée une
 * fois par la garde et traversée par la requête. Voir
 * `lib/evenements/acces.ts`.
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
  const { utilisateur, portee } = await exigerAccesAuxEvenements();
  const evenements = await listerDansLaPortee(portee);
  const mots = intitule(portee);

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre={mots.titre}
      description={mots.description}
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
            {portee.etendue === "TOUT"
              ? "Crée le premier — il naîtra en brouillon, et ne paraîtra que lorsque tu le publieras."
              : "Crée le premier — il naîtra en brouillon. Tu l'enverras en relecture quand la fiche sera prête."}
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
                {/*
                  L'organisateur ne s'affiche qu'à qui voit ceux des autres.
                  Répéter son propre nom sur chacune de ses lignes n'apprend
                  rien et occupe la place d'une information utile.
                */}
                {portee.etendue === "TOUT" ? <span>par {e.organisateur}</span> : null}
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
