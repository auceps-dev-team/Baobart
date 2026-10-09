"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { usePlaceholderTape } from "@/components/anime/placeholder-tape";
import { deconnecter } from "@/lib/auth/actions";

import {
  BLANC,
  ENCRE,
  JAUNE,
  LAVANDE,
  LAVANDE_CLAIR,
  LAVANDE_PROFOND,
  MENUS,
  ORANGE,
  ORANGE_PALE,
} from "@/components/shell/nav-data";

/**
 * En-tête, traduit du bloc HEADER de « Baobart Accueil.dc.html ».
 *
 * Carte blanche contourée collée en haut, logo, champ de recherche avec
 * suggestions, menus déroulants au survol, panier et puce de compte.
 */

interface Suggestion {
  title: string;
  famille: string | null;
  slug: string;
}

export interface UtilisateurEnTete {
  nom: string;
  /**
   * Affiché dans la carte d'identité du menu de compte, comme la maquette
   * (« Baobart Accueil.dc.html » ligne 129). Aucun appelant n'a eu à changer :
   * les vingt-deux passent déjà un `UtilisateurConnecte`, qui le porte.
   */
  email: string;
  username: string | null;
}

/** Une entrée du menu de compte. `href` nul = page pas encore écrite. */
interface LienCompte {
  label: string;
  href: string | null;
}

/**
 * ════════════════════════════════════════════════════════════════════════════
 * LE MENU DE COMPTE, ET CE QU'IL DOIT À LA MAQUETTE
 *
 * « Baobart Accueil.dc.html » ligne 1925 porte un `accountMenu` de huit
 * entrées. Il en manquait sept : l'écran n'offrait que « Tableau de bord » et
 * « Se déconnecter », ce qui laissait les collections, les achats et le profil
 * public joignables uniquement en passant par le tableau de bord.
 *
 * Trois écarts avec la maquette, chacun pour une raison :
 *
 * 1. LES LIBELLÉS SE CROISENT. La maquette appelle « Historique des commandes »
 *    l'écran des factures et « Mes achats » celui des téléchargements — voir
 *    ses lignes 1563 et 1573 : le premier porte un bouton « Facture », le
 *    second « Télécharger ». Ici les deux pages existent déjà sous d'autres
 *    noms, que `lib/dashboard/nav.ts` fixe : « Historique des achats » et
 *    « Historique des téléchargements ». Reprendre les libellés de la maquette
 *    ferait atterrir « Mes achats » sur une page intitulée autrement. Ce sont
 *    les noms des pages qui gagnent : un menu ment quand il annonce un titre
 *    qu'on ne retrouve pas en arrivant.
 *
 * 2. « NOTIFICATIONS » S'AJOUTE. Elle n'est dans aucun `accountMenu`, mais les
 *    maquettes ne connaissent pas le centre de notifications : le mot n'y
 *    apparaît que dans trois phrases de texte courant, jamais comme écran.
 *    Son absence n'est donc pas une décision de la maquette.
 *
 * 3. « RÈGLES DE PUBLICATION » ET « SUPPORT » RESTENT SANS LIEN. La maquette
 *    les mène vers un écran de documentation qui n'existe pas encore ici :
 *    aucune page ne les sert, et le pied de page ne pointe que vers `/`.
 *    Plutôt que de les taire, elles s'affichent grisées — comme les entrées de
 *    la barre de navigation, même traitement pour la même raison.
 */
function liensCompte(username: string | null): LienCompte[] {
  return [
    { label: "Tableau de bord", href: "/dashboard" },
    { label: "Historique des achats", href: "/dashboard/achats" },
    { label: "Mes téléchargements", href: "/dashboard/telechargements" },
    { label: "Mes collections", href: "/dashboard/collections" },
    { label: "Notifications", href: "/dashboard/notifications" },
    {
      // Sans pseudo, il n'y a pas de page publique à montrer : le réglage du
      // profil est la seule chose utile à offrir à sa place.
      label: username ? "Mon profil public" : "Compléter mon profil",
      href: username ? `/createurs/${username}` : "/dashboard/profil",
    },
    { label: "Règles de publication", href: null },
    { label: "Support", href: null },
  ];
}

