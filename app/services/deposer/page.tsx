import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { FormulaireService } from "@/components/services/formulaire";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { MESSAGES as MESSAGES_DROIT, peutPublier } from "@/lib/cms/droits";
import { categoriesPourChoix } from "@/lib/services/queries";
import { lireQualifications } from "@/lib/services/qualifications";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, ORANGE } from "@/lib/systeme/charte";

export const metadata = { title: "Proposer un service — Baobart." };
export const dynamic = "force-dynamic";

/**
 * Déposer un service.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ON DIT LE REFUS AVANT LE FORMULAIRE
 *
 * Trois conditions cumulatives (§18.3) qui prennent chacune un chemin
 * différent à corriger — s'abonner, publier une ressource, écrire pour le
 * badge. Laisser saisir puis refuser à la validation ferait recommencer un
 * créateur qui n'aurait, de toute façon, aucun moyen de publier. L'écran
 * annonce le refus dès l'arrivée, avec le message exact du module `droits`.
 *
 * L'action refait toutes ces gardes : cacher le formulaire ne ferme rien.
 */
export default async function DeposerServicePage() {
  const utilisateur = await sessionCourante();

  if (!utilisateur) redirect("/connexion?suite=/services/deposer");

  const qualifs = await lireQualifications(utilisateur.id);

  const droit = peutPublier(
    {
      role: utilisateur.role,
      estVendeur: utilisateur.progression.aPublie,
      abonnementOuvert: qualifs.abonnementOuvert,
      badgeProfessionnel: qualifs.badgeProfessionnel,
    },
    "service",
  );

  const categories = await categoriesPourChoix();

  return (
    <>
      <Header utilisateur={utilisateur} />

      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 72 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 32px 0" }}>
          <Link
            href={"/services" as Route}
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
            ← Tous les services
          </Link>

          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(28px,3.6vw,44px)",
              lineHeight: 1,
              letterSpacing: "-1.6px",
              textTransform: "uppercase",
              margin: "22px 0 0",
            }}
          >
            Proposer un service
          </h1>

          {!droit.ok ? (
            <div
              style={{
                marginTop: 20,
                padding: "18px 20px",
                border: CADRE,
                borderRadius: 20,
                background: ORANGE,
                color: BLANC,
                boxShadow: `5px 5px 0 ${ENCRE}`,
              }}
            >
              <div style={{ fontSize: 15.5, fontWeight: 800 }}>
                Publier un service demande trois choses
              </div>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1.55,
                  marginTop: 8,
                  textWrap: "pretty",
                }}
              >
                {MESSAGES_DROIT[droit.motif]}
              </p>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  gap: 13,
                  marginTop: 18,
                  padding: "16px 18px",
                  border: CADRE,
                  borderRadius: 18,
                  background: JAUNE,
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    flex: "0 0 auto",
                    border: `2px solid ${ENCRE}`,
                    borderRadius: 99,
                    background: BLANC,
                    display: "grid",
                    placeItems: "center",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  !
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    lineHeight: 1.5,
                    textWrap: "pretty",
                  }}
                >
                  Ton service passe par une relecture avant de paraître —
                  compte un jour ou deux. Un acheteur voit la fiche pour de
                  bon, sans étape intermédiaire ; c&apos;est la relecture qui
                  garde le catalogue lisible.
                </div>
              </div>

              <div style={{ marginTop: 22 }}>
                <FormulaireService categories={categories} />
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
