"use client";

import { useActionState, useState } from "react";

import { Banniere } from "@/components/publicites/banniere";
import {
  creerPublicite,
  modifierPublicite,
  type EtatFormulairePub,
} from "@/lib/publicites/actions";
import { lienExterieur, FREQUENCE_MAX, FREQUENCE_MIN, FREQUENCE_PAR_DEFAUT, type SaisiePub } from "@/lib/publicites/regles";
import { BLANC, CADRE, ENCRE, GRIS, JAUNE, ORANGE, VERT } from "@/lib/systeme/charte";

/**
 * Créer ou corriger une publicité, en la voyant telle qu'elle paraîtra.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LES MÉDIAS PARTENT TOUT DE SUITE
 *
 * Comme les images du blog : le fichier est déposé dès qu'on le choisit, et
 * ce que le formulaire envoie est son adresse. Corriger le lien ne renvoie pas
 * une vidéo de quinze mégaoctets.
 *
 * Ce que ça implique : un média déposé puis remplacé reste au stockage jusqu'au
 * passage quotidien `/api/cron/medias` (depuis v1.71.5), qui retire ce que
 * plus rien ne cite, vingt-quatre heures après le dépôt.
 */
export function FormulairePublicite({
  pubId,
  depart,
}: {
  /** Absent à la création. */
  pubId?: string;
  depart?: SaisiePub;
}) {
  const action = pubId ? modifierPublicite.bind(null, pubId) : creerPublicite;
  const [etat, envoyer, enCours] = useActionState<EtatFormulairePub | null, FormData>(action, null);

  // Ce que le serveur a renvoyé prime : React vide les champs non contrôlés à
  // la fin d'une action, et une faute de lien effacerait tout le reste.
  const v = etat && !etat.ok ? etat.saisie : depart;
  const faute = etat && !etat.ok ? etat.champ : undefined;

  const [nature, setNature] = useState<"IMAGE" | "VIDEO">(v?.nature === "VIDEO" ? "VIDEO" : "IMAGE");
  const [image, setImage] = useState({
    url: v?.imageUrl ?? "",
    largeur: v?.imageLargeur ?? "",
    hauteur: v?.imageHauteur ?? "",
  });
  const [videoUrl, setVideoUrl] = useState(v?.videoUrl ?? "");
  const [titre, setTitre] = useState(v?.titre ?? "");
  const [lien, setLien] = useState(v?.lien ?? "");

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)",
        gap: 24,
        alignItems: "start",
      }}
    >
      <form action={envoyer} style={{ display: "grid", gap: 16 }}>
        {etat && !etat.ok ? (
          <div role="status" style={{ ...bandeau, background: ORANGE, color: BLANC }}>
            {etat.message}
          </div>
        ) : null}
        {etat?.ok ? (
          <div role="status" style={{ ...bandeau, background: VERT }}>
            Enregistré.
          </div>
        ) : null}

        <Champ label="Nom de la campagne" aide="Lu à voix haute aux personnes qui naviguent avec un lecteur d'écran : écris ce que montre la bannière." faute={faute === "titre"}>
          <input
            name="titre"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            required
            maxLength={80}
            placeholder="Pack wax de la rentrée — moins 20 %"
            style={saisie}
          />
        </Champ>

        <Champ label="Lien" aide="Une page de Baobart (/products/…) ou une adresse en https://. Seul un lien vers une fiche produit permet de compter les ventes." faute={faute === "lien"}>
          <input
            name="lien"
            value={lien}
            onChange={(e) => setLien(e.target.value)}
            required
            maxLength={500}
            placeholder="/products/pack-wax"
            style={saisie}
          />
        </Champ>

        <fieldset style={{ border: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          <legend style={{ ...etiquette, marginBottom: 6 }}>Média</legend>
          <div style={{ display: "flex", gap: 8 }}>
            {(["IMAGE", "VIDEO"] as const).map((n) => (
              <label key={n} style={{ ...choix, background: nature === n ? JAUNE : BLANC }}>
                <input
                  type="radio"
                  name="nature"
                  value={n}
                  checked={nature === n}
                  onChange={() => setNature(n)}
                  style={{ margin: 0 }}
                />
                {n === "IMAGE" ? "Image ou GIF" : "Vidéo"}
              </label>
            ))}
          </div>
        </fieldset>

        <Champ
          label={nature === "VIDEO" ? "Affiche de la vidéo" : "Image"}
          aide={
            nature === "VIDEO"
              ? "L'image montrée avant que la vidéo ne démarre. Elle fixe aussi les proportions de la bannière."
              : "PNG, JPEG, GIF ou WebP, 5 Mo au plus. La bannière garde ses proportions, à la largeur d'une colonne."
          }
          faute={faute === "imageUrl"}
        >
          <input type="hidden" name="imageUrl" value={image.url} />
          <input type="hidden" name="imageLargeur" value={image.largeur} />
          <input type="hidden" name="imageHauteur" value={image.hauteur} />
          <EnvoiMedia
            libelle={image.url ? "Remplacer l'image" : "Envoyer l'image"}
            accept="image/png,image/jpeg,image/gif,image/webp"
            attendu="IMAGE"
            onDepose={(r) => setImage({ url: r.url, largeur: String(r.largeur ?? ""), hauteur: String(r.hauteur ?? "") })}
          />
          {image.url ? (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.65 }}>
              {image.largeur} × {image.hauteur} px
            </span>
          ) : null}
        </Champ>

        {nature === "VIDEO" ? (
          <Champ label="Vidéo" aide="MP4 ou WebM, 20 Mo au plus. Muette, en boucle, et lue seulement quand elle est à l'écran." faute={faute === "videoUrl"}>
            <EnvoiMedia
              libelle={videoUrl ? "Remplacer la vidéo" : "Envoyer la vidéo"}
              accept="video/mp4,video/webm"
              attendu="VIDEO"
              onDepose={(r) => setVideoUrl(r.url)}
            />
          </Champ>
        ) : null}
        {/* Toujours envoyée : la validation l'oublie d'elle-même pour une image. */}
        <input type="hidden" name="videoUrl" value={videoUrl} />

        <Champ
          label="Fréquence"
          aide={`Une bannière tous les combien de produits — de ${FREQUENCE_MIN} à ${FREQUENCE_MAX}. L'écart minimal, réglé sur la liste, passe avant.`}
          faute={faute === "frequence"}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Tous les</span>
            <input
              type="number"
              name="frequence"
              min={FREQUENCE_MIN}
              max={FREQUENCE_MAX}
              defaultValue={v?.frequence ?? String(FREQUENCE_PAR_DEFAUT)}
              required
              style={{ ...saisie, width: 90 }}
            />
            <span style={{ fontSize: 13, fontWeight: 700 }}>produits</span>
          </div>
        </Champ>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Champ label="Début" aide="Vide : tout de suite. Heure d'Abidjan (GMT)." faute={faute === "debut"}>
            <input type="datetime-local" name="debut" defaultValue={v?.debut ?? ""} style={saisie} />
          </Champ>
          <Champ label="Fin" aide="Vide : jusqu'à ce qu'on l'arrête." faute={faute === "fin"}>
            <input type="datetime-local" name="fin" defaultValue={v?.fin ?? ""} style={saisie} />
          </Champ>
        </div>

        <button
          type="submit"
          disabled={enCours}
          className="sticker-press"
          style={{
            justifySelf: "start",
            padding: "13px 24px",
            border: CADRE,
            borderRadius: 14,
            background: JAUNE,
            boxShadow: `4px 4px 0 ${ENCRE}`,
            fontSize: 14,
            fontWeight: 800,
            fontFamily: "inherit",
            cursor: "pointer",
            color: ENCRE,
          }}
        >
          {enCours ? "Un instant…" : pubId ? "Enregistrer" : "Créer la publicité"}
        </button>
      </form>

      <aside style={{ position: "sticky", top: 16, display: "grid", gap: 10 }}>
        <span style={etiquette}>Aperçu, à la largeur d&apos;une colonne</span>
        {image.url && Number(image.largeur) > 0 ? (
          <div style={{ maxWidth: 320 }}>
            <Banniere
              apercu
              pub={{
                id: pubId ?? "apercu",
                titre: titre || "Publicité",
                nature: nature === "VIDEO" && videoUrl ? "VIDEO" : "IMAGE",
                imageUrl: image.url,
                largeur: Number(image.largeur),
                hauteur: Number(image.hauteur),
                videoUrl: nature === "VIDEO" ? videoUrl || null : null,
                exterieure: lienExterieur(lien),
                frequence: FREQUENCE_PAR_DEFAUT,
              }}
            />
          </div>
        ) : (
          <div
            style={{
              maxWidth: 320,
              height: 200,
              border: `2.5px dashed ${ENCRE}`,
              borderRadius: 20,
              display: "grid",
              placeItems: "center",
              fontSize: 13,
              fontWeight: 700,
              opacity: 0.6,
            }}
          >
            L&apos;aperçu paraît ici
          </div>
        )}
      </aside>
    </div>
  );
}

