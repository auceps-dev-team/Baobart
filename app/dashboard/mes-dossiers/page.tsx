import Link from "next/link";
import { redirect } from "next/navigation";
import type { Route } from "next";

import { DashboardFrame } from "@/components/dashboard/frame";
import { FormulaireReponse } from "@/components/juridique/reponse";
import { sessionCourante } from "@/lib/auth/session";
import { dossiersDeLAuteur } from "@/lib/juridique/queries";
import { BLANC, CADRE, ENCRE, JAUNE, MAUVE, ORANGE, VERT } from "@/lib/systeme/charte";

export const metadata = { title: "Mes dossiers — Baobart." };
export const dynamic = "force-dynamic";

/**
 * Les notifications qui visent mes contenus.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON NE DIT PAS QUI A NOTIFIÉ
 *
 * Cette page montre **ce qui est reproché**, pas qui le reproche. La loi
 * n'oblige pas à le dire, et le dire exposerait le domicile et la date de
 * naissance d'une personne à celle dont elle conteste le travail. Un litige de
 * droit d'auteur n'a pas à devenir un problème de sécurité physique.
 *
 * Ce n'est pas seulement une décision d'affichage : `dossiersDeLAuteur` ne
 * **sélectionne pas** les colonnes du notifiant. Ce qui n'est jamais chargé ne
 * peut pas fuir par une distraction.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE MOTIF EST REPRIS TEL QU'IL A ÉTÉ ÉCRIT
 *
 * Pas résumé, pas reformulé. On répond à ce qui vous est reproché, pas à notre
 * traduction de ce qui vous est reproché.
 */
export default async function MesDossiersPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion?suite=/dashboard/mes-dossiers" as Route);

  const dossiers = await dossiersDeLAuteur(utilisateur.id);

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Mes dossiers"
      description="Les notifications qui visent tes contenus, et ce que tu peux y répondre."
    >
      {dossiers.length === 0 ? (
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
            Rien ne vise tes contenus
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55, marginTop: 8 }}>
            Si quelqu&apos;un notifie un de tes contenus comme litigieux, tu le
            sauras par courriel — pas seulement ici — et tu auras dix jours
            pour répondre.{" "}
            <Link href={"/signalement" as Route} style={{ textDecoration: "underline" }}>
              Comment ça marche
            </Link>
            .
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 20 }}>
          {dossiers.map((d) => (
            <article
              key={d.reference}
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
                <span style={{ fontFamily: "var(--font-display)", fontSize: 19 }}>
                  {d.reference}
                </span>
                <Marque fond={FOND[d.etat] ?? BLANC}>{LIBELLE[d.etat] ?? d.etat}</Marque>
                <span style={{ fontSize: 12.5, opacity: 0.6, marginLeft: "auto" }}>
                  notifié le {dateCourte(d.notifieLe)}
                </span>
              </div>

              <Bloc titre="Ce qui t'est reproché">{d.motifs}</Bloc>
              <Bloc titre="Les faits décrits">{d.faits}</Bloc>

              {d.adresses.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.6 }}>
                    Contenus visés
                  </div>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    {d.adresses.map((a) => (
                      <li
                        key={a}
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 12.5,
                          wordBreak: "break-all",
                        }}
                      >
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {d.motifDecision ? (
                <Bloc titre="Notre décision">{d.motifDecision}</Bloc>
              ) : null}

              {/* ── Répondre ─────────────────────────────────────────── */}
              {d.etat === "RETRAIT_PROVISOIRE" && !d.aRepondu ? (
                <div
                  style={{
                    marginTop: 20,
                    paddingTop: 16,
                    borderTop: CADRE,
                  }}
                >
                  {d.reponseAvantLe ? (
                    <p style={{ fontSize: 13.5, fontWeight: 700, margin: "0 0 12px" }}>
                      Tu peux répondre jusqu&apos;au {dateCourte(d.reponseAvantLe)}.
                      Passé ce terme, le retrait devient définitif.
                    </p>
                  ) : null}
                  <FormulaireReponse reference={d.reference} />
                </div>
              ) : null}

              {d.aRepondu ? (
                <p
                  style={{
                    marginTop: 16,
                    paddingTop: 14,
                    borderTop: CADRE,
                    fontSize: 13.5,
                    fontWeight: 700,
                    opacity: 0.75,
                  }}
                >
                  Tu as répondu. Le dossier est repassé devant un humain.
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </DashboardFrame>
  );
}

const LIBELLE: Record<string, string> = {
  RECUE: "En cours d'examen",
  INCOMPLETE: "Notification incomplète",
  RETRAIT_PROVISOIRE: "Retiré à titre provisoire",
  CONTESTEE: "Ta réponse est à l'examen",
  RETIREE: "Retrait définitif",
  RESTAUREE: "Remis en ligne",
  CLASSEE: "Classé sans suite",
};

const FOND: Record<string, string> = {
  RECUE: JAUNE,
  INCOMPLETE: BLANC,
  RETRAIT_PROVISOIRE: MAUVE,
  CONTESTEE: JAUNE,
  RETIREE: ORANGE,
  RESTAUREE: VERT,
  CLASSEE: VERT,
};

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.6 }}>{titre}</div>
      <p
        style={{
          fontSize: 14.5,
          lineHeight: 1.55,
          margin: "4px 0 0",
          whiteSpace: "pre-wrap",
        }}
      >
        {children}
      </p>
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
    month: "long",
    year: "numeric",
  }).format(d);
}
