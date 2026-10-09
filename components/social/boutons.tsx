"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Eclats } from "@/components/anime/eclats";
import { basculerLike, basculerSuivi } from "@/lib/social/actions";

const ENCRE = "#121212";
const BLANC = "#FFFFFF";
const ORANGE = "#E2622C";
const CADRE = `2.5px solid ${ENCRE}`;

/**
 * J'aime et Suivre.
 *
 * L'affichage bascule avant la réponse du serveur — un cœur qui met 300 ms à
 * se remplir donne l'impression d'avoir raté le clic, et on re-clique. Si le
 * serveur refuse, on remet l'état d'avant et on dit pourquoi : mentir dans
 * l'autre sens serait pire.
 */

function useBascule(
  initialActif: boolean,
  initialTotal: number,
  action: () => Promise<
    { ok: true; actif: boolean; total: number } | { ok: false; message: string }
  >,
) {
  const [actif, setActif] = useState(initialActif);
  const [total, setTotal] = useState(initialTotal);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  // Combien de fois on est passé à « actif » par un clic : la clé des éclats
  // et du cœur qui bat. Zéro au rendu initial — un cœur déjà plein ne bat pas.
  const [salve, setSalve] = useState(0);
  // Le nombre a-t-il changé sous les yeux ? Sans cela, il rebondirait au
  // premier affichage.
  const [abouge, setAbouge] = useState(false);
  const routeur = useRouter();

  function basculer() {
    const avantActif = actif;
    const avantTotal = total;

    setErreur(null);
    setActif(!avantActif);
    setTotal(Math.max(0, avantTotal + (avantActif ? -1 : 1)));
    setAbouge(true);
    if (!avantActif) setSalve((s) => s + 1);

    demarrer(async () => {
      const reponse = await action();

      if (!reponse.ok) {
        setActif(avantActif);
        setTotal(avantTotal);
        setErreur(reponse.message);
        return;
      }

      // Le serveur a le dernier mot : il connaît les likes des autres, pas
      // seulement le nôtre.
      setActif(reponse.actif);
      setTotal(reponse.total);
      routeur.refresh();
    });
  }

  return { actif, total, erreur, enCours, basculer, salve, abouge };
}

/**
 * Le nombre, qui rebondit quand il change (09/10, labo « explorations »).
 * La clé qui change remonte l'élément et relance l'animation.
 */
function Nombre({ total, abouge }: { total: number; abouge: boolean }) {
  if (total <= 0) return null;
  return (
    <>
      {" · "}
      <span key={total} className={abouge ? "rebond" : undefined}>
        {total}
      </span>
    </>
  );
}

export function BoutonJaime({
  produitId,
  actifInitial,
  totalInitial,
  pleineLargeur = false,
}: {
  produitId: string;
  actifInitial: boolean;
  totalInitial: number;
  pleineLargeur?: boolean;
}) {
  const { actif, total, erreur, enCours, basculer, salve, abouge } = useBascule(
    actifInitial,
    totalInitial,
    () => basculerLike(produitId),
  );

  return (
    <span style={{ flex: pleineLargeur ? "1 1 auto" : undefined }}>
      <button
        type="button"
        onClick={basculer}
        disabled={enCours}
        aria-pressed={actif}
        aria-label={actif ? "Retirer mon j'aime" : "J'aime"}
        className="sticker-press"
        style={{
          width: pleineLargeur ? "100%" : undefined,
          padding: 11,
          border: CADRE,
          borderRadius: 13,
          textAlign: "center",
          fontSize: 13,
          fontWeight: 800,
          cursor: enCours ? "wait" : "pointer",
          background: actif ? ORANGE : BLANC,
          // Encre et non blanc sur l'orange : 5,37:1 contre 3,49:1 (calculé
          // le 08/10 au labo « explorations », formule WCAG). L'orange est une
          // surface (charte §4.2) ; le blanc dessus ne passait pas le seuil.
          color: ENCRE,
        }}
      >
        {/* Le cœur bat et éclate quand on aime (09/10, labo « explorations »). */}
        <span style={{ position: "relative", display: "inline-block" }}>
          <span key={salve} className={salve > 0 && actif ? "coeur-bat" : undefined}>
            ♥
          </span>
          {actif ? <Eclats salve={salve} /> : null}
        </span>{" "}
        {actif ? "Aimé" : "J'aime"}
        <Nombre total={total} abouge={abouge} />
      </button>

      {erreur ? <Erreur texte={erreur} /> : null}
    </span>
  );
}

export function BoutonSuivre({
  createurId,
  actifInitial,
  totalInitial,
  chezSoi,
}: {
  createurId: string;
  actifInitial: boolean;
  totalInitial: number;
  chezSoi: boolean;
}) {
  const { actif, total, erreur, enCours, basculer, abouge } = useBascule(
    actifInitial,
    totalInitial,
    () => basculerSuivi(createurId),
  );

  // Se suivre soi-même n'a pas de sens : plutôt qu'un bouton qui refusera, on
  // montre le nombre d'abonnés, qui est ce qui intéresse le créateur.
  if (chezSoi) {
    return (
      <span
        style={{
          padding: "9px 14px",
          border: `2px solid ${ENCRE}`,
          borderRadius: 999,
          fontSize: 12.5,
          fontWeight: 800,
          whiteSpace: "nowrap",
        }}
      >
        {total} abonné{total > 1 ? "s" : ""}
      </span>
    );
  }

  return (
    <span>
      <button
        type="button"
        onClick={basculer}
        disabled={enCours}
        aria-pressed={actif}
        className="sticker-press"
        style={{
          padding: "9px 16px",
          border: CADRE,
          borderRadius: 999,
          fontSize: 12.5,
          fontWeight: 800,
          whiteSpace: "nowrap",
          cursor: enCours ? "wait" : "pointer",
          background: actif ? ENCRE : "#FFD84A",
          color: actif ? BLANC : ENCRE,
        }}
      >
        {/* Le libellé glisse d'un état à l'autre (09/10, adapté d'Animata
            `text/swap-text`, voir components/labo/explorations/panier.tsx).
            Les deux lignes visuelles sont cachées aux lecteurs d'écran : ils
            n'entendent que l'état vrai, une fois. */}
        <span className="sr-only">{actif ? "Abonné" : "Suivre"}</span>
        <span aria-hidden className="bascule" data-actif={actif || undefined}>
          <span>Suivre</span>
          <span>Abonné</span>
        </span>
        <Nombre total={total} abouge={abouge} />
      </button>

      {erreur ? <Erreur texte={erreur} /> : null}
    </span>
  );
}

function Erreur({ texte }: { texte: string }) {
  return (
    <span
      role="alert"
      style={{
        display: "block",
        marginTop: 6,
        fontSize: 11.5,
        fontWeight: 700,
        color: "#B34A1F",
      }}
    >
      {texte}
    </span>
  );
}
