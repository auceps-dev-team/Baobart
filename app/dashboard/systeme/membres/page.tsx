import Link from "next/link";

import { DashboardFrame } from "@/components/dashboard/frame";
import {
  BandeauGravite,
  Compteurs,
  Intro,
  Panneau,
  PiedEcran,
  type Puce,
} from "@/components/systeme/bandeau";
import {
  LigneMembre,
  type MembreAffiche,
} from "@/components/systeme/ligne-membre";
import { exigerAdministrateur } from "@/lib/auth/acces-administration";
import { peut } from "@/lib/auth/administration";
import {
  decisionsPour,
  FILTRES_MEMBRES,
  filtreMembresValide,
  listerMembres,
} from "@/lib/domain/membres";
import { ETATS_SUSPENDUS, type RiskState } from "@/lib/domain/trust";
import { BLANC, ENCRE, ORANGE, TON } from "@/lib/systeme/charte";
import type { Gravite } from "@/lib/systeme/diagnostic";

export const metadata = { title: "Système · Membres — Baobart." };
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Le mot que voit l'administrateur, et le ton qui va avec. */
const ETAT: Record<RiskState, { libelle: string; gravite: Gravite }> = {
  NOT_REVIEWED: { libelle: "NON EXAMINÉ", gravite: "ok" },
  COMPLIANT: { libelle: "CONFORME", gravite: "ok" },
  ON_PROBATION: { libelle: "PROBATION", gravite: "attention" },
  FLAGGED_TOS: { libelle: "SIGNALÉ · CONDITIONS", gravite: "attention" },
  FLAGGED_FRAUD: { libelle: "SIGNALÉ · FRAUDE", gravite: "attention" },
  SUSPENDED_TOS: { libelle: "SUSPENDU · CONDITIONS", gravite: "panne" },
  SUSPENDED_FRAUD: { libelle: "SUSPENDU · FRAUDE", gravite: "panne" },
};

export default async function MembresPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  // Le layout garde la section, mais Next.js réutilise un layout entre pages
  // sœurs au lieu de le réexécuter. Une garde qui ne s'exécute pas est absente.
  const utilisateur = await exigerAdministrateur();
  const { filtre: brut } = await searchParams;
  const filtre = filtreMembresValide(brut);

  const { membres, total, suspendus } = await listerMembres(filtre);
  const peutAgir = peut(utilisateur.role, "agir_sur_l_exploitation");

  const signales = membres.filter((m) =>
    m.etatRisque.startsWith("FLAGGED"),
  ).length;

  const compteurs = [
    {
      cle: "affiches",
      libelle: "Comptes affichés",
      valeur: String(membres.length),
      note: `sur ${total} dans ce filtre`,
      gravite: "ok" as const,
    },
    {
      cle: "suspendus",
      libelle: "Comptes suspendus",
      valeur: String(suspendus),
      note: suspendus > 0 ? "ils ne peuvent plus vendre" : "aucun",
      gravite: suspendus > 0 ? ("panne" as const) : ("ok" as const),
    },
    {
      cle: "signales",
      libelle: "Signalés, non suspendus",
      valeur: String(signales),
      note: signales > 0 ? "en attente d'examen" : "rien à examiner",
      gravite: signales > 0 ? ("attention" as const) : ("ok" as const),
    },
  ];

  const puces: Puce[] = [{ texte: `${total} comptes`, fond: BLANC }];
  if (suspendus > 0) {
    puces.push({ texte: `${suspendus} suspendus`, fond: ORANGE });
  }

  const lignes: MembreAffiche[] = membres.map((m) => {
    const etat = ETAT[m.etatRisque] ?? {
      libelle: m.etatRisque,
      gravite: "attention" as Gravite,
    };

    return {
      id: m.id,
      nom: m.nom,
      email: m.email,
      etatRisque: etat.libelle,
      gravite: etat.gravite,
      fond: TON[etat.gravite].ligneFond,
      detail: [
        m.email,
        m.produits > 0 ? `${m.produits} ressource(s)` : "aucune ressource",
        `inscrit le ${DATE.format(m.inscritLe)}`,
        m.suspendu && m.suspenduLe
          ? `suspendu le ${DATE.format(m.suspenduLe)}`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      derniereDecision: m.derniereDecision
        ? `dernière décision : ${m.derniereDecision.auteur}, ${DATE.format(m.derniereDecision.le)}${m.derniereDecision.motif ? ` — ${m.derniereDecision.motif}` : ""}`
        : null,
      decisions: decisionsPour(m.etatRisque),
    };
  });

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Système · Membres"
      description="Qui peut vendre, qui ne peut plus, et pourquoi."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <BandeauGravite
          gravite={suspendus > 0 ? "panne" : signales > 0 ? "attention" : "ok"}
          puces={puces}
        />

        <Intro>
          Suspendre un compte ferme ses sessions et retire ses ressources de la
          vente. Lever une suspension ne les remet pas en vente : on ne sait pas
          lesquelles le créateur avait retirées lui-même.
        </Intro>

        <Compteurs liste={compteurs} />

        <Panneau
          titre="Comptes"
          mention="relu à chaque affichage · aucune mise en cache"
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 14 }}>
            {FILTRES_MEMBRES.map((f) => (
              <Link
                key={f}
                href={
                  f === "Tous"
                    ? "/dashboard/systeme/membres"
                    : `/dashboard/systeme/membres?filtre=${encodeURIComponent(f)}`
                }
                style={{
                  padding: "7px 14px",
                  border: `2px solid ${ENCRE}`,
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                  background: f === filtre ? ENCRE : BLANC,
                  color: f === filtre ? BLANC : ENCRE,
                  textDecoration: "none",
                }}
              >
                {f}
              </Link>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginTop: 16,
            }}
          >
            {lignes.length === 0 ? (
              <p style={{ fontSize: 13.5, fontWeight: 600, opacity: 0.7 }}>
                Aucun compte dans ce filtre.
              </p>
            ) : (
              lignes.map((m) => (
                <LigneMembre key={m.id} membre={m} peutAgir={peutAgir} />
              ))
            )}
          </div>

          {peutAgir ? null : (
            <div
              style={{
                marginTop: 16,
                padding: "11px 16px",
                border: `2.5px dashed ${ENCRE}`,
                borderRadius: 13,
                background: "#F4EEFC",
                fontSize: 12.5,
                fontWeight: 700,
              }}
            >
              Lecture seule — le pouvoir{" "}
              <span style={{ fontFamily: "var(--font-mono)" }}>
                agir_sur_l_exploitation
              </span>{" "}
              est requis pour décider.
            </div>
          )}
        </Panneau>

        <PiedEcran
          libelle="Ce que la machine refuse"
          qui={`${ETATS_SUSPENDUS.length} états de suspension`}
          note="Lever une suspension exige une demande explicite : une revue de routine ne doit pas défaire une sanction qu'elle n'a jamais examinée. Chaque décision est consignée avec son auteur et sa raison."
        />
      </div>
    </DashboardFrame>
  );
}
