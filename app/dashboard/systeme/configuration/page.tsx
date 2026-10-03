import { DashboardFrame } from "@/components/dashboard/frame";
import {
  BandeauGravite,
  Intro,
  Panneau,
  PastilleEtat,
  PiedEcran,
  type Puce,
} from "@/components/systeme/bandeau";
import { exigerAdministrateur } from "@/lib/auth/acces-administration";
import { LIBELLE_ROLE } from "@/lib/auth/administration";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, ORANGE, TON } from "@/lib/systeme/charte";
import type { Constat } from "@/lib/systeme/diagnostic";
import { etatDeLaPlateforme } from "@/lib/systeme/lecture";

export const metadata = { title: "Système · Configuration — Baobart." };
export const dynamic = "force-dynamic";

function LigneConstat({ constat }: { constat: Constat }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        padding: 15,
        border: CADRE,
        borderRadius: 18,
        background: TON[constat.gravite].ligneFond,
      }}
    >
      <PastilleEtat gravite={constat.gravite} />

      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800 }}>{constat.libelle}</div>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            lineHeight: 1.45,
            marginTop: 4,
            opacity: 0.82,
            textWrap: "pretty",
          }}
        >
          {constat.detail}
        </div>

        {constat.remede ? (
          <div
            style={{
              display: "flex",
              gap: 9,
              alignItems: "flex-start",
              marginTop: 10,
              padding: "10px 13px",
              border: `2px solid ${ENCRE}`,
              borderRadius: 13,
              background: BLANC,
            }}
          >
            <div
              style={{
                flex: "0 0 auto",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".1em",
                paddingTop: 2,
                opacity: 0.6,
              }}
            >
              REMÈDE
            </div>
            {/* Un nom de variable (« RATE_LIMIT_DRIVER=redis ») ne se coupe pas
                de lui-même : sur un téléphone, il poussait la page de 66 à
                136 px de travers (mesuré le 03/10). */}
            <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.4, minWidth: 0, overflowWrap: "anywhere" }}>
              {constat.remede}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Les compteurs du bandeau.
 *
 * On n'annonce que ce qui demande une décision : « 6 constats » situe, « 1 à
 * voir » oriente. Afficher aussi « 5 OK » diluerait le seul chiffre qu'on
 * regarde vraiment.
 */
function puces(constats: Constat[]): Puce[] {
  const compte = (g: Constat["gravite"]) =>
    constats.filter((c) => c.gravite === g).length;

  const liste: Puce[] = [
    { texte: `${constats.length} constats`, fond: BLANC },
  ];

  const aVoir = compte("attention");
  if (aVoir > 0) liste.push({ texte: `${aVoir} à voir`, fond: JAUNE });

  const pannes = compte("panne");
  if (pannes > 0) liste.push({ texte: `${pannes} en panne`, fond: ORANGE });

  return liste;
}

export default async function ConfigurationPage() {
  // Le layout garde déjà la section, mais Next.js ne le réexécute pas à chaque
  // navigation entre pages sœurs. Une garde qui ne s'exécute pas est absente.
  const utilisateur = await exigerAdministrateur();
  const etat = await etatDeLaPlateforme();

  return (
    <DashboardFrame
      utilisateur={utilisateur}
      titre="Système · Configuration"
      description="Ce que la plateforme a réellement sous les pieds."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <BandeauGravite gravite={etat.gravite} puces={puces(etat.constats)} />

        <Intro>
          Ce que la plateforme a réellement sous les pieds. Chaque ligne dit ce
          qui est cassé et ce qu&apos;il faut faire — rien d&apos;autre.
        </Intro>

        <Panneau
          titre="État des dépendances"
          mention="relu à chaque affichage · aucune mise en cache"
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginTop: 16,
            }}
          >
            {etat.constats.map((c) => (
              <LigneConstat key={c.cle} constat={c} />
            ))}
          </div>
        </Panneau>

        <Panneau titre="Pas encore écrit" fond={LAVANDE}>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 500,
              lineHeight: 1.5,
              marginTop: 7,
              maxWidth: 720,
              opacity: 0.82,
              textWrap: "pretty",
            }}
          >
            Renseigner les variables d&apos;environnement de ces briques ne
            branche rien : le code correspondant n&apos;existe pas encore. Elles
            apparaissent ici pour que personne ne croie l&apos;inverse.
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 16,
            }}
          >
            {etat.aVenir.map((m) => (
              <div
                key={m}
                style={{
                  padding: "10px 16px",
                  border: CADRE,
                  borderRadius: 14,
                  background: BLANC,
                  fontSize: 13.5,
                  fontWeight: 700,
                }}
              >
                {m}
              </div>
            ))}
          </div>
        </Panneau>

        <PiedEcran
          libelle="Personne connectée"
          qui={`${utilisateur.nom} · ${LIBELLE_ROLE[utilisateur.role].toLowerCase()}`}
          note="Les rôles se donnent depuis la base de données, jamais depuis un écran. Aucune page de cette section ne peut élever un compte."
        />
      </div>
    </DashboardFrame>
  );
}