interface Depot {
  url: string;
  nature: "IMAGE" | "VIDEO";
  largeur: number | null;
  hauteur: number | null;
}

/**
 * Envoyer un média, et rendre son adresse.
 *
 * Par `fetch` vers une route, pas par une action serveur : voir l'en-tête de
 * `app/api/pub/media/route.ts` — une action refuse tout au-delà d'un mégaoctet.
 */
function EnvoiMedia({
  libelle,
  accept,
  attendu,
  onDepose,
}: {
  libelle: string;
  accept: string;
  attendu: "IMAGE" | "VIDEO";
  onDepose: (r: Depot) => void;
}) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label
        style={{
          ...choix,
          justifySelf: "start",
          background: enCours ? GRIS : BLANC,
          cursor: enCours ? "progress" : "pointer",
        }}
      >
        {enCours ? "Envoi…" : libelle}
        <input
          type="file"
          // Un filtre de confort, pas une garde : ce sont les premiers octets
          // qui décident, côté serveur.
          accept={accept}
          disabled={enCours}
          style={{ display: "none" }}
          onChange={async (e) => {
            const fichier = e.target.files?.[0];
            // Vidé tout de suite : renvoyer le même fichier après une erreur
            // ne déclencherait sinon aucun événement.
            e.target.value = "";
            if (!fichier) return;

            setErreur(null);
            setEnCours(true);
            try {
              const corps = new FormData();
              corps.set("fichier", fichier);
              const reponse = await fetch("/api/pub/media", { method: "POST", body: corps });
              const r = (await reponse.json().catch(() => null)) as (Depot & { erreur?: string }) | null;

              if (!reponse.ok || !r?.url) {
                setErreur(r?.erreur ?? "Le dépôt a échoué. Réessaie.");
              } else if (r.nature !== attendu) {
                setErreur(attendu === "IMAGE" ? "Ce fichier est une vidéo : il faut ici une image." : "Ce fichier est une image : il faut ici une vidéo.");
              } else {
                onDepose(r);
              }
            } catch {
              setErreur("Le dépôt a échoué. Vérifie ta connexion et réessaie.");
            } finally {
              setEnCours(false);
            }
          }}
        />
      </label>
      {erreur ? (
        <span role="status" style={{ fontSize: 12, fontWeight: 700, color: ORANGE }}>
          {erreur}
        </span>
      ) : null}
    </div>
  );
}

function Champ({
  label,
  aide,
  faute,
  children,
}: {
  label: string;
  aide?: string;
  faute?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <span style={{ ...etiquette, color: faute ? ORANGE : ENCRE, opacity: faute ? 1 : 0.6, fontWeight: faute ? 700 : 400 }}>
        {label}
      </span>
      {children}
      {aide ? <span style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.65, lineHeight: 1.45 }}>{aide}</span> : null}
    </div>
  );
}

const etiquette: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10.5,
  textTransform: "uppercase",
  letterSpacing: ".1em",
  opacity: 0.6,
};

const saisie: React.CSSProperties = {
  width: "100%",
  padding: "11px 13px",
  border: CADRE,
  borderRadius: 12,
  background: BLANC,
  fontSize: 14,
  fontWeight: 600,
  fontFamily: "inherit",
  color: ENCRE,
};

const choix: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 13px",
  border: CADRE,
  borderRadius: 12,
  fontSize: 12.5,
  fontWeight: 800,
  cursor: "pointer",
};

const bandeau: React.CSSProperties = {
  padding: "12px 15px",
  border: CADRE,
  borderRadius: 14,
  fontSize: 13.5,
  fontWeight: 700,
};
