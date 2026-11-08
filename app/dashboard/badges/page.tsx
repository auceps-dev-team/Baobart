import { redirect } from "next/navigation";

import { GrandEcusson, Jeton } from "@/components/badges/formes";
import { jusquAu } from "@/components/badges/rangees";
import { BLANC, DashboardFrame, DashboardPanel, EmptyState, ENCRE, JAUNE, LAVANDE_CLAIR } from "@/components/dashboard/frame";
import { sessionCourante } from "@/lib/auth/session";
import { badgesDuCompte } from "@/lib/badges/compte";
import { FAMILLES_MERITE, MERITES, type Merite, type Proche } from "@/lib/badges/merites";
import { statutDe, type Ecusson } from "@/lib/badges/statuts";

export const metadata = { title: "Mes badges — Baobart." };

/**
 * L'orange de la charte (#E2622C) donne 3,07:1 sur ce fond lavande — mesuré par
 * axe le 08/11/2026 (`e2e/badges.spec.ts`). Celui-ci en donne 4,8 : la même
 * teinte, assombrie, pour du texte de 10 px.
 */
const ORANGE_LISIBLE = "#B4471A";
export const dynamic = "force-dynamic";

/**
 * « Vos badges » (`SPEC_GAMIFICATION` §5), dessiné par la maquette des badges
 * (`Baobart Badges.dc.html`) : les deux familles séparées, puis « pas encore
 * obtenu » — les trois plus proches, avec la distance et une jauge.
 *
 * Dans les espaces acheteur ET vendeur : l'entrée vit dans la partie acheteur
 * de la navigation (`lib/dashboard/nav.ts`), présente à tous les paliers. Un
 * acheteur porte lui aussi des mérites — « Un an », « Pionnier », « Fidèle ».
 *
 * Deux écarts avec la maquette :
 *   — pas de bloc « La perte » : les mérites se calculent à l'affichage
 *     (décision du 04/11), rien ne garde la trace d'un mérite perdu ;
 *   — le catalogue complet, critères publiés compris, est ici plutôt que sur
 *     une page `/badges` publique, que la spec donne pour optionnelle.
 */
