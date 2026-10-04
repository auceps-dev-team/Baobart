"use client";

import { useActionState } from "react";

import { creerCollection, modifierCollection, type EtatCollection } from "@/lib/collections/actions";
import { DESCRIPTION_MAX, TITRE_MAX } from "@/lib/collections/regles";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE, VERT } from "@/lib/systeme/charte";

/** Créer une collection, ou régler la sienne. */
export function FormulaireCollection({
  collectionId,
  depart,
}: {
  collectionId?: string;
  depart?: { titre: string; description: string; publique: boolean };
}) {
  const action = collectionId ? modifierCollection.bind(null, collectionId) : creerCollection;
  const [etat, envoyer, enCours] = useActionState<EtatCollection | null, FormData>(action, null);
  const v = etat && !etat.ok ? etat.saisie : depart;

  return (
    <form action={envoyer} style={{ display: "grid", gap: 12, border: CADRE, borderRadius: 20, background: BLANC, boxShadow: `4px 4px 0 ${ENCRE}`, padding: 18, maxWidth: 560 }}>
      <div style={{ fontSize: 15, fontWeight: 800 }}>{collectionId ? "Régler la collection" : "Nouvelle collection"}</div>
      {etat && !etat.ok ? <Bandeau fond={ORANGE} clair>{etat.message}</Bandeau> : null}
      {etat?.ok ? <Bandeau fond={VERT}>Enregistré.</Bandeau> : null}
      <input name="titre" defaultValue={v?.titre ?? ""} required maxLength={TITRE_MAX} placeholder="Inspiration wax" aria-label="Nom de la collection" style={saisie} />
      <textarea name="description" defaultValue={v?.description ?? ""} maxLength={DESCRIPTION_MAX} rows={2} placeholder="Pour quel projet ? (facultatif)" aria-label="Description" style={{ ...saisie, resize: "vertical" }} />
      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, fontWeight: 700, lineHeight: 1.45 }}>
        <input type="checkbox" name="publique" defaultChecked={v?.publique ?? false} style={{ width: 18, height: 18 }} />
        Publique : tout membre connecté peut la voir. Sinon, toi seul — et les membres d&apos;une communauté si tu la partages avec elle.
      </label>
      <button type="submit" disabled={enCours} className="sticker-press" style={{ justifySelf: "start", padding: "11px 18px", border: CADRE, borderRadius: 13, background: JAUNE, boxShadow: `3px 3px 0 ${ENCRE}`, fontSize: 13.5, fontWeight: 800, fontFamily: "inherit", color: ENCRE, cursor: "pointer" }}>
        {enCours ? "Un instant…" : collectionId ? "Enregistrer" : "Créer la collection"}
      </button>
    </form>
  );
}

function Bandeau({ fond, clair = false, children }: { fond: string; clair?: boolean; children: React.ReactNode }) {
  return (
    <div role="status" style={{ padding: "10px 13px", border: CADRE, borderRadius: 12, background: fond, color: clair ? BLANC : ENCRE, fontSize: 13, fontWeight: 700 }}>
      {children}
    </div>
  );
}

const saisie: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: CADRE,
  borderRadius: 12,
  background: BLANC,
  fontSize: 14,
  fontWeight: 600,
  fontFamily: "inherit",
  color: ENCRE,
};
