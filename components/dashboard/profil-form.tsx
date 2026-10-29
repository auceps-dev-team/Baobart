"use client";

import { useActionState, useState } from "react";

import { VisuelsProfil } from "@/components/dashboard/visuels-profil";
import { Medaillon } from "@/components/reseaux/logos";
import { enregistrerProfil, type EtatProfil } from "@/lib/profil/actions";
import type { Saisie } from "@/lib/profil/validation";
import { RESEAUX, exempleDuReseau, nomDuReseau } from "@/lib/reseaux/reseaux";
import { BLANC, CADRE, ENCRE, JAUNE, ORANGE, VERT } from "@/lib/systeme/charte";

/**
 * Le formulaire du profil public.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * IL NE VALIDE RIEN
 *
 * `lib/profil/validation.ts` est autorité. Ce qu'on met ici — `required`,
 * `maxLength` — n'est qu'un confort : un formulaire se contourne.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * LE CHANGEMENT D'ADRESSE S'ANNONCE AVANT, PAS APRÈS
 *
 * Modifier son nom d'utilisateur déplace sa vitrine : `/@ancien` cesse de
 * répondre. C'est permis — une personne mal nommée à l'inscription vit avec
 * cette adresse partout où on la cite — mais cela se découvre mal après coup.
 * L'avertissement n'apparaît donc qu'au moment où le champ change vraiment.
 */
