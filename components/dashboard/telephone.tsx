"use client";

import { useActionState } from "react";

import { EtapesTelephone } from "@/components/auth/etapes-telephone";
import { BLANC, ENCRE, ORANGE } from "@/components/shell/nav-data";
import type { EtatTelephone } from "@/lib/auth/actions-telephone";

/**
 * Le numéro de téléphone du compte : le prouver, le changer, le retirer.
 *
 * Un numéro n'est enregistré qu'après qu'un code SMS l'a prouvé : il sert alors
 * à se connecter et aux rappels d'abonnement. Il n'y a pas de champ « numéro »
 * qu'on remplirait sans preuve — voir `lib/auth/telephone.ts`.
 */

type Action = (etat: EtatTelephone | null, donnees: FormData) => Promise<EtatTelephone>;

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function PanneauTelephone({
  telephone,
  verifieLe,
  disponible,
  demander,
  confirmer,
  retirer,
}: {
  telephone: string | null;
  verifieLe: Date | null;
  /** Un opérateur SMS utilisable est-il branché ? */
  disponible: boolean;
  demander: Action;
  confirmer: Action;
  retirer: () => Promise<EtatTelephone>;
}) {
  const [etatRetrait, agirRetirer, retraitEnCours] = useActionState<
    EtatTelephone | null,
    FormData
  >(async () => retirer(), null);

  const prouve = telephone !== null && verifieLe !== null;

  return (
    <div>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>
        {prouve
          ? `Ton numéro ${telephone} est vérifié depuis le ${DATE.format(verifieLe)}. Il te permet de te connecter par SMS et reçoit tes rappels d'abonnement.`
          : "Aucun numéro vérifié. Un numéro prouvé par un code SMS te permet de te connecter sans mot de passe, et reçoit tes rappels d'abonnement."}
      </p>

      {prouve ? (
        <form action={agirRetirer} style={{ marginTop: 12 }}>
          <button
            type="submit"
            disabled={retraitEnCours}
            style={{
              padding: "8px 13px",
              border: `2.5px solid ${ENCRE}`,
              borderRadius: 13,
              background: BLANC,
              color: ORANGE,
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Retirer ce numéro
          </button>
          {etatRetrait?.info ? (
            <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 700 }}>{etatRetrait.info}</span>
          ) : null}
        </form>
      ) : null}

      <div style={{ marginTop: 18, maxWidth: 460 }}>
        {disponible ? (
          <EtapesTelephone
            demander={demander}
            verifier={confirmer}
            libelleEnvoi={prouve ? "Changer de numéro" : "Recevoir un code"}
            libelleValidation="Vérifier ce numéro"
          />
        ) : (
          <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>
            {"L'envoi de SMS n'est pas encore branché : la vérification d'un numéro ouvrira dès qu'il le sera."}
          </p>
        )}
      </div>
    </div>
  );
}
