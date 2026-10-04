import Link from "next/link";
import type { Route } from "next";

import { Footer } from "@/components/shell/footer";
import { Header } from "@/components/shell/header";
import { sessionCourante } from "@/lib/auth/session";
import { ENGAGEMENTS } from "@/lib/juridique/dossier";
import { BLANC, CADRE, ENCRE, JAUNE, LAVANDE, MAUVE, ORANGE, VERT } from "@/lib/systeme/charte";

export const metadata = {
  title: "Signaler un contenu — Baobart.",
  description:
    "Ce que la loi ivoirienne impose à Baobart, ce que Baobart s'engage à faire en plus, et comment notifier un contenu litigieux.",
};

export const dynamic = "force-dynamic";

/**
 * L'engagement juridique de Baobart.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA STRUCTURE VIENT DE DRIBBBLE, LE CONTENU DE LA LOI IVOIRIENNE
 *
 * Dribbble organise sa page en trois blocs : ce que doit contenir une
 * notification, comment la contester, ce qu'on fait des récidivistes. C'est un
 * bon découpage, et on le reprend.
 *
 * Le contenu, non. Leur page applique le DMCA américain : sept éléments, un
 * délai de dix jours ouvrables pour saisir un tribunal fédéral, une
 * acceptation de compétence juridictionnelle. Recopier ce texte aurait produit
 * une page qui **annonce une procédure qui n'existe pas ici** — et sur une
 * page juridique, personne ne va vérifier.
 *
 * Le droit applicable est la loi ivoirienne n° 2013-451 du 19 juin 2013,
 * chapitre 6, articles 46 à 54. Baobart est établie à Abidjan.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * CE QUI VIENT DE LA LOI ET CE QUI VIENT DE NOUS EST SÉPARÉ À L'ÉCRAN
 *
 * L'article 46 dit « promptement », sans chiffre. Les 48 heures et les dix
 * jours qu'on affiche sont des engagements de Baobart. Les présenter comme du
 * droit serait s'abriter derrière une obligation qu'on s'est donnée soi-même ;
 * les taire laisserait croire qu'on ne s'engage à rien.
 *
 * D'où deux colonnes, et deux couleurs.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * L'ARTICLE 49 EST AFFICHÉ, ET PAS EN PETIT
 *
 * Notifier de mauvaise foi pour obtenir un retrait est puni de un à cinq ans
 * d'emprisonnement et de 1 à 5 millions de francs CFA. C'est la meilleure
 * protection du créateur dans tout ce dispositif.
 *
 * On l'affiche non pour intimider, mais parce qu'une personne qui hésite entre
 * « il m'a copié » et « son travail ressemble au mien » a le droit de savoir
 * ce qu'elle signe.
 */
