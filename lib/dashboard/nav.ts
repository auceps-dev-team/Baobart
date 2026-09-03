import { peut, type Pouvoir, type RolePlateforme } from "@/lib/auth/administration";
import type { EtapeCompte } from "@/lib/auth/roles";

/**
 * Navigation du tableau de bord, reprise de « Baobart Dashboard.dc.html »
 * (constante `NAV`), et rendue **progressive**.
 *
 * Trois états, une seule liste :
 *
 *   ACHETEUR   les entrées acheteur, plus une seule porte vers la création.
 *   ATELIER    les entrées créateur apparaissent, grisées — sauf celles qui
 *              servent à travailler le brouillon qu'on vient de créer. Les
 *              griser sans exception rendrait ce brouillon inatteignable.
 *   BOUTIQUE   tout est ouvert.
 *
 * Montrer les entrées grisées plutôt que de les cacher est un choix : elles
 * apprennent le produit. Quelqu'un qui vient de déposer un brouillon voit ce
 * que la publication va lui ouvrir.
 */

export interface EntreeNav {
  cle: string;
  label: string;
  glyph: string;
  href: string | null;
  /** Pastille de la maquette (« NEW », un compteur…). */
  badge?: string;
  /**
   * Le pouvoir qu'il faut porter pour que cette entrée s'affiche.
   *
   * ─────────────────────────────────────────────────────────────────
   * ELLE NE PROTÈGE RIEN
   *
   * Cacher une entrée de menu ne ferme aucune porte : la garde vit dans la
   * page et dans l'action. Ce champ sert à ne pas MENTIR — montrer « File de
   * modération » à un comptable lui promettrait un écran qui répondra 404.
   */
  pouvoir?: Pouvoir;
}

export interface EntreeNavRendue extends EntreeNav {
  actif: boolean;
  /** Ce qui débloquera l'entrée. `null` quand elle est déjà active. */
  raisonVerrou: string | null;
}

/** Entrées acheteur — présentes à tous les paliers. */
const ACHETEUR: EntreeNav[] = [
  { cle: "apercu", label: "Aperçu", glyph: "◈", href: "/dashboard" },
  { cle: "profil", label: "Profil", glyph: "☺", href: "/dashboard/profil" },
  {
    cle: "achats",
    label: "Historique des achats",
    glyph: "▤",
    href: "/dashboard/achats",
  },
  {
    cle: "telechargements",
    label: "Historique des téléchargements",
    glyph: "↓",
    href: "/dashboard/telechargements",
  },
  { cle: "suivis", label: "Éléments suivis", glyph: "♥", href: "/dashboard/suivis" },
  { cle: "collections", label: "Mes collections", glyph: "⌸", href: "/dashboard/collections" },
  {
    cle: "abonnements_suivis",
    label: "Abonnements",
    glyph: "☍",
    href: "/dashboard/abonnements",
  },
  { cle: "abonnement", label: "Forfait & pass d'accès", glyph: "◉", href: "/dashboard/forfait" },
];

/**
 * Entrées créateur.
 *
 * `desLAtelier` marque celles qui restent utilisables dès le premier brouillon :
 * sans elles, on ne pourrait pas atteindre ce qu'on vient de créer.
 */
const CREATEUR: Array<EntreeNav & { desLAtelier?: boolean }> = [
  {
    cle: "c_apercu",
    label: "Tableau de bord",
    glyph: "◈",
    href: "/dashboard",
    desLAtelier: true,
  },
  {
    cle: "c_produits",
    label: "Produits",
    glyph: "▦",
    href: "/dashboard/produits",
    desLAtelier: true,
  },
  {
    cle: "c_publier",
    label: "Ajouter un produit",
    glyph: "+",
    href: "/dashboard/produits/nouveau",
    desLAtelier: true,
  },
  { cle: "c_revenus", label: "Gains", glyph: "◎", href: "/dashboard/gains" },
  {
    cle: "c_versements",
    label: "Versements",
    glyph: "◈",
    href: "/dashboard/versements",
  },
  { cle: "c_commandes", label: "Commandes", glyph: "▤", href: "/dashboard/commandes" },
  { cle: "c_ventes", label: "Ventes", glyph: "◫", href: "/dashboard/ventes" },
  { cle: "c_commissions", label: "Commissions", glyph: "%", href: "/dashboard/commissions" },
  { cle: "c_stats", label: "Statistiques", glyph: "▲", href: "/dashboard/statistiques" },
  { cle: "c_profil", label: "Profil de la boutique", glyph: "☺", href: "/dashboard/boutique" },
  { cle: "c_avis", label: "Créateur feedback", glyph: "✎", href: "/dashboard/avis" },
];

/** La porte unique offerte à un acheteur qui n'a encore rien créé. */
const PORTE_CREATION: EntreeNav = {
  cle: "c_publier",
  label: "Devenir vendeur",
  glyph: "★",
  href: "/dashboard/produits/nouveau",
  badge: "NEW",
};

export interface Groupe {
  titre: string | null;
  entrees: EntreeNavRendue[];
}

