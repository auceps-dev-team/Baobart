import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { DashboardFrame } from "@/components/dashboard/frame";
import { FormulaireEvenement } from "@/components/evenements/formulaire";
import { GestesEvenement } from "@/components/evenements/gestes";
import { LIBELLE_ETAT } from "@/lib/cms/cycle";
import { accesAuxEvenements, exigerAccesAuxEvenements } from "@/lib/evenements/garde";
import { LIBELLE_PHASE, phaseDe, placesRestantes } from "@/lib/evenements/phases";
import { evenementAEditer, pourChampDateHeure } from "@/lib/evenements/queries";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE, VERT } from "@/lib/systeme/charte";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Le titre passe par la même portée que la page.
  //
  // Sans cela, une agence qui tape l'identifiant d'un concours qu'elle
  // n'organise pas verrait son titre s'afficher dans l'onglet avant que la
  // page ne réponde 404 — la fuite la plus discrète qui soit.
  const acces = await accesAuxEvenements();
  const e = acces ? await evenementAEditer(id, acces.portee) : null;

  return { title: e ? `${e.titre} — Baobart.` : "Événement introuvable — Baobart." };
}

/**
 * Éditer un événement, et décider de son sort.
 *
 * Le formulaire et les gestes cohabitent sur le même écran : séparer
 * « corriger » de « publier » obligerait à revenir en arrière entre les deux,
 * alors que c'est le même geste dans la tête de qui écrit — je relis, je
 * publie.
 */