export function FormulaireProfil({
  depart,
  visuels,
  email,
  disposition = "identite",
}: {
  depart: Saisie;
  visuels: { avatarUrl: string | null; bannerUrl: string | null };
  /** L'adresse du compte, affichée et jamais envoyée. */
  email: string;
  /**
   * « identite » : Acheteur › Profil de la maquette. « boutique » : Créateur ›
   * Profil de la boutique, la vitrine et ses liens côte à côte. Un seul
   * formulaire, une seule action : voir les champs cachés plus bas.
   */
  disposition?: "identite" | "boutique";
}) {
  const [etat, envoyer, enCours] = useActionState<EtatProfil | null, FormData>(
    enregistrerProfil,
    null,
  );

  const v = etat && !etat.ok ? etat.saisie : depart;
  const [username, setUsername] = useState(depart.username);

  const changeDAdresse = username.trim() !== depart.username;
  const refus = etat && !etat.ok ? etat : null;

  return (
    <form
      action={envoyer}
      // Identité : une colonne, que la page pose à gauche. Boutique : deux
      // colonnes, « Vitrine » | « Liens & services », comme la maquette (27/10).
      style={{
        display: "grid",
        gap: 18,
        minWidth: 0,
        alignItems: "start",
        gridTemplateColumns: disposition === "boutique" ? "repeat(auto-fit,minmax(min(100%,420px),1fr))" : undefined,
      }}
    >
      {refus ? (
        <div
          role="alert"
          style={{
            gridColumn: "1 / -1",
            padding: "13px 15px",
            border: CADRE,
            borderRadius: 14,
            background: ORANGE,
            color: BLANC,
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          {refus.message}
        </div>
      ) : null}

      {etat?.ok ? (
        <div
          role="status"
          style={{
            gridColumn: "1 / -1",
            padding: "13px 15px",
            border: CADRE,
            borderRadius: 14,
            background: VERT,
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          Profil enregistré. Il est visible sur ta page publique.
        </div>
      ) : null}

      {/*
        « Identité » (Acheteur › Profil) ou « Vitrine » (Créateur › Profil de
        la boutique) de la maquette, et leurs libellés (27/10). Le nom, la
        photo et la présentation sont aux deux : la maquette les dessine aux
        deux endroits, et c'est la même donnée.
      */}
      <Bloc titre={disposition === "boutique" ? "Vitrine" : "Identité"}>
        <VisuelsProfil avatarUrl={visuels.avatarUrl} bannerUrl={visuels.bannerUrl} />

        <Champ label="Nom à afficher" pour="nomAffiche">
          <input
            id="nomAffiche"
            name="nomAffiche"
            required
            maxLength={80}
            defaultValue={v.nomAffiche}
            key={`nom-${v.nomAffiche}`}
            style={entree}
          />
        </Champ>

        <Champ
          label="Nom d'utilisateur"
          pour="username"
          aide="C'est l'adresse de ta page : baobart.com/@ton-nom"
        >
          <input
            id="username"
            name="username"
            required
            maxLength={40}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={entree}
          />
        </Champ>

        {changeDAdresse ? (
          <div
            style={{
              gridColumn: "1 / span 2",
              padding: "12px 14px",
              border: CADRE,
              borderRadius: 14,
              background: JAUNE,
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.5,
              textWrap: "pretty",
            }}
          >
            Tu changes l&apos;adresse de ta page. <strong>/@{depart.username}</strong>{" "}
            cessera de répondre, et les liens déjà partagés ne mèneront plus
            nulle part.
          </div>
        ) : null}

        {/*
          Sans `name` : l'adresse se lit, elle ne part pas avec le formulaire.
          Rien ne sait la changer — c'est l'identifiant du compte.
        */}
        {disposition === "identite" ? (
          <Champ label="Adresse e-mail principale" pour="email-compte" aide="L'adresse de ton compte : elle reçoit tes reçus et tes codes." pleineLargeur>
            <input id="email-compte" readOnly value={email} style={{ ...entree, opacity: 0.7 }} />
          </Champ>
        ) : (
          <Champ label="Spécialité" pour="specialite" pleineLargeur>
            <input
              id="specialite"
              name="specialite"
              maxLength={80}
              defaultValue={v.specialite}
              key={`spe-${v.specialite}`}
              placeholder="Illustration & motifs"
              style={entree}
            />
          </Champ>
        )}

        <Champ
          label="Description"
          pour="bio"
          aide="Quelques lignes : ce que tu fais, pour qui, ce qui te distingue."
          pleineLargeur
        >
          <textarea
            id="bio"
            name="bio"
            rows={4}
            maxLength={600}
            defaultValue={v.bio}
            key={`bio-${v.bio}`}
            placeholder="Deux lignes sur toi…"
            style={{ ...entree, resize: "vertical" }}
          />
        </Champ>

        <Champ label="Ville" pour="ville">
          <input
            id="ville"
            name="ville"
            maxLength={80}
            defaultValue={v.ville}
            key={`ville-${v.ville}`}
            placeholder="Abidjan"
            style={entree}
          />
        </Champ>

        <Champ label="Pays" pour="pays" aide="Code à deux lettres : CI, SN, ML…">
          <input
            id="pays"
            name="pays"
            maxLength={2}
            defaultValue={v.pays}
            key={`pays-${v.pays}`}
            placeholder="CI"
            style={entree}
          />
        </Champ>
      </Bloc>

      {disposition === "boutique" ? (
        <Bloc titre="Liens & services">
          <Champ label="Portfolio" pour="portfolio" aide="Adresse complète, en https://" pleineLargeur>
            <input
              id="portfolio"
              name="portfolio"
              type="url"
              maxLength={300}
              defaultValue={v.portfolio}
              key={`porte-${v.portfolio}`}
              placeholder="https://mon-site.example"
              style={entree}
            />
          </Champ>

          <Champ label="Ouvert aux commandes" pour="disponibilite" aide="En toutes lettres : « Oui, sous 2 semaines »." pleineLargeur>
            <input
              id="disponibilite"
              name="disponibilite"
              maxLength={80}
              defaultValue={v.disponibilite}
              key={`dispo-${v.disponibilite}`}
              placeholder="Oui, sous 2 semaines"
              style={entree}
            />
          </Champ>

          <Champ label="Tarif journalier indicatif (F CFA)" pour="tarifJournalier" aide="Laisse vide pour ne pas l'afficher." pleineLargeur>
            <input
              id="tarifJournalier"
              name="tarifJournalier"
              inputMode="numeric"
              pattern="[0-9]*"
              defaultValue={v.tarifJournalier}
              key={`tarif-${v.tarifJournalier}`}
              placeholder="45000"
              style={entree}
            />
          </Champ>

          {/*
            Les douze réseaux du Design System (« 05 · Logos réseaux »), chacun
            avec le médaillon des « liens profil ». La maquette n'en dessine que
            deux (Instagram, Behance) : la vitrine en affiche douze depuis
            v1.92.0. Tout est facultatif — un champ vide n'affiche rien.
          */}
          <p style={{ gridColumn: "1 / -1", margin: "6px 0 0", fontSize: 13, fontWeight: 600, lineHeight: 1.5, opacity: 0.75, textWrap: "pretty" }}>
            <strong>Tes réseaux.</strong> Ton pseudo, ou colle l&apos;adresse de ta page. Chaque logo mène sur son réseau et nulle part
            ailleurs : une adresse Behance dans le champ Instagram est refusée.
          </p>
          {RESEAUX.map((r) => {
            const fautif = refus?.champ === `reseau-${r}`;
            return (
              <div key={r} style={{ minWidth: 0 }}>
                <label htmlFor={`reseau-${r}`} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, fontSize: 13, fontWeight: 800 }}>
                  <Medaillon reseau={r} />
                  {nomDuReseau(r)}
                </label>
                <input
                  id={`reseau-${r}`}
                  name={`reseau-${r}`}
                  maxLength={300}
                  defaultValue={v.reseaux[r]}
                  key={`reseau-${r}-${v.reseaux[r]}`}
                  placeholder={exempleDuReseau(r)}
                  aria-invalid={fautif || undefined}
                  inputMode={r === "whatsapp" ? "tel" : undefined}
                  autoComplete="off"
                  spellCheck={false}
                  style={fautif ? { ...entree, borderColor: ORANGE, background: "#FFF1EA" } : entree}
                />
              </div>
            );
          })}
        </Bloc>
      ) : (
        // L'action enregistre le profil ENTIER : un champ absent vaut « vidé »,
        // et les réseaux sont remplacés en bloc. Ce que cette page ne montre
        // pas part donc tel quel — sans ces champs, enregistrer son identité
        // effacerait sa vitrine.
        <>
          <input type="hidden" name="specialite" value={v.specialite} />
          <input type="hidden" name="portfolio" value={v.portfolio} />
          <input type="hidden" name="disponibilite" value={v.disponibilite} />
          <input type="hidden" name="tarifJournalier" value={v.tarifJournalier} />
          {RESEAUX.map((r) => (
            <input key={r} type="hidden" name={`reseau-${r}`} value={v.reseaux[r]} />
          ))}
        </>
      )}

      <div style={{ gridColumn: "1 / -1" }}>
        <button
          type="submit"
          disabled={enCours}
          className="sticker-press"
          style={{
            padding: "14px 24px",
            border: CADRE,
            borderRadius: 14,
            background: ENCRE,
            color: BLANC,
            fontSize: 14,
            fontWeight: 800,
            cursor: enCours ? "wait" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {enCours ? "Enregistrement…" : "Enregistrer mon profil"}
        </button>
      </div>
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

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: CADRE,
        borderRadius: 22,
        background: BLANC,
        boxShadow: `5px 5px 0 ${ENCRE}`,
        padding: 22,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 17,
          textTransform: "uppercase",
          letterSpacing: "-.4px",
          marginBottom: 16,
        }}
      >
        {titre}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 16,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Champ({
  label,
  pour,
  aide,
  pleineLargeur = false,
  children,
}: {
  label: string;
  pour: string;
  aide?: string;
  pleineLargeur?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ minWidth: 0, gridColumn: pleineLargeur ? "1 / -1" : "auto" }}>
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
