import Link from "next/link";
import type { Route } from "next";

import { CorpsArticle } from "@/components/cms/corps";
import { DashboardFrame } from "@/components/dashboard/frame";
import {
  DecisionSignalement,
  FermerLaCommunaute,
} from "@/components/forum/decision-signalement";
import { exigerLePouvoir } from "@/lib/auth/acces-administration";
import {
  communautesPourLAdministration,
  indicateurs,
  messagesSignales,
} from "@/lib/forum/signalements";
import { BLANC, CADRE, ENCRE, JAUNE, MAUVE, ORANGE, VERT } from "@/lib/systeme/charte";

export const metadata = { title: "Signalements & DMCA — Baobart." };
export const dynamic = "force-dynamic";

/**
 * Signalements & DMCA.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE NOM ET LA PLACE VIENNENT DE LA MAQUETTE
 *
 * `Baobart Dashboard.dc.html` dessine deux entrées distinctes dans la
 * navigation d'administration : `a_moderation` « File de modération » et
 * `a_signalements` « Signalements & DMCA ». Cet écran est le second, et il est
 * donc à `/dashboard/signalements` — à côté de la file, pas dessous.
 *
 * Il portait le nom de « signalements du forum » et vivait sous
 * `/dashboard/moderation/`. C'était une invention, prise avant d'avoir lu la
 * maquette.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * DEUX CHOSES QUE LA MAQUETTE PROMET ET QUE LE CODE NE TIENT PAS
 *
 * Son texte d'introduction annonce « retrait provisoire sous 48 h après une
 * demande complète, notification au contributeur, droit de réponse de 10
 * jours », et deux de ses quatre tuiles comptent des dossiers DMCA.
 *
 * **Rien de cette procédure n'existe en base.** Pas de table de dossiers, pas
 * de délai, pas de droit de réponse. Afficher cette phrase serait promettre un
 * engagement juridique que personne ne tient — et l'afficher sur un écran
 * d'administration le rendrait crédible auprès de ceux qui l'appliquent.
 *
 * On garde donc la forme de la maquette — quatre tuiles, la même liste — et on
 * écrit ce que l'écran fait réellement. L'écart est dit **sous les tuiles**,
 * là où celui qui décide le lira, plutôt que caché dans ce commentaire.
 */
