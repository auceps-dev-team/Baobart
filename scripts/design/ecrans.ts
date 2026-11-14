/**
 * La table des écrans : chaque écran dessiné dans `Baobart Design/*.dc.html`,
 * et la route de l'application qui lui répond.
 *
 * Relevé le 14/11/2026 (D1b), à partir du source des maquettes — pas de leurs
 * noms de fichiers. `maquettes.test.ts` vérifie, contre ce même source, que
 * cette table ne contient aucun écran inventé et n'en oublie aucun ; et,
 * contre `app/`, que chaque route citée existe et que chaque route de
 * l'application est soit associée à un écran, soit déclarée sans maquette.
 *
 * `route: null` = l'écran est dessiné, l'application n'en a pas. La note dit
 * quelle tâche de `TACHES.md` le prévoit, quand une le prévoit.
 *
 * Les segments `{…}` d'une route sont résolus par le script de capture dans
 * la base de développement (un produit publié, un abonnement…). Sans donnée,
 * l'écran est noté « non capturé », jamais capturé à tort sur une 404.
 */

export type Compte = "client" | "createur" | "admin" | "agence";

export type Maquette = "Accueil" | "Auth" | "Parcours Achat" | "Dashboard" | "Mobile" | "Badges";

export interface EcranMaquette {
  /** Unique, stable : sert de nom de fichier aux captures. */
  id: string;
  maquette: Maquette;
  /** Tel que la maquette l'affiche (menu, onglet, étiquette). */
  libelle: string;
  /** Valeurs posées dans `state = { … }` (voir `maquettes.ts`). */
  etat?: Record<string, string | number>;
  /** Mobile : la valeur de `data-screen-label`. */
  etiquette?: string;
  route: string | null;
  /** Le compte connecté pour capturer la route ; aucun = visiteur. */
  compte?: Compte;
  note?: string;
}

const accueil = (
  screen: string,
  libelle: string,
  route: string | null,
  extra: Partial<EcranMaquette> = {},
): EcranMaquette => ({
  id: `accueil/${screen}`,
  maquette: "Accueil",
  libelle,
  etat: { screen },
  route,
  ...extra,
});

const doc = (cle: string, libelle: string, route: string): EcranMaquette => ({
  id: `accueil/doc-${cle}`,
  maquette: "Accueil",
  libelle,
  etat: { screen: "doc", docKey: cle },
  route,
});

const tableau = (
  role: "acheteur" | "createur" | "admin",
  cle: string,
  libelle: string,
  route: string | null,
  extra: Partial<EcranMaquette> = {},
): EcranMaquette => ({
  id: `dashboard/${cle}`,
  maquette: "Dashboard",
  libelle,
  etat: { role, key: cle },
  route,
  compte: role === "acheteur" ? "client" : role,
  ...extra,
});

const LOT6 = "Lot 6 — pilotage de l'administration (A4)";

