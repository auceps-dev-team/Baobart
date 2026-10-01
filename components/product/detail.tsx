import type { Route } from "next";
import Link from "next/link";

import {
  BLANC,
  ENCRE,
  JAUNE,
  LAVANDE,
  LAVANDE_CLAIR,
  LAVANDE_PROFOND,
  ORANGE,
} from "@/components/shell/nav-data";
import type { MotifRefus } from "@/lib/checkout/achat";
import { texteDuRetour } from "@/lib/checkout/retour";
import { formatCount } from "@/lib/i18n/money";
import { BoutonJaime, BoutonSuivre } from "@/components/social/boutons";
import { Commentaires } from "@/components/social/commentaires";
import type {
  DroitTelechargement,
  FicheProduit,
} from "@/lib/products/queries";
import type { CommentaireRendu } from "@/lib/social/queries";

/**
 * Contenu de la fiche ressource, traduit du bloc « DÉTAIL RESSOURCE » de
 * « Baobart Accueil.dc.html ».
 *
 * Le même contenu sert deux surfaces : la modale ouverte depuis le feed, et la
 * page complète pour un accès direct ou un lien partagé.
 */

const CADRE = `2.5px solid ${ENCRE}`;

function trameDe(id: string): string {
  const teintes = [LAVANDE_PROFOND, JAUNE, ORANGE, LAVANDE, LAVANDE_CLAIR];
  let somme = 0;
  for (let i = 0; i < id.length; i += 1) somme += id.charCodeAt(i);
  const accent = teintes[somme % teintes.length] as string;
  return `repeating-linear-gradient(135deg, ${accent} 0 8px, ${BLANC} 8px 18px)`;
}

function formatPoids(octets: number): string {
  if (octets >= 1024 * 1024) return `${Math.round(octets / (1024 * 1024))} Mo`;
  return `${Math.round(octets / 1024)} Ko`;
}

/**
 * L'avatar, le nom et la ville du créateur — cliquables vers son profil.
 *
 * `minWidth: 0` sur le lien et sur la colonne de texte : sans lui, un nom long
 * pousse « Suivre » hors de la carte au lieu de se laisser tronquer.
 */
function Identite({ auteur }: { auteur: FicheProduit["auteur"] }) {
  const contenu = (
    <>
      <span
        style={{
          width: 40,
          height: 40,
          flex: "0 0 auto",
          border: CADRE,
          borderRadius: 99,
          background: trameDe(auteur.nom),
        }}
      />
      <span style={{ flex: "1 1 auto", minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 800 }}>
          {auteur.nom}
          {auteur.verifie ? " ✓" : ""}
        </span>
        <span
          style={{
            display: "block",
            fontSize: 11.5,
            fontWeight: 600,
            opacity: 0.65,
          }}
        >
          {auteur.role}
        </span>
      </span>
    </>
  );

  const disposition = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flex: "1 1 auto",
    minWidth: 0,
  } as const;

  if (!auteur.username) {
    return <span style={disposition}>{contenu}</span>;
  }

  return (
    <Link
      href={`/@${auteur.username}` as Route}
      style={{ ...disposition, color: ENCRE }}
      title={`Voir le profil de ${auteur.nom}`}
    >
      {contenu}
    </Link>
  );
}

/**
 * Le bouton de retrait, dans les trois situations possibles.
 *
 * Un bouton grisé sur une ressource qu'on possède, ou actif sur une qu'on n'a
 * pas achetée, sont deux mensonges symétriques. Chaque état dit ce qu'il fait.
 */
