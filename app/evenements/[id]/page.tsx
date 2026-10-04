import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import { BoutonInscription } from "@/components/evenements/bouton-inscription";
import { CompteARebours } from "@/components/evenements/compte-a-rebours";
import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { LIBELLE_GENRE } from "@/lib/evenements/enums";
import { estInscrit } from "@/lib/evenements/inscription";
import { LIBELLE_PHASE, placesRestantes } from "@/lib/evenements/phases";
import { evenementPublic } from "@/lib/evenements/queries";
import { formatMoney, type Currency } from "@/lib/i18n/money";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, ORANGE, VERT } from "@/lib/systeme/charte";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const e = await evenementPublic(id);
  if (!e) return { title: "Événement introuvable — Baobart." };

  return {
    title: `${e.titre} — Baobart.`,
    description: e.description.slice(0, 200),
  };
}

/**
 * La fiche d'un événement.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN ANNULÉ S'OUVRE, ET LE DIT EN PREMIER
 *
 * C'est toute la raison d'être de `cancelledAt` à côté de `state` (§24.4).
 * Les inscrits ont noté la date, prévu un déplacement, peut-être payé un
 * billet : la page reste, et l'annonce passe avant le reste — avant le titre,
 * avant les dates, avant la description. Les envoyer sur un 404 les laisserait
 * chercher.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * UN ÉVÉNEMENT PASSÉ S'OUVRE AUSSI
 *
 * On vient y lire ce qui s'est produit. La seule chose qui change, c'est qu'on
 * ne peut plus s'y inscrire — et l'écran le dit au lieu de proposer un bouton
 * qui refuserait.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE BOUTON D'INSCRIPTION ARRIVE EN E4
 *
 * On annonce ce qui est vrai — les places restantes, le tarif — sans promettre
 * un geste qui n'aboutirait pas. Un billet payant restera d'ailleurs fermé
 * tant que l'encaissement n'est pas branché : donner des places sans les faire
 * payer serait pire que ne pas en donner.
 */