export const ECRANS: EcranMaquette[] = [
  // ── Accueil : le site public ──────────────────────────────────────────
  accueil("home", "Accueil", "/"),
  accueil("explorer", "Explorer les ressources", "/explore"),
  accueil("categorie", "Page catégorie", null, { note: "C6 — une page par catégorie" }),
  {
    id: "accueil/fiche",
    maquette: "Accueil",
    libelle: "Fiche produit (modale)",
    etat: { screen: "home", open: 1 },
    route: "/products/{produit}",
    note: "L'application l'ouvre en modale par app/@modal/(.)products (route interceptée, sans adresse propre) ; capturée ici en page pleine",
  },
  accueil("tarifs", "Tarifs", "/tarifs"),
  accueil("features", "Fonctionnalités", "/fonctionnalites"),
  accueil("sponsor", "Sponsoriser", "/sponsoriser"),
  accueil("concours", "Concours & Événements", "/evenements"),
  accueil("createurs", "Créateurs", "/createurs"),
  accueil("profil", "Profil d'un créateur", "/createurs/{createur}"),
  accueil("services", "Services", "/services"),
  accueil("service_detail", "Fiche d'un service", "/services/{service}"),
  accueil("jobs", "Jobs", "/jobs"),
  accueil("job_detail", "Fiche d'une offre", "/jobs/{job}"),
  accueil("compte", "Mon compte", "/dashboard/apercu", {
    compte: "client",
    note: "Espace de compte à onglets dans le site public ; associé à l'aperçu acheteur, à confirmer",
  }),
  doc("apropos", "À propos", "/a-propos"),
  doc("contact", "Contact", "/contact"),
  doc("blogs", "Blogs", "/blog"),
  doc("support", "Support", "/support"),
  doc("docs", "Documentation Baobart", "/documentation"),
  doc("changelog", "Changelog", "/changelog"),
  doc("licences", "Licences Baobart", "/licences"),
  doc("regles", "Règles de publication", "/regles-de-publication"),
  doc("dmca", "Signalement DMCA", "/signalement"),
  doc("cookies", "Politique de cookies (UE)", "/cookies"),

  // ── Auth ──────────────────────────────────────────────────────────────
  { id: "auth/login", maquette: "Auth", libelle: "Connexion", etat: { mode: "login" }, route: "/connexion" },
  { id: "auth/register", maquette: "Auth", libelle: "Inscription", etat: { mode: "register" }, route: "/inscription" },
  { id: "auth/forgot", maquette: "Auth", libelle: "Mot de passe oublié", etat: { mode: "forgot" }, route: "/mot-de-passe-oublie" },
  {
    id: "auth/nouveau",
    maquette: "Auth",
    libelle: "Nouveau mot de passe",
    etat: { mode: "nouveau" },
    route: "/reinitialiser/{jetonValide}",
    note: "Demande un jeton de réinitialisation valide",
  },
  {
    id: "auth/perime",
    maquette: "Auth",
    libelle: "Lien périmé",
    etat: { mode: "perime" },
    route: "/reinitialiser/{jetonPerime}",
    note: "Demande un jeton de réinitialisation expiré",
  },
  {
    id: "auth/inconnu",
    maquette: "Auth",
    libelle: "Lien inconnu",
    etat: { mode: "inconnu" },
    route: "/reinitialiser/jeton-inconnu-d1b",
  },

  // ── Parcours d'achat ──────────────────────────────────────────────────
  {
    id: "parcours/pay",
    maquette: "Parcours Achat",
    libelle: "Moyen de paiement",
    etat: { screen: "pay" },
    route: "/acheter/{produit}",
    compte: "client",
    note: "La maquette nomme la route /achat/nouveau ; l'application l'appelle /acheter/[slug]",
  },
  {
    id: "parcours/return",
    maquette: "Parcours Achat",
    libelle: "Retour opérateur",
    etat: { screen: "return" },
    route: "/achat/{commande}",
    compte: "client",
  },
  {
    id: "parcours/renew",
    maquette: "Parcours Achat",
    libelle: "Renouveler",
    etat: { screen: "renew" },
    route: "/abonnement/{abonnement}/renouveler",
    compte: "agence",
  },
  {
    id: "parcours/renewret",
    maquette: "Parcours Achat",
    libelle: "Retour renouvellement",
    etat: { screen: "renewret" },
    route: "/abonnement/{abonnement}/paiement/{paiementAbonnement}",
    compte: "agence",
  },
  {
    id: "parcours/notifs",
    maquette: "Parcours Achat",
    libelle: "Notifications (forfait)",
    etat: { screen: "notifs" },
    route: "/dashboard/forfait",
    compte: "client",
  },
  { id: "parcours/404", maquette: "Parcours Achat", libelle: "404", etat: { screen: "404" }, route: "/introuvable-d1b" },
  {
    id: "parcours/error",
    maquette: "Parcours Achat",
    libelle: "Erreur",
    etat: { screen: "error" },
    route: null,
    note: "app/error.tsx existe, mais ne se provoque pas sans casser une page",
  },
  {
    id: "parcours/loading",
    maquette: "Parcours Achat",
    libelle: "Chargement",
    etat: { screen: "loading" },
    route: null,
    note: "État transitoire de /explore : pas de capture stable",
  },

  // ── Dashboard : acheteur ──────────────────────────────────────────────
  tableau("acheteur", "apercu", "Aperçu", "/dashboard/apercu"),
  tableau("acheteur", "profil", "Profil", "/dashboard/profil"),
  tableau("acheteur", "bibliotheque", "Ma bibliothèque", "/dashboard/bibliotheque"),
  tableau("acheteur", "achats", "Historique des achats", "/dashboard/achats"),
  tableau("acheteur", "telechargements", "Historique des téléchargements", "/dashboard/telechargements"),
  tableau("acheteur", "suivis", "Éléments suivis", "/dashboard/suivis"),
  tableau("acheteur", "notifs", "Notifications", "/dashboard/notifications"),
  tableau("acheteur", "collections", "Mes collections", "/dashboard/collections"),
  tableau("acheteur", "abonnements_suivis", "Abonnements", "/dashboard/abonnements"),
  tableau("acheteur", "abonnement", "Forfait & pass d'accès", "/dashboard/forfait"),
  tableau("acheteur", "vendeur", "Devenir vendeur", "/dashboard/devenir-vendeur"),

  // ── Dashboard : créateur ──────────────────────────────────────────────
  tableau("createur", "c_apercu", "Tableau de bord", "/dashboard"),
  tableau("createur", "c_produits", "Produits", "/dashboard/produits"),
  tableau("createur", "c_publier", "Ajouter un produit", "/dashboard/produits/nouveau"),
  tableau("createur", "c_revenus", "Gains", "/dashboard/gains"),
  tableau("createur", "c_commandes", "Commandes", "/dashboard/commandes"),
  tableau("createur", "c_ventes", "Ventes", "/dashboard/ventes"),
  tableau("createur", "c_ventes_ops", "Remboursements", "/dashboard/ventes/remboursements"),
  tableau("createur", "c_commissions", "Commissions", "/dashboard/commissions"),
  tableau("createur", "c_versements", "Versements", "/dashboard/versements"),
  tableau("createur", "c_promos", "Promotions", "/dashboard/promos"),
  tableau("createur", "c_promos_upsell", "Promotions · Offres après achat", null, {
    note: "Onglet de /dashboard/promos dans la maquette ; aucun équivalent trouvé dans app/ (à confirmer à la relecture)",
  }),
  tableau("createur", "c_stats", "Statistiques", "/dashboard/statistiques"),
  tableau("createur", "c_profil", "Profil de la boutique", "/dashboard/boutique"),
  tableau("createur", "c_candidatures", "Candidatures", "/dashboard/jobs/{jobAgence}/candidatures", { compte: "agence" }),
  tableau("createur", "c_dossiers", "Mes dossiers", "/dashboard/mes-dossiers"),
  tableau("createur", "c_notifs", "Notifications", "/dashboard/notifications"),
  tableau("createur", "c_purchases", "Mes achats", "/dashboard/achats"),
  tableau("createur", "c_suivre", "Suivre les détails", null, { note: "Lot 5 — abonnés du créateur (A5)" }),
  tableau("createur", "c_allaccess", "All Access", null, { note: "Lot 8 — Pass All Access (A6)" }),
  tableau("createur", "c_subscription", "Abonnement", "/dashboard/forfait"),
  tableau("createur", "c_avis", "Créateur feedback", "/dashboard/avis"),

  // ── Dashboard : administration ────────────────────────────────────────
  tableau("admin", "a_apercu", "Vue d'ensemble", null, { note: LOT6 }),
  tableau("admin", "a_moderation", "File de modération", "/dashboard/moderation"),
  tableau("admin", "a_signalements", "Signalements & DMCA", "/dashboard/signalements"),
  tableau("admin", "a_rembours", "Remboursements à trancher", "/dashboard/remboursements-a-trancher"),
  tableau("admin", "a_messages", "Messages reçus", "/dashboard/messages-recus"),
  tableau("admin", "a_membres", "Membres", "/dashboard/systeme/membres"),
  tableau("admin", "a_membres_risque", "Décisions de risque", null, {
    note: "Aucune route dédiée dans app/ (à confirmer : peut-être dans /dashboard/systeme/membres)",
  }),
  tableau("admin", "a_boutiques", "Boutiques créateurs", null, { note: LOT6 }),
  tableau("admin", "a_catalogue", "Catalogue", null, { note: LOT6 }),
  tableau("admin", "a_finances", "Finances plateforme", null, { note: LOT6 }),
  tableau("admin", "a_versements", "Versements créateurs", "/dashboard/systeme/versements"),
  tableau("admin", "a_abonnements", "Abonnements", null, { note: LOT6 }),
  tableau("admin", "a_jobs", "Jobs & services", null, { note: "Aucune route d'administration des jobs dans app/" }),
  tableau("admin", "a_editorial", "Contenus éditoriaux", null, { note: "B2 / C10 — sélection éditoriale" }),
  tableau("admin", "a_blog", "Blog", "/dashboard/blog"),
  tableau("admin", "a_blog_edit", "Blog · Éditeur", "/dashboard/blog/nouveau"),
  tableau("admin", "a_evenements", "Événements", "/dashboard/evenements"),
  tableau("admin", "a_evt_fiche", "Événements · Fiche", "/dashboard/evenements/{evenement}"),
  tableau("admin", "a_evt_inscrits", "Événements · Inscrits", "/dashboard/evenements/{evenement}/inscrits"),
  tableau("admin", "a_evt_new", "Événements · Nouvel événement", "/dashboard/evenements/nouveau"),
  tableau("admin", "a_publicites", "Publicités", "/dashboard/publicites"),
  tableau("admin", "a_pub_detail", "Publicités · Détail", "/dashboard/publicites/{publicite}"),
  tableau("admin", "a_pub_new", "Publicités · Nouvelle publicité", "/dashboard/publicites/nouvelle"),
  tableau("admin", "a_infolettre", "Lettre d'information", "/dashboard/infolettre"),
  tableau("admin", "a_temoignages", "Témoignages", "/dashboard/temoignages"),
  tableau("admin", "a_taxonomie", "Catégories & tags", null, { note: LOT6 }),
  tableau("admin", "a_equipe", "Équipe & rôles", null, {
    note: "/dashboard/statuts accorde des statuts de créateur, pas des rôles d'équipe (lu dans lib/dashboard/nav.ts)",
  }),
  tableau("admin", "a_journal", "Journal d'activité", null, { note: LOT6 }),
  tableau("admin", "a_reglages", "Réglages plateforme", null, { note: LOT6 }),
  tableau("admin", "a_sys_versements", "Système · Versements", "/dashboard/systeme/versements"),
  tableau("admin", "a_sys_config", "Système · Configuration", "/dashboard/systeme/configuration"),
  tableau("admin", "a_sys_emails", "Système · Emails", "/dashboard/systeme/emails"),
  tableau("admin", "a_sys_paiements", "Système · Paiements", "/dashboard/systeme/paiements"),
  tableau("admin", "a_sys_blocklist", "Système · Liste de blocage", "/dashboard/systeme/blocklist"),

  // ── Mobile : comparé à l'application à 360 px ─────────────────────────
  { id: "mobile/01", maquette: "Mobile", libelle: "Logo / lancement", etiquette: "01 Splash", route: null, note: "Écran de lancement : relève du manifeste de l'application installée, pas d'une route" },
  { id: "mobile/02", maquette: "Mobile", libelle: "Connexion", etiquette: "02 Auth", route: "/connexion" },
  { id: "mobile/03", maquette: "Mobile", libelle: "Accueil", etiquette: "03 Accueil", route: "/" },
  { id: "mobile/04", maquette: "Mobile", libelle: "Dashboard créateur", etiquette: "04 Dashboard", route: "/dashboard", compte: "createur" },
  { id: "mobile/05", maquette: "Mobile", libelle: "Paiement", etiquette: "05 Paiement", route: "/acheter/{produit}", compte: "client" },
  { id: "mobile/06", maquette: "Mobile", libelle: "Badges", etiquette: "06 Badges", route: "/dashboard/badges", compte: "createur" },
  { id: "mobile/07", maquette: "Mobile", libelle: "Catalogue", etiquette: "07 Catalogue", route: "/explore" },
  { id: "mobile/08", maquette: "Mobile", libelle: "Fiche produit", etiquette: "08 Fiche produit", route: "/products/{produit}" },
  { id: "mobile/09", maquette: "Mobile", libelle: "Mes produits", etiquette: "09 Mes produits", route: "/dashboard/produits", compte: "createur" },
  { id: "mobile/10", maquette: "Mobile", libelle: "Statistiques", etiquette: "10 Statistiques", route: "/dashboard/statistiques", compte: "createur" },

  // ── Badges : une planche, la page qui l'affiche ───────────────────────
  { id: "badges/planche", maquette: "Badges", libelle: "Planche des badges", route: "/dashboard/badges", compte: "createur" },
];

