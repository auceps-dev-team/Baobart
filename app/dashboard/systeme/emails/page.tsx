import Link from "next/link";

import { DashboardFrame } from "@/components/dashboard/frame";
import {
  BandeauGravite,
  Compteurs,
  Intro,
  Panneau,
  PastilleEtat,
  PiedEcran,
  type Puce,
} from "@/components/systeme/bandeau";
import { exigerAdministrateur } from "@/lib/auth/acces-administration";
import { peut } from "@/lib/auth/administration";
import { abandonnerCourriel, relancerCourriel } from "@/lib/email/actions";
import { filtreValide, FILTRES, vueDeLaFile, type LigneFile } from "@/lib/email/lecture";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE, TON } from "@/lib/systeme/charte";

export const metadata = { title: "Système · Emails — Baobart." };
export const dynamic = "force-dynamic";

const COLONNES = [
  { libelle: "Créé le", flex: 1.5 },
  { libelle: "Modèle", flex: 1.6 },
  { libelle: "Destinataire", flex: 2 },
  { libelle: "Statut", flex: 1.4 },
  { libelle: "Tentatives", flex: 0.9 },
  { libelle: "Prochaine", flex: 1.3 },
  { libelle: "Dernière erreur", flex: 2 },
  { libelle: "", flex: 1.5 },
];

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

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