const RAISON_ATELIER =
  "Disponible dès que tu déposes un premier produit, même en brouillon.";
const RAISON_BOUTIQUE = "Disponible une fois ton premier produit publié.";

/**
 * Entrées réservées à l'administration de la plateforme.
 *
 * La maquette en prévoit quinze ; seules celles dont l'écran existe figurent
 * ici. Une entrée de menu qui mène à une page vide coûte plus cher qu'une
 * entrée absente : elle donne à croire que la fonction existe.
 */
const ADMINISTRATION: EntreeNav[] = [
  {
    cle: "a_moderation",
    label: "File de modération",
    glyph: "⚑",
    href: "/dashboard/moderation",
    pouvoir: "moderer_le_contenu",
  },
  {
    cle: "a_sys_config",
    pouvoir: "consulter_le_systeme" as const,
    label: "Système · Configuration",
    glyph: "◧",
    href: "/dashboard/systeme/configuration",
  },
  {
    cle: "a_sys_emails",
    pouvoir: "consulter_le_systeme" as const,
    label: "Système · Emails",
    glyph: "✉",
    href: "/dashboard/systeme/emails",
  },
  {
    cle: "a_sys_paiements",
    pouvoir: "consulter_le_systeme" as const,
    label: "Système · Paiements",
    glyph: "⇄",
    href: "/dashboard/systeme/paiements",
  },
  {
    cle: "a_versements",
    label: "Versements créateurs",
    glyph: "%",
    href: "/dashboard/systeme/versements",
  },
  {
    cle: "a_membres",
    label: "Membres",
    glyph: "☺",
    href: "/dashboard/systeme/membres",
  },
];

export function navigationPour(
  etape: EtapeCompte,
  /**
   * MEMBER par défaut : un appelant qui oublie ce paramètre n'expose pas
   * l'administration par inadvertance.
   *
   * ─────────────────────────────────────────────────────────────────────
   * UN RÔLE, PAS UN BOOLÉEN
   *
   * C'était `administrateur: boolean`, et cela tenait tant que tout
   * administrateur pouvait tout voir. Depuis que les rôles sont fonctionnels,
   * un modérateur n'est pas « administrateur » au sens des écrans Système : le
   * booléen lui aurait caché **son propre écran**, ou lui aurait montré la base
   * de données.
   *
   * C'est le même piège que dans `exigerLePouvoir`, un étage plus haut.
   */
  role: RolePlateforme = "MEMBER",
): Groupe[] {
  const entreesAdmin = ADMINISTRATION.filter(
    (e) => e.pouvoir === undefined || peut(role, e.pouvoir),
  );

  const admin: Groupe[] =
    entreesAdmin.length > 0
      ? [
          {
            titre: "Plateforme",
            entrees: entreesAdmin.map((e) => ({
              ...e,
              actif: true,
              raisonVerrou: null,
            })),
          },
        ]
      : [];

  const acheteur: EntreeNavRendue[] = ACHETEUR.map((e) => ({
    ...e,
    actif: true,
    raisonVerrou: null,
  }));

  if (etape === "ACHETEUR") {
    // Une seule porte, en évidence : rien ne sert de montrer douze entrées
    // grisées à quelqu'un qui n'a pas encore l'idée de vendre.
    return [
      { titre: null, entrees: acheteur },
      {
        titre: "Vendre",
        entrees: [{ ...PORTE_CREATION, actif: true, raisonVerrou: null }],
      },
      ...admin,
    ];
  }

  const ouvertePartout = etape === "BOUTIQUE";

  const createur: EntreeNavRendue[] = CREATEUR.map((e) => {
    const actif = ouvertePartout || e.desLAtelier === true;
    return {
      cle: e.cle,
      label: e.label,
      glyph: e.glyph,
      href: e.href,
      ...(e.badge ? { badge: e.badge } : {}),
      actif,
      raisonVerrou: actif ? null : RAISON_BOUTIQUE,
    };
  });

  return [
    { titre: null, entrees: acheteur },
    { titre: "Ma boutique", entrees: createur },
    ...admin,
  ];
}

/**
 * Texte d'accompagnement affiché en tête du tableau de bord.
 *
 * Prend la progression entière, pas seulement le palier : un compte qui a vendu
 * puis tout retiré est au palier BOUTIQUE — son historique le lui garde — mais
 * n'a plus rien en vente. Lui annoncer « ta boutique est en ligne » serait faux.
 */
export function messageProgression(progression: {
  etape: EtapeCompte;
  aPublie: boolean;
}): string {
  switch (progression.etape) {
    case "ACHETEUR":
      return "Dépose un premier produit quand tu veux — ton espace vendeur s'ouvrira tout seul.";
    case "ATELIER":
      return "Ton atelier est ouvert. Le reste s'activera à ta première publication.";
    case "BOUTIQUE":
      return progression.aPublie
        ? "Ta boutique est en ligne."
        : "Plus rien en vente pour le moment — tes gains et ton historique restent accessibles.";
  }
}

export { RAISON_ATELIER, RAISON_BOUTIQUE };