export default async function FicheEvenementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [e, visiteur] = await Promise.all([evenementPublic(id), sessionCourante()]);

  // 404 pour tout ce qui n'est pas publié : brouillon, retiré. Un identifiant
  // se devine mal, mais il se partage.
  if (!e) notFound();

  const restantes = placesRestantes(e.capacite, e.inscrits);
  const complet = restantes === 0;
  const termine = e.phase === "TERMINE";

  // Seulement pour qui est connecté : un visiteur n'a pas d'inscription à
  // avoir, et la question ne mérite pas une requête.
  const inscrit = visiteur ? await estInscrit(e.id, visiteur.id) : false;

  // Un billet payant reste fermé tant que l'encaissement n'est pas branché —
  // même refus que dans `inscrire`, dit ici plutôt que découvert au clic.
  const billetPayant = e.prixBillet !== null && e.prixBillet > 0;
  const inscriptionOuverte = !e.annuleLe && !termine && !billetPayant;

  const faits: { k: string; v: string; fond: string }[] = [
    { k: "Type", v: LIBELLE_GENRE[e.genre], fond: LAVANDE },
    { k: "État", v: LIBELLE_PHASE[e.phase], fond: BLANC },
    {
      k: "Lieu",
      v: e.enLigne ? "En ligne" : (e.lieu ?? "Non précisé"),
      fond: BLANC,
    },
    {
      k: "Places",
      v:
        e.capacite === null
          ? "Sans limite"
          : `${e.inscrits} / ${e.capacite}`,
      fond: complet ? ORANGE : BLANC,
    },
  ];

  return (
    <>
      <Header utilisateur={visiteur} />

      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 72 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 32px 0" }}>
          <Link
            href={"/evenements" as Route}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              border: CADRE,
              borderRadius: 13,
              background: BLANC,
              fontSize: 13,
              fontWeight: 800,
              color: ENCRE,
            }}
          >
            ← Tous les événements
          </Link>

          {/* L'annulation passe avant tout le reste. */}
          {e.annuleLe ? (
            <div
              role="alert"
              style={{
                marginTop: 20,
                border: CADRE,
                borderRadius: 22,
                background: ORANGE,
                color: BLANC,
                boxShadow: `6px 6px 0 ${ENCRE}`,
                padding: 22,
              }}
            >
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, textTransform: "uppercase" }}>
                Cet événement est annulé
              </div>
              {e.raisonAnnulation ? (
                <p style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.55, marginTop: 10 }}>
                  {e.raisonAnnulation}
                </p>
              ) : null}
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  marginTop: 10,
                  opacity: 0.85,
                }}
              >
                annoncé le {e.annuleLe.toLocaleDateString("fr-FR", { timeZone: "UTC" })}
              </div>
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1.55fr) minmax(0,1fr)",
              gap: 24,
              marginTop: 20,
              alignItems: "start",
            }}
          >
            {/* ── L'événement ─────────────────────────────────────────────── */}
            <div
              style={{
                border: CADRE,
                borderRadius: 26,
                background: BLANC,
                boxShadow: `7px 7px 0 ${ENCRE}`,
                padding: 26,
                minWidth: 0,
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <Pastille fond={LAVANDE} mono>
                  {LIBELLE_GENRE[e.genre]}
                </Pastille>
                <Pastille fond={e.phase === "EN_COURS" ? VERT : JAUNE}>
                  {LIBELLE_PHASE[e.phase]}
                </Pastille>
              </div>

              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(26px,3.2vw,42px)",
                  lineHeight: 1.02,
                  letterSpacing: "-1.5px",
                  margin: "16px 0 0",
                  textTransform: "uppercase",
                }}
              >
                {e.titre}
              </h1>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 18,
                  marginTop: 12,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11.5,
                  opacity: 0.65,
                }}
              >
                <span>
                  du {formatDate(e.debut)} au {formatDate(e.fin)}
                </span>
                <span>
                  organisé par{" "}
                  {e.organisateurUsername ? (
                    <Link
                      href={`/@${e.organisateurUsername}` as Route}
                      style={{ color: ENCRE, textDecoration: "underline" }}
                    >
                      {e.organisateur}
                    </Link>
                  ) : (
                    e.organisateur
                  )}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
                  gap: 12,
                  marginTop: 20,
                }}
              >
                {faits.map((f) => (
                  <div
                    key={f.k}
                    style={{
                      border: CADRE,
                      borderRadius: 16,
                      background: f.fond,
                      color: f.fond === ORANGE ? BLANC : ENCRE,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: ".1em",
                        opacity: 0.65,
                      }}
                    >
                      {f.k}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 18,
                        lineHeight: 1.2,
                        marginTop: 5,
                      }}
                    >
                      {f.v}
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                  margin: "26px 0 10px",
                }}
              >
                Le programme
              </div>
              {/*
                Texte saisi par l'organisateur. React l'échappe : jamais
                interprété comme du balisage. `pre-wrap` garde ses paragraphes.
              */}
              <p
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  lineHeight: 1.6,
                  margin: 0,
                  opacity: 0.85,
                  whiteSpace: "pre-wrap",
                  textWrap: "pretty",
                }}
              >
                {e.description}
              </p>
            </div>

            {/* ── Inscription ─────────────────────────────────────────────── */}
            <div style={{ position: "sticky", top: 88, minWidth: 0 }}>
              <div
                style={{
                  border: CADRE,
                  borderRadius: 26,
                  background: JAUNE,
                  boxShadow: `7px 7px 0 ${ENCRE}`,
                  padding: 22,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: ".1em",
                    opacity: 0.7,
                  }}
                >
                  {e.prixBillet ? "Billet" : "Participation"}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 34,
                    lineHeight: 1,
                    marginTop: 4,
                  }}
                >
                  {e.prixBillet
                    ? formatMoney(e.prixBillet, e.devise as Currency)
                    : "Gratuite"}
                </div>

                {e.dotation ? (
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 10 }}>
                    {formatMoney(e.dotation, e.devise as Currency)} de dotation
                  </div>
                ) : null}

                {/* Le décompte n'a de sens que sur ce qui n'est pas terminé. */}
                {!termine && !e.annuleLe ? (
                  <CompteARebours jusqua={e.phase === "EN_COURS" ? e.fin : e.debut} />
                ) : null}

                <div style={{ marginTop: 18, paddingTop: 16, borderTop: CADRE }}>
                  {inscriptionOuverte ? (
                    <BoutonInscription
                      evenementId={e.id}
                      inscrit={inscrit}
                      complet={complet}
                    />
                  ) : (
                    <div
                      style={{
                        padding: 14,
                        border: CADRE,
                        borderRadius: 15,
                        background: BLANC,
                        textAlign: "center",
                        fontSize: 13,
                        fontWeight: 700,
                        lineHeight: 1.5,
                        textWrap: "pretty",
                      }}
                    >
                      {e.annuleLe
                        ? "Les inscriptions sont closes."
                        : termine
                          ? "Cet événement est terminé."
                          : "Les billets payants ne sont pas encore encaissés en ligne. Écris à l'organisateur."}
                    </div>
                  )}

                  {/*
                    Le reste des places n'a de sens que tant qu'on peut les
                    prendre — et pas quand on est déjà inscrit, où le bouton
                    dit déjà l'essentiel.
                  */}
                  {inscriptionOuverte && !inscrit && restantes !== null && restantes > 0 ? (
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10.5,
                        textAlign: "center",
                        marginTop: 10,
                        opacity: 0.7,
                      }}
                    >
                      {restantes} place{restantes > 1 ? "s" : ""} restante
                      {restantes > 1 ? "s" : ""}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

/**
 * Une date lisible, en GMT.
 *
 * `timeZone: "UTC"` explicite : les heures ont été **saisies** en GMT (voir
 * `lib/evenements/validation.ts`). Les rendre dans le fuseau du serveur
 * afficherait une heure différente de celle que l'organisateur a tapée.
 */
function formatDate(quand: Date): string {
  return quand.toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function Pastille({
  children,
  fond,
  mono = false,
}: {
  children: React.ReactNode;
  fond: string;
  mono?: boolean;
}) {
  return (
    <span
      style={{
        padding: "6px 13px",
        border: `2px solid ${ENCRE}`,
        borderRadius: 999,
        background: fond,
        fontSize: mono ? 11 : 11.5,
        fontWeight: mono ? 400 : 800,
        fontFamily: mono ? "var(--font-mono)" : undefined,
        textTransform: "uppercase",
        letterSpacing: mono ? ".08em" : undefined,
      }}
    >
      {children}
    </span>
  );
}