function BoutonTelechargement({
  droit,
  slug,
}: {
  droit: DroitTelechargement;
  /** Pour mener au choix du moyen de paiement, qui se retrouve par le slug. */
  slug: string;
}) {
  const base = {
    display: "block",
    padding: 14,
    marginTop: 14,
    border: CADRE,
    borderRadius: 14,
    textAlign: "center" as const,
    fontSize: 14.5,
    fontWeight: 800,
  };

  if (droit.etat === "TELECHARGEABLE") {
    // Plusieurs fichiers : autant de liens, chacun nommé. Un ZIP à la volée
    // demanderait de streamer côté serveur ce qui part déjà tout seul.
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {droit.fichiers.map((f, rang) => (
          <a
            key={f.id}
            href={`/api/telechargement/${f.id}`}
            /*
              Pas d'attribut `download`, et c'est délibéré.

              La route ne sert jamais le fichier : elle redirige vers une URL
              signée qui porte déjà `Content-Disposition: attachment` avec le
              vrai nom. La sauvegarde se déclenche donc toute seule, bien
              nommée.

              `download` n'ajoutait rien à ce cas — mais il abîmait l'autre :
              quand la route REFUSE (quota épuisé, commande remboursée), elle
              répond un message en texte brut. Avec `download`, le navigateur
              enregistrait ce message comme un fichier « <id>.txt » qu'on ne
              pouvait ni ouvrir ni comprendre, au lieu de l'afficher.
            */
            className="sticker-press"
            style={{
              ...base,
              marginTop: rang === 0 ? 14 : 0,
              background: ENCRE,
              color: BLANC,
              boxShadow: `4px 4px 0 ${ORANGE}`,
            }}
          >
            {droit.fichiers.length === 1 ? "Télécharger" : `Télécharger ${f.nom}`}
          </a>
        ))}
      </div>
    );
  }

  if (droit.etat === "A_CONNECTER") {
    return (
      <a
        href="/connexion"
        className="sticker-press"
        style={{ ...base, background: JAUNE, color: ENCRE }}
      >
        Se connecter pour télécharger
      </a>
    );
  }

  // À acheter. Le bouton n'apparaît que si un achat peut réellement aboutir :
  // annoncer « Acheter » sans paiement branché promettrait un écran qui
  // n'ouvrirait sur rien.
  if (droit.achatPossible) {
    // Un lien, plus une action. Le rail — Orange Money, Wave, MTN, Moov — doit
    // être choisi AVANT que la commande s'ouvre : c'est lui qui décide de
    // l'invite que l'acheteur recevra sur son téléphone. Le demander après
    // obligerait à rouvrir un paiement déjà ouvert.
    return (
      <Link
        href={`/acheter/${slug}` as Route}
        className="sticker-press"
        style={{
          ...base,
          display: "block",
          width: "100%",
          textAlign: "center",
          background: ENCRE,
          color: BLANC,
          boxShadow: `4px 4px 0 ${ORANGE}`,
        }}
      >
        Acheter — {droit.prix}
      </Link>
    );
  }

  return (
    <div style={{ ...base, background: ENCRE, color: BLANC, opacity: 0.6 }}>
      Paiement bientôt disponible
    </div>
  );
}

/**
 * La couleur de chaque retour d'achat. Le texte, lui, vient du tunnel.
 *
 * Cette table recopiait les messages de `lib/checkout/achat.ts` et en avait
 * perdu trois — CODE_REFUSE, CHAMPS_INVALIDES, MONTANT_REFUSE. Typée sur
 * `string`, elle compilait quand même ; l'acheteur revenait sur la fiche sans
 * un mot (mesuré le 25/09 : P4.3, P5.1, P5.3, S21). Typée sur les motifs, un
 * motif ajouté sans couleur ne compile plus.
 */
const FOND_RETOUR: Record<MotifRefus | "ok", string> = {
  ok: JAUNE,
  DEJA_ACQUISE: JAUNE,
  SA_PROPRE_RESSOURCE: ORANGE,
  SANS_FICHIER: ORANGE,
  GRATUITE: JAUNE,
  EN_COURS: JAUNE,
  CONFLIT: JAUNE,
  PAIEMENT_INDISPONIBLE: ORANGE,
  INTROUVABLE: ORANGE,
  CODE_REFUSE: ORANGE,
  CHAMPS_INVALIDES: ORANGE,
  MONTANT_REFUSE: ORANGE,
};

/** Le retour d'un achat, lu depuis l'URL après la redirection de l'action. */
export function RetourAchat({
  code,
  montant,
  minimum,
}: {
  code: string | undefined;
  montant?: string;
  minimum?: string;
}) {
  const texte = code ? texteDuRetour(code, montant, minimum) : null;
  if (!code || !texte) return null;
  const message = { texte, fond: FOND_RETOUR[code as MotifRefus | "ok"] };

  return (
    <div
      role="status"
      style={{
        margin: "0 0 16px",
        padding: "13px 16px",
        border: CADRE,
        borderRadius: 14,
        background: message.fond,
        color: message.fond === ORANGE ? BLANC : ENCRE,
        fontSize: 13.5,
        fontWeight: 800,
      }}
    >
      {message.texte}
    </div>
  );
}

