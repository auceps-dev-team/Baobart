"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { confirmerVisuel, reserverVisuel, retirerVisuel } from "@/lib/profil/actions-visuels";
import { REGLES, type Visuel } from "@/lib/profil/visuels";

/**
 * La photo de profil et la bannière, dans le bloc d'identité.
 *
 * Traduit de `Baobart Dashboard.dc.html`, écran `c_profil`, bloc « Vitrine »
 * (`hasAvatar`) : un cadre en tirets sur fond lavande, l'aperçu rond de 72 px
 * rayé tant qu'il n'y a pas de photo, « Photo de profil », la consigne en
 * Space Mono, le bouton jaune « Téléverser ». La bannière n'est pas dessinée :
 * elle reprend la même forme, avec un aperçu en bandeau.
 *
 * Hors du formulaire de profil : l'envoi a ses propres boutons et son propre
 * circuit (réserver, déposer, confirmer). Enregistrer le profil ne renvoie
 * pas les images, et changer d'image n'oblige pas à enregistrer le reste.
 */
export function VisuelsProfil({
  avatarUrl,
  bannerUrl,
}: {
  avatarUrl: string | null;
  bannerUrl: string | null;
}) {
  return (
    <div style={{ gridColumn: "1 / -1", display: "grid", gap: 12 }}>
      <Envoi visuel="avatar" depart={avatarUrl} />
      <Envoi visuel="banniere" depart={bannerUrl} />
    </div>
  );
}

function Envoi({ visuel, depart }: { visuel: Visuel; depart: string | null }) {
  const regle = REGLES[visuel];
  const routeur = useRouter();
  const choix = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(depart);
  const [etat, setEtat] = useState<"repos" | "envoi" | "retrait">("repos");
  const [message, setMessage] = useState<{ ton: "ok" | "refus"; texte: string } | null>(null);

  const envoyer = async (fichier: File) => {
    setEtat("envoi");
    setMessage(null);
    try {
      const reservation = await reserverVisuel(visuel, { nom: fichier.name, taille: fichier.size, mime: fichier.type });
      if (!reservation.ok) return setMessage({ ton: "refus", texte: reservation.message });

      // Le type est figé dans la signature : en envoyer un autre l'invalide.
      const depot = await fetch(reservation.url, {
        method: "PUT",
        headers: { "Content-Type": reservation.mime },
        body: fichier,
      });
      if (!depot.ok) return setMessage({ ton: "refus", texte: "Le fichier n'est pas arrivé au bout. Réessaie." });

      const confirme = await confirmerVisuel(visuel, reservation.reservationId);
      if (!confirme.ok) return setMessage({ ton: "refus", texte: confirme.message });

      setUrl(confirme.url);
      setMessage({ ton: "ok", texte: `${regle.titre} enregistrée. Elle est visible sur ta page.` });
      routeur.refresh();
    } catch {
      setMessage({ ton: "refus", texte: "L'envoi a échoué. Vérifie ta connexion et réessaie." });
    } finally {
      setEtat("repos");
      if (choix.current) choix.current.value = "";
    }
  };

  const retirer = async () => {
    setEtat("retrait");
    setMessage(null);
    const r = await retirerVisuel(visuel).catch(() => null);
    setEtat("repos");
    if (!r?.ok) return setMessage({ ton: "refus", texte: r?.message ?? "Le retrait a échoué. Réessaie." });
    setUrl(null);
    routeur.refresh();
  };

  const avatar = visuel === "avatar";
  const fondApercu = url
    ? `center / cover no-repeat url(${url})`
    : avatar
      ? "repeating-linear-gradient(135deg,#FFD84A 0 6px,#FFFFFF 6px 13px)"
      : "repeating-linear-gradient(135deg,#C9A8F5 0 10px,#FFFFFF 10px 22px)";

  return (
    <div
      data-visuel={visuel}
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 16,
        padding: 16,
        border: "2.5px dashed #121212",
        borderRadius: 18,
        background: "#F4EEFC",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: avatar ? 72 : 168,
          height: 72,
          flex: "0 0 auto",
          border: "2.5px solid #121212",
          borderRadius: avatar ? 99 : 14,
          background: fondApercu,
        }}
      />
      <div style={{ flex: "1 1 160px", minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800 }}>{regle.titre}</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, opacity: 0.65 }}>{regle.consigne}</div>
        {message ? (
          <div
            role={message.ton === "refus" ? "alert" : "status"}
            style={{ fontSize: 12.5, fontWeight: 700, marginTop: 6, color: message.ton === "refus" ? "#B34A1F" : "#121212" }}
          >
            {message.texte}
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {url ? (
          <button
            type="button"
            onClick={retirer}
            disabled={etat !== "repos"}
            style={{ ...bouton, background: "#FFFFFF", cursor: etat === "repos" ? "pointer" : "wait" }}
          >
            {etat === "retrait" ? "Retrait…" : "Retirer"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => choix.current?.click()}
          disabled={etat !== "repos"}
          style={{ ...bouton, cursor: etat === "repos" ? "pointer" : "wait" }}
        >
          {etat === "envoi" ? "Envoi…" : url ? "Remplacer" : "Téléverser"}
        </button>
        <input
          ref={choix}
          type="file"
          accept="image/png,image/jpeg"
          aria-label={`${regle.titre} : choisir un fichier PNG ou JPG`}
          hidden
          onChange={(e) => {
            const fichier = e.target.files?.[0];
            if (fichier) void envoyer(fichier);
          }}
        />
      </div>
    </div>
  );
}

const bouton = {
  padding: "10px 16px",
  border: "2.5px solid #121212",
  borderRadius: 12,
  background: "#FFD84A",
  fontSize: 12.5,
  fontWeight: 800,
  whiteSpace: "nowrap",
  fontFamily: "inherit",
  color: "#121212",
} as const;
