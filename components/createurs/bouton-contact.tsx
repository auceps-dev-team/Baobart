"use client";

import Link from "next/link";
import type { Route } from "next";
import { useActionState, useRef } from "react";

import { ChampsAntiBot } from "@/components/auth/champs-antibot";
import { ecrireAuCreateurAction, type EtatMessage } from "@/lib/contact/actions-createur";
import { CORPS_MAX, SUJET_MAX } from "@/lib/contact/createur";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE, VERT } from "@/lib/systeme/charte";

const LAVANDE_CLAIR = "#F4EEFC";

/**
 * Le bouton « Contact » de la vitrine : jaune, ombre de 4 px, entre
 * « Suivre » et « Partager » (`Baobart Accueil.dc.html`, PROFIL CREATEUR).
 *
 * La maquette ne dessine pas ce qu'il ouvre. Le formulaire reprend celui de
 * la page Contact de la même maquette — champs lavande, envoi jaune — sans
 * Nom ni Email : l'expéditeur est connecté, et c'est l'adresse de son compte
 * qui part en « Répondre à ». Il le lit avant d'envoyer.
 *
 * La fenêtre est un `<dialog>` natif : le focus y entre et en ressort seul,
 * Échap la ferme, le reste de la page devient inerte.
 *
 * Sans session, le bouton mène à la connexion : un message demande un compte
 * (`lib/contact/createur.ts`).
 */
export function BoutonContact({
  username,
  nom,
  adresseDeReponse,
  ouverture,
}: {
  username: string;
  nom: string;
  /** L'adresse du compte connecté, `null` sans session. */
  adresseDeReponse: string | null;
  /** L'instant signé par la page (`ouvertureSignee`) : l'envoi l'exige. */
  ouverture: string | null;
}) {
  const fenetre = useRef<HTMLDialogElement>(null);
  const [etat, envoyer, enCours] = useActionState<EtatMessage | null, FormData>(
    ecrireAuCreateurAction.bind(null, username),
    null,
  );

  if (!adresseDeReponse) {
    return (
      <Link href={`/connexion?suite=/@${username}` as Route} className="sticker-press" style={bouton}>
        Contact
      </Link>
    );
  }

  const v = etat && !etat.ok ? etat.saisie : { sujet: "", corps: "" };
  const faute = etat && !etat.ok ? etat.champ : undefined;

  return (
    <>
      <button type="button" data-contact-createur onClick={() => fenetre.current?.showModal()} className="sticker-press" style={{ ...bouton, cursor: "pointer", fontFamily: "inherit" }}>
        Contact
      </button>
      <dialog
        ref={fenetre}
        aria-labelledby={`contact-${username}`}
        style={{ width: "min(560px, calc(100vw - 32px))", padding: 0, border: CADRE, borderRadius: 24, background: BLANC, color: ENCRE, boxShadow: `7px 7px 0 ${ENCRE}` }}
      >
        <div style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <h2 id={`contact-${username}`} style={{ fontFamily: "var(--font-display)", fontSize: 22, letterSpacing: -0.6, margin: 0 }}>
              Écrire à {nom}
            </h2>
            <button type="button" aria-label="Fermer" onClick={() => fenetre.current?.close()} style={{ border: CADRE, borderRadius: 99, width: 34, height: 34, background: BLANC, color: ENCRE, fontWeight: 800, cursor: "pointer", flex: "0 0 auto" }}>
              ×
            </button>
          </div>

          {etat?.ok ? (
            <div role="status" data-contact-createur-envoye style={{ ...bandeau, background: VERT, marginTop: 16 }}>
              Message envoyé. {nom} te répondra à {adresseDeReponse}.
            </div>
          ) : (
            <form action={envoyer} style={{ display: "grid", gap: 12, marginTop: 16, position: "relative" }}>
              <ChampsAntiBot ouverture={ouverture} />
              {etat && !etat.ok ? (
                <div role="alert" style={{ ...bandeau, background: ORANGE, color: BLANC }}>
                  {etat.message}
                </div>
              ) : null}
              <input name="sujet" defaultValue={v.sujet} required maxLength={SUJET_MAX} aria-label="Sujet" placeholder="Sujet" style={saisie(faute === "sujet")} />
              <textarea
                name="corps"
                defaultValue={v.corps}
                required
                rows={6}
                maxLength={CORPS_MAX}
                aria-label="Message"
                placeholder="Présente ton projet : ce que tu cherches, pour quand, et ton budget s'il est fixé."
                style={{ ...saisie(faute === "corps"), resize: "vertical", lineHeight: 1.5 }}
              />
              <p style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.75, margin: 0, lineHeight: 1.45 }}>
                Baobart transmet ton message à {nom}, qui pourra te répondre à <strong>{adresseDeReponse}</strong>. Son
                adresse reste privée tant qu&apos;aucune réponse ne t&apos;est envoyée.
              </p>
              <button type="submit" disabled={enCours} className="sticker-press" style={{ padding: 14, border: CADRE, borderRadius: 14, background: JAUNE, color: ENCRE, fontSize: 14, fontWeight: 800, fontFamily: "inherit", cursor: "pointer" }}>
                {enCours ? "Un instant…" : "Envoyer le message"}
              </button>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}

const bouton: React.CSSProperties = {
  padding: "12px 20px",
  border: CADRE,
  borderRadius: 14,
  background: JAUNE,
  boxShadow: `4px 4px 0 ${ENCRE}`,
  fontSize: 13.5,
  fontWeight: 800,
  color: ENCRE,
};

const bandeau: React.CSSProperties = {
  padding: "12px 15px",
  border: CADRE,
  borderRadius: 14,
  color: ENCRE,
  fontSize: 13.5,
  fontWeight: 700,
};

function saisie(faute: boolean): React.CSSProperties {
  return {
    minWidth: 0,
    width: "100%",
    fontFamily: "inherit",
    fontSize: 13.5,
    fontWeight: 500,
    padding: "12px 14px",
    border: faute ? `2.5px solid ${ORANGE}` : CADRE,
    borderRadius: 13,
    background: LAVANDE_CLAIR,
    color: ENCRE,
    outline: "none",
  };
}