export function Header({
  cartCount = 0,
  utilisateur = null,
}: {
  cartCount?: number;
  utilisateur?: UtilisateurEnTete | null;
}) {
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  // L'indication du champ tape ses exemples, une fois, puis revient à
  // elle-même (09/10, adapté d'Animata `text/typing-text`). Les quatre
  // familles nommées existent dans la barre de filtres.
  const indication = usePlaceholderTape({
    base: "Cherche un mockup, une illu, une font…",
    prefixe: "Cherche",
    exemples: ["un mockup…", "une illu…", "une font…", "une photo…"],
    pause: focus || q !== "",
  });
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  // Ce que le panneau a à dire. Il ne s'ouvrait que s'il y avait des
  // résultats : zéro résultat, recherche en cours et recherche en panne se
  // rendaient tous par rien du tout (mesuré le 25/09, Qualitytest S29, S57).
  const [etatRecherche, setEtatRecherche] = useState<"repos" | "chargement" | "pret" | "erreur">("repos");
  const router = useRouter();
  const [menuOuvert, setMenuOuvert] = useState<string | null>(null);
  const [compteOuvert, setCompteOuvert] = useState(false);

  /**
   * ══════════════════════════════════════════════════════════════════════════
   * FERMER AVEC UN DÉLAI, PARCE QUE LA SOURIS N'EST PAS UN CURSEUR PARFAIT
   *
   * `onMouseLeave` fermait immédiatement. Entre le libellé et le panneau il y
   * a quelques pixels, et il faut traverser un coin pour atteindre un
   * sous-menu : on quittait la zone avant d'arriver, et le menu disparaissait
   * sous le doigt.
   *
   * Deux corrections vont ensemble, et l'une sans l'autre ne suffit pas :
   * le panneau est désormais collé au libellé (`top: 100%` avec une bande de
   * garde transparente), et la fermeture attend 220 ms — annulés dès que la
   * souris revient.
   *
   * 220 ms : assez pour traverser un coin, trop court pour qu'un menu
   * s'attarde quand on est parti ailleurs.
   */
  const minuteurFermeture = useRef<ReturnType<typeof setTimeout> | null>(null);

  const annulerFermeture = useCallback(() => {
    if (minuteurFermeture.current !== null) {
      clearTimeout(minuteurFermeture.current);
      minuteurFermeture.current = null;
    }
  }, []);

  const fermerBientot = useCallback(
    (fermer: () => void) => {
      annulerFermeture();
      minuteurFermeture.current = setTimeout(fermer, 220);
    },
    [annulerFermeture],
  );

  // Un minuteur qui survit au démontage rappellerait un `setState` sur un
  // composant disparu.
  useEffect(() => annulerFermeture, [annulerFermeture]);
  const dernier = useRef(0);

  // La hauteur réelle de l'en-tête, pour que le rail fixe se cale dessous.
  // Il était posé à 104 px — un en-tête sur une ligne. Mesuré le 24/09
  // (Qualitytest A1) : à 1280 et 1366 px, ou avec un nom de compte long,
  // l'en-tête passe sur deux lignes et le rail recouvre « Panier ».
  const entete = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = entete.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const poser = () =>
      document.documentElement.style.setProperty("--bas-entete", `${el.offsetHeight + 8}px`);
    poser();
    const observateur = new ResizeObserver(poser);
    observateur.observe(el);
    return () => observateur.disconnect();
  }, []);

  // Les suggestions viennent de la base, pas d'une liste figée : c'est le seul
  // écart assumé avec la maquette, qui filtrait un tableau en dur.
  useEffect(() => {
    if (q.trim().length === 0) {
      setSuggestions([]);
      setEtatRecherche("repos");
      return;
    }
    const jeton = ++dernier.current;
    setEtatRecherche("chargement");
    const minuteur = setTimeout(async () => {
      try {
        const reponse = await fetch(`/api/recherche?q=${encodeURIComponent(q)}`);
        if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
        const data = await reponse.json();
        // Une réponse plus ancienne ne doit pas écraser une plus récente.
        if (jeton !== dernier.current) return;
        setSuggestions(data.items ?? []);
        setEtatRecherche("pret");
      } catch {
        if (jeton === dernier.current) setEtatRecherche("erreur");
      }
    }, 180);
    return () => clearTimeout(minuteur);
  }, [q]);

  const montreSuggestions = focus && q.trim().length > 0 && etatRecherche !== "repos";
  const messageRecherche =
    etatRecherche === "erreur"
      ? "La recherche ne répond pas. Réessaie dans un instant."
      : etatRecherche === "pret" && suggestions.length === 0
        ? `Aucune ressource ne correspond à « ${q.trim()} ».`
        : etatRecherche === "chargement" && suggestions.length === 0
          ? "Recherche…"
          : null;

  return (
    <div ref={entete} data-entete="1" style={{ position: "sticky", top: 0, zIndex: 40, padding: "18px 32px 0" }}>
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          // 16 et non 20 entre les blocs : voir la base du champ de recherche.
          gap: "14px 16px",
          background: BLANC,
          border: `2.5px solid ${ENCRE}`,
          borderRadius: 22,
          boxShadow: `5px 5px 0 ${ENCRE}`,
          padding: "12px 16px",
        }}
      >
        <Link
          href="/"
          className="logo-anime"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flex: "0 0 auto",
            cursor: "pointer",
          }}
        >
          <span
            className="logo-pastille"
            style={{
              width: 40,
              height: 40,
              flex: "0 0 auto",
              border: `2.5px solid ${ENCRE}`,
              borderRadius: 99,
              background: ORANGE,
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
            }}
          >
            <Image
              src="/img/baobab-white.svg"
              alt="Baobart"
              width={27}
              height={27}
              style={{ width: 27, height: "auto", display: "block", marginTop: 2 }}
            />
          </span>
          <span
            className="logo-mot"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              letterSpacing: "-.5px",
            }}
          >
            Baobart<span style={{ color: ORANGE }}>.</span>
          </span>
        </Link>

        {/*
          Base de 110 px, et non 190 : dans un conteneur qui passe à la ligne,
          la coupure se décide sur la base, avant tout rétrécissement. Avec 190,
          un compte connecté (« Kofi Mensah » au lieu de « Invité ») renvoyait
          panier et compte sur une seconde ligne à 1440 px (relevé le 04/10).
          Mesuré le 08/10 à 1366 px : 1 301 px demandés pour 1 266 disponibles —
          d'où aussi les écarts resserrés (16 entre blocs, 12 entre menus).
        */}
        <div
          style={{
            flex: "1 1 110px",
            maxWidth: 300,
            position: "relative",
            minWidth: 0,
          }}
        >
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setFocus(true);
            }}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
            placeholder={indication}
            aria-label="Rechercher une ressource"
            style={{
              width: "100%",
              fontFamily: "var(--font-body)",
              fontSize: 14,
              fontWeight: 500,
              padding: "11px 16px",
              border: `2.5px solid ${ENCRE}`,
              borderRadius: 14,
              background: LAVANDE_CLAIR,
              outline: "none",
            }}
          />
          {montreSuggestions ? (
            <div
              style={{
                position: "absolute",
                top: 52,
                left: 0,
                right: 0,
                background: BLANC,
                border: `2.5px solid ${ENCRE}`,
                borderRadius: 16,
                boxShadow: `5px 5px 0 ${ENCRE}`,
                padding: 8,
                animation: "popin .16s ease-out",
              }}
            >
              {messageRecherche ? (
                <div role="status" style={{ padding: "9px 10px", fontSize: 13.5, fontWeight: 600 }}>
                  {messageRecherche}
                </div>
              ) : null}
              {etatRecherche !== "erreur" && suggestions.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  // La maquette ouvre la ressource (`open: r.id`) ; on ne faisait
                  // que recopier son titre dans le champ.
                  onClick={() => {
                    setQ(s.title);
                    setFocus(false);
                    router.push(`/products/${s.slug}` as Route);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    background: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 10px",
                    borderRadius: 11,
                    cursor: "pointer",
                    fontSize: 13.5,
                    fontWeight: 600,
                  }}
                >
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      border: `2px solid ${ENCRE}`,
                      flex: "0 0 auto",
                      background: LAVANDE_PROFOND,
                    }}
                  />
                  <span style={{ flex: "1 1 auto" }}>{s.title}</span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      opacity: 0.55,
                    }}
                  >
                    {s.famille}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: ".03em",
            textTransform: "uppercase",
            flex: "1 1 auto",
            justifyContent: "flex-end",
            flexWrap: "wrap",
          }}
        >
          {MENUS.map((groupe) => (
            <div
              key={groupe.key}
              onMouseEnter={() => {
                annulerFermeture();
                setMenuOuvert(groupe.key);
              }}
              onMouseLeave={() => fermerBientot(() => setMenuOuvert(null))}
              style={{ position: "relative" }}
            >
              <a
                href={groupe.href ?? "#"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  color: ENCRE,
                }}
              >
                {groupe.label}{" "}
                <span style={{ fontSize: 9 }}>
                  {groupe.items.length > 0 ? "▼" : ""}
                </span>
              </a>
              {menuOuvert === groupe.key && groupe.items.length > 0 ? (
                <div
                  style={{
                    position: "absolute",
                    // Collé au libellé, et non à 26 px : la bande de garde
                    // ci-dessous fait le reste. Un écart nu créait une zone
                    // morte que la souris devait franchir.
                    top: "100%",
                    left: -14,
                    width: 262,
                    background: BLANC,
                    border: `2.5px solid ${ENCRE}`,
                    borderRadius: 18,
                    boxShadow: `5px 5px 0 ${ENCRE}`,
                    padding: 8,
                    // APRÈS le raccourci `padding`, jamais avant : React
                    // sérialise les clés dans l'ordre d'insertion, et
                    // `padding: 8px` écrit ensuite réécrirait les quatre
                    // côtés. La première version faisait exactement cela —
                    // la bande décrite ici n'existait pas, et rien ne le
                    // disait puisque le menu s'affichait quand même.
                    //
                    // Ces deux pixels de plus haut sont la marge d'erreur du
                    // trajet : le panneau touche déjà le libellé, mais la
                    // souris arrive rarement tout droit.
                    paddingTop: 10,
                    textTransform: "none",
                    letterSpacing: 0,
                    zIndex: 50,
                    animation: "popin .14s ease-out",
                  }}
                >
                  {groupe.items.map((m) => {
                    /*
                      ══════════════════════════════════════════════════════
                      UNE ENTRÉE SANS DESTINATION N'EST PAS UN LIEN

                      `href={m.href ?? "#"}` faisait de chaque rubrique à venir
                      un lien cliquable qui ne menait nulle part : on cliquait,
                      la page sautait en haut, et rien d'autre. L'opacité à
                      0,55 suggérait quelque chose, mais un lien grisé reste un
                      lien.

                      La maquette prévoit ces entrées — « Licences », « À
                      propos », « Changelog » — avant que les pages n'existent.
                      Les afficher est donc juste ; les rendre cliquables ne
                      l'est pas.

                      Un `<span>` avec `cursor: default` et « bientôt » : on
                      voit ce qui vient, et on ne clique pas dans le vide.
                    */
                    const Balise = m.href ? "a" : "span";
                    return (
                    <Balise
                      key={m.label}
                      {...(m.href ? { href: m.href } : {})}
                      aria-disabled={m.href ? undefined : true}
                      title={m.href ? undefined : "Bientôt disponible"}
                      className="ligne-menu"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 11,
                        padding: 10,
                        borderRadius: 12,
                        cursor: m.href ? "pointer" : "default",
                        opacity: m.href ? 1 : 0.45,
                      }}
                    >
                      <span
                        style={{
                          width: 30,
                          height: 30,
                          flex: "0 0 auto",
                          border: `2px solid ${ENCRE}`,
                          borderRadius: 9,
                          display: "grid",
                          placeItems: "center",
                          fontSize: 13,
                          background: LAVANDE,
                        }}
                      >
                        {m.glyph}
                      </span>
                      <span>
                        <span
                          style={{
                            display: "block",
                            fontSize: 13.5,
                            fontWeight: 800,
                          }}
                        >
                          {m.label}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: 11,
                            fontWeight: 600,
                            opacity: 0.6,
                          }}
                        >
                          {m.hint}
                        </span>
                        {m.href ? null : (
                          <span
                            style={{
                              marginLeft: "auto",
                              fontFamily: "var(--font-mono)",
                              fontSize: 9,
                              textTransform: "uppercase",
                              letterSpacing: ".08em",
                              opacity: 0.7,
                            }}
                          >
                            bientôt
                          </span>
                        )}
                      </span>
                    </Balise>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
          <button
            type="button"
            style={{
              position: "relative",
              padding: "10px 13px",
              border: `2.5px solid ${ENCRE}`,
              borderRadius: 12,
              background: BLANC,
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: ".06em",
              cursor: "pointer",
            }}
          >
            PANIER
            {cartCount > 0 ? (
              <span
                style={{
                  position: "absolute",
                  top: -8,
                  right: -8,
                  minWidth: 22,
                  height: 22,
                  padding: "0 5px",
                  border: `2.5px solid ${ENCRE}`,
                  borderRadius: 99,
                  background: ORANGE,
                  color: BLANC,
                  fontSize: 11,
                  fontWeight: 800,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {cartCount}
              </span>
            ) : null}
          </button>

          <div
            onMouseEnter={() => {
              annulerFermeture();
              setCompteOuvert(true);
            }}
            onMouseLeave={() => fermerBientot(() => setCompteOuvert(false))}
            style={{ position: "relative" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "6px 12px 6px 6px",
                border: `2.5px solid ${ENCRE}`,
                borderRadius: 14,
                background: LAVANDE_PROFOND,
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 30,
                  border: `2.5px solid ${ENCRE}`,
                  borderRadius: 99,
                  background: `repeating-linear-gradient(135deg,${JAUNE} 0 5px,${BLANC} 5px 11px)`,
                }}
              />
              <span
                title={utilisateur?.nom}
                style={{
                  fontSize: 12.5,
                  fontWeight: 800,
                  // Un nom long ne repousse pas l'en-tête sur deux lignes.
                  maxWidth: 120,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {utilisateur ? utilisateur.nom : "Invité"}
              </span>
            </div>
            {compteOuvert ? (
              <div
                style={{
                  position: "absolute",
                  top: 48,
                  right: 0,
                  width: 268,
                  background: BLANC,
                  border: `2.5px solid ${ENCRE}`,
                  borderRadius: 20,
                  boxShadow: `6px 6px 0 ${ENCRE}`,
                  padding: 10,
                  zIndex: 55,
                  animation: "popin .14s ease-out",
                }}
              >
                {utilisateur ? (
                  <div>
                    {/* La carte d'identité de la maquette, ligne 126. */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 11,
                        padding: 10,
                        border: `2.5px solid ${ENCRE}`,
                        borderRadius: 14,
                        background: LAVANDE_CLAIR,
                      }}
                    >
                      <span
                        style={{
                          width: 38,
                          height: 38,
                          flex: "0 0 auto",
                          border: `2.5px solid ${ENCRE}`,
                          borderRadius: 99,
                          background: `repeating-linear-gradient(135deg,${JAUNE} 0 5px,${BLANC} 5px 11px)`,
                        }}
                      />
                      <span style={{ minWidth: 0 }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: 14,
                            fontWeight: 800,
                          }}
                        >
                          {utilisateur.nom}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: 11,
                            fontWeight: 600,
                            opacity: 0.6,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {utilisateur.email}
                        </span>
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                        marginTop: 8,
                      }}
                    >
                      {liensCompte(utilisateur.username).map((lien) => {
                        // Même règle que les sous-menus de navigation : une
                        // entrée sans page est un `span` et non un `a`. Un lien
                        // qui mène nulle part se clique quand même, et c'est en
                        // arrivant sur un 404 qu'on découvre qu'il ne menait
                        // nulle part.
                        const Balise = lien.href ? "a" : "span";
                        return (
                          <Balise
                            key={lien.label}
                            {...(lien.href ? { href: lien.href } : {})}
                            aria-disabled={lien.href ? undefined : true}
                            title={lien.href ? undefined : "Bientôt disponible"}
                            className="ligne-menu"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "9px 10px",
                              borderRadius: 11,
                              fontSize: 13.5,
                              fontWeight: 700,
                              cursor: lien.href ? "pointer" : "default",
                              opacity: lien.href ? 1 : 0.45,
                            }}
                          >
                            {lien.label}
                            {lien.href ? null : (
                              <span
                                style={{
                                  marginLeft: "auto",
                                  fontFamily: "var(--font-mono)",
                                  fontSize: 9,
                                  textTransform: "uppercase",
                                  letterSpacing: ".08em",
                                  opacity: 0.7,
                                }}
                              >
                                bientôt
                              </span>
                            )}
                          </Balise>
                        );
                      })}
                    </div>

                    <form action={deconnecter} style={{ marginTop: 6 }}>
                      <button
                        type="submit"
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "9px 10px",
                          borderRadius: 11,
                          border: "none",
                          fontFamily: "inherit",
                          fontSize: 13.5,
                          fontWeight: 700,
                          color: ORANGE,
                          background: ORANGE_PALE,
                          cursor: "pointer",
                        }}
                      >
                        Se déconnecter
                      </button>
                    </form>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <a
                      href="/connexion"
                      style={{
                        padding: "11px 12px",
                        border: `2.5px solid ${ENCRE}`,
                        borderRadius: 13,
                        background: JAUNE,
                        textAlign: "center",
                        fontSize: 13.5,
                        fontWeight: 800,
                      }}
                    >
                      Se connecter
                    </a>
                    <a
                      href="/inscription"
                      style={{
                        padding: "11px 12px",
                        border: `2.5px solid ${ENCRE}`,
                        borderRadius: 13,
                        background: LAVANDE_CLAIR,
                        textAlign: "center",
                        fontSize: 13.5,
                        fontWeight: 800,
                      }}
                    >
                      Créer un compte
                    </a>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
