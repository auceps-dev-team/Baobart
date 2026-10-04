"use client";

import { useActionState } from "react";

import { traiterMessage, type EtatTraitement } from "@/lib/contact/actions";
import { CADRE, ENCRE, JAUNE } from "@/lib/systeme/charte";

/** « Marquer traité » sous un message reçu. La réponse, elle, part de la messagerie de l'équipe. */
export function BoutonTraiter({ id }: { id: string }) {
  const [etat, agir, enCours] = useActionState<EtatTraitement | null, FormData>(async () => traiterMessage(id), null);

  return (
    <form action={agir} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 12 }}>
      <button type="submit" disabled={enCours} style={{ padding: "9px 14px", border: CADRE, borderRadius: 12, background: JAUNE, color: ENCRE, fontSize: 13, fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }}>
        {enCours ? "Un instant…" : "Marquer traité"}
      </button>
      {etat && !etat.ok ? <span style={{ fontSize: 12.5, fontWeight: 700, color: "#E2622C" }}>{etat.message}</span> : null}
    </form>
  );
}