export default async function BadgesPage() {
  const utilisateur = await sessionCourante();
  if (!utilisateur) redirect("/connexion?suite=/dashboard/badges");
  const badges = await badgesDuCompte(utilisateur.id);
  if (!badges) redirect("/connexion?suite=/dashboard/badges");

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Mes badges"
      description="Deux familles qu'on ne confond pas. Un statut, en écusson, engage Baobart : nous avons vérifié quelque chose. Un mérite, en jeton rond, constate ton activité : il se calcule, il ne se demande pas."
    >
      <div data-badges-page style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <DashboardPanel titre="Garanti par Baobart">
          {badges.ecussons.length === 0 ? (
            <EmptyState
              titre="Aucun statut pour l'instant"
              texte="Un statut s'accorde après une vérification par l'équipe : identité, portfolio, structure. Il ne s'obtient jamais tout seul."
            />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
              {badges.ecussons.map((e) => (
                <CarteStatut key={e.code} ecusson={e} />
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel titre="Constaté par l'activité">
          {badges.merites.length === 0 ? (
            <EmptyState
              titre="Aucun mérite pour l'instant"
              texte="Les mérites se constatent : une première ressource publiée, une première vente, un an parmi nous. Les plus proches sont juste en dessous."
            />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
              {badges.merites.map((m) => (
                <CarteMerite key={m.code} merite={m} jusquAu={m.code === "TOP_CREATOR" ? badges.createurDuMoisJusquAu : null} />
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel titre="Pas encore obtenu">
          <p style={{ margin: "0 0 14px", fontSize: 13.5, fontWeight: 600, lineHeight: 1.5, opacity: 0.75, maxWidth: 680 }}>
            Les trois dont tu es le plus près. Ton profil public n&apos;affiche jamais ce qui te manque : ceci ne se voit qu&apos;ici.
          </p>
          {badges.proches.length === 0 ? (
            <EmptyState
              titre="Rien en cours"
              texte="Aucun mérite n'est commencé. Publie une ressource ou fais ta première vente : la distance s'affichera ici."
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {badges.proches.map((p) => (
                <LignePlusProche key={p.merite.code} proche={p} />
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel titre="Tous les critères">
          <p style={{ margin: "0 0 14px", fontSize: 13.5, fontWeight: 600, lineHeight: 1.5, opacity: 0.75, maxWidth: 680 }}>
            Chaque mérite se calcule à partir d&apos;une règle publiée, la même pour tout le monde. Aucun ne s&apos;achète, aucun n&apos;ouvre de droit.
          </p>
          <Catalogue obtenus={new Set(badges.merites.map((m) => m.code))} />
        </DashboardPanel>
      </div>
    </DashboardFrame>
  );
}

function CarteStatut({ ecusson }: { ecusson: Ecusson }) {
  const droit = ecusson.code === "KYC_VERIFIED" ? "Seuils de versement relevés." : statutDe(ecusson.code).droit;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 15, padding: 16, border: `2.5px solid ${ENCRE}`, borderRadius: 20, background: LAVANDE_CLAIR }}>
      <GrandEcusson ecusson={ecusson} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>{ecusson.nom}</div>
        <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.4, marginTop: 4, opacity: 0.75 }}>
          {ecusson.dormant
            ? "En sommeil : sans abonnement actif, le droit se referme. Ce que tu as déjà publié reste en ligne."
            : droit}
        </div>
      </div>
    </div>
  );
}

function CarteMerite({ merite, jusquAu: fin }: { merite: Merite; jusquAu: Date | null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 13, padding: 15, border: `2.5px solid ${ENCRE}`, borderRadius: 20, background: BLANC, boxShadow: `4px 4px 0 ${ENCRE}` }}>
      <Jeton merite={merite} diametre={56} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{merite.nom}</div>
        {fin ? (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, marginTop: 3, color: ORANGE_LISIBLE }}>
            {jusquAu(fin)} · se prolonge tant que tu restes en tête
          </div>
        ) : null}
        <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.4, marginTop: 3, opacity: 0.72 }}>{merite.critere}</div>
      </div>
    </div>
  );
}

function LignePlusProche({ proche }: { proche: Proche }) {
  const { merite, progression, pourcentage } = proche;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 15, border: `2.5px solid ${ENCRE}`, borderRadius: 18, background: LAVANDE_CLAIR }}>
      <Jeton merite={merite} diametre={54} eteint />
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 9 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800 }}>{merite.nom}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 700, color: ORANGE_LISIBLE }}>{progression.ecart}</div>
        </div>
        <div
          role="progressbar"
          aria-label={`${merite.nom} : ${pourcentage} %`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pourcentage}
          style={{ height: 14, marginTop: 8, border: `2.5px solid ${ENCRE}`, borderRadius: 999, background: BLANC, overflow: "hidden" }}
        >
          <div style={{ height: "100%", width: `${pourcentage}%`, background: JAUNE }} />
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, marginTop: 6, opacity: 0.6 }}>{progression.detail}</div>
      </div>
    </div>
  );
}

function Catalogue({ obtenus }: { obtenus: ReadonlySet<string> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {FAMILLES_MERITE.map((f) => (
        <div key={f.code}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10 }}>
            <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 15, textTransform: "uppercase", letterSpacing: "-.3px" }}>{f.titre}</h3>
            <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.6 }}>{f.sousTitre}</span>
          </div>
          <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10 }}>
            {MERITES.filter((m) => m.famille === f.code).map((m) => (
              <li key={m.code} style={{ display: "flex", alignItems: "center", gap: 11, padding: 11, border: `2px solid ${ENCRE}`, borderRadius: 14, background: obtenus.has(m.code) ? BLANC : LAVANDE_CLAIR }}>
                <Jeton merite={m} diametre={38} eteint={!obtenus.has(m.code)} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>
                    {m.nom}
                    {obtenus.has(m.code) ? " · obtenu" : ""}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4, opacity: 0.72 }}>{m.critere}</div>
                  {m.enAttente ? (
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, marginTop: 4, opacity: 0.6 }}>Pas encore mesuré : {m.enAttente}</div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
