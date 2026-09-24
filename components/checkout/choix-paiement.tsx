"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import type { ApercuCode } from "@/lib/commerce/actions-promo";
import type { ChampDeclare } from "@/lib/commerce/champs";
import {
  PAYS,
  demandeLeTelephone,
  motDuTelephone,
  paysDe,
  railValide,
  railsDe,
} from "@/lib/payments/rails";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE } from "@/lib/systeme/charte";

/** La lavande claire de la charte, pour les fonds secondaires. */
const LAVANDE_CLAIR = "#F4EEFC";

/**
 * Le choix du moyen de paiement — étape 1 sur 2.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * IL NE DÉCIDE RIEN D'IRRÉVERSIBLE
 *
 * Rien n'est débité ici : cet écran choisit **où** l'acheteur va valider, pas
 * s'il paie. Le montant ne bouge qu'après sa confirmation chez l'opérateur.
 * C'est ce que dit le sous-titre, et ce n'est pas une formule rassurante — c'est
 * la mécanique réelle du mobile money.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA GARDE N'EST PAS ICI
 *
 * Ce composant construit un formulaire. Le refus vit dans `acheterRessource`,
 * qui relit tout depuis la session et la base : le rail transmis n'est
 * qu'indicatif, et un rail inventé est ignoré plutôt que suivi.
 *
 * Traduit de « Baobart Parcours Achat.dc.html », écran `pay`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * IL NE SAIT PAS CE QU'ON PAIE
 *
 * L'action arrive déjà liée à son sujet — une ressource, un abonnement. Cet
 * écran ne connaît donc ni produit ni abonnement : il choisit un rail et
 * soumet. C'est ce qui permet d'avoir UN seul sélecteur de paiement plutôt
 * qu'un par tunnel, avec la certitude que les deux proposent les mêmes rails et
 * demandent le numéro dans les mêmes cas.
 */

