import Link from "next/link";

import { DashboardFrame } from "@/components/dashboard/frame";
import {
  BandeauGravite,
  Compteurs,
  Intro,
  Panneau,
  PastilleEtat,
  PiedEcran,
  type CompteurAffiche,
  type Puce,
} from "@/components/systeme/bandeau";
import { exigerAdministrateur } from "@/lib/auth/acces-administration";
import {
  filtreValide,
  FILTRES,
  vueDeLEncaissement,
  type LigneRappel,
} from "@/lib/payments/encaissement/lecture";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE, TON } from "@/lib/systeme/charte";

export const metadata = { title: "Système · Paiements — Baobart." };
export const dynamic = "force-dynamic";

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const COLONNES = [
  { libelle: "Reçu le", flex: 1.4 },
  { libelle: "Opérateur", flex: 1.2 },
  { libelle: "Réf. transaction", flex: 1.8 },
  { libelle: "Statut", flex: 1.2 },
  { libelle: "Ce qui s'est passé", flex: 2.6 },
];

function Texte({
  children,
  mono = false,
  attenue = 1,
}: {
  children: React.ReactNode;
  mono?: boolean;
  attenue?: number;
}) {
  return (
    <div
      style={{
        fontFamily: mono ? "var(--font-mono)" : "var(--font-body)",
        fontSize: 12.5,
        fontWeight: mono ? 400 : 600,
        lineHeight: 1.35,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        opacity: attenue,
      }}
    >
      {children}
    </div>
  );
}

function Ligne({ ligne }: { ligne: LigneRappel }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: "12px 16px",
        borderTop: `1.5px solid ${ENCRE}22`,
        background: TON[ligne.gravite].ligneFond,
      }}
    >
      <div style={{ flex: COLONNES[0]!.flex, minWidth: 0 }}>
        <Texte>{DATE.format(ligne.recuLe)}</Texte>
      </div>
      <div style={{ flex: COLONNES[1]!.flex, minWidth: 0 }}>
        <Texte>{ligne.fournisseur}</Texte>
      </div>
      <div style={{ flex: COLONNES[2]!.flex, minWidth: 0 }}>
        <Texte mono attenue={ligne.referenceOperateur ? 1 : 0.45}>
          {ligne.referenceOperateur ?? "—"}
        </Texte>
      </div>
      <div style={{ flex: COLONNES[3]!.flex, minWidth: 0 }}>
        <PastilleEtat gravite={ligne.gravite} texte={ligne.libelleStatut} />
      </div>
      <div style={{ flex: COLONNES[4]!.flex, minWidth: 0 }}>
        <Texte mono attenue={ligne.erreur ? 1 : 0.45}>
          {ligne.erreur ?? "—"}
        </Texte>
      </div>
    </div>
  );
}

export default async function PaiementsSystemePage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  // Le layout garde la section, mais Next.js réutilise un layout entre pages
  // sœurs au lieu de le réexécuter. Une garde qui ne s'exécute pas est absente.
  const utilisateur = await exigerAdministrateur();
  const { filtre: brut } = await searchParams;
  const filtre = filtreValide(brut);

  const vue = await vueDeLEncaissement(filtre);

  const puces: Puce[] = [
    { texte: `${vue.totalGeneral} rappels`, fond: BLANC },
  ];
  if (vue.refus > 0) puces.push({ texte: `${vue.refus} refusés`, fond: ORANGE });
  else if (vue.bloquees > 0) {
    puces.push({ texte: `${vue.bloquees} en attente`, fond: JAUNE });
  }

  const compteurs: CompteurAffiche[] = vue.constats.map((c) => ({
    cle: c.cle,
    libelle: c.libelle,
    valeur: c.detail.split(" ")[0] ?? "—",
    note: c.remede ?? c.detail,
    gravite: c.gravite,
  }));

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Système · Paiements"
      description="Ce que les opérateurs nous disent, et ce qu'on en a fait."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <BandeauGravite gravite={vue.gravite} puces={puces} />

        <Intro>
          Chaque ligne est un appel entrant d&apos;opérateur. Un « sans effet »
          n&apos;est pas une anomalie : c&apos;est un rejeu, et un opérateur qui
          rejoue fait son travail. Ce qu&apos;on surveille ici, ce sont les
          refus — presque toujours un secret de signature décalé — et les
          commandes qu&apos;aucun rappel n&apos;est jamais venu conclure.
        </Intro>

        <Compteurs liste={compteurs} />

        {/*
          Les remèdes, en toutes lettres. Un compteur orange dit qu'il y a un
          problème ; il ne dit pas quoi faire à trois heures du matin.
        */}
        {vue.constats.some((c) => c.gravite !== "ok") ? (
          <Panneau titre="Ce qu'il faut regarder" fond={JAUNE}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {vue.constats
                .filter((c) => c.gravite !== "ok")
                .map((c) => (
                  <div key={c.cle}>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>
                      {c.libelle} — {c.detail}
                    </div>
                    {c.remede ? (
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          lineHeight: 1.5,
                          marginTop: 5,
                          textWrap: "pretty",
                        }}
                      >
                        {c.remede}
                      </div>
                    ) : null}
                  </div>
                ))}
            </div>
          </Panneau>
        ) : null}

        <Panneau
          titre="Les derniers rappels"
          mention={`${vue.lignes.length} affichés sur ${vue.total}`}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {FILTRES.map((f) => (
              <Link
                key={f}
                href={
                  f === "Tous"
                    ? "/dashboard/systeme/paiements"
                    : `/dashboard/systeme/paiements?filtre=${encodeURIComponent(f)}`
                }
                style={{
                  padding: "7px 13px",
                  border: CADRE,
                  borderRadius: 999,
                  background: f === filtre ? ENCRE : BLANC,
                  color: f === filtre ? BLANC : ENCRE,
                  fontSize: 12.5,
                  fontWeight: 800,
                }}
              >
                {f.toUpperCase()}
              </Link>
            ))}
          </div>

          <div style={{ border: CADRE, borderRadius: 16, overflow: "hidden" }}>
            <div
              style={{
                display: "flex",
                gap: 12,
                padding: "11px 16px",
                background: ENCRE,
                color: BLANC,
              }}
            >
              {COLONNES.map((c) => (
                <div
                  key={c.libelle}
                  style={{
                    flex: c.flex,
                    minWidth: 0,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: ".6px",
                    textTransform: "uppercase",
                  }}
                >
                  {c.libelle}
                </div>
              ))}
            </div>

            {vue.lignes.length === 0 ? (
              <div
                style={{
                  padding: "26px 16px",
                  fontSize: 13.5,
                  fontWeight: 600,
                  opacity: 0.7,
                }}
              >
                {vue.totalGeneral === 0
                  ? "Aucun opérateur ne nous a encore appelés."
                  : "Rien de ce genre pour l'instant."}
              </div>
            ) : (
              vue.lignes.map((l) => <Ligne key={l.id} ligne={l} />)
            )}
          </div>
        </Panneau>

        <PiedEcran
          libelle="Règle à ne pas perdre"
          qui="Le retour du navigateur ne fait jamais foi"
          note="Un acheteur revient sur notre site parce que l'opérateur l'a renvoyé, pas parce qu'il a payé. Seul le rappel signé décide, et c'est pourquoi une commande peut rester ouverte alors que l'acheteur, lui, croit avoir terminé."
        />
      </div>
    </DashboardFrame>
  );
}
