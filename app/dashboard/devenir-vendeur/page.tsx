import Link from "next/link";
import { redirect } from "next/navigation";

import {
  CADRE,
  DashboardFrame,
  ENCRE,
  JAUNE,
  MetricCard,
} from "@/components/dashboard/frame";
import { sessionCourante } from "@/lib/auth/session";
import {
  lireProgressionVendeur,
  type CleEtapeVendeur,
} from "@/lib/dashboard/devenir-vendeur-lecture";
import { BAREME_XOF, partDuCreateur } from "@/lib/domain/fees";
import { CONFIG_PAR_DEFAUT, RAILS_BAOBART } from "@/lib/payments/payout-schedule";
import { MAUVE } from "@/lib/systeme/charte";

export const metadata = { title: "Devenir vendeur — Baobart." };
export const dynamic = "force-dynamic";

const JOURS = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
] as const;

const FOND_ETAPE: Record<CleEtapeVendeur, string> = {
  profil: "#FFFFFF",
  versement: "#EADFF9",
  ressources: JAUNE,
};

/**
 * Page « Devenir vendeur » (`Baobart Design/Baobart Dashboard.dc.html`, page `vendeur`).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ÉCARTS VOLONTAIRES AVEC LA MAQUETTE (vérifiés dans le code le 08/11/2026)
 *
 * 1. **Part du créateur et commission** : la maquette affiche « Tu gardes 80 %
 *    de chaque vente » et « Commission plateforme : 20 % » (`Baobart Dashboard.dc.html:1546,1554`).
 *    Depuis la décision du 10/10/2026 (`lib/domain/fees.ts:60,294`), la
 *    commission Baobart est de 10 % et les frais d'opérateur de 1,5 %, soit
 *    88,5 % pour le créateur (`partDuCreateur()`). Les valeurs affichées ici
 *    sont calculées depuis `BAREME_XOF` et `partDuCreateur()`.
 *
 * 2. **Pas de relecture sous 72 h** : la maquette annonce « validation sous
 *    72 h » et « Nos curateurs valident sous 72 h et ta boutique s'ouvre »
 *    (`Baobart Dashboard.dc.html:1546,1550`). En réalité, `publierProduit`
 *    (`lib/products/actions.ts:240`) passe la ressource à `PUBLISHED`
 *    immédiatement, sans file de validation préalable.
 *
 * 3. **Revenu moyen créateur retiré** : la carte « Revenu moyen créateur :
 *    142 000 F par mois, 6 mois d'ancienneté » (`Baobart Dashboard.dc.html:1553`)
 *    est un chiffre fictif de maquette ; elle est remplacée par la part réelle
 *    du créateur (`partDuCreateur()`).
 *
 * 4. **Calendrier de versement** : la maquette indique « 7 jours après la fin
 *    du mois » (`Baobart Dashboard.dc.html:1555`). Le code verse chaque semaine
 *    au jour propre à chaque rail (`RAILS_BAOBART`, `lib/payments/payout-schedule.ts:66`),
 *    après `CONFIG_PAR_DEFAUT.delayDays` jours de rétention.
 */