export default async function SignalementsPage() {
  const utilisateur = await exigerLePouvoir("moderer_le_contenu");

  const [file, chiffres, communautes] = await Promise.all([
    messagesSignales(),
    indicateurs(),
    communautesPourLAdministration(),
  ]);

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Signalements & DMCA"
      description="Les messages qu'un membre a signalés, et les communautés elles-mêmes. Le plus ancien d'abord — laisser, ou retirer."
    >
      {/* ── Les quatre tuiles ─────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
          gap: 14,
          marginBottom: 12,
        }}
      >
        <Tuile
          libelle="Signalements en attente"
          valeur={chiffres.signalesEnAttente}
          note="messages à trancher"
          fond={chiffres.signalesEnAttente > 0 ? ORANGE : BLANC}
        />
        <Tuile
          libelle="Communautés ouvertes"
          valeur={chiffres.communautesOuvertes}
          note="visibles dans l'annuaire"
          fond={BLANC}
        />
        <Tuile
          libelle="Communautés fermées"
          valeur={chiffres.communautesFermees}
          note="plus lisibles par personne"
          fond={MAUVE}
        />
        <Tuile
          libelle="Tranchés"
          valeur={chiffres.tranchesSur90Jours}
          note="sur 90 jours"
          fond={JAUNE}
        />
      </div>

      {/*
        L'écart avec la maquette, écrit là où on le lit. Voir l'en-tête.
      */}
      <p style={{ fontSize: 12.5, lineHeight: 1.5, opacity: 0.7, marginBottom: 26 }}>
        La maquette prévoit ici deux indicateurs de plus — « retraits
        provisoires » et « dossiers DMCA » — ainsi qu&apos;une procédure de
        retrait sous 48 h avec droit de réponse. Rien de tout cela n&apos;existe
        encore en base : ces quatre tuiles comptent ce que la plateforme sait
        réellement compter.{" "}
        <Link href={"/dashboard/moderation" as Route} style={{ textDecoration: "underline" }}>
          La file de relecture
        </Link>{" "}
        traite les contenus qui attendent d&apos;être publiés.
      </p>

      {/* ── Les messages signalés ─────────────────────────────────────── */}
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 20,
          textTransform: "uppercase",
          margin: "0 0 16px",
        }}
      >
        Messages signalés
      </h2>

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
              key={`${m.origine}-${m.id}`}
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
                {m.communauteFermee ? <Marque fond={MAUVE}>Fermée</Marque> : null}
                {/*
                  L'origine est dite : un message de forum vient d'un produit
                  dont les écrans ne sont plus branchés. Sans cette marque, le
                  lien « voir le fil » ne mènerait pas où on l'attend.
                */}
                {m.origine === "forum" ? <Marque fond={BLANC}>Ancien forum</Marque> : null}
                {m.sujetTitre ? (
                  <span style={{ fontSize: 13.5, fontWeight: 800 }}>{m.sujetTitre}</span>
                ) : null}
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
                <DecisionSignalement messageId={m.id} origine={m.origine} />

                {m.communauteFermee ? (
                  <span style={{ fontSize: 12.5, opacity: 0.6 }}>
                    Communauté fermée : le fil ne s&apos;ouvre pas d&apos;ici.
                  </span>
                ) : m.origine === "forum" ? (
                  <span style={{ fontSize: 12.5, opacity: 0.6 }}>
                    Message d&apos;un sujet — ces écrans ne sont plus servis.
                  </span>
                ) : (
                  <Link
                    href={`/communautes/${m.communauteSlug}` as Route}
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

      {/* ── Les communautés ───────────────────────────────────────────── */}
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 20,
          textTransform: "uppercase",
          margin: "40px 0 8px",
        }}
      >
        Communautés
      </h2>
      <p style={{ fontSize: 13, opacity: 0.7, margin: "0 0 16px", lineHeight: 1.5 }}>
        Fermer une communauté n&apos;efface rien : elle cesse d&apos;être
        lisible, y compris par ses membres et son créateur, et elle peut être
        rouverte. Chaque geste demande un motif, qui reste au journal.
      </p>

      {communautes.length === 0 ? (
        <p
          style={{
            padding: 24,
            border: CADRE,
            borderRadius: 18,
            background: BLANC,
            fontSize: 14.5,
            fontWeight: 600,
            margin: 0,
          }}
        >
          Aucune communauté n&apos;a encore été ouverte.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {communautes.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 18,
                flexWrap: "wrap",
                border: CADRE,
                borderRadius: 18,
                background: c.fermee ? MAUVE : BLANC,
                boxShadow: `4px 4px 0 ${ENCRE}`,
                padding: "18px 22px",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Link
                    href={`/communautes/${c.slug}` as Route}
                    style={{ fontSize: 16, fontWeight: 800 }}
                  >
                    {c.nom}
                  </Link>
                  {c.signales > 0 ? (
                    <Marque fond={ORANGE}>
                      {c.signales} signalé{c.signales > 1 ? "s" : ""}
                    </Marque>
                  ) : null}
                  {c.fermee ? <Marque fond={BLANC}>Fermée</Marque> : null}
                </div>
                <div style={{ fontSize: 12.5, opacity: 0.7, marginTop: 5 }}>
                  {c.membres} membre{c.membres > 1 ? "s" : ""} · {c.messages} message
                  {c.messages > 1 ? "s" : ""} · ouverte le {dateCourte(c.creeeLe)}
                </div>
              </div>

              <FermerLaCommunaute
                communauteId={c.id}
                nom={c.nom}
                fermee={c.fermee}
              />
            </div>
          ))}
        </div>
      )}
    </DashboardFrame>
  );
}

function Tuile({
  libelle,
  valeur,
  note,
  fond,
}: {
  libelle: string;
  valeur: number;
  note: string;
  fond: string;
}) {
  return (
    <div
      style={{
        border: CADRE,
        borderRadius: 18,
        background: fond,
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: ".1em",
          opacity: 0.7,
        }}
      >
        {libelle}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 30, lineHeight: 1.1, marginTop: 6 }}>
        {valeur}
      </div>
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{note}</div>
    </div>
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
