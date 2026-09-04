"use client";

import { useActionState } from "react";

import { deposerService, type EtatDepot } from "@/lib/services/actions";
import type { CategorieChoix } from "@/lib/services/queries";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE, VERT } from "@/lib/systeme/charte";

/**
 * Le formulaire de dépôt d'un service.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL NE VALIDE RIEN
 *
 * `lib/services/validation.ts` est autorité. `required`, `min`, `max` ici ne
 * sont qu'un confort — un formulaire se contourne, la seule barrière est côté
 * serveur.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LA SAISIE REVIENT AVEC LE REFUS
 *
 * Comme pour Jobs. Refaire écrire une description de deux mille signes pour un
 * prix mal tapé fait partir le créateur.
 */
export function FormulaireService({ categories }: { categories: CategorieChoix[] }) {
  const [etat, envoyer, enCours] = useActionState<EtatDepot | null, FormData>(
    deposerService,
    null,
  );

  const saisie = etat && !etat.ok ? etat.saisie : null;

  if (etat?.ok) {
    return (
      <div
        style={{
          border: CADRE,
          borderRadius: 24,
          background: VERT,
          boxShadow: `6px 6px 0 ${ENCRE}`,
          padding: 28,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            textTransform: "uppercase",
          }}
        >
          Ton service est parti en relecture
        </div>
        <p style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.55, marginTop: 10 }}>
          Il paraîtra dès qu&apos;il aura été lu — compte un jour ou deux.
          Inutile de le redéposer : il est déjà dans la file.
        </p>
      </div>
    );
  }

  const refus = etat && !etat.ok ? etat : null;

  return (
    <form
      action={envoyer}
      style={{
        border: CADRE,
        borderRadius: 24,
        background: BLANC,
        boxShadow: `6px 6px 0 ${ENCRE}`,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      {refus ? (
        <div
          role="alert"
          style={{
            padding: "12px 15px",
            border: CADRE,
            borderRadius: 14,
            background: ORANGE,
            color: BLANC,
            fontSize: 13.5,
            fontWeight: 700,
            lineHeight: 1.5,
          }}
        >
          {refus.message}
        </div>
      ) : null}

      <Champ label="Intitulé du service" pour="titre">
        <input
          id="titre"
          name="titre"
          required
          minLength={6}
          maxLength={120}
          defaultValue={saisie?.titre ?? ""}
          placeholder="Charte graphique complète en 10 jours"
          style={entree}
        />
      </Champ>

      <Champ
        label="La prestation"
        pour="description"
        aide="Ce qui est inclus, ce qui ne l'est pas, ce que tu attends de l'acheteur. Une description trop courte est refusée : l'acheteur qui commande veut savoir ce qu'il reçoit."
      >
        <textarea
          id="description"
          name="description"
          required
          minLength={60}
          maxLength={8000}
          rows={9}
          defaultValue={saisie?.description ?? ""}
          style={{ ...entree, resize: "vertical" }}
        />
      </Champ>

      <Champ label="Catégorie" pour="categoryId">
        <select
          id="categoryId"
          name="categoryId"
          required
          defaultValue={saisie?.categoryId ?? ""}
          style={entree}
        >
          <option value="" disabled>
            Choisis une catégorie…
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Champ>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: 14,
        }}
      >
        <Champ
          label="Prix de départ (F CFA)"
          pour="startingPrice"
          aide="À partir de. Tu peux affiner par devis."
        >
          <input
            id="startingPrice"
            name="startingPrice"
            required
            inputMode="numeric"
            pattern="[0-9]+"
            defaultValue={saisie?.startingPrice ?? ""}
            placeholder="180000"
            style={entree}
          />
        </Champ>

        <Champ
          label="Délai annoncé (jours)"
          pour="deliveryDays"
          aide="Combien de jours entre la commande et la livraison."
        >
          <input
            id="deliveryDays"
            name="deliveryDays"
            required
            inputMode="numeric"
            pattern="[0-9]+"
            defaultValue={saisie?.deliveryDays ?? ""}
            placeholder="10"
            style={entree}
          />
        </Champ>
      </div>

      <button
        type="submit"
        disabled={enCours}
        className="sticker-press"
        style={{
          padding: "15px 26px",
          border: CADRE,
          borderRadius: 15,
          background: JAUNE,
          boxShadow: `5px 5px 0 ${ENCRE}`,
          fontSize: 15,
          fontWeight: 800,
          cursor: enCours ? "wait" : "pointer",
          fontFamily: "inherit",
          color: ENCRE,
        }}
      >
        {enCours ? "Envoi…" : "Envoyer en relecture"}
      </button>
    </form>
  );
}

const entree = {
  width: "100%",
  padding: "13px 15px",
  border: CADRE,
  borderRadius: 14,
  background: "#F4EEFC",
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: 500,
  outline: "none",
  color: ENCRE,
} as const;

function Champ({
  label,
  pour,
  aide,
  children,
}: {
  label: string;
  pour: string;
  aide?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={pour}
        style={{
          display: "block",
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: ".12em",
          opacity: 0.6,
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      {children}
      {aide ? (
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1.45,
            marginTop: 6,
            opacity: 0.7,
            textWrap: "pretty",
          }}
        >
          {aide}
        </div>
      ) : null}
    </div>
  );
}
