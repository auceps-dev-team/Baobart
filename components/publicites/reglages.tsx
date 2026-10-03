"use client";

import { useActionState, useEffect, useRef } from "react";

import { reglerPublicites, type EtatReglages } from "@/lib/publicites/actions";
import { BORNES, type LimitesPub } from "@/lib/publicites/limites";
import { ECART_MAX, ECART_MIN } from "@/lib/publicites/regles";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE, VERT } from "@/lib/systeme/charte";

/**
 * Les réglages qui valent pour toutes les bannières.
 *
 * L'interrupteur coupe tout d'un geste, sans toucher aux campagnes : c'est ce
 * qu'on cherche le jour où une bannière pose problème et qu'on ne sait pas
 * encore laquelle.
 *
 * Les limites sont repliées : elles se règlent une fois, et se relisent le jour
 * où des chiffres paraissent trop beaux. Le repli s'ouvre de lui-même quand
 * l'une d'elles est refusée — sinon on ne verrait pas laquelle.
 */
export function ReglagesPublicites({
  actives,
  ecartMinimal,
  limites,
}: {
  actives: boolean;
  ecartMinimal: number;
  limites: LimitesPub;
}) {
  const [etat, envoyer, enCours] = useActionState<EtatReglages | null, FormData>(reglerPublicites, null);
  const fautive = etat && !etat.ok ? etat.champ : undefined;

  // Ouvert par le refus, jamais refermé par le succès. Un `open` piloté par
  // l'état refermait le repli après « Enregistré. » — sous les yeux de qui
  // venait de l'ouvrir pour régler une limite.
  const repli = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (fautive && fautive !== "ecartMinimal" && repli.current) repli.current.open = true;
  }, [etat, fautive]);

  return (
    <form
      action={envoyer}
      style={{
        display: "grid",
        gap: 14,
        border: CADRE,
        borderRadius: 20,
        background: BLANC,
        boxShadow: `4px 4px 0 ${ENCRE}`,
        padding: 18,
        maxWidth: 760,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800 }}>Diffusion</div>

      <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, fontWeight: 700 }}>
        <input type="checkbox" name="actives" defaultChecked={actives} style={{ width: 18, height: 18 }} />
        Afficher les bannières dans la mosaïque
      </label>

      <Nombre
        nom="ecartMinimal"
        libelle="Écart minimal entre deux bannières"
        unite="produits"
        min={ECART_MIN}
        max={ECART_MAX}
        valeur={ecartMinimal}
        fautif={fautive === "ecartMinimal"}
        aide="Chaque bannière revient selon sa propre fréquence. Quand deux tombent trop près, la seconde attend : jamais deux bannières à moins de cet écart. Quand deux tombent au même rang, elles alternent."
      />

      <details ref={repli} style={{ borderTop: CADRE, paddingTop: 12 }}>
        <summary style={{ fontSize: 13.5, fontWeight: 800, cursor: "pointer" }}>
          Limites contre le gonflage des chiffres
        </summary>
        <p style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.5, opacity: 0.75, margin: "10px 0 14px" }}>
          Une « adresse » est celle d&apos;une connexion à Internet : un bureau ou une famille
          peuvent en partager une. Le débit ralentit un script ; le plafond l&apos;arrête — au-delà,
          le visiteur arrive toujours à destination, mais son geste ne compte plus jusqu&apos;au
          lendemain.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          <Nombre
            nom="vuesParVisiteurJour"
            libelle="Affichages comptés par visiteur"
            unite="par pub et par jour"
            min={BORNES.vuesParVisiteurJour[0]}
            max={BORNES.vuesParVisiteurJour[1]}
            valeur={limites.vuesParVisiteurJour}
            fautif={fautive === "vuesParVisiteurJour"}
          />
          <Nombre
            nom="clicsParVisiteurJour"
            libelle="Clics comptés par visiteur"
            unite="par pub et par jour"
            min={BORNES.clicsParVisiteurJour[0]}
            max={BORNES.clicsParVisiteurJour[1]}
            valeur={limites.clicsParVisiteurJour}
            fautif={fautive === "clicsParVisiteurJour"}
          />
          <Nombre
            nom="vuesParMinute"
            libelle="Envois d'affichages par adresse"
            unite="par minute"
            min={BORNES.vuesParMinute[0]}
            max={BORNES.vuesParMinute[1]}
            valeur={limites.vuesParMinute}
            fautif={fautive === "vuesParMinute"}
          />
          <Nombre
            nom="clicsParMinute"
            libelle="Clics par adresse"
            unite="par minute"
            min={BORNES.clicsParMinute[0]}
            max={BORNES.clicsParMinute[1]}
            valeur={limites.clicsParMinute}
            fautif={fautive === "clicsParMinute"}
          />
        </div>
      </details>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <button
          type="submit"
          disabled={enCours}
          className="sticker-press"
          style={{
            padding: "10px 18px",
            border: CADRE,
            borderRadius: 13,
            background: JAUNE,
            boxShadow: `3px 3px 0 ${ENCRE}`,
            fontSize: 13,
            fontWeight: 800,
            fontFamily: "inherit",
            color: ENCRE,
            cursor: "pointer",
          }}
        >
          {enCours ? "Un instant…" : "Enregistrer"}
        </button>
        {etat ? (
          <span
            role="status"
            style={{
              padding: "6px 11px",
              border: CADRE,
              borderRadius: 11,
              background: etat.ok ? VERT : ORANGE,
              color: etat.ok ? ENCRE : BLANC,
              fontSize: 12.5,
              fontWeight: 700,
            }}
          >
            {etat.ok ? "Enregistré." : etat.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}

function Nombre({
  nom,
  libelle,
  unite,
  min,
  max,
  valeur,
  fautif,
  aide,
}: {
  nom: string;
  libelle: string;
  unite: string;
  min: number;
  max: number;
  valeur: number;
  fautif: boolean;
  aide?: string;
}) {
  return (
    <label style={{ display: "grid", gap: 6, maxWidth: 420 }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: ".1em",
          color: fautif ? ORANGE : ENCRE,
          opacity: fautif ? 1 : 0.6,
          fontWeight: fautif ? 700 : 400,
        }}
      >
        {libelle}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <input
          type="number"
          name={nom}
          min={min}
          max={max}
          defaultValue={valeur}
          required
          style={{
            width: 90,
            padding: "10px 12px",
            border: CADRE,
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 700,
            fontFamily: "inherit",
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 700 }}>{unite}</span>
      </div>
      {aide ? (
        <span style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.65, lineHeight: 1.45 }}>{aide}</span>
      ) : null}
      <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.55 }}>
        De {min} à {max}.
      </span>
    </label>
  );
}