export default async function EditerEvenementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { utilisateur, portee } = await exigerAccesAuxEvenements();
  const { id } = await params;

  // `null` couvre deux cas — il n'existe pas, ou il n'est pas à toi — et les
  // confondre est volontaire : 404 dans les deux cas, jamais « pas à toi ».
  const e = await evenementAEditer(id, portee);
  if (!e) notFound();

  const phase = phaseDe(e.debut, e.fin);
  const restantes = placesRestantes(e.capacite, e.inscrits);

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre={e.titre}
      description={`${LIBELLE_ETAT[e.etat]} · ${LIBELLE_PHASE[phase]}`}
      action={
        <Link
          href={"/dashboard/evenements" as Route}
          style={{
            padding: "10px 16px",
            border: CADRE,
            borderRadius: 13,
            background: BLANC,
            fontSize: 13,
            fontWeight: 800,
            color: ENCRE,
          }}
        >
          ← {portee.etendue === "TOUT" ? "Tous les événements" : "Mes événements"}
        </Link>
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr)",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <FormulaireEvenement
            evenementId={e.id}
            depart={{
              titre: e.titre,
              description: e.description,
              genre: e.genre,
              debut: pourChampDateHeure(e.debut),
              fin: pourChampDateHeure(e.fin),
              lieu: e.lieu ?? "",
              enLigne: e.enLigne ? "on" : "",
              capacite: e.capacite === null ? "" : String(e.capacite),
              prixBillet: e.prixBillet === null ? "" : String(e.prixBillet),
              dotation: e.dotation === null ? "" : String(e.dotation),
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {/*
            ════════════════════════════════════════════════════════════════
            LE MOTIF DE REFUS PASSE AVANT TOUT LE RESTE

            C'est la première chose que l'organisateur doit lire en ouvrant sa
            fiche refusée, et la SEULE qu'il recevra : il n'y a pas de
            messagerie dans le produit (§22.6). L'enfouir sous le formulaire
            reviendrait à ne pas l'écrire.

            Il reste affiché après une remise en brouillon tant qu'une nouvelle
            décision ne l'a pas effacé — on corrige en le relisant.
          */}
          {e.raisonRefus ? (
            <div
              style={{
                border: CADRE,
                borderRadius: 20,
                background: ORANGE,
                color: BLANC,
                boxShadow: `4px 4px 0 ${ENCRE}`,
                padding: 18,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 800 }}>
                Fiche refusée à la relecture
              </div>
              {e.relueLe ? (
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    marginTop: 4,
                    opacity: 0.85,
                  }}
                >
                  le {e.relueLe.toLocaleDateString("fr-FR", { timeZone: "UTC" })}
                </div>
              ) : null}
              <p
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  lineHeight: 1.5,
                  marginTop: 10,
                  textWrap: "pretty",
                }}
              >
                {e.raisonRefus}
              </p>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 10, opacity: 0.9 }}>
                Corrige la fiche, remets-la en brouillon, puis renvoie-la en
                relecture. Rien n&apos;est perdu.
              </div>
            </div>
          ) : null}

          {e.annuleLe ? (
            <div
              style={{
                border: CADRE,
                borderRadius: 20,
                background: ORANGE,
                color: BLANC,
                boxShadow: `4px 4px 0 ${ENCRE}`,
                padding: 18,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 800 }}>Événement annulé</div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  marginTop: 4,
                  opacity: 0.85,
                }}
              >
                le {e.annuleLe.toLocaleDateString("fr-FR", { timeZone: "UTC" })}
              </div>
              <p style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.5, marginTop: 10 }}>
                {e.raisonAnnulation}
              </p>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 10, opacity: 0.9 }}>
                La fiche reste en ligne : c&apos;est là que les inscrits liront
                cette raison.
              </div>
            </div>
          ) : null}

          <GestesEvenement
            evenementId={e.id}
            etat={e.etat}
            annule={e.annuleLe !== null}
            portee={portee}
          />

          <div
            style={{
              border: CADRE,
              borderRadius: 20,
              background: BLANC,
              boxShadow: `4px 4px 0 ${ENCRE}`,
              padding: 18,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                textTransform: "uppercase",
                letterSpacing: ".12em",
                opacity: 0.6,
                marginBottom: 12,
              }}
            >
              Inscriptions
            </div>

            <div style={{ fontFamily: "var(--font-display)", fontSize: 32, lineHeight: 1 }}>
              {e.inscrits}
              {e.capacite !== null ? (
                <span style={{ fontSize: 18, opacity: 0.6 }}> / {e.capacite}</span>
              ) : null}
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8, opacity: 0.75 }}>
              {restantes === null
                ? "Sans plafond."
                : restantes === 0
                  ? "Complet."
                  : `${restantes} place${restantes > 1 ? "s" : ""} restante${restantes > 1 ? "s" : ""}.`}
            </div>

            <Link
              href={`/dashboard/evenements/${e.id}/inscrits` as Route}
              className="sticker-press"
              style={{
                display: "block",
                marginTop: 14,
                padding: "11px 16px",
                border: CADRE,
                borderRadius: 13,
                background: JAUNE,
                boxShadow: `3px 3px 0 ${ENCRE}`,
                textAlign: "center",
                fontSize: 13,
                fontWeight: 800,
                color: ENCRE,
              }}
            >
              Voir les inscrits →
            </Link>

            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                marginTop: 12,
                paddingTop: 12,
                borderTop: CADRE,
                opacity: 0.7,
                textWrap: "pretty",
              }}
            >
              La liste s&apos;exporte en CSV, et permet d&apos;écrire à tout le
              monde en copie cachée.
            </div>
          </div>

          {e.prixBillet !== null ? (
            <div
              style={{
                border: CADRE,
                borderRadius: 20,
                background: JAUNE,
                padding: 18,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800 }}>Billet payant</div>
              <p style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.5, marginTop: 8 }}>
                L&apos;encaissement des billets n&apos;est pas branché.
                Tant qu&apos;il ne l&apos;est pas, l&apos;inscription en ligne
                restera fermée sur cet événement — mieux vaut ça que donner des
                places sans les faire payer.
              </p>
            </div>
          ) : (
            <div
              style={{
                border: CADRE,
                borderRadius: 20,
                background: VERT,
                padding: 18,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              Événement gratuit.
            </div>
          )}
        </div>
      </div>
    </DashboardFrame>
  );
}