/**
 * Les routes de l'application qu'aucun écran de maquette ne dessine.
 *
 * Capturées quand même, aux trois largeurs : les mesures (débordement, cibles,
 * champs) valent pour toutes les pages, dessinées ou non.
 */
export const ROUTES_SANS_MAQUETTE: { route: string; compte?: Compte; note?: string }[] = [
  { route: "/blog/{blog}", note: "Un article ; la maquette ne dessine que la liste (« Blogs »)" },
  { route: "/communautes" },
  { route: "/communautes/{communaute}" },
  { route: "/communautes/nouvelle", compte: "createur" },
  { route: "/conditions" },
  { route: "/confidentialite" },
  { route: "/connexion/telephone" },
  { route: "/connexion/verification" },
  { route: "/evenements/{evenementPublic}" },
  { route: "/infolettre/confirmer" },
  { route: "/infolettre/desinscription" },
  { route: "/jobs/deposer", compte: "agence" },
  { route: "/jobs/{job}/postuler", compte: "client" },
  { route: "/jobs/mes-propositions", compte: "client" },
  { route: "/services/deposer", compte: "agence" },
  { route: "/signalement/deposer" },
  { route: "/dashboard/blog/{articleAdmin}", compte: "admin" },
  { route: "/dashboard/collections/{collection}", compte: "client" },
  { route: "/dashboard/notifications/reglages", compte: "client" },
  { route: "/dashboard/produits/{produitCreateur}", compte: "createur" },
  { route: "/dashboard/remboursements", compte: "client", note: "Remboursements côté acheteur : absents du menu acheteur de la maquette" },
  { route: "/dashboard/statuts", compte: "admin" },
  { route: "/dashboard/temoignage", compte: "client" },
  { route: "/labo/animata", note: "Labo, fermé en production" },
  { route: "/labo/boutons", note: "Labo, fermé en production" },
  { route: "/labo/explorations", note: "Labo, fermé en production" },
  { route: "/labo/icones", note: "Labo, fermé en production" },
];