export default async function DevenirVendeurPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion?suite=/dashboard/devenir-vendeur");

  const progression = await lireProgressionVendeur(utilisateur.id);
  const part = partDuCreateur();
  const commissionPct = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 1,
  }).format(BAREME_XOF.commissionBp / 100);
  const operateurPct = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 1,
  }).format(BAREME_XOF.processorRateBp / 100);
  const joursParRail = Object.values(RAILS_BAOBART).map(
    (r) => `${r.label} (${JOURS[r.weekday]})`,
  );

  const enBoutique = utilisateur.progression.etape === "BOUTIQUE";
  const toutEstFait = progression.faites === progression.total;

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Devenir vendeur"
      description={`Tu gardes ${part} de chaque vente. Trois étapes pour préparer et ouvrir ta boutique.`}
      action={
        <Link
          href="/dashboard/produits/nouveau"
          className="sticker-press"
          style={{
            padding: "11px 18px",
            border: CADRE,
            borderRadius: 13,
            background: JAUNE,
            boxShadow: `4px 4px 0 ${ENCRE}`,
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          Ouvrir ma boutique
        </Link>
      }
    >
      <div data-devenir-vendeur-page style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <section
          style={{
            border: CADRE,
            borderRadius: 22,
            background: toutEstFait ? JAUNE : MAUVE,
            boxShadow: `5px 5px 0 ${ENCRE}`,
            padding: "18px 20px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 20,
                textTransform: "uppercase",
                letterSpacing: "-.4px",
              }}
            >
              {toutEstFait
                ? "Les 3 étapes sont complétées — ta boutique est prête"
                : `Ta progression : ${progression.faites} étape${progression.faites > 1 ? "s" : ""} sur ${progression.total}`}
            </div>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 13.5,
                fontWeight: 650,
                lineHeight: 1.45,
              }}
            >
              {enBoutique && toutEstFait
                ? "Ta boutique est en ligne et tes trois étapes sont validées."
                : enBoutique
                  ? "Ta boutique est déjà en ligne. Complète les étapes restantes pour finaliser ton profil et tes versements."
                  : "Avance dans l'ordre qui te convient : chaque étape se met à jour dès que tu l'enregistres."}
            </p>
          </div>
          {enBoutique ? (
            <Link
              href="/dashboard"
              className="sticker-press"
              style={{
                padding: "10px 16px",
                border: CADRE,
                borderRadius: 12,
                background: "#FFFFFF",
                fontSize: 12.5,
                fontWeight: 800,
                whiteSpace: "nowrap",
              }}
            >
              Tableau de bord vendeur →
            </Link>
          ) : null}
        </section>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))",
            gap: 16,
          }}
        >
          {progression.etapes.map((s) => (
            <section
              key={s.cle}
              style={{
                border: CADRE,
                borderRadius: 20,
                background: FOND_ETAPE[s.cle],
                boxShadow: `5px 5px 0 ${ENCRE}`,
                padding: 18,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      border: CADRE,
                      borderRadius: 99,
                      background: "#FFFFFF",
                      display: "grid",
                      placeItems: "center",
                      fontFamily: "var(--font-display)",
                      fontSize: 14,
                    }}
                  >
                    {s.numero}
                  </div>
                  <span
                    style={{
                      padding: "4px 10px",
                      border: `2px solid ${ENCRE}`,
                      borderRadius: 999,
                      background: s.faite
                        ? s.enAttente
                          ? MAUVE
                          : ENCRE
                        : "#FFFFFF",
                      color: s.faite && !s.enAttente ? "#FFFFFF" : ENCRE,
                      fontFamily: "var(--font-mono)",
                      fontSize: 10.5,
                      fontWeight: 800,
                      textTransform: "uppercase",
                    }}
                  >
                    {s.faite
                      ? s.enAttente
                        ? "Faite · délai 24 h"
                        : "Faite ✓"
                      : "À faire"}
                  </span>
                </div>

                <h2
                  style={{
                    fontSize: 15.5,
                    fontWeight: 800,
                    margin: "12px 0 0",
                  }}
                >
                  {s.titre}
                </h2>
                <p
                  style={{
                    fontSize: 13.5,
                    fontWeight: 500,
                    lineHeight: 1.45,
                    margin: "5px 0 0",
                    opacity: 0.85,
                  }}
                >
                  {s.texte}
                </p>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11.5,
                    fontWeight: 700,
                    marginTop: 10,
                    padding: "6px 10px",
                    border: `1.5px solid ${ENCRE}`,
                    borderRadius: 10,
                    background: "#FFFFFF",
                    display: "inline-block",
                  }}
                >
                  {s.detail}
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <Link
                  href={s.action.href}
                  className="sticker-press"
                  style={{
                    display: "inline-block",
                    padding: "9px 15px",
                    border: CADRE,
                    borderRadius: 12,
                    background: "#FFFFFF",
                    fontSize: 12.5,
                    fontWeight: 800,
                  }}
                >
                  {s.action.libelle}
                </Link>
              </div>
            </section>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            gap: 16,
          }}
        >
          <MetricCard
            label="Part créateur"
            value={part}
            hint="sur chaque vente, après commission et frais"
          />
          <MetricCard
            label="Commission plateforme"
            value={`${commissionPct} %`}
            hint={`+ ${operateurPct} % de frais d'opérateur, aucun frais fixe`}
            accent
          />
          <MetricCard
            label="Cycles de versement"
            value="Hebdomadaire"
            hint={`${joursParRail.join(" · ")} · rétention ${CONFIG_PAR_DEFAUT.delayDays} j`}
          />
        </div>
      </div>
    </DashboardFrame>
  );
}

