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
  /** Fournisseurs configurés ET branchés : leur bouton mène quelque part. */
  actifs: readonly string[];
  /**
   * Fournisseurs dont les variables sont posées, mais qu'aucune route ne
   * reçoit. Leur bouton reste « Bientôt disponible » : quelqu'un a cru les
   * allumer.
   */
  configuresNonBranches?: readonly string[];
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

  // ──────────────────────────────────────────────────────────────────────────
  // CONFIGURÉ N'EST PAS BRANCHÉ
  //
  // Avant le 08/10/2026, cet écran disait « 1 fournisseur(s) actif(s) :
  // Google » dès que ses variables étaient posées — alors qu'aucune route ne
  // recevait la connexion et que le bouton menait à une 404. Un réglage posé
  // pour rien se signale : la personne qui l'a posé attend un effet qui ne
  // viendra pas.
  const enAttente = faits.configuresNonBranches ?? [];
  if (enAttente.length > 0) {
    return {
      cle: "connexion",
      libelle: "Connexion",
      gravite: "attention",
      detail:
        `Configuré mais non branché : ${enAttente.join(", ")}. ` +
        "Le bouton reste « Bientôt disponible » : aucune route ne reçoit cette connexion." +
        (faits.actifs.length > 0 ? ` Actif(s) : ${faits.actifs.join(", ")}.` : ""),
      remede:
        "Retire ces variables, ou écris la route `app/api/auth/<id>` et passe le fournisseur à branché.",
    };
  }

  if (faits.actifs.length === 0) {
    return {
      cle: "connexion",
      libelle: "Connexion",
      gravite: "attention",
      detail: "Mot de passe seul — aucun fournisseur tiers branché.",
      remede:
        "Un fournisseur s'active quand ses variables sont posées ET qu'une route le reçoit (`lib/auth/providers.ts`).",
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

export interface FaitsLimitation {
  /** Le pilote actif : « memoire », « redis » ou « aucun ». */
  pilote: string;
  production: boolean;
}

/**
 * La limitation compte-t-elle vraiment ?
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UN COMPTEUR EN MÉMOIRE MENT DÈS QU'IL Y A DEUX INSTANCES
 *
 * En développement, compter dans le processus est exactement ce qu'il faut :
 * aucune infrastructure, et la limitation s'éprouve pour de vrai.
 *
 * En production serverless, chaque instance a ses propres compteurs. Dix
 * instances autorisent dix fois la limite, et personne ne s'en aperçoit — la
 * page affiche « protégé », les compteurs tournent, et l'attaque passe. C'est
 * le pire genre de panne : celle qui a l'air de fonctionner.
 *
 * D'où l'avertissement en production, et la panne franche quand on a
 * explicitement demandé à ne rien compter.
 */
export function constatLimitation(faits: FaitsLimitation): Constat {
  if (faits.pilote === "aucun") {
    return {
      cle: "limitation",
      libelle: "Limitation",
      gravite: faits.production ? "panne" : "attention",
      detail: "Désactivée — rien n'est compté.",
      remede:
        "Pose RATE_LIMIT_DRIVER=redis. Sans limitation, la connexion et l'inscription s'essaient sans fin.",
    };
  }

  if (faits.pilote === "memoire") {
    return {
      cle: "limitation",
      libelle: "Limitation",
      gravite: faits.production ? "attention" : "ok",
      detail: faits.production
        ? "Comptée en mémoire — chaque instance a ses propres compteurs."
        : "Comptée en mémoire (développement).",
      remede: faits.production
        ? "Pose RATE_LIMIT_DRIVER=redis et REDIS_URL. En mémoire, dix instances autorisent dix fois la limite."
        : undefined,
    };
  }

  return {
    cle: "limitation",
    libelle: "Limitation",
    gravite: "ok",
    detail: `Comptée par ${faits.pilote}.`,
  };
}

export interface FaitsAntiBot {
  /** Une clé reCAPTCHA est-elle configurée ? */
  tiers: boolean;
  production: boolean;
}

/**
 * L'anti-bot protège-t-il vraiment, et jusqu'où ?
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SANS TIERS, CE N'EST PAS « RIEN » — ET CE N'EST PAS « TOUT »
 *
 * C'est la distinction que cette ligne existe pour porter. Le leurre et le
 * plancher de temps fonctionnent sans clé, sans réseau, sans compte chez
 * personne : ils arrêtent les robots qui remplissent tous les champs et ceux
 * qui postent en cent millisecondes, c'est-à-dire la grande majorité.
 *
 * Ce qu'ils n'arrêtent pas, c'est un robot écrit pour ce site-ci — qui lit le
 * formulaire, saute le champ caché et attend trois secondes. Contre celui-là,
 * il faut un score.
 *
 * Afficher « ok » sans tiers laisserait croire à une protection complète ;
 * afficher « panne » laisserait croire qu'il n'y a rien. Les deux mentiraient,
 * et c'est pourquoi l'état est « attention » en production et « ok » ailleurs.
 */
export function constatAntiBot(faits: FaitsAntiBot): Constat {
  if (faits.tiers) {
    return {
      cle: "antibot",
      libelle: "Anti-bot",
      gravite: "ok",
      detail: "Leurre, plancher de temps et score du tiers.",
    };
  }

  return {
    cle: "antibot",
    libelle: "Anti-bot",
    gravite: faits.production ? "attention" : "ok",
    detail: faits.production
      ? "Leurre et plancher de temps seulement — aucun score de risque."
      : "Leurre et plancher de temps (développement).",
    remede: faits.production
      ? "Pose RECAPTCHA_SECRET. Sans score, un robot écrit pour ce site — qui saute le champ caché et attend trois secondes — passe sans être gêné."
      : undefined,
  };
}

export interface FaitsPlafondPub {
  /** `AUTH_SECRET` est-il posé, et assez long ? Jamais sa valeur. */
  secret: boolean;
  production: boolean;
}

/**
 * Le plafond des bannières par visiteur s'applique-t-il ?
 *
 * Sans `AUTH_SECRET`, `lib/publicites/plafond.ts` compte sans plafonner : une
 * empreinte d'adresse sans secret se retrouve en essayant les quatre milliards
 * d'IPv4, et on préfère ne rien ranger. Le débit à la minute tient toujours ;
 * ce qui saute, c'est la limite par jour — une même adresse peut faire compter
 * quinze mille clics en une nuit.
 *
 * Attention et non panne : rien ne casse pour le visiteur. La connexion n'a
 * pas besoin de cette variable, et les compteurs tournent comme si de rien
 * n'était. Le seul autre signal vient de la lettre d'information, qui refuse
 * de partir sans `AUTH_SECRET` (lib/infolettre/envoi.ts) — mais seulement au
 * moment où quelqu'un clique « Envoyer », et seulement s'il manque : un secret
 * trop court pour le plafond lui suffit. D'où la mention dans le remède.
 */
export function constatPlafondPub(faits: FaitsPlafondPub): Constat {
  if (faits.secret) {
    return {
      cle: "plafond-pub",
      libelle: "Plafond des bannières",
      gravite: "ok",
      detail: "Affichages et clics plafonnés par visiteur et par jour.",
    };
  }

  return {
    cle: "plafond-pub",
    libelle: "Plafond des bannières",
    gravite: faits.production ? "attention" : "ok",
    detail: faits.production
      ? "AUTH_SECRET absent ou trop court : seul le débit à la minute s'applique."
      : "Non appliqué sans AUTH_SECRET (développement).",
    remede: faits.production
      ? "Pose AUTH_SECRET (16 caractères au moins, par exemple `openssl rand -hex 32`). Sans lui, une même adresse fait compter des affichages et des clics sans limite par jour ; absent, il bloque aussi l'envoi de la lettre d'information."
      : undefined,
  };
}

export interface FaitsSms {
  /** Le pilote actif : « aucun », « console » ou le nom d'un opérateur. */
  pilote: string;
  production: boolean;
}

/**
 * Les relances d'abonnement peuvent-elles vraiment partir ?
 *
 * ─────────────────────────────────────────────────────────────────────────
 * « CONSOLE » EN PRODUCTION EST PIRE QU'« AUCUN »
 *
 * C'est contre-intuitif, et c'est pourtant le seul des deux qui soit une panne.
 *
 * « Aucun » rend `false` : Ndank ne note pas la relance, essaie le canal
 * suivant, et compte l'abonné parmi les injoignables. Rien n'est perdu.
 *
 * « Console » rend `true` après avoir simplement écrit le message dans le
 * journal. Ndank note donc une relance qui n'est **jamais partie**, ne la
 * renverra pas, et coupera l'accès au terme de la grâce — à quelqu'un que
 * personne n'a prévenu, et sans qu'aucun compteur ne le signale.
 */
export function constatSms(faits: FaitsSms): Constat {
  if (faits.pilote === "console") {
    return {
      cle: "sms",
      libelle: faits.production ? "SMS SIMULÉ EN PRODUCTION" : "SMS",
      gravite: faits.production ? "panne" : "ok",
      detail: faits.production
        ? "Les relances sont écrites dans le journal et comptées comme envoyées. Les abonnés seront coupés sans avoir été prévenus. La connexion par téléphone, elle, reste fermée : un code écrit dans le journal ouvrirait le compte à qui le lit."
        : "Écrites dans le journal (développement).",
      remede: faits.production
        ? "Pose SMS_DRIVER=twilio, textbee ou smsgate et ses identifiants, ou SMS_DRIVER=aucun — qui, lui, ne prétend rien."
        : undefined,
    };
  }

  if (faits.pilote === "aucun") {
    return {
      cle: "sms",
      libelle: "SMS",
      gravite: faits.production ? "attention" : "ok",
      detail:
        "Aucun opérateur. Les relances d'abonnement ne partent que par courriel.",
      remede: faits.production
        ? "Pose SMS_DRIVER et ses identifiants. Les deux derniers rappels avant coupure passent par SMS : sans lui, un abonné qui ne lit pas ses courriels perd son accès sans avertissement."
        : undefined,
    };
  }

  return {
    cle: "sms",
    libelle: "SMS",
    gravite: "ok",
    detail: `Envoyés par ${faits.pilote}.`,
  };
}

export interface FaitsPush {
  /** Le pilote actif : « web-push » ou « aucun ». */
  pilote: string;
  /** Combien de navigateurs sont enregistrés. */
  appareils: number;
  production: boolean;
}

/**
 * Les notifications peuvent-elles partir ?
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DES APPAREILS ENREGISTRÉS SANS CLÉ EST LE CAS GRAVE
 *
 * Aucune clé et aucun appareil : personne n'a rien accepté, rien n'est promis,
 * et le canal est simplement absent.
 *
 * Mais des appareils enregistrés ALORS que la clé a disparu veut dire que des
 * gens ont accepté les notifications et n'en recevront aucune. Ils croient être
 * prévenus. C'est ce qui arrive quand on régénère une paire VAPID : tous les
 * abonnements existants deviennent muets d'un coup, sans la moindre erreur.
 */
export function constatPush(faits: FaitsPush): Constat {
  if (faits.pilote === "aucun") {
    if (faits.appareils > 0) {
      return {
        cle: "push",
        libelle: "NOTIFICATIONS MUETTES",
        gravite: "panne",
        detail: `${faits.appareils} appareil(s) enregistré(s), et aucune clé pour leur écrire. Ces personnes croient être prévenues.`,
        remede:
          "Repose VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT. Si la paire a changé, les abonnements existants sont définitivement muets : il faut les effacer pour que les gens se réinscrivent.",
      };
    }

    return {
      cle: "push",
      libelle: "Notifications",
      gravite: faits.production ? "attention" : "ok",
      detail: "Aucune clé VAPID. Le bouton d'activation ne s'affiche pas.",
      remede: faits.production
        ? "Pose VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT (pnpm push:cles). Sans elles, les abonnés sur iPhone n'ont que le courriel — et le SMS, qui coûte."
        : undefined,
    };
  }

  return {
    cle: "push",
    libelle: "Notifications",
    gravite: "ok",
    detail: `Actives. ${faits.appareils} appareil(s) enregistré(s).`,
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
