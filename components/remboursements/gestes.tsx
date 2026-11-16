"use client";

import { useActionState, useState } from "react";

import { sansRemiseAZero } from "@/lib/formulaires/sans-remise";

import { changerDelaiDeRemboursement, demanderRemboursement, trancherDemande, type EtatGeste } from "@/lib/remboursements/actions";

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const JAUNE = "#FFD84A";
const ORANGE = "#E2622C";
const CADRE = `2.5px solid ${ENCRE}`;

const bouton: React.CSSProperties = {
  padding: "10px 16px",
  border: CADRE,
  borderRadius: 12,
  fontSize: 13,
  fontWeight: 800,
  fontFamily: "inherit",
  color: ENCRE,
  cursor: "pointer",
};

const saisie: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: CADRE,
  borderRadius: 12,
  fontSize: 13.5,
  fontWeight: 600,
  fontFamily: "inherit",
  resize: "vertical",
  background: BLANC,
  color: ENCRE,
};

function Retour({ etat }: { etat: EtatGeste | null }) {
  if (!etat) return null;
  return (
    <p role={etat.ok ? "status" : "alert"} style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: etat.ok ? ENCRE : ORANGE }}>
      {etat.message}
    </p>
  );
}

/** Côté acheteur : demander, avec un motif. */
export function FormulaireDemande({ orderItemId }: { orderItemId: string }) {
  const [etat, envoyer, enCours] = useActionState<EtatGeste | null, FormData>(demanderRemboursement.bind(null, orderItemId), null);
  const [ouvert, setOuvert] = useState(false);
  if (etat?.ok) return <Retour etat={etat} />;

  return ouvert ? (
    <form action={envoyer} data-demande={orderItemId} style={{ display: "grid", gap: 8, maxWidth: 560 }}>
      <textarea name="motif" required minLength={10} rows={3} placeholder="Ce qui ne va pas — le créateur le lira." style={saisie} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="submit" disabled={enCours} style={{ ...bouton, background: JAUNE }}>
          {enCours ? "Un instant…" : "Envoyer la demande"}
        </button>
        <button type="button" onClick={() => setOuvert(false)} style={{ ...bouton, background: BLANC }}>
          Annuler
        </button>
      </div>
      <Retour etat={etat} />
    </form>
  ) : (
    <button type="button" data-ouvrir-demande={orderItemId} onClick={() => setOuvert(true)} style={{ ...bouton, background: BLANC }}>
      Demander un remboursement
    </button>
  );
}

/** Côté créateur et support : accepter, ou refuser avec un motif. */
export function DecisionDemande({ demandeId }: { demandeId: string }) {
  const [accord, accepter, enAccord] = useActionState<EtatGeste | null, FormData>(trancherDemande.bind(null, demandeId, "ACCEPTER"), null);
  const [refus, refuser, enRefus] = useActionState<EtatGeste | null, FormData>(trancherDemande.bind(null, demandeId, "REFUSER"), null);
  const [motifOuvert, setMotifOuvert] = useState(false);
  // Rembourser, c'est sortir de l'argent : le geste se confirme, comme le
  // refus demande son motif. Mesuré par la recette du 14/11/2026 (Q-08, et
  // Q-40 côté équipe) : le remboursement partait au premier appui, d'un
  // bouton collé à « Refuser ».
  const [aConfirmer, setAConfirmer] = useState(false);
  const fini = accord?.ok ? accord : refus?.ok ? refus : null;
  if (fini) return <Retour etat={fini} />;

  return (
    <div data-decision={demandeId} style={{ display: "grid", gap: 8, marginTop: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          aria-expanded={aConfirmer}
          onClick={() => {
            setAConfirmer((o) => !o);
            setMotifOuvert(false);
          }}
          style={{ ...bouton, background: JAUNE }}
        >
          Rembourser
        </button>
        <button
          type="button"
          aria-expanded={motifOuvert}
          onClick={() => {
            setMotifOuvert((o) => !o);
            setAConfirmer(false);
          }}
          style={{ ...bouton, background: BLANC }}
        >
          Refuser
        </button>
      </div>
      {aConfirmer ? (
        <form action={accepter} style={{ display: "grid", gap: 8, maxWidth: 560 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
            L&apos;acheteur est remboursé tout de suite, et la somme est reprise sur les gains de cette vente. Ce geste ne s&apos;annule pas.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button type="submit" disabled={enAccord} style={{ ...bouton, background: JAUNE }}>
              {enAccord ? "Un instant…" : "Confirmer le remboursement"}
            </button>
            <button type="button" onClick={() => setAConfirmer(false)} style={{ ...bouton, background: BLANC }}>
              Annuler
            </button>
          </div>
        </form>
      ) : null}
      {motifOuvert ? (
        <form action={refuser} style={{ display: "grid", gap: 8, maxWidth: 560 }}>
          <textarea name="motif" required minLength={8} rows={2} placeholder="Pourquoi — l'acheteur le lira." style={saisie} />
          <button type="submit" disabled={enRefus} style={{ ...bouton, background: BLANC, justifySelf: "start" }}>
            {enRefus ? "Un instant…" : "Envoyer le refus"}
          </button>
        </form>
      ) : null}
      <Retour etat={accord && !accord.ok ? accord : refus && !refus.ok ? refus : null} />
    </div>
  );
}

/** Le délai du créateur, pour les achats à venir. */
export function ReglageDelai({ actuel, delais }: { actuel: number; delais: readonly number[] }) {
  const [etat, envoyer, enCours] = useActionState<EtatGeste | null, FormData>(changerDelaiDeRemboursement, null);
  return (
    // Sans remise à zéro : la liste réaffichait « 30 jours » sous le message
    // « Délai réglé à 7 jours » jusqu'au rechargement (Q-38, 14/11/2026).
    <form action={envoyer} onSubmit={sansRemiseAZero(envoyer)} data-delai style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
      <select name="jours" defaultValue={String(actuel)} aria-label="Délai de remboursement" style={{ ...saisie, width: "auto", resize: undefined }}>
        {delais.map((d) => (
          <option key={d} value={d}>
            {d === 0 ? "Aucun remboursement" : `${d} jours`}
          </option>
        ))}
      </select>
      <button type="submit" disabled={enCours} style={{ ...bouton, background: JAUNE }}>
        {enCours ? "Un instant…" : "Enregistrer"}
      </button>
      <Retour etat={etat} />
    </form>
  );
}