export interface SocialFiche {
  jaime: boolean;
  likes: number;
  suit: boolean;
  abonnes: number;
  chezSoi: boolean;
  commentaires: number;
  connecte: boolean;
}

export function DetailProduit({
  produit,
  droit,
  social,
  commentaires,
}: {
  produit: FicheProduit;
  droit: DroitTelechargement;
  social: SocialFiche;
  commentaires: CommentaireRendu[];
}) {
  const visuel = produit.coverUrl
    ? `center / cover no-repeat url(${produit.coverUrl})`
    : trameDe(produit.id);

  /*
    Une vidéo ou une nappe sonore sans couverture affichait une trame rayée de
    440 pixels — alors que son extrait, jouable, attendait plus bas. On
    montrait donc un carré vide en haut de la fiche et le vrai média en
    dessous, sous un titre qui n'appelait pas le regard.

    Quand il n'y a pas de couverture mais qu'il y a un extrait, l'extrait
    PREND la place principale. Et il ne se répète pas plus bas : le même
    lecteur deux fois donnerait à croire qu'il y a deux médias.
  */
  const extraitEnPrincipal = !produit.coverUrl && produit.extrait !== null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.35fr .65fr",
        gap: 22,
        padding: 22,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {extraitEnPrincipal && produit.extrait ? (
          <div
            style={{
              border: CADRE,
              borderRadius: 20,
              boxShadow: `5px 5px 0 ${ENCRE}`,
              background: produit.extrait.nature === "video" ? ENCRE : BLANC,
              padding: produit.extrait.nature === "video" ? 0 : 22,
              overflow: "hidden",
              display: "grid",
              placeItems: "center",
              minHeight: produit.extrait.nature === "video" ? 0 : 160,
            }}
          >
            {produit.extrait.nature === "video" ? (
              <video
                src={produit.extrait.url}
                controls
                preload="metadata"
                style={{
                  width: "100%",
                  maxHeight: 440,
                  display: "block",
                  background: ENCRE,
                }}
              />
            ) : (
              <div style={{ width: "100%" }}>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    opacity: 0.65,
                    marginBottom: 12,
                  }}
                >
                  Extrait
                </div>
                <audio
                  src={produit.extrait.url}
                  controls
                  preload="metadata"
                  style={{ width: "100%" }}
                />
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              border: CADRE,
              borderRadius: 20,
              boxShadow: `5px 5px 0 ${ENCRE}`,
              height: 440,
              display: "grid",
              placeItems: "center",
              background: visuel,
            }}
          >
            {produit.coverUrl ? null : (
              <span
                style={{
                  padding: "8px 16px",
                  border: `2px solid ${ENCRE}`,
                  borderRadius: 999,
                  background: BLANC,
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                }}
              >
                {produit.titre}
              </span>
            )}
          </div>
        )}

        {/*
          L'extrait, quand il existe. Une nappe sonore ou un motion design ne se
          juge pas sur une vignette : sans lui, l'acheteur paierait à l'aveugle.
          `preload="metadata"` — on ne télécharge pas l'extrait de toutes les
          fiches ouvertes, seulement sa durée.
        */}
        {produit.extrait && !extraitEnPrincipal ? (
          <div
            style={{
              border: CADRE,
              borderRadius: 20,
              boxShadow: `5px 5px 0 ${ENCRE}`,
              background: BLANC,
              padding: 14,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: ".08em",
                opacity: 0.65,
                marginBottom: 10,
              }}
            >
              Extrait
            </div>

            {produit.extrait.nature === "video" ? (
              <video
                src={produit.extrait.url}
                controls
                preload="metadata"
                style={{ width: "100%", borderRadius: 12, display: "block" }}
              />
            ) : (
              <audio
                src={produit.extrait.url}
                controls
                preload="metadata"
                style={{ width: "100%" }}
              />
            )}
          </div>
        ) : null}

        {produit.duMemeCreateur.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 12,
            }}
          >
            {produit.duMemeCreateur.map((a) => (
              <Link
                key={a.slug}
                href={`/products/${a.slug}`}
                title={a.titre}
                style={{
                  height: 80,
                  border: CADRE,
                  borderRadius: 13,
                  background: a.coverUrl
                    ? `center / cover no-repeat url(${a.coverUrl})`
                    : trameDe(a.slug),
                }}
              />
            ))}
          </div>
        ) : null}

        <Commentaires
          produitId={produit.id}
          commentaires={commentaires}
          total={social.commentaires}
          connecte={social.connecte}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            border: CADRE,
            borderRadius: 20,
            background: BLANC,
            boxShadow: `5px 5px 0 ${ENCRE}`,
            padding: 18,
          }}
        >
          {produit.famille ? (
            <div
              style={{
                display: "inline-block",
                padding: "6px 12px",
                border: `2px solid ${ENCRE}`,
                borderRadius: 999,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
              }}
            >
              {produit.famille}
            </div>
          ) : null}
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 26,
              lineHeight: 1.05,
              letterSpacing: "-.8px",
              marginTop: 12,
            }}
          >
            {produit.titre}
          </div>
          {produit.description ? (
            <p
              style={{
                fontSize: 13.5,
                fontWeight: 500,
                lineHeight: 1.5,
                opacity: 0.75,
                margin: "10px 0 0",
              }}
            >
              {produit.description}
            </p>
          ) : null}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 14,
              paddingTop: 14,
              borderTop: CADRE,
            }}
          >
            {/*
              L'identité mène au profil public — c'était le seul endroit de la
              fiche où le nom du créateur ne conduisait nulle part, alors que
              c'est le geste attendu après avoir aimé son travail.

              Le lien enveloppe l'avatar et le nom, jamais « Suivre » : un
              bouton d'action à l'intérieur d'un lien part sur le profil au
              lieu de faire ce qu'il annonce.

              Sans `username`, il n'y a pas d'adresse à viser — le profil se
              sert par `/@…`, et un compte sans profil n'en a pas. On rend
              alors la même chose, sans lien.
            */}
            <Identite auteur={produit.auteur} />
            <BoutonSuivre
              createurId={produit.auteur.id}
              actifInitial={social.suit}
              totalInitial={social.abonnes}
              chezSoi={social.chezSoi}
            />
          </div>
        </div>

        <div
          style={{
            border: CADRE,
            borderRadius: 20,
            background: JAUNE,
            boxShadow: `5px 5px 0 ${ENCRE}`,
            padding: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div style={{ fontFamily: "var(--font-display)", fontSize: 30 }}>
              {produit.prixAffiche}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
              licence commerciale
            </div>
          </div>
          <BoutonTelechargement droit={droit} slug={produit.slug} />
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <BoutonJaime
              produitId={produit.id}
              actifInitial={social.jaime}
              totalInitial={social.likes}
              pleineLargeur
            />
            {/* Les collections restent à faire : le bouton l'annonce plutôt
                que de faire semblant. */}
            <span
              title="Les collections arrivent bientôt."
              style={{
                flex: "1 1 auto",
                padding: 11,
                border: CADRE,
                borderRadius: 13,
                textAlign: "center",
                fontSize: 13,
                fontWeight: 800,
                background: BLANC,
                opacity: 0.45,
              }}
            >
              ⌸ Collection
            </span>
          </div>
        </div>

        <div
          style={{
            border: CADRE,
            borderRadius: 20,
            background: BLANC,
            padding: 18,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: ".06em",
            }}
          >
            Détails
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 9,
              marginTop: 12,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {[
              ["Format", produit.fichier?.format ?? "—"],
              ["Dimensions", produit.fichier?.dimensions ?? "—"],
              [
                "Poids",
                produit.fichier ? formatPoids(produit.fichier.poids) : "—",
              ],
              ["Téléchargements", formatCount(produit.telechargements)],
              [
                "Ajouté le",
                new Intl.DateTimeFormat("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(produit.publieLe),
              ],
            ].map(([cle, valeur]) => (
              <div
                key={cle}
                style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
              >
                <span style={{ opacity: 0.6 }}>{cle}</span>
                <span>{valeur}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Bandeau de titre, commun à la modale et à la page. */
export function EnTeteFiche({
  titre,
  action,
}: {
  titre: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "18px 22px",
        borderBottom: `3px solid ${ENCRE}`,
        background: BLANC,
        borderRadius: "25px 25px 0 0",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
          textTransform: "uppercase",
          letterSpacing: ".1em",
          opacity: 0.6,
        }}
      >
        Ressource
      </div>
      <div style={{ flex: "1 1 auto", fontSize: 15, fontWeight: 800 }}>{titre}</div>
      {action}
    </div>
  );
}
