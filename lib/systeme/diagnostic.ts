/**
 * Lire l'état de la plateforme et dire ce qui cloche.
 *
 * L'écran de configuration existe pour une question précise : « le déploiement
 * ne marche pas, pourquoi ? ». Une liste de variables cochées n'y répond pas —
 * elle dit ce qui est renseigné, pas ce qui est cassé. Ce module classe donc
 * chaque constat par gravité et, quand il y a quelque chose à faire, dit quoi.
 *
 * Pur, volontairement : il reçoit des faits déjà collectés. Les règles qu'il
 * applique — une migration en retard est une panne, un aperçu en HTTP sur un
 * site en HTTPS aussi — sont exactement ce qu'on veut pouvoir éprouver sans
 * base ni stockage.
 */

export type Gravite = "ok" | "attention" | "panne";

export interface Constat {
  cle: string;
  libelle: string;
  gravite: Gravite;
  /** L'état, en une phrase lisible par quelqu'un qu'on réveille la nuit. */
  detail: string;
  /** Ce qu'il faut faire. Absent quand il n'y a rien à faire. */
  remede?: string;
}

/** Le pire l'emporte : un bandeau vert au-dessus d'une panne ne sert personne. */
export function graviteGlobale(constats: readonly Constat[]): Gravite {
  if (constats.some((c) => c.gravite === "panne")) return "panne";
  if (constats.some((c) => c.gravite === "attention")) return "attention";
  return "ok";
}

export interface FaitsBase {
  joignable: boolean;
  /** Migrations présentes dans le dépôt mais pas encore appliquées. */
  enAttente: number;
}

export function constatBase(faits: FaitsBase): Constat {
  if (!faits.joignable) {
    return {
      cle: "base",
      libelle: "Base de données",
      gravite: "panne",
      detail: "Injoignable.",
      remede:
        "Vérifie DATABASE_URL et que la base accepte les connexions depuis cet hébergeur.",
    };
  }

  // Une migration en attente n'est pas un avertissement : le code déployé
  // attend des colonnes qui n'existent pas, et la panne surgira à la première
  // requête qui les touche — pas au démarrage.
  if (faits.enAttente > 0) {
    return {
      cle: "base",
      libelle: "Base de données",
      gravite: "panne",
      detail: `${faits.enAttente} migration(s) non appliquée(s).`,
      remede: "Joue `pnpm db:deploy` avec DIRECT_URL avant de servir du trafic.",
    };
  }

  return {
    cle: "base",
    libelle: "Base de données",
    gravite: "ok",
    detail: "Joignable, schéma à jour.",
  };
}

export interface FaitsStockage {
  configure: boolean;
  /** `S3_PUBLIC_URL`, telle quelle — jamais les clés d'accès. */
  urlPublique: string | null;
  production: boolean;
}

function estLocale(hote: string): boolean {
  return hote === "localhost" || hote === "127.0.0.1" || hote.endsWith(".local");
}

export function constatStockage(faits: FaitsStockage): Constat {
  if (!faits.configure) {
    return {
      cle: "stockage",
      libelle: "Stockage des fichiers",
      gravite: "panne",
      detail: "Non configuré : aucun envoi ni téléchargement possible.",
      remede: "Renseigne S3_ENDPOINT, S3_ACCESS_KEY_ID et S3_SECRET_ACCESS_KEY.",
    };
  }

  if (!faits.urlPublique) {
    return {
      cle: "stockage",
      libelle: "Stockage des fichiers",
      gravite: "attention",
      detail: "S3_PUBLIC_URL absente : les aperçus retombent sur S3_ENDPOINT.",
      remede: "Renseigne S3_PUBLIC_URL avec l'adresse publique du bucket.",
    };
  }

  let hote: string;
  let protocole: string;
  try {
    const url = new URL(faits.urlPublique);
    hote = url.hostname;
    protocole = url.protocol;
  } catch {
    return {
      cle: "stockage",
      libelle: "Stockage des fichiers",
      gravite: "panne",
      detail: "S3_PUBLIC_URL n'est pas une adresse valide.",
      remede: "Attendu une URL complète, par exemple https://media.exemple.com.",
    };
  }

  // Un aperçu servi en HTTP depuis une page en HTTPS est bloqué par le
  // navigateur : la grille se vide sans qu'aucune erreur ne remonte au serveur.
  if (faits.production && protocole !== "https:") {
    return {
      cle: "stockage",
      libelle: "Stockage des fichiers",
      gravite: "panne",
      detail: `Aperçus servis en ${protocole.replace(":", "")} — le navigateur les refusera.`,
      remede: "Passe S3_PUBLIC_URL en https.",
    };
  }

  if (faits.production && estLocale(hote)) {
    return {
      cle: "stockage",
      libelle: "Stockage des fichiers",
      gravite: "panne",
      detail: `S3_PUBLIC_URL pointe sur « ${hote} », que personne d'autre n'atteint.`,
      remede: "MinIO local ne convient pas en production : passe sur R2, S3 ou équivalent.",
    };
  }

  return {
    cle: "stockage",
    libelle: "Stockage des fichiers",
    gravite: "ok",
    detail: `Aperçus servis depuis ${hote}.`,
  };
}