function Bouton({
  children,
  fond,
}: {
  children: React.ReactNode;
  fond: string;
}) {
  return (
    <button
      type="submit"
      className="sticker-press"
      style={{
        padding: "7px 12px",
        border: `2px solid ${ENCRE}`,
        borderRadius: 10,
        background: fond,
        fontSize: 11.5,
        fontWeight: 800,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function Ligne({ ligne, peutAgir }: { ligne: LigneFile; peutAgir: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: "13px 14px",
        border: CADRE,
        borderRadius: 15,
        background: TON[ligne.gravite].ligneFond,
      }}
    >
      <div style={{ flex: "1.5 1 0", minWidth: 0 }}>
        <Texte mono attenue={0.7}>{DATE.format(ligne.creeLe)}</Texte>
      </div>
      <div style={{ flex: "1.6 1 0", minWidth: 0 }}>
        <Texte mono attenue={0.85}>{ligne.modele}</Texte>
      </div>
      <div style={{ flex: "2 1 0", minWidth: 0 }}>
        <Texte>{ligne.destinataire}</Texte>
      </div>
      <div style={{ flex: "1.4 1 0", minWidth: 0 }}>
        <PastilleEtat gravite={ligne.gravite} texte={ligne.libelleStatut} />
      </div>
      <div style={{ flex: "0.9 1 0", minWidth: 0 }}>
        <Texte mono attenue={0.7}>{ligne.tentatives}</Texte>
      </div>
      <div style={{ flex: "1.3 1 0", minWidth: 0 }}>
        <Texte mono attenue={0.7}>
          {ligne.prochaine ? DATE.format(ligne.prochaine) : "—"}
        </Texte>
      </div>
      <div style={{ flex: "2 1 0", minWidth: 0 }} title={ligne.derniereErreur ?? undefined}>
        <Texte attenue={0.75}>{ligne.derniereErreur ?? "—"}</Texte>
      </div>

      <div
        style={{
          flex: "1.5 1 0",
          minWidth: 0,
          display: "flex",
          gap: 7,
          justifyContent: "flex-end",
        }}
      >
        {/*
          Les boutons ne s'affichent que là où ils feraient quelque chose.
          Proposer « relancer » sur un message déjà parti serait une promesse
          en trompe-l'œil — et l'action le refuserait de toute façon.
        */}
        {peutAgir && ligne.relancable ? (
          <form action={relancerCourriel.bind(null, ligne.id)}>
            <Bouton fond={JAUNE}>Relancer</Bouton>
          </form>
        ) : null}
        {peutAgir && ligne.abandonnable ? (
          <form action={abandonnerCourriel.bind(null, ligne.id)}>
            <Bouton fond={BLANC}>Abandonner</Bouton>
          </form>
        ) : null}
      </div>
    </div>
  );
}

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  // Le layout garde la section, mais Next.js réutilise un layout entre pages
  // sœurs au lieu de le réexécuter. Une garde qui ne s'exécute pas est absente.
  const utilisateur = await exigerAdministrateur();
  const { filtre: brut } = await searchParams;
  const filtre = filtreValide(brut);

  const vue = await vueDeLaFile(filtre);
  const peutAgir = peut(utilisateur.role, "agir_sur_l_exploitation");

  const puces: Puce[] = [
    { texte: `pilote : ${vue.pilote}`, fond: BLANC },
  ];
  if (vue.echecs > 0) {
    puces.push({
      texte: `${vue.echecs} échec${vue.echecs > 1 ? "s" : ""} définitif${vue.echecs > 1 ? "s" : ""}`,
      fond: ORANGE,
    });
  }

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Système · Emails"
      description="La file d'attente des messages transactionnels."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <BandeauGravite gravite={vue.gravite} puces={puces} />

        <Intro>
          Un message part après la transaction qui le justifie : la commande
          écrit son intention, un passage l&apos;envoie ensuite. Ce qui est
          découplé doit être surveillé.
        </Intro>

        {vue.pilote === "console" || vue.pilote === "aucun" ? (
          <div
            role="alert"
            style={{
              border: CADRE,
              borderRadius: 16,
              background: JAUNE,
              padding: "14px 18px",
              fontSize: 13.5,
              fontWeight: 800,
            }}
          >
            {vue.pilote === "console"
              ? "Pilote « console » : rien ne part réellement. Les messages sont écrits dans les journaux et marqués comme envoyés."
              : "Aucun pilote configuré : rien ne part, et les messages restent en attente plutôt que d'être perdus."}
          </div>
        ) : null}

        <Compteurs liste={vue.compteurs} />

        <Panneau
          titre="File d'attente"
          mention="relu à chaque affichage · aucune mise en cache"
        >
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 14 }}
          >
            {FILTRES.map((f) => {
              const actif = f === filtre;
              return (
                <Link
                  key={f}
                  href={
                    f === "Tous"
                      ? "/dashboard/systeme/emails"
                      : `/dashboard/systeme/emails?filtre=${encodeURIComponent(f)}`
                  }
                  style={{
                    padding: "7px 14px",
                    border: `2px solid ${ENCRE}`,
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 800,
                    background: actif ? ENCRE : BLANC,
                    color: actif ? BLANC : ENCRE,
                    textDecoration: "none",
                  }}
                >
                  {f}
                </Link>
              );
            })}
          </div>

          <div style={{ overflowX: "auto", marginTop: 16 }}>
            <div style={{ minWidth: 1080 }}>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "0 14px 10px",
                  borderBottom: CADRE,
                }}
              >
                {COLONNES.map((c, i) => (
                  <div
                    key={c.libelle || `col-${i}`}
                    style={{
                      flex: `${c.flex} 1 0`,
                      minWidth: 0,
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: ".1em",
                      opacity: 0.6,
                    }}
                  >
                    {c.libelle}
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 9,
                  marginTop: 11,
                }}
              >
                {vue.lignes.length === 0 ? (
                  <div
                    style={{
                      padding: "24px 14px",
                      fontSize: 13.5,
                      fontWeight: 600,
                      opacity: 0.7,
                    }}
                  >
                    {vue.totalGeneral === 0
                      ? "Aucun message n'est jamais passé par la file."
                      : "Aucun message ne correspond à ce filtre."}
                  </div>
                ) : (
                  vue.lignes.map((l) => (
                    <Ligne key={l.id} ligne={l} peutAgir={peutAgir} />
                  ))
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 12,
              marginTop: 16,
              paddingTop: 14,
              borderTop: CADRE,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                flex: "1 1 auto",
                opacity: 0.6,
              }}
            >
              {vue.lignes.length} message(s) affiché(s) sur {vue.total} · file
              complète : {vue.totalGeneral}
            </div>

            {peutAgir ? null : (
              <div
                style={{
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
                est requis pour agir.
              </div>
            )}
          </div>
        </Panneau>

        <PiedEcran
          libelle="Pilote d'envoi actif"
          qui={vue.pilote}
          note="Relancer remet un message abandonné en file, immédiatement. Abandonner le ferme sans prétendre qu'il est parti — utile quand l'adresse n'existe plus, sinon la ligne resterait rouge à jamais et masquerait les vraies pannes."
        />
      </div>
    </DashboardFrame>
  );
}
