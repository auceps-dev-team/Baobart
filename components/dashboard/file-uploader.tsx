"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import {
  EXTENSIONS_ANNONCEES,
  formatPoids,
  verifierEnvoi,
} from "@/lib/upload/formats";
import {
  confirmerFichier,
  retirerFichier,
  reserverFichier,
} from "@/lib/upload/actions";

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const JAUNE = "#FFD84A";
const ORANGE = "#E2622C";
const ORANGE_SOMBRE = "#B34A1F";
const CADRE = `2.5px solid ${ENCRE}`;

const TRAME = `repeating-linear-gradient(135deg,${BLANC} 0 8px,${ENCRE} 8px 18px)`;

export interface FichierAttache {
  id: string;
  nom: string;
  taille: number;
}

/** Un envoi en cours : il n'a pas encore d'identifiant en base. */
interface EnCours {
  cle: string;
  nom: string;
  taille: number;
  progression: number;
}

/**
 * Zone de dépôt des fichiers d'une ressource.
 *
 * Le fichier part **directement au stockage** : il ne traverse pas Next. C'est
 * ce qui permet d'annoncer 200 Mo sans faire tomber le serveur, et ce qui donne
 * une barre de progression honnête — l'octet compté est l'octet parti.
 */
export function FileUploader({
  produitId,
  fichiersInitiaux,
  couvertureInitiale,
}: {
  produitId: string;
  fichiersInitiaux: FichierAttache[];
  couvertureInitiale: string | null;
}) {
  const [fichiers, setFichiers] = useState<FichierAttache[]>(fichiersInitiaux);
  const [enCours, setEnCours] = useState<EnCours[]>([]);
  const [couverture, setCouverture] = useState(couvertureInitiale);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [survol, setSurvol] = useState(false);
  const [suppression, demarrerSuppression] = useTransition();

  /*
    L'affichage avance sans attendre le serveur — un fichier envoyé apparaît
    aussitôt. Mais dès que le serveur renvoie sa version, c'est elle qui
    l'emporte : lui seul sait quel aperçu a réellement été produit.
  */
  // Comparé sur une signature, pas sur la référence : le serveur reconstruit le
  // tableau à chaque rendu, et une simple égalité de référence remettrait l'état
  // à zéro pour rien.
  const signatureServeur = `${couvertureInitiale ?? ""}|${fichiersInitiaux
    .map((f) => f.id)
    .join(",")}`;

  const [derniereVueServeur, setDerniereVueServeur] = useState(signatureServeur);

  if (derniereVueServeur !== signatureServeur) {
    setDerniereVueServeur(signatureServeur);
    setFichiers(fichiersInitiaux);
    setCouverture(couvertureInitiale);
  }

  const champ = useRef<HTMLInputElement>(null);
  const routeur = useRouter();

  /**
   * Le récapitulatif au-dessus — sources, dimensions, poids — est rendu par le
   * serveur à partir des fichiers. Il faut donc le redemander, sinon il annonce
   * « 600 × 400 » pour une ressource dont on vient de retirer l'image.
   */
  function rafraichirLeRecapitulatif() {
    routeur.refresh();
  }

  function signaler(message: string) {
    setErreurs((precedentes) => [...precedentes, message]);
  }

  async function envoyer(fichier: File) {
    // Premier filtre côté navigateur : refuser tout de suite évite un aller-retour
    // et une attente pour rien. Le serveur revérifiera, il ne fait confiance à
    // personne.
    const verdict = verifierEnvoi({
      nom: fichier.name,
      taille: fichier.size,
      mimeDeclare: fichier.type,
    });

    if (!verdict.accepte || !verdict.format) {
      signaler(`${fichier.name} — ${verdict.message}`);
      return;
    }

    const cle = `${fichier.name}-${Date.now()}-${Math.random()}`;
    setEnCours((liste) => [
      ...liste,
      { cle, nom: fichier.name, taille: fichier.size, progression: 0 },
    ]);

    const retirerDeLaListe = () =>
      setEnCours((liste) => liste.filter((e) => e.cle !== cle));

    const reservation = await reserverFichier(produitId, {
      nom: fichier.name,
      taille: fichier.size,
      mime: fichier.type,
    });

    if (!reservation.ok) {
      retirerDeLaListe();
      signaler(`${fichier.name} — ${reservation.message}`);
      return;
    }

    try {
      await deposer(reservation.url, fichier, verdict.format.mime, (part) => {
        setEnCours((liste) =>
          liste.map((e) => (e.cle === cle ? { ...e, progression: part } : e)),
        );
      });
    } catch {
      retirerDeLaListe();
      signaler(`${fichier.name} — l'envoi s'est interrompu. Réessaie.`);
      return;
    }

    const confirmation = await confirmerFichier(
      produitId,
      reservation.reservationId,
    );

    retirerDeLaListe();

    if (!confirmation.ok) {
      signaler(`${fichier.name} — ${confirmation.message}`);
      return;
    }

    setFichiers((liste) => [...liste, confirmation.fichier]);
    if (confirmation.couverture) setCouverture(confirmation.couverture);
    rafraichirLeRecapitulatif();
  }

  function accepter(liste: FileList | null) {
    setErreurs([]);
    if (!liste) return;
    for (const fichier of Array.from(liste)) void envoyer(fichier);
  }

  function retirer(fichierId: string) {
    setErreurs([]);

    demarrerSuppression(async () => {
      const reponse = await retirerFichier(produitId, fichierId);
      if (!reponse.ok) {
        signaler(reponse.message ?? "Suppression impossible.");
        return;
      }

      setFichiers((liste) => liste.filter((f) => f.id !== fichierId));

      // La couverture disparaît avec le dernier aperçu. Le serveur en désigne
      // peut-être un autre : c'est le rafraîchissement qui tranche.
      setCouverture(null);
      rafraichirLeRecapitulatif();
    });
  }

  const poidsTotal = fichiers.reduce((somme, f) => somme + f.taille, 0);

  return (
    <div style={{ maxWidth: 640 }}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSurvol(false);
          accepter(e.dataTransfer.files);
        }}
        onClick={() => champ.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") champ.current?.click();
        }}
        style={{
          border: `2.5px dashed ${ENCRE}`,
          borderRadius: 20,
          padding: 26,
          textAlign: "center",
          background: survol ? JAUNE : BLANC,
          cursor: "pointer",
          transition: "background .12s ease",
        }}
      >
        <div
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 12,
            opacity: 0.7,
          }}
        >
          glisse tes fichiers ici
        </div>

        <div
          style={{
            height: 120,
            marginTop: 16,
            border: CADRE,
            borderRadius: 14,
            background: couverture
              ? `center / cover no-repeat url(${couverture})`
              : TRAME,
          }}
        />

        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 14 }}>
          {EXTENSIONS_ANNONCEES.join(" · ")} — 200 Mo max
        </div>
      </div>

      <input
        ref={champ}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          accepter(e.target.files);
          // Sans cette remise à zéro, renvoyer le même fichier après un échec
          // ne déclenche aucun événement.
          e.target.value = "";
        }}
      />

      {erreurs.map((message) => (
        <p
          key={message}
          role="alert"
          style={{
            marginTop: 12,
            fontSize: 13,
            fontWeight: 700,
            color: ORANGE_SOMBRE,
          }}
        >
          {message}
        </p>
      ))}

      {enCours.map((e) => (
        <div
          key={e.cle}
          style={{
            marginTop: 12,
            border: CADRE,
            borderRadius: 14,
            background: BLANC,
            padding: "12px 14px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {e.nom}
            </span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11 }}>
              {Math.round(e.progression * 100)} %
            </span>
          </div>

          <div
            style={{
              marginTop: 8,
              height: 10,
              border: `2px solid ${ENCRE}`,
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.max(3, e.progression * 100)}%`,
                background: e.progression >= 1 ? ENCRE : JAUNE,
                transition: "width .18s linear",
              }}
            />
          </div>

          {e.progression >= 1 ? (
            <p
              style={{
                margin: "8px 0 0",
                fontFamily: "'Space Mono', monospace",
                fontSize: 10.5,
                opacity: 0.65,
              }}
            >
              vérification et aperçu…
            </p>
          ) : null}
        </div>
      ))}

      {fichiers.length > 0 ? (
        <>
          <div
            style={{
              marginTop: 18,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {fichiers.map((f) => (
              <div
                key={f.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  border: CADRE,
                  borderRadius: 14,
                  background: BLANC,
                  boxShadow: `4px 4px 0 ${ENCRE}`,
                  padding: "12px 14px",
                }}
              >
                <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 13.5,
                      fontWeight: 800,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.nom}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontFamily: "'Space Mono', monospace",
                      fontSize: 11,
                      opacity: 0.6,
                    }}
                  >
                    {formatPoids(f.taille)}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() => retirer(f.id)}
                  disabled={suppression}
                  style={{
                    padding: "8px 14px",
                    border: `2px solid ${ENCRE}`,
                    borderRadius: 10,
                    background: BLANC,
                    fontSize: 12.5,
                    fontWeight: 800,
                    color: ORANGE_SOMBRE,
                    cursor: suppression ? "wait" : "pointer",
                  }}
                >
                  Retirer
                </button>
              </div>
            ))}
          </div>

          <p
            style={{
              marginTop: 12,
              fontFamily: "'Space Mono', monospace",
              fontSize: 11,
              opacity: 0.65,
            }}
          >
            {fichiers.length} fichier{fichiers.length > 1 ? "s" : ""} ·{" "}
            {formatPoids(poidsTotal)}
            {couverture ? "" : " · aucun aperçu"}
          </p>
        </>
      ) : null}

      {fichiers.length === 0 && enCours.length === 0 ? (
        <p
          style={{
            marginTop: 12,
            fontSize: 13,
            fontWeight: 700,
            color: ORANGE,
          }}
        >
          Aucun fichier attaché : un acheteur n&apos;aurait rien à télécharger.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Dépose le fichier sur l'URL signée en rapportant l'avancement.
 *
 * `XMLHttpRequest` plutôt que `fetch` : c'est encore la seule façon d'obtenir
 * la progression d'un envoi dans tous les navigateurs.
 */
function deposer(
  url: string,
  fichier: File,
  contentType: string,
  avance: (part: number) => void,
): Promise<void> {
  return new Promise((tenu, rompu) => {
    const requete = new XMLHttpRequest();
    requete.open("PUT", url, true);
    // Le type est figé dans la signature : en envoyer un autre l'invalide.
    requete.setRequestHeader("Content-Type", contentType);

    requete.upload.onprogress = (e) => {
      if (e.lengthComputable) avance(e.loaded / e.total);
    };

    requete.onload = () => {
      if (requete.status >= 200 && requete.status < 300) {
        avance(1);
        tenu();
      } else {
        rompu(new Error(`stockage: ${requete.status}`));
      }
    };

    requete.onerror = () => rompu(new Error("réseau"));
    requete.onabort = () => rompu(new Error("interrompu"));

    requete.send(fichier);
  });
}