export interface FaitsConnexion {
  /** Identifiants des fournisseurs dont toutes les variables sont posées. */
  actifs: readonly string[];
  /** Le mot de passe reste-t-il une voie d'entrée ? */
  motDePasse: boolean;
}

export function constatConnexion(faits: FaitsConnexion): Constat {
  if (faits.actifs.length === 0 && !faits.motDePasse) {
    return {
      cle: "connexion",
      libelle: "Connexion",
      gravite: "panne",
      detail: "Aucun moyen de se connecter.",
      remede: "Configure au moins un fournisseur, ou rouvre le mot de passe.",
    };
  }

  if (faits.actifs.length === 0) {
    return {
      cle: "connexion",
      libelle: "Connexion",
      gravite: "attention",
      detail: "Mot de passe seul — aucun fournisseur tiers configuré.",
      remede: "Renseigne toutes les variables d'un fournisseur pour l'activer.",
    };
  }

  return {
    cle: "connexion",
    libelle: "Connexion",
    gravite: "ok",
    detail: `${faits.actifs.length} fournisseur(s) actif(s) : ${faits.actifs.join(", ")}.`,
  };
}

export interface FaitsAdressePublique {
  /** Ce que rend `urlDuSite()` — déjà validée, ou `null`. */
  origine: string | null;
  production: boolean;
}

/**
 * L'adresse publique du site est-elle posée ?
 *
 * Sans elle, aucun courriel ne peut porter de lien : ni la réinitialisation du
 * mot de passe, ni les liens de téléchargement. Le manque ne casse rien au
 * démarrage — il casse une fonctionnalité que personne ne teste avant d'en
 * avoir besoin, un soir, en urgence. D'où la panne plutôt que l'avertissement.
 *
 * Une adresse en HTTP sur un site en production est un problème distinct : le
 * lien de réinitialisation est un identifiant temporaire, et le laisser
 * traverser un réseau en clair revient à l'écrire sur la vitre.
 */
export function constatAdressePublique(faits: FaitsAdressePublique): Constat {
  if (!faits.origine) {
    return {
      cle: "adresse-publique",
      libelle: "Adresse publique",
      gravite: "panne",
      detail: "Absente — aucun courriel ne peut porter de lien.",
      remede:
        "Renseigne APP_URL avec l'adresse du site, protocole compris : https://baobart.com",
    };
  }

  if (faits.production && faits.origine.startsWith("http://")) {
    return {
      cle: "adresse-publique",
      libelle: "Adresse publique",
      gravite: "panne",
      detail: `${faits.origine} — en clair, alors qu'elle porte des liens de réinitialisation.`,
      remede: "Passe APP_URL en HTTPS.",
    };
  }

  return {
    cle: "adresse-publique",
    libelle: "Adresse publique",
    gravite: "ok",
    detail: `${faits.origine}.`,
  };
}

export interface FaitsSimulation {
  ouverte: boolean;
  production: boolean;
}

/**
 * Le paiement simulé est-il ouvert ?
 *
 * En développement, c'est l'outil qui permet d'éprouver la chaîne d'achat sans
 * opérateur. En production, c'est deux dégâts à la fois : les ressources
 * payantes se prennent gratuitement, et les créateurs sont crédités d'un argent
 * qui n'est jamais entré — dette de versement fabriquée de toutes pièces. D'où
 * la panne, et pas un simple avertissement.
 */
export function constatSimulation(faits: FaitsSimulation): Constat {
  if (!faits.ouverte) {
    return {
      cle: "simulation",
      libelle: "Paiement",
      gravite: "ok",
      detail: "Aucun paiement simulé. Les ressources payantes ne s'achètent pas.",
    };
  }

  if (faits.production) {
    return {
      cle: "simulation",
      libelle: "Paiement simulé EN PRODUCTION",
      gravite: "panne",
      detail:
        "Les ressources payantes se prennent sans payer, et les créateurs sont crédités d'un argent qui n'est jamais entré.",
      remede:
        "Retire CHECKOUT_SIMULATION_ENABLED, puis vérifie les commandes dont le fournisseur vaut « simulation ».",
    };
  }

  return {
    cle: "simulation",
    libelle: "Paiement simulé",
    gravite: "attention",
    detail:
      "Les achats aboutissent sans qu'aucun argent ne circule. Les commandes portent le fournisseur « simulation ».",
    remede: "À ne jamais poser en production.",
  };
}

export interface FaitsInterrupteurs {
  fermees: readonly string[];
}

export function constatInterrupteurs(faits: FaitsInterrupteurs): Constat {
  if (faits.fermees.length === 0) {
    return {
      cle: "interrupteurs",
      libelle: "Interrupteurs",
      gravite: "ok",
      detail: "Toutes les fonctionnalités livrées sont ouvertes.",
    };
  }

  // Attention et non panne : une fermeture est une décision, pas un incident.
  // Mais elle doit rester visible — une fermeture oubliée après un incident
  // ressemble, une semaine plus tard, à une fonctionnalité cassée.
  return {
    cle: "interrupteurs",
    libelle: "Interrupteurs",
    gravite: "attention",
    detail: `Fermé volontairement : ${faits.fermees.join(", ")}.`,
    remede: "Retire la variable FEATURE_… correspondante pour rouvrir.",
  };
}