export default async function SignalementPage() {
  const visiteur = await sessionCourante();

  return (
    <>
      <Header utilisateur={visiteur} />

      <main style={{ minHeight: "100vh", background: LAVANDE, paddingBottom: 80 }}>
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "44px 32px 0" }}>
          {/* ── Le bandeau ─────────────────────────────────────────────── */}
          <header
            style={{
              border: CADRE,
              borderRadius: 28,
              background: JAUNE,
              boxShadow: `7px 7px 0 ${ENCRE}`,
              padding: 34,
            }}
          >
            <Pastille fond={BLANC}>Signalement &amp; retrait</Pastille>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(30px,4vw,52px)",
                lineHeight: 0.98,
                letterSpacing: "-1.8px",
                margin: "14px 0 0",
                textTransform: "uppercase",
              }}
            >
              Ce qu&apos;on fait quand on nous signale un contenu.
            </h1>
            <p
              style={{
                fontSize: 16,
                fontWeight: 500,
                lineHeight: 1.55,
                maxWidth: 620,
                margin: "14px 0 0",
                opacity: 0.82,
              }}
            >
              Baobart est établie à Abidjan. Ce qui suit applique la loi
              ivoirienne n° 2013-451 du 19 juin 2013, chapitre 6, articles 46 à
              54 — et non le DMCA américain, qui ne s&apos;applique pas ici et
              dont la procédure est différente.
            </p>

            <Link
              href={"/signalement/deposer" as Route}
              className="sticker-press"
              style={{
                display: "inline-block",
                marginTop: 22,
                padding: "14px 26px",
                border: CADRE,
                borderRadius: 16,
                background: ENCRE,
                color: BLANC,
                fontSize: 14.5,
                fontWeight: 800,
              }}
            >
              Déposer une notification
            </Link>
          </header>

          {/* ── Avant de nous écrire ───────────────────────────────────── */}
          <Section titre="Avant de nous écrire, écris à la personne">
            <p style={P}>
              La loi ivoirienne exige quelque chose que la loi américaine ne
              demande pas : que tu aies <strong>d&apos;abord contacté
              l&apos;auteur</strong> du contenu pour lui demander de le retirer,
              de l&apos;interrompre ou de le modifier — ou que tu expliques
              pourquoi tu n&apos;as pas pu le joindre.
            </p>
            <p style={P}>
              Ce n&apos;est pas une formalité. Beaucoup de situations se règlent
              là : un créateur prévenu retire, crédite, ou s&apos;explique. Une
              notification qui n&apos;en fait pas état est incomplète, et nous
              ne pouvons pas la traiter.
            </p>
          </Section>

          {/* ── Les six éléments ───────────────────────────────────────── */}
          <Section titre="Ce que ta notification doit contenir">
            <p style={P}>
              L&apos;article 47 énumère six éléments. Tant qu&apos;il en manque
              un, la loi considère que nous ne « savons » pas — et notre
              obligation d&apos;agir ne commence pas. Le formulaire te dit
              lesquels manquent plutôt que de refuser en bloc.
            </p>

            <ol style={{ margin: "18px 0 0", paddingLeft: 20, display: "grid", gap: 12 }}>
              <Point titre="Qui tu es">
                Personne physique : nom, prénoms, profession, domicile,
                nationalité, date et lieu de naissance. Personne morale :
                dénomination et siège social — <em>et rien d&apos;autre</em>.
              </Point>
              <Point titre="Qui est visé">
                Les nom, prénoms et domicile de la personne dont le contenu est
                en cause, ou sa dénomination et son siège social.
              </Point>
              <Point titre="Ce qui est litigieux">
                La description des faits.
              </Point>
              <Point titre="Où, précisément">
                L&apos;adresse exacte de chaque contenu. « Tout son profil » ne
                localise rien, et nous ne retirerons pas des pages que personne
                n&apos;a regardées.
              </Point>
              <Point titre="Le droit invoqué, et pourquoi il s'applique">
                Droit d&apos;auteur, marque, vie privée, diffamation…
              </Point>
              <Point titre="Ce que tu as écrit à l'auteur">
                La copie de ta demande, ou la justification de ce que tu
                n&apos;as pu le contacter.
              </Point>
            </ol>
          </Section>

          {/* ── Les deux colonnes ──────────────────────────────────────── */}
          <Section titre="Ce que la loi impose, ce que nous promettons en plus">
            <p style={P}>
              Ces deux colonnes n&apos;ont pas la même force. À gauche, ce à
              quoi la loi nous oblige. À droite, ce que nous nous imposons — et
              que nous pourrions changer, en le disant.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
                gap: 16,
                marginTop: 18,
              }}
            >
              <Colonne titre="La loi ivoirienne" fond={MAUVE}>
                <Ligne texte="Agir « promptement » dès que la notification est complète." note="art. 46" />
                <Ligne texte="Aucune obligation de surveiller ce qui est publié." note="art. 50" />
                <Ligne texte="Conserver trois ans les données permettant d'identifier qui a contribué à un contenu." note="art. 53" />
                <Ligne texte="Publier nos propres données d'identification." note="art. 54" />
                <Ligne texte="Appliquer toute mesure prescrite par l'autorité judiciaire." note="art. 52" />
              </Colonne>

              <Colonne titre="Nos engagements" fond={VERT}>
                <Ligne texte="Accuser réception immédiatement, avec une référence de dossier." />
                <Ligne texte={`Examiner la complétude sous ${ENGAGEMENTS.examenHeures} heures.`} />
                <Ligne texte="Dire lequel des six éléments manque, plutôt que de refuser en bloc." />
                <Ligne texte="Prévenir l'auteur par courriel, en reprenant ton motif tel que tu l'as écrit." />
                <Ligne
                  texte={`Lui laisser ${ENGAGEMENTS.reponseJours} jours pour répondre avant que le retrait devienne définitif.`}
                />
                <Ligne texte="Motiver chaque décision par écrit, et la conserver." />
              </Colonne>
            </div>

            <p style={{ ...P, fontSize: 13, opacity: 0.7, marginTop: 16 }}>
              Aucun délai chiffré ne vient de la loi : l&apos;article 46 dit
              « promptement », sans nombre. Les {ENGAGEMENTS.examenHeures} heures
              et les {ENGAGEMENTS.reponseJours} jours sont à nous.
            </p>
          </Section>

          {/* ── Le retrait est provisoire ──────────────────────────────── */}
          <Section titre="« Provisoire » veut dire provisoire">
            <p style={P}>
              Quand une notification est complète, nous retirons le contenu le
              temps de l&apos;examen. Rien n&apos;est supprimé : le contenu
              revient si la notification ne tient pas.
            </p>
            <p style={P}>
              Nous ne jugeons pas qui a raison — nous ne sommes ni juge ni
              expert. Nous décidons si le contenu reste en ligne. Le litige
              lui-même relève du tribunal, et l&apos;article 52 lui donne le
              pouvoir de nous prescrire toute mesure.
            </p>
          </Section>

          {/* ── Contester ─────────────────────────────────────────────── */}
          <Section titre="Si c'est ton contenu qui est visé">
            <p style={P}>
              Tu reçois un courriel — pas seulement une notification dans
              l&apos;application. Il porte la référence du dossier, le motif
              invoqué <em>dans les termes du notifiant</em>, et la date
              limite.
            </p>
            <p style={P}>
              Tu réponds depuis ton tableau de bord. Tu n&apos;as rien à jurer
              ni à prouver à ce stade : tu exposes ta version, et le dossier
              repasse devant un humain. Si tu ne réponds pas avant
              l&apos;échéance, le retrait devient définitif.
            </p>
          </Section>

          {/* ── Article 49 ─────────────────────────────────────────────── */}
          <div
            style={{
              marginTop: 32,
              border: CADRE,
              borderRadius: 24,
              background: ORANGE,
              boxShadow: `6px 6px 0 ${ENCRE}`,
              padding: 30,
            }}
          >
            <Pastille fond={BLANC}>Article 49</Pastille>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 26,
                lineHeight: 1.05,
                margin: "12px 0 0",
                textTransform: "uppercase",
              }}
            >
              Signaler de mauvaise foi est un délit
            </h2>
            <p style={{ ...P, marginTop: 12, color: ENCRE }}>
              « Est puni d&apos;une peine d&apos;emprisonnement de un à cinq ans
              et d&apos;une amende de 1.000.000 à 5.000.000 de francs CFA, le
              fait, pour toute personne de présenter de mauvaise foi […] un
              contenu ou une activité comme étant illicite dans le but
              d&apos;en obtenir le retrait ou d&apos;en faire cesser la
              diffusion. »
            </p>
            <p style={{ ...P, fontSize: 14, marginTop: 12, opacity: 0.85 }}>
              Ce n&apos;est pas une clause que nous ajoutons : c&apos;est la
              loi. Nous l&apos;affichons parce qu&apos;une personne qui hésite
              entre « il m&apos;a copié » et « son travail ressemble au mien »
              a le droit de savoir ce qu&apos;elle signe.
            </p>
          </div>

          {/* ── Récidive ──────────────────────────────────────────────── */}
          <Section titre="Et ceux qui recommencent">
            <p style={P}>
              Un compte dont les contenus font l&apos;objet de retraits
              répétés et tranchés contre lui peut être suspendu. Un notifiant
              qui dépose des notifications manifestement infondées à
              répétition peut se voir refuser l&apos;accès au formulaire —
              sans préjudice de l&apos;article 49.
            </p>
            <p style={{ ...P, fontSize: 13, opacity: 0.7 }}>
              Ces deux mesures sont décidées cas par cas, par un humain, avec
              un motif écrit. Aucun compte n&apos;est suspendu par un compteur.
            </p>
          </Section>

          {/* ── Mentions d'identification — article 54 ─────────────────── */}
          <Section titre="Qui nous sommes">
            <p style={{ ...P, fontSize: 14 }}>
              L&apos;article 54 nous oblige à publier nos données
              d&apos;identification. Baobart — Abidjan, Côte d&apos;Ivoire.
            </p>
            <p style={{ ...P, fontSize: 13, opacity: 0.7 }}>
              Les mentions complètes — forme sociale, registre du commerce,
              capital, directeur de la publication — ne sont pas encore
              renseignées dans l&apos;application. C&apos;est un manque, et il
              est écrit ici plutôt que caché.
            </p>
          </Section>

          <div style={{ marginTop: 36, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href={"/signalement/deposer" as Route}
              className="sticker-press"
              style={{
                padding: "14px 26px",
                border: CADRE,
                borderRadius: 16,
                background: ENCRE,
                color: BLANC,
                fontSize: 14.5,
                fontWeight: 800,
              }}
            >
              Déposer une notification
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

const P: React.CSSProperties = {
  fontSize: 15.5,
  lineHeight: 1.6,
  margin: "0 0 12px",
};

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        marginTop: 26,
        border: CADRE,
        borderRadius: 24,
        background: BLANC,
        boxShadow: `5px 5px 0 ${ENCRE}`,
        padding: 30,
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 24,
          lineHeight: 1.05,
          letterSpacing: "-.5px",
          margin: "0 0 14px",
          textTransform: "uppercase",
        }}
      >
        {titre}
      </h2>
      {children}
    </section>
  );
}

function Point({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <li style={{ fontSize: 15, lineHeight: 1.55 }}>
      <strong>{titre}.</strong> {children}
    </li>
  );
}

function Colonne({
  titre,
  fond,
  children,
}: {
  titre: string;
  fond: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ border: CADRE, borderRadius: 20, background: fond, padding: 22 }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: ".12em",
          marginBottom: 14,
        }}
      >
        {titre}
      </div>
      <div style={{ display: "grid", gap: 12 }}>{children}</div>
    </div>
  );
}

function Ligne({ texte, note }: { texte: string; note?: string }) {
  return (
    <div style={{ fontSize: 14, lineHeight: 1.5, fontWeight: 500 }}>
      {texte}
      {note ? (
        <span
          style={{
            display: "inline-block",
            marginLeft: 8,
            padding: "2px 8px",
            border: CADRE,
            borderRadius: 999,
            background: BLANC,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: ".08em",
          }}
        >
          {note}
        </span>
      ) : null}
    </div>
  );
}

function Pastille({ children, fond }: { children: React.ReactNode; fond: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "6px 14px",
        border: CADRE,
        borderRadius: 999,
        background: fond,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: ".12em",
      }}
    >
      {children}
    </span>
  );
}
