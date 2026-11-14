"use client";

import { useActionState, useState, useTransition } from "react";

import { APLATS, Icone } from "@/components/icones/icone";
import { enregistrerAvis, supprimerAvis, type ReponseAvis } from "@/lib/avis/actions";
import { NOTE_MAX, TEXTE_MAX } from "@/lib/avis/regles";
import { BLANC, ENCRE, JAUNE } from "@/lib/systeme/charte";

/**
 * Noter une ressource, ou modifier son avis.
 *
 * Les étoiles sont un groupe de boutons radio : on les parcourt aux flèches,
 * chacune porte son nom (« 4 étoiles »), et sans JavaScript le formulaire part
 * quand même. Le champ de texte fait 16 px : en dessous, iOS zoome la page à
 * la saisie (règles du design system livré le 09/11).
 */
export function FormulaireAvis({
  produitId,
  monAvis,
}: {
  produitId: string;
  monAvis: { note: number; texte: string | null; compte: boolean } | null;
}) {
  const [etat, envoyer, enCours] = useActionState<ReponseAvis | null, FormData>(enregistrerAvis.bind(null, produitId), null);
  const [note, setNote] = useState<number>(monAvis?.note ?? 0);
  const [retrait, setRetrait] = useState<ReponseAvis | null>(null);
  const [retraitEnCours, retirer] = useTransition();

  return (
    <form action={envoyer} data-formulaire-avis style={{ border: `2.5px solid ${ENCRE}`, borderRadius: 18, background: BLANC, padding: 16 }}>
      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend style={{ fontSize: 14.5, fontWeight: 800, padding: 0 }}>{monAvis ? "Ton avis" : "Noter cette ressource"}</legend>
        {monAvis && !monAvis.compte ? (
          <p role="status" style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.45, margin: "6px 0 0" }}>
            Ton avis ne compte plus dans la note : la ressource ne t&apos;appartient plus (remboursement, contestation ou accès retiré). Tu peux le retirer.
          </p>
        ) : null}
        <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
          {Array.from({ length: NOTE_MAX }, (_, i) => i + 1).map((n) => (
            <label key={n} style={{ cursor: "pointer", lineHeight: 1 }}>
              <input
                type="radio"
                name="note"
                value={n}
                checked={note === n}
                onChange={() => setNote(n)}
                required
                style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
              />
              <span aria-hidden style={{ display: "inline-flex" }}>
                <Icone
                  nom="star"
                  taille={30}
                  aplat={n <= note ? APLATS.jaune : APLATS.lavande}
                  style={n <= note ? undefined : { opacity: 0.5 }}
                />
              </span>
              <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                {n} {n > 1 ? "étoiles" : "étoile"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label style={{ display: "block", marginTop: 12 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>Ton commentaire (facultatif)</span>
        <textarea
          name="texte"
          defaultValue={monAvis?.texte ?? ""}
          maxLength={TEXTE_MAX}
          rows={3}
          style={{ display: "block", width: "100%", marginTop: 6, padding: 10, border: `2px solid ${ENCRE}`, borderRadius: 12, fontSize: 16, fontFamily: "inherit", resize: "vertical" }}
        />
      </label>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 12 }}>
        <button
          type="submit"
          disabled={enCours || note === 0}
          className="sticker-press"
          style={{ padding: "11px 18px", border: `2.5px solid ${ENCRE}`, borderRadius: 13, background: JAUNE, boxShadow: `4px 4px 0 ${ENCRE}`, fontSize: 13.5, fontWeight: 800, cursor: "pointer" }}
        >
          {enCours ? "Envoi…" : monAvis ? "Mettre à jour mon avis" : "Publier mon avis"}
        </button>
        {monAvis ? (
          <button
            type="button"
            disabled={retraitEnCours}
            onClick={() => retirer(async () => setRetrait(await supprimerAvis(produitId)))}
            style={{ padding: "10px 14px", border: `2px solid ${ENCRE}`, borderRadius: 12, background: BLANC, fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}
          >
            Retirer mon avis
          </button>
        ) : null}
        {(retrait ?? etat) ? (
          <span role="status" style={{ fontSize: 12.5, fontWeight: 700 }}>
            {(retrait ?? etat)!.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