export function ChoixPaiement({
  action,
  operateur,
  prixFormate,
  produitId,
  apercu,
  champs = [],
  montantLibre = null,
  pourboiresOuverts = false,
}: {
  /** Déjà liée à son sujet par l'appelant. Le refus vit dedans, pas ici. */
  action: (donnees: FormData) => Promise<void>;
  /** Le pilote actif : il décide si le numéro est demandé. */
  operateur: string;
  prixFormate: string;
  /**
   * La ressource achetée, quand il y en a une.
   *
   * Absente au renouvellement d'abonnement, qui emprunte le même formulaire
   * sans avoir de ressource à remiser. Un code promo s'applique à une vente,
   * pas à une échéance — et `OfferCode.durationDays`, qui existe pour les
   * abonnements, relève d'un autre chemin.
   */
  produitId?: string;
  /** Évalue un code sans rien consommer, pour l'afficher avant validation. */
  apercu?: (produitId: string, code: string) => Promise<ApercuCode>;
  /** Les questions que le créateur pose à l'achat. Vide s'il n'en pose pas. */
  champs?: ChampDeclare[];
  /** Ce que l'acheteur décide du montant, quand il décide quelque chose. */
  montantLibre?: {
    /** Le minimum accepté, plancher de la plateforme compris. */
    minimum: number;
    /** Les montants proposés en un clic. */
    suggeres: number[];
  } | null;
  /** Vrai quand le créateur invite un pourboire. */
  pourboiresOuverts?: boolean;
}) {
  const [montant, setMontant] = useState(
    montantLibre ? String(montantLibre.suggeres[0] ?? montantLibre.minimum) : "",
  );
  const [pourboire, setPourboire] = useState("");

  const [codePromo, setCodePromo] = useState("");
  const [remise, setRemise] = useState<ApercuCode | null>(null);
  const [verifieEnCours, transitionCode] = useTransition();

  const [pays, setPays] = useState("CI");
  const [rail, setRail] = useState("om");
  const [telephone, setTelephone] = useState("");

  const disponibles = railsDe(pays);
  const choisi = railValide(pays, rail);
  const infoPays = paysDe(pays);
  const veutLeNumero = demandeLeTelephone(operateur, choisi);
  const motNumero = motDuTelephone(operateur, choisi);

  const manqueLeNumero = veutLeNumero && telephone.trim().length < 8;

  function changerPays(code: string) {
    setPays(code);
    // Le rail choisi peut ne pas exister dans le nouveau pays. Le garder
    // laisserait un choix invisible et un paiement qui échoue sans raison
    // affichée.
    setRail(railValide(code, rail));
  }

  return (
    <form
      action={action}
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      {/*
        Le rail voyage par le formulaire, pas par un appel direct. Deux
        raisons : l'action garde ainsi la même signature que celle du bouton de
        la fiche, et le geste reste un envoi de formulaire — donc traçable,
        annulable, et compréhensible sans JavaScript.

        Ce que l'acheteur choisit n'est qu'indicatif : l'action revalide le
        rail contre la liste connue, et ignore un nom inventé.
      */}
      <input type="hidden" name="moyen" value={choisi} />
      <input type="hidden" name="pays" value={pays} />

      {/*
        ══════════════════════════════════════════════════════════════════════
        L'APERÇU DIT POURQUOI, ET IL NE CONSOMME RIEN

        `evaluerUnCode` distingue sept refus. L'acheteur a besoin de les
        connaître ICI : « ce code a expiré » lui apprend quoi faire, « ça n'a
        pas marché » ne lui apprend rien.

        Il ne réserve pas d'exemplaire pour autant : c'est l'achat qui
        consomme, et qui peut donc refuser si quelqu'un a pris le dernier
        entre-temps. L'aperçu est une aide à la saisie, pas une promesse.
      */}
      {montantLibre ? (
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>
            Combien veux-tu donner ?
          </div>

          {/*
            Trois boutons avant le champ, et pas l'inverse : personne ne sait
            quoi donner, et un champ vide se remplit surtout du montant le plus
            bas. Les boutons ne remplacent pas la saisie — ils la préremplissent.
          */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {montantLibre.suggeres.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMontant(String(m))}
                style={{
                  padding: "9px 15px",
                  border: `2.5px solid ${ENCRE}`,
                  borderRadius: 12,
                  background: montant === String(m) ? JAUNE : "#FFFFFF",
                  fontFamily: "inherit",
                  fontSize: 13.5,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {m.toLocaleString("fr-FR")} F
              </button>
            ))}
          </div>

          <input
            name="montant"
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            inputMode="numeric"
            required
            aria-label="Montant en francs"
            style={{
              width: "100%",
              padding: "12px 14px",
              border: `2.5px solid ${ENCRE}`,
              borderRadius: 13,
              background: "#FFFFFF",
              fontFamily: "inherit",
              fontSize: 15,
              fontWeight: 700,
            }}
          />

          <p style={{ fontSize: 12.5, opacity: 0.75, margin: "8px 0 0" }}>
            {`Minimum ${montantLibre.minimum.toLocaleString("fr-FR")} F — en dessous, les frais dépassent ce qui reste au créateur.`}
          </p>
        </div>
      ) : null}

      {pourboiresOuverts ? (
        <div>
          <label
            htmlFor="pourboire"
            style={{ display: "block", fontSize: 13, fontWeight: 800, marginBottom: 10 }}
          >
            Ajouter un pourboire{" "}
            <span style={{ opacity: 0.6, fontWeight: 600 }}>— si tu veux</span>
          </label>

          <input
            id="pourboire"
            name="pourboire"
            value={pourboire}
            onChange={(e) => setPourboire(e.target.value)}
            inputMode="numeric"
            placeholder="0"
            style={{
              width: 190,
              padding: "12px 14px",
              border: `2.5px solid ${ENCRE}`,
              borderRadius: 13,
              background: "#FFFFFF",
              fontFamily: "inherit",
              fontSize: 15,
              fontWeight: 700,
            }}
          />

          <p style={{ fontSize: 12.5, opacity: 0.75, margin: "8px 0 0" }}>
            {"Il s'ajoute au prix et part au créateur, frais déduits comme le reste."}
          </p>
        </div>
      ) : null}

      {champs.length > 0 ? (
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>
            Ce que le créateur demande
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {champs.map((c) => {
              // Le préfixe `champ:` isole ces réponses des autres champs du
              // formulaire — voir `lib/checkout/actions.ts`.
              const nomHtml = `champ:${c.id}`;

              if (c.type === "BOOLEAN" || c.type === "TERMS") {
                return (
                  <label
                    key={c.id}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      fontSize: 13.5,
                      lineHeight: 1.5,
                    }}
                  >
                    <input
                      name={nomHtml}
                      type="checkbox"
                      required={c.obligatoire}
                      style={{ width: 18, height: 18, marginTop: 2 }}
                    />
                    <span>
                      {c.nom}
                      {c.obligatoire ? " *" : ""}
                    </span>
                  </label>
                );
              }

              return (
                <div key={c.id}>
                  <label
                    htmlFor={nomHtml}
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    {c.nom}
                    {c.obligatoire ? " *" : ""}
                  </label>

                  {c.type === "CHOICE" ? (
                    <select
                      id={nomHtml}
                      name={nomHtml}
                      required={c.obligatoire}
                      defaultValue=""
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        border: `2.5px solid ${ENCRE}`,
                        borderRadius: 13,
                        background: "#FFFFFF",
                        fontFamily: "inherit",
                        fontSize: 13.5,
                      }}
                    >
                      <option value="" disabled>
                        Choisis…
                      </option>
                      {c.options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={nomHtml}
                      name={nomHtml}
                      required={c.obligatoire}
                      maxLength={200}
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        border: `2.5px solid ${ENCRE}`,
                        borderRadius: 13,
                        background: "#FFFFFF",
                        fontFamily: "inherit",
                        fontSize: 13.5,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {produitId && apercu ? (
      <div>
        <label
          htmlFor="codePromo"
          style={{ display: "block", fontSize: 13, fontWeight: 800, marginBottom: 10 }}
        >
          Code promo <span style={{ opacity: 0.6, fontWeight: 600 }}>— si tu en as un</span>
        </label>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            id="codePromo"
            name="codePromo"
            value={codePromo}
            onChange={(e) => {
              setCodePromo(e.target.value);
              setRemise(null);
            }}
            autoComplete="off"
            placeholder="NOEL25"
            style={{
              flex: "1 1 180px",
              padding: "12px 14px",
              border: `2.5px solid ${ENCRE}`,
              borderRadius: 13,
              background: "#FFFFFF",
              fontFamily: "var(--font-mono)",
              fontSize: 14,
              letterSpacing: ".1em",
              textTransform: "uppercase",
            }}
          />

          <button
            type="button"
            disabled={verifieEnCours || codePromo.trim().length === 0}
            onClick={() =>
              transitionCode(async () =>
                setRemise(await apercu!(produitId!, codePromo)),
              )
            }
            style={{
              padding: "12px 18px",
              border: `2.5px solid ${ENCRE}`,
              borderRadius: 13,
              background: "#FFFFFF",
              fontFamily: "inherit",
              fontSize: 13.5,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {verifieEnCours ? "…" : "Vérifier"}
          </button>
        </div>

        {remise && remise.ok ? (
          <p style={{ margin: "10px 0 0", fontSize: 13.5, fontWeight: 700 }}>
            {`− ${remise.remise.toLocaleString("fr-FR")} F · tu paieras ${remise.prixFinal.toLocaleString("fr-FR")} F`}
          </p>
        ) : null}

        {remise && !remise.ok && remise.message ? (
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 13.5,
              fontWeight: 700,
              color: "#E2622C",
            }}
          >
            {remise.message}
          </p>
        ) : null}
      </div>
      ) : null}
      {/* ── Le pays ─────────────────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>
          Pays de facturation
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PAYS.map((p) => (
            <button
              key={p.code}
              type="button"
              onClick={() => changerPays(p.code)}
              className="sticker-press"
              style={{
                padding: "9px 14px",
                border: CADRE,
                borderRadius: 999,
                background: p.code === pays ? ENCRE : BLANC,
                color: p.code === pays ? BLANC : ENCRE,
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            opacity: 0.7,
            marginTop: 10,
            textWrap: "pretty",
          }}
        >
          Seuls les rails actifs dans ce pays sont proposés — un opérateur grisé
          ne sert à rien.
        </div>
      </div>

      {/* ── Le rail ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {disponibles.map((r) => {
          const actif = r.code === choisi;
          return (
            <button
              key={r.code}
              type="button"
              onClick={() => setRail(r.code)}
              aria-pressed={actif}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                textAlign: "left",
                padding: 14,
                border: CADRE,
                borderRadius: 16,
                background: actif ? JAUNE : BLANC,
                boxShadow: actif ? `4px 4px 0 ${ENCRE}` : undefined,
                cursor: "pointer",
                width: "100%",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  flex: "0 0 auto",
                  border: CADRE,
                  borderRadius: 12,
                  background: LAVANDE_CLAIR,
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {r.initiales}
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800 }}>{r.label}</div>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    opacity: 0.75,
                    marginTop: 3,
                  }}
                >
                  {r.hint}
                </div>
              </div>

              {actif ? (
                <div
                  style={{
                    flex: "0 0 auto",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "5px 10px",
                    border: CADRE,
                    borderRadius: 999,
                    background: BLANC,
                  }}
                >
                  CHOISI
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* ── Le numéro, quand l'opérateur en a besoin ─────────────────────── */}
      {veutLeNumero ? (
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
            Numéro de téléphone{" "}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                padding: "3px 8px",
                border: CADRE,
                borderRadius: 999,
                background: ORANGE,
                color: BLANC,
                marginLeft: 6,
              }}
            >
              obligatoire
            </span>
          </div>
          <input
            type="tel"
            inputMode="tel"
            name="telephone"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            placeholder={`${infoPays.indicatif} 07 00 00 00 00`}
            style={{
              width: "100%",
              padding: "13px 15px",
              border: CADRE,
              borderRadius: 14,
              background: BLANC,
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          />
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              opacity: 0.75,
              marginTop: 8,
              textWrap: "pretty",
            }}
          >
            {motNumero}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            padding: 14,
            border: CADRE,
            borderRadius: 16,
            background: LAVANDE_CLAIR,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              flex: "0 0 auto",
              border: CADRE,
              borderRadius: 99,
              background: BLANC,
              display: "grid",
              placeItems: "center",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            i
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
            {motNumero}
          </div>
        </div>
      )}

      {/* ── Partir chez l'opérateur ─────────────────────────────────────── */}
      <BoutonPayer bloque={manqueLeNumero} prixFormate={prixFormate} />

      <div
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          opacity: 0.75,
          textAlign: "center",
          textWrap: "pretty",
        }}
      >
        Tu seras redirigé vers {disponibles.find((r) => r.code === choisi)?.label}.
        Rien n&apos;est débité avant ta confirmation chez eux.
      </div>
    </form>
  );
}

/**
 * Le bouton d'envoi, à part.
 *
 * `useFormStatus` ne connaît l'attente que depuis l'INTÉRIEUR du formulaire :
 * appelé dans le composant qui déclare le `<form>`, il rendrait toujours faux.
 * D'où ce petit composant, dont c'est la seule raison d'être.
 *
 * L'attente compte ici plus qu'ailleurs : sans elle, un second clic ouvrirait
 * une seconde commande. La fenêtre anti-doublon de `acheter()` l'arrêterait,
 * mais l'acheteur verrait un refus incompréhensible.
 */
function BoutonPayer({
  bloque,
  prixFormate,
}: {
  bloque: boolean;
  prixFormate: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || bloque}
      className="sticker-press"
      style={{
        width: "100%",
        padding: 16,
        border: CADRE,
        borderRadius: 16,
        background: bloque ? LAVANDE_CLAIR : ENCRE,
        color: bloque ? ENCRE : BLANC,
        fontSize: 15,
        fontWeight: 800,
        boxShadow: bloque ? undefined : `5px 5px 0 ${ORANGE}`,
        cursor: pending || bloque ? "not-allowed" : "pointer",
        opacity: pending ? 0.7 : 1,
      }}
    >
      {pending ? "Un instant…" : `Payer ${prixFormate}`}
    </button>
  );
}
