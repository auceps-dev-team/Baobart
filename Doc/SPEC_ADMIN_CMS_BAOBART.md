# Baobart — Spécification Super Admin & CMS (Point J)

**Back-office Baobart : blogs, événements, jobs, services + modération + paiements**
**Document J — v1.0 — août 2026**

> Complète le plan directeur (§3.6 sécurité/ops, §3.8 moteur de confiance) et le blueprint (`BLUEPRINT_NEXTJS_BAOBART.md`). Ce document détaille le **back-office interne** de la plateforme : un **Super Admin** central + un **CMS** pour les 4 contenus éditoriaux (blogs, événements, jobs, services), intégrant la **modération**, la **gestion utilisateurs/vendeurs**, les **payouts** et l'**audit** — en reprenant les patterns admin de Gumroad (file de revue, staff picked, suspension massive, audits).

---

## 1. Objectif & périmètre

| Domaine | Contenu |
|---|---|
| **Super Admin** | Dashboard global, gestion utilisateurs/vendeurs (risk states, suspension, KYC), revue des nouveaux vendeurs, payouts (vue d'ensemble, retry), modération de tout le contenu, feature flags, médias |
| **CMS Blogs** | Rédaction/publication des articles « Quoi de neuf » (maquette) : éditeur riche, catégories, SEO, planification |
| **CMS Événements** | Création/gestion des événements & concours (jury, prix, compte à rebours), inscriptions, promotion |
| **CMS Jobs** | Gestion des offres, **vérification des recruteurs** (badge « Offre vérifiée »), modération anti-arnaque, mise en avant, paiement |
| **CMS Services** | Catégories, modération des offres de service, mise en avant, litiges |

**Principes** :
1. **Séparé de l'app publique** : `/admin` (route group Next.js) avec **sa propre auth** (`AdminUser`) et RBAC strict.
2. **Tout est audité** : chaque action admin → `AuditLog` (qui, quoi, quand — pattern Gumroad `admin_api_audit_log` + notre §9.4).
3. **Workflows** : contenu = brouillon → relecture → publié ; contenu utilisateur = soumis → modéré → approuvé/rejeté (avec motif).
4. **En français** (back-office FR — équipe Baobart).
5. **Mobiles-responsif mais optimisé desktop** (les admins sont sur desktop).

---

## 2. Architecture & navigation

```
app/admin/
├── layout.tsx                 # Shell admin : auth AdminUser, nav latérale, garde de rôle
├── page.tsx                   # Dashboard : KPI globaux + files d'action
├── moderation/                # File unifiée de modération (tout type de contenu)
├── users/                     # Utilisateurs, vendeurs, KYC, risk states, suspension
├── payouts/                   # Vue d'ensemble, retry, planification
├── cms/
│   ├── blog/                  # Articles + catégories
│   ├── events/                # Événements + concours + inscriptions
│   ├── jobs/                  # Offres + recruteurs + vérification
│   └── services/              # Catégories + offres + modération
├── sponsors/                  # Campagnes de sponsoring (bannière, collection, newsletter)
├── media/                     # Bibliothèque média partagée
├── settings/                  # Feature flags, configuration, droits admin
└── audit/                     # Journal d'audit global + recherche
```

**Auth & rôles admin** :

```prisma
model AdminUser {
  id         String  @id @default(cuid())
  email      String  @unique
  name       String
  passwordHash String
  role       AdminRole
  isActive   Boolean @default(true)
  lastLoginAt DateTime?
  createdAt  DateTime @default(now())
  audit      AdminAuditLog[]
}

enum AdminRole {
  SUPER_ADMIN      // tout
  CONTENT_MANAGER  // blogs + événements (CMS éditorial)
  MARKETING        // sponsors, promotion, newsletters
  MODERATOR        // files de modération (jobs, services, shots, forum)
  SUPPORT          // tickets, litiges, remboursements
  ACCOUNTANT       // payouts, soldes, rapports (lecture écriture comptable)
  COMPLIANCE       // KYC, risk states, juridique
}
```

**Permissions** : matrice `(rôle × ressource)` — ex. `MODERATOR` peut approuver/rejeter mais pas supprimer un vendeur ; `ACCOUNTANT` voit les payouts mais pas le CMS ; seul `SUPER_ADMIN` gère les rôles et feature flags. (Porté du pattern `app/policies/` de Gumroad — transposition en une `lib/admin/policies.ts`.)

---

## 3. Dashboard Super Admin

### 3.1 KPI globaux (mois en cours)
| Indicateur | Source |
|---|---|
| Utilisateurs (total, nouveaux, actifs 30 j) | `User` |
| Créateurs (total, vérifiés, en attente KYC) | `Profile`, `kycStatus` |
| Ventes (nb, GMV, panier moyen) | `Order` (réussies) |
| Revenus Baobart (commission, abonnements) | `BalanceTransaction`, `Subscription` |
| Téléchargements (total, par plan) | `ConsumptionEvent` |
| Abonnements actifs (Explorer/Studio) + churn | `Subscription` |
| Contentieux (remboursements, disputes, fraudes) | `FraudWarning`, remboursements |
| File de modération en attente (par type) | `ModerationLog` |

> **Mécanique** : agrégats **cachés en cache** (pattern `gumroad_daily_analytic` §3.6, `caching_proxy` §3.7-H) — jamais de `COUNT(*)` live sur les grandes tables (§8.2).

### 3.2 Files d'action (le vrai quotidien admin)
| File | Contenu | Action |
|---|---|---|
| **Vendeurs à revoir** | `User.riskState = NOT_REVIEWED` (nouveaux vendeurs) | Vérifier KYC → `compliant` / rejeter (pattern `unreviewed_users` Gumroad §3.8-C) |
| **Contenus à modérer** | shots, produits, commentaires, offres jobs/services, posts forum signalés | Approuver / rejeter (motif) / bannir |
| **KYC en attente** | pièces d'identité uploadées | Valider / refuser |
| **Litiges & disputes** | `FraudWarning`, réclamations services, chargebacks | Résoudre, transmettre |
| **Payouts en erreur** | `Payout.status = FAILED` | Relancer / corriger (pattern workers payouts §3.6) |
| **Remboursements demandés** | demandes en attente | Approuver / refuser (selon `RefundPolicy`) |

### 3.3 Notifications internes
- Badge de compteur sur chaque file + **email admin quotidien** (résumé : X vendeurs à revoir, Y contenus signalés…).
- Rappel d'engagement : délai cible de traitement (KYC < 24 h, modération < 4 h, litiges < 48 h).

---

## 4. CMS — Blogs

### 4.1 Modèle

```prisma
model BlogPost {
  id          String   @id @default(cuid())
  authorId    String                            // AdminUser
  title       String
  slug        String   @unique
  excerpt     String?                            // résumé (cartes du « Quoi de neuf »)
  coverMediaId String?                           // MediaAsset
  body        String   @db.Text                 // HTML TipTap (sanitisé)
  categoryId  String?
  status      String   @default("draft")        // draft | review | published | archived
  isFeatured  Boolean  @default(false)          // « Tous les articles » → à la une
  seoTitle    String?
  seoDescription String?
  canonicalUrl String?
  publishedAt DateTime?
  scheduledAt DateTime?                          // planification
  viewsCount  Int      @default(0)              // dénormalisé
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model BlogCategory {
  id       String  @id @default(cuid())
  name     String
  slug     String  @unique
  posts    BlogPost[]
}
```

### 4.2 Éditeur
- **TipTap** (déjà notre éditeur riche) : titres, listes, citations, code, images (upload → MediaAsset), vidéos embarquées, tableaux.
- **Couverture** : upload + recadrage (16:9, 4:3, carré — variants auto).
- **Extrait** : champ dédié (longueur conseillée ~160 car.) pour les cartes de la page blog.

### 4.3 Workflow & SEO
| Étape | Statut | Détail |
|---|---|---|
| Rédaction | `draft` | Enregistrement auto (autosave) |
| Relecture | `review` | Un 2ᵉ admin valide (double contrôle) |
| Publication | `published` | Immédiate ou **planifiée** (`scheduledAt`) — job Inngest publie à l'heure |
| Archivage | `archived` | Retiré du site sans suppression |

- **SEO** : slug automatique (éditable), meta title/description, canonique, `og:` image (couverture), sitemap, JSON-LD (Article).
- **Création de contenu assistée IA** (v2) : brouillon généré par le « Baobart Assistant » côté admin (pattern §3.9-B).

### 4.4 Page admin (liste)
Tableau filtrable (statut, catégorie, date, auteur), recherche, actions rapides (éditer / publier / planifier / archiver), compteur de vues par article.

---

## 5. CMS — Événements

### 5.1 Modèle (complète le blueprint §4.6)

```prisma
model Event { ... } // déjà au blueprint : organizerId, kind, dates, lieu, prix, capacité, statut, jury, prix FCFA, compte à rebours

model EventAdminMeta {            // métadonnées de gestion (admin only)
  id        String @id @default(cuid())
  eventId   String @unique
  createdBy String                              // AdminUser
  reviewed  Boolean @default(false)
  reviewNote String?
  featured  Boolean @default(false)             // mise en avant feed/accueil
  newsletterSlot Boolean @default(false)        // annonce dans la newsletter
  exportedAt DateTime?                          // dernière export des inscriptions
}
```

### 5.2 Fonctions admin
| Fonction | Détail |
|---|---|
| **Créer un événement** | Form complet : type (concours/atelier/conférence/expo), dates/heures, lieu ou en ligne, visuel, description (TipTap), prix du billet (FCFA), capacité, organisateur |
| **Gérer un concours** | Jury (nom, rôle, avatar), **prix FCFA**, date de clôture (compte à rebours public), statut (brouillon → en cours → clôturé → résultats) |
| **Inscriptions** | Liste, recherche, **export CSV** (participants, emails, tickets payés), capacité (verrou au plafond), annulation/remboursement d'un participant |
| **Promotion** | `featured` (accueil/feed), emplacement newsletter, lien sponsorisé éventuel |
| **Modération** | Les événements soumis par des tiers (organisateurs externes) passent par la file de modération avant publication |
| **Concours : résultats** | Saisie des gagnants → publication sur l'accueil + notifications + badges (gamification §D) |

### 5.3 Statuts
`draft → review → published (upcoming) → ongoing → finished → results_published` + `cancelled`.

---

## 6. CMS — Jobs

### 6.1 Modèle (complète le blueprint §4.6)

```prisma
model JobPosting { ... } // déjà au blueprint : type, mode, pays/ville, salaire, statut, isFeatured, isVerified

model JobAdminMeta {
  id          String @id @default(cuid())
  jobPostingId String @unique
  reviewedBy  String?
  reviewNote  String?
  paymentStatus String @default("pending")      // pending | paid | refunded | free_internal
  paymentRef  String?                           // id transaction mobile money
  expiresAt   DateTime?                         // durée de mise en ligne
  flaggedReason String?                         // signalement anti-arnaque
}
```

### 6.2 Vérification des recruteurs (anti-arnaque — priorité)
1. **Vérification du compte recruteur** : email pro valide + (option) n° de téléphone vérifié + page entreprise.
2. **Garde-fous** (pattern `adult_keyword_detector` + liste de mots interdits de l'arnaque à l'emploi : « avance de frais », « paiement à l'inscription », « faux virements »…) : détection → `flaggedReason` → file de modération manuelle.
3. **Badge « Offre vérifiée »** : affiché publiquement une fois vérifié (valeur de confiance §2.9).
4. **Signalement** : les candidats peuvent signaler une offre → file dédiée → blocage du recruteur (`BlockedObject`) + `UserRiskState` dégradé.

### 6.3 Fonctions admin
| Fonction | Détail |
|---|---|
| Liste/CRUD | Toutes les offres (interne + recruteurs), statuts (draft/published/filled/closed), filtres (type, pays, statut, vérifié) |
| Modération | Approuver / rejeter avec motif ; contenu interdit (discrimination, fraude) → refus + trace |
| **Vérification** | Lancer la vérification recruteur → badge |
| **Paiement** | Confirmer le paiement d'une offre (mobile money), lier `paymentRef`, durée de vie, remboursement si refus |
| Mise en avant | `isFeatured` (épinglé en tête + newsletter) |
| Expiration | Job auto-`filled`/`closed` à `expiresAt` (worker) + relance recruteur |
| Export | CSV des offres (stats marché) |

---

## 7. CMS — Services

### 7.1 Modèle

```prisma
model ServiceCategory {
  id        String @id @default(cuid())
  name      String                            // Identité visuelle, Illustration, Retouche, Motion, Mise en page…
  slug      String @unique
  position  Int
  isActive  Boolean @default(true)
  offers    ServiceOffer[]
}

model ServiceOffer {                           // « Proposer mon service » (créateur)
  id           String @id @default(cuid())
  creatorId    String
  categoryId   String
  title        String
  description  String  @db.Text
  startingPrice Int                            // FCFA « à partir de »
  deliveryDays Int
  portfolioMediaIds Json @default("[]")        // preuve de travail
  status       String  @default("pending")    // pending | approved | rejected | archived
  reviewNote   String?
  isFeatured   Boolean @default(false)
  ratingAvg    Decimal @default(0)             // dénormalisé
  ratingCount  Int     @default(0)
  createdAt    DateTime @default(now())
}
```

### 7.2 Fonctions admin
| Fonction | Détail |
|---|---|
| **Catégories** | CRUD + ordre d'affichage (maquette : Identité visuelle, Illustration, Retouche, Motion, Mise en page) |
| **Modération des offres** | Chaque offre soumise passe par la file : contrôle (pertinence, prix, contenu) → `approved` / `rejected` + motif visible par le créateur |
| **Mise en avant** | `isFeatured` + boost payant (§2.9) lié au paiement |
| **Litiges** | Demandes de remboursement / litiges service (liés à `Commission`) → file SUPPORT : résolution, médiation, remboursement partiel |
| **Stats** | Offres par catégorie, prix moyens, délais annoncés vs réels, top créateurs de services |

---

## 8. Modération & Trust (centralisé)

- **File unifiée** : toutes les signalisations (shots, produits, commentaires, posts forum, offres jobs, offres services, événements, profils) dans une seule interface avec filtres par type.
- **Actions** : approuver / rejeter (motif) / masquer / bannir l'auteur (→ `BlockedObject` + `UserRiskState`) / laisser passer.
- **Auto-modération** : le service de modération automatisée (§3.6) pré-filtre ; l'admin ne traite que ce qui est signalé ou douteux.
- **Récidive** : historique du créateur (infractions/30 j) → seuil → suspension.

---

## 9. Gestion utilisateurs & vendeurs

| Fonction | Détail |
|---|---|
| **Recherche** | Par email, nom, téléphone, ID (pattern `admin_search` Gumroad) |
| **Profil admin** | Vue complète : infos, produits, ventes, soldes, risk state, historiques |
| **KYC** | Examiner les documents, valider/refuser (→ badge « Créateur vérifié ») |
| **Risk states** | Machine à états portée de Gumroad (§3.8-A) : `not_reviewed → compliant / on_probation / suspendu` avec gardes (clear_suspension explicite) |
| **Suspension** | Simple (désactive produits, sessions) ou **massive** (liste d'identifiants + motif — pattern `suspend_users` §3.8-E) |
| **Restauration** | Réintégration → produits réactivés, IP débloquée (transitions automatiques §3.8) |
| **VIP/accès** | Mise en avant manuelle, accès beta (feature flags par user) |

---

## 10. Payouts & argent (admin)

- **Vue d'ensemble** : soldes en attente, à payer, payouts du jour, échecs.
- **File des payouts** : initier, **relancer les échoués** (pattern `retry_failed_paypal_payouts`, `sync_stuck_payouts` §3.6), annuler un payout erroné.
- **Planification** : jour par rail (mobile money mercredi, banque jeudi…) — pattern `payout_rail_schedule` §3.9-A.
- **Protections** : gel des payouts en cas de litiges/chargebacks (pattern `release_chargeback_rate_payout_pause` §3.6), seuils de risque (`LowBalanceFraudCheck` §3.8-B).
- **Rapports** : exports CSV (gains par créateur, par mois), rapports fiscaux (v2).

---

## 11. Sponsoring (campagnes)

- **Formats** : bannière accueil (180 000 F/sem), collection sponsorisée (260 000 F/14 j), newsletter (120 000 F) — de la maquette.
- **Flux admin** : créer une campagne (annonceur, format, dates, visuel, lien), valider le paiement, **planifier l'affichage** (un seul sponsor à la fois — pas de collision), retirer à l'expiration.
- **Suivi** : impressions/clics (via UTM links §3.10-E), renouvellement.

---

## 12. Feature flags & configuration

- **Feature flags par palier** : global, par rôle admin, par pourcentage d'utilisateurs, par user (pattern `flipper` de Gumroad + `feature_flags_controller` mobile §3.9-F).
- **Configuration** : prix des plans (Explorer/Studio), commission, pool %, seuils des badges, messages (CGU, licences), maintenance mode.
- **Journal des changements** : toute modif de config → AuditLog.

---

## 13. Sécurité & audit

| Mesure | Détail |
|---|---|
| **Auth admin** | 2FA obligatoire (TOTP + passkeys WebAuthn), session courte, IP allowlist optionnelle |
| **AuditLog** | Toute action admin enregistrée : acteur, action, ressource, avant/après, IP, horodatage — consultable et recherchable (`/admin/audit`) |
| **Inviolabilité** | Les logs d'audit ne sont pas modifiables via l'app (append-only) |
| **Séparation** | Les comptes admin ne sont **jamais** des comptes utilisateurs publics (pas de croisement) |
| **Limites** | Rate-limiting sur les actions de masse ; confirmation explicite pour suspension/remboursement/payout |
| **Sessions** | Révocation à distance (invalider toutes les sessions d'un admin), alerte de connexion inhabituelle |

---

## 14. UI/UX du back-office

- **Design** : même design system (lavande/ambre) mais **plus dense** : tables, filtres, badges de statut, colonnes compactes.
- **Navigation** : nav latérale fixe (Dashboard, Files, Utilisateurs, CMS ▸ Blog/Événements/Jobs/Services, Sponsors, Médias, Payouts, Audit, Paramètres) + compteurs de files dans la nav.
- **Composants** : DataTable (tri, recherche, pagination curseur, export CSV), File d'action, Badge de statut, Modal de confirmation (destructive), Éditeur TipTap.
- **Raccourcis** : recherche globale admin (⌘K) sur utilisateurs, produits, contenus.
- **Mobile** : accessible en secours mais optimisé desktop (annoncé comme tel).

---

## 15. Roadmap d'intégration

| Phase | Contenu admin/CMS | Statut |
|---|---|---|
| **M0** | Rôles fonctionnels + matrice de pouvoirs + `AuditLog` écrit | ✅ **v1.44.0** |
| **M0 bis** | Shell `/admin` dédié + recherche globale + écran d'audit | à faire |
| **M1** | Dashboard KPI (cache) + file « vendeurs à revoir » + gestion KYC (nécessaire au badge vérifié) + bibliothèque média | Avec le MVP |
| **M2** | Payouts admin (vue, retry) + sponsors + feature flags | Avec paiements |
| **M3** | **CMS Services** (catégories + modération des offres) + file litiges | Avec vendeurs |
| **M4** | **CMS Jobs** (vérification recruteurs + modération + paiement offres) + **CMS Événements** (concours, inscriptions, CSV) | Avec jobs/events |
| **M5** | **CMS Blog** (éditeur, workflow, SEO, planification) + modération centralisée complète + rapports | Avec communauté |
| **M7+** | Assistance IA côté admin (brouillons), rapports fiscaux, exports avancés | Itératif |

---

## 16. Compléments au schéma Prisma (à merger dans le blueprint)

```prisma
// ADMIN
model AdminUser { ... }              // §2
model AdminRole { ... }              // enum §2
model AdminAuditLog {
  id         String   @id @default(cuid())
  adminId    String
  action     String                   // "suspend_user", "publish_blog", "approve_job"…
  resource   String                   // "User", "BlogPost", "JobPosting"…
  resourceId String
  before     Json?
  after      Json?
  ip         String?
  createdAt  DateTime @default(now())
}

// CMS
model BlogPost { ... }               // §4.1
model BlogCategory { ... }           // §4.1
model EventAdminMeta { ... }         // §5.1
model JobAdminMeta { ... }           // §6.1
model ServiceCategory { ... }        // §7.1
model ServiceOffer { ... }           // §7.1
model SponsorshipCampaign {
  id        String   @id @default(cuid())
  advertiser String
  format    String                    // banner | collection | newsletter
  price     Int
  startsAt  DateTime
  endsAt    DateTime
  mediaId   String?
  targetUrl String?
  paymentRef String?
  status    String   @default("draft") // draft | scheduled | live | ended | cancelled
}
```

---

## 17. Ce qui a été fait, et les deux écarts avec cette spec

*Écrit le 2 septembre 2026, à la livraison de M0 (v1.44.0).*

### 17.1 Pas de table `AdminUser` : une seule identité

La spec (§2) propose une table d'administrateurs avec **sa propre
authentification**. Le code n'en crée pas, et voici pourquoi.

Baobart a déjà une authentification durcie — sessions, limitation de débit,
réinitialisation à usage unique, hachage. En monter une seconde signifie deux
endroits où se tromper sur la sécurité des sessions, deux parcours de mot de
passe oublié à tenir, et deux fois la surface d'attaque — pour un gain qui
n'existe que si les administrateurs ne sont pas aussi des utilisateurs. Chez
Baobart, ils le sont : ils ont un profil, ils achètent, certains publient.

La propriété de sécurité recherchée est ailleurs, et elle est déjà tenue :
**aucun écran ne permet de s'élever.** La promotion passe par
`pnpm admin:promouvoir`, donc par quelqu'un qui a déjà la main sur la base — et
qui n'a plus rien à gagner à l'exploiter. Une faille d'autorisation dans un
formulaire de profil ne peut pas se terminer en super administrateur.

### 17.2 Un seul journal d'audit, pas deux

La spec (§16) propose `AdminAuditLog` à côté de l'`AuditLog` du blueprint. Le
code n'en garde qu'un.

`AuditLog` était au schéma depuis le début **et personne n'y écrivait**. C'est
le pire état possible : un écran d'audit aurait affiché une liste vide, et vide
se lit « rien ne s'est passé », pas « on ne consigne rien ». En ajouter une
seconde aurait doublé le problème au lieu de le résoudre.

`lib/admin/audit.ts` l'écrit désormais, avec deux règles :

- **consigner ne fait jamais échouer l'acte.** Un administrateur qui suspend un
  compte frauduleux ne doit pas voir son geste refusé parce que la trace n'est
  pas passée. L'échec crie dans le journal applicatif ;
- **on consigne après, et seulement si l'acte a eu lieu.** Tracer une décision
  refusée la ferait passer pour appliquée à la relecture.

Les champs `before`/`after`/`ip` de la spec ne sont pas repris : `details` est un
JSON libre qui les porte quand ils ont un sens, et l'adresse IP d'un
administrateur est une donnée personnelle qu'on ne conserve pas sans raison.

### 17.3 Ce que M0 a corrigé en passant

`exigerLePouvoir` enchaînait sur `exigerAdministrateur`, donc exigeait
`consulter_le_systeme` en plus du pouvoir demandé. C'était sans conséquence
tant que tout administrateur pouvait lire l'état technique. Avec des rôles
fonctionnels, un modérateur se serait vu refuser **son propre écran**, avec un
404 que rien n'aurait expliqué.

Deux gardes distinctes, désormais :

| | Qui passe |
|---|---|
| `estAdministrateur` | ceux qui peuvent lire l'état technique — écrans **Système** |
| `aAccesAuBackOffice` | quiconque porte au moins un pouvoir |

Confondre les deux aurait ouvert la base, le stockage et les interrupteurs à six
rôles d'un coup, sans qu'aucun écran ne change d'apparence.

Deux actes ont aussi changé de pouvoir requis, pour dire ce qu'ils font :

- changer l'état de risque d'un compte demande `gerer_la_conformite`, non
  `agir_sur_l_exploitation` : c'est une décision sur une personne ;
- déplacer un versement demande `agir_sur_l_argent` : c'est décider où va de
  l'argent.

Les administrateurs généralistes gardent les deux — personne n'a perdu d'accès.

---

## 18. Qui a le droit de publier quoi

*Arbitré le 2 septembre 2026. Cette section prime sur les §§4 à 7 partout où
elles divergent : celles-ci décrivent les écrans, celle-ci décrit les droits.*

Les quatre CMS n'ont **pas** le même régime, et c'est le point qui décide de
tout leur développement. Les traiter uniformément — la pente naturelle, puisque
ce sont quatre listes avec un éditeur — produirait soit un blog que n'importe
qui écrit, soit un annuaire d'offres d'emploi que personne ne peut remplir.

| CMS | Qui crée | Qui modère |
|---|---|---|
| **Blog** | l'administration seule | — |
| **Événements** | l'administration seule | — |
| **Jobs** | **tout inscrit** — lecture publique, action authentifiée | l'administration, avant parution |
| **Services** | un vendeur **abonné** et de type **Agence** ou **Freelance** | l'administration |

### 18.1 Blog et Événements : l'administration, et personne d'autre

Créer, modifier, supprimer : `publier_du_contenu`. Ce sont des contenus qui
portent la voix de Baobart — un article signé du site engage le site.

Conséquence pratique : **pas de fil de soumission, pas de file de modération.**
Ce qui existe est publié par quelqu'un qui en avait le droit. Construire un
workflow d'approbation pour ces deux-là serait écrire des écrans que personne
n'ouvrirait jamais.

### 18.2 Jobs : lecture publique, action authentifiée

**Voir** une offre ne demande rien : ni compte, ni abonnement, ni badge. C'est
un choix de référencement autant que d'accueil — un annuaire d'offres derrière
une connexion n'est lu par personne.

**Agir** demande un compte, sans exception. Déposer une offre comme y postuler :
les deux sont des actions, et aucune n'est possible sans être inscrit.

> *Arbitrage du 2 septembre 2026, en resserrement d'une première version qui
> laissait un visiteur anonyme déposer une offre.* « Ouvert à tous » distingue
> Jobs de Services : **tout inscrit** peut publier une offre d'emploi, là où un
> service exige d'être vendeur, abonné et badgé. Cela ne veut pas dire « sans
> compte ».

Ce que ce resserrement change, et c'est considérable :

- **plus de formulaire public qui écrit en base.** C'était la surface d'attaque
  la plus large du projet ; elle disparaît ;
- **la limitation de débit redevient ordinaire.** Elle porte sur le compte, pas
  sur l'adresse IP — donc la même mécanique que partout ailleurs, au lieu d'un
  cas particulier à écrire et à maintenir seul ;
- **un dépôt abusif a un auteur.** On peut suspendre un compte ; on ne peut pas
  suspendre un visiteur ;
- **le moyen de recontact existe déjà** : c'est l'adresse du compte, vérifiée.

Ce qui ne change pas : **rien ne paraît avant modération.** Un compte gratuit se
crée en deux minutes, et l'authentification ne filtre pas les arnaques — elle
donne seulement quelqu'un à qui les imputer. Le badge « Offre vérifiée » (§6.2)
garde donc tout son sens.

### 18.3 Services : vendeur, abonné, badgé

Trois conditions cumulatives, et **aucune ne se déduit d'une autre** :

1. **être vendeur** — au sens de `lib/auth/roles.ts` : avoir publié. On ne se
   déclare pas vendeur, on le devient ;
2. **avoir un abonnement en cours** — au sens de Ndank : `ACTIVE` ou dans la
   grâce ;
3. **porter le badge Freelance ou Agence.**

#### Le badge n'est pas un rôle

C'est le point à ne pas confondre, et il a été tranché explicitement.

`PlatformRole` décrit ce qu'on a le droit de faire **dans le back-office** :
modérer, publier un article, toucher à l'argent. Freelance et Agence ne sont
rien de tout cela — ce sont des **vendeurs**, du côté public de la plateforme,
qui obtiennent un privilège supplémentaire.

Les mettre dans `PlatformRole` aurait deux conséquences fâcheuses :

- un vendeur porterait un rôle d'administration, et se retrouverait mêlé aux
  gardes du back-office — là où une erreur coûte cher ;
- un rôle unique par personne ferait qu'être Freelance **remplacerait** MEMBER,
  et l'on ne saurait plus distinguer un vendeur badgé d'un administrateur.

Le badge vit donc **sur le profil**, à côté de `isVerified` qui existe déjà et
qui dit « Créateur vérifié ». Même nature, même endroit.

#### Il s'accorde, il ne se déclare pas

Un badge que l'on se donne soi-même ne vaut rien — surtout sur des prestations
payantes, où c'est précisément ce qu'un arnaqueur cocherait. Il est accordé par
l'administration, et sa pose est **consignée à l'audit** comme tout acte
d'administration.

#### Le droit se calcule, il ne se range pas

**Le piège à éviter** : une colonne `peutPublierDesServices`, qui dériverait de
l'abonnement réel dès la première échéance manquée. Les trois conditions se
lisent à chaque fois — `deduireProgression` pour la première, l'état Ndank pour
la deuxième, le badge pour la troisième.

C'est la même leçon que partout dans ce projet : un statut rangé en base se
désynchronise dès qu'un passage rate son tour.

#### Un abonnement suspendu ne casse pas ce qui est vendu

Il retire le droit de publier de **nouvelles** offres, sans effacer celles qui
existent ni les prestations en cours. Couper un service déjà vendu parce qu'une
échéance est passée pénaliserait le client, qui n'y est pour rien.

*Confirmé le 2 septembre 2026.*

---

## 19. Plan d'exécution des quatre CMS

*Écrit le 2 septembre 2026, après M0.*

### 19.1 L'ordre, et pourquoi

**Jobs, Services, Événements, Blog.** Ce n'est ni l'ordre de la §15, ni l'ordre
de la facilité : c'est celui de la **contrainte**.

Jobs est le plus contraint des quatre — il porte de la modération obligatoire,
un anti-arnaque, une limitation de débit, et deux acteurs (celui qui publie,
celui qui postule). Tout ce qu'il faut construire pour lui sert ensuite aux
trois autres, qui en sont des versions allégées.

L'ordre inverse — commencer par le blog, le plus simple — produirait un
éditeur, une liste et un workflow taillés pour un cas sans modération, qu'il
faudrait rouvrir entièrement en arrivant à Jobs.

### 19.2 Ce que les quatre partagent

Trois briques à écrire une fois, en les découvrant sur Jobs :

1. **Un cycle de vie de contenu.** `BROUILLON → SOUMIS → PUBLIÉ`, plus
   `REFUSÉ` et `RETIRÉ`. Pur, testable sans base, comme `lib/ndank/etats.ts`.
   Le blog et les événements n'emprunteront que la moitié du chemin — leurs
   auteurs ont déjà le droit de publier — et c'est très bien : un état non
   atteint ne coûte rien, un état manquant coûte une réécriture.
2. **Une file de modération.** Un écran, quatre types de contenu. La §8 la veut
   unifiée ; la construire par CMS produirait quatre écrans jumeaux qui
   divergeraient.
3. **Le droit de publier, calculé.** `lib/cms/droits.ts` répond à « cette
   personne peut-elle publier ce type de contenu », en croisant rôle, badge et
   abonnement. Jamais une colonne : voir §18.3.

### 19.3 Ce qui a déjà été trouvé dans le schéma

`JobPosting` existe, et **son `status` vaut `"published"` par défaut**. Une
offre déposée paraîtrait donc immédiatement, ce qui contredit §18.2 : la
première arnaque serait en ligne avant qu'on l'ait lue.

Trois autres manques sur le même modèle :

- `status` est une chaîne libre, pas un enum — deux orthographes d'un même
  état rendraient la file de modération inutilisable ;
- `recruiterId` est un identifiant nu, sans relation : rien ne garantit qu'il
  désigne un compte existant, et l'on ne peut pas remonter aux offres d'une
  personne qu'on suspend ;
- **il n'existe aucun modèle de candidature.** « Apply job » n'a rien où
  écrire.

### 19.4 Jobs — découpage

| | Contenu |
|---|---|
| **J1** | Cycle de vie + droits + schéma (`JobPosting` corrigé, `JobApplication`, enums) | ✅ |
| **J2** | Dépôt d'une offre : formulaire authentifié, limitation de débit, état SOUMIS | ✅ |
| **J3** | File de modération + badge « Offre vérifiée » + audit | ✅ |
| **J4** | Lecture publique : `/jobs`, `/jobs/[id]`, et l'écran de dépôt que J2 avait oublié | ✅ |
| **J5** | Candidature : « Apply » authentifié, une par personne et par offre | ✅ |

### 19.5 Les deux décisions, tranchées

*Arbitré le 2 septembre 2026.*

#### Une offre porte des candidatures, ou renvoie ailleurs — jamais les deux

`applyMode` vaut `BAOBART` ou `EXTERNE`, et les deux s'excluent. Une offre qui
accepterait l'un et l'autre laisserait le candidat ne pas savoir où aller, et
nous ne tiendrions que la moitié des candidatures — la pire des situations pour
répondre à quelqu'un qui se plaint de n'avoir jamais eu de réponse.

**Mode `BAOBART`** : la candidature produit un `JobApplication`, une seule par
personne et par offre. Postuler deux fois n'ajoute rien pour le recruteur et
double son travail de tri.

Une candidature dit **où quelqu'un cherche du travail**. C'est une donnée
personnelle, et le modèle en tire les conséquences : elle disparaît avec le
compte (`Cascade`), elle se supprime à la demande, et le document joint vit dans
le stockage privé — jamais dans le préfixe public, où il serait téléchargeable
par qui devine l'adresse.

**Mode `EXTERNE`** : `applyUrl` renvoie sur le site de l'annonce, et **aucune
ligne n'est conservée ici**. Garder une trace d'un acte qu'on n'a pas accompagné
serait retenir une donnée personnelle pour rien.

> ⚠️ **`applyUrl` est le vecteur d'arnaque le plus direct de tout le projet.**
> Une URL d'hameçonnage déposée sous couvert d'offre d'emploi profite de la
> confiance que le site lui prête. Trois règles, écrites dans le schéma :
>
> 1. elle est **montrée en entier au modérateur** — une URL tronquée dans la
>    file de modération est une URL qu'on approuve sans l'avoir lue ;
> 2. elle n'est **jamais suivie par le serveur**. Pas d'aperçu, pas de
>    vérification automatique, pas de récupération de logo : ce serait offrir
>    une requête sortante à quiconque dépose une offre ;
> 3. elle part au navigateur en `nofollow noopener`, et l'écran **affiche le
>    domaine** — le candidat doit voir où il va avant de cliquer.

#### L'offre expire à son échéance, et l'expiration se déduit

`deadline` décide. Passée cette date, l'offre cesse de paraître.

**Aucun ordonnanceur ne bascule l'état.** C'était la solution évidente et elle
aurait créé une seconde vérité : l'offre serait restée en ligne jusqu'au passage
du lendemain, ou aurait disparu sans que personne ne l'ait décidé. `estPublic`
croise donc l'état **et** l'échéance, et c'est la seule porte — écrire
`state = PUBLIE` à la main dans une requête afficherait une offre périmée depuis
six mois.

C'est la même leçon que Ndank, qui déduit l'état d'un abonnement de ses dates
plutôt que de le ranger.

`estExpire` existe séparément, parce que les deux répondent à des questions
différentes : le public ne voit pas une offre périmée, mais **son auteur doit
comprendre pourquoi elle a disparu**. Lui dire « expirée » plutôt que « retirée »
lui évite de croire qu'on la lui a refusée.

Le formulaire range **la fin du jour** choisi : « jusqu'au 31 octobre » veut dire
que le 31 compte encore. L'interprétation vit à la saisie, pas dans la lecture,
faute de quoi elle se disperserait dans chaque écran.

### 19.6 Ce que J1 a corrigé dans le schéma

| | Avant | Après |
|---|---|---|
| État | `status String @default("published")` | `state ContentState @default(BROUILLON)` |
| Recruteur | identifiant nu | relation, `onDelete: Cascade` |
| Candidatures | *rien* | `JobApplication`, unique par (offre, personne) |
| Refus | *rien* | `refusedReason`, `moderatedAt`, `moderatorId` |
| Index | `(status, createdAt)` | `(state, deadline, createdAt)` — l'ordre de la requête publique |

Le défaut du défaut valait à lui seul ce passage : **une offre déposée paraissait
immédiatement.** La première arnaque aurait été en ligne avant qu'on l'ait lue.

---

## 20. Ce que J1 à J3 ont changé ailleurs

*Écrit le 2 septembre 2026.*

### 20.1 Le piège des rôles fonctionnels s'est propagé deux fois

Il avait été attrapé dans `exigerLePouvoir` en v1.44.0. Il attendait à deux
autres étages, et J3 l'a révélé en donnant enfin un écran à un rôle
fonctionnel :

- **la barre latérale** prenait un booléen `administrateur`, dérivé de
  `estAdministrateur` — c'est-à-dire de « peut lire l'état technique ». Un
  modérateur n'aurait pas vu **son propre écran**. Elle prend maintenant le
  rôle, et chaque entrée déclare le pouvoir qu'elle exige ;
- **l'emplacement de l'écran.** `/dashboard/systeme/*` est gardé par ce même
  pouvoir technique. Y ranger la file l'aurait fermée aux modérateurs — ou
  aurait obligé à élargir la garde du dossier, ce qui aurait ouvert la base et
  les interrupteurs à six rôles d'un coup.

La leçon vaut pour les trois CMS suivants : **chaque fois qu'un rôle
fonctionnel reçoit un écran, chercher où le booléen survit encore.**

### 20.2 Trois décisions de la file de modération

**L'adresse externe est affichée en entier, et n'est pas cliquable.** Une URL
tronquée dans une file est une URL qu'on approuve sans l'avoir lue. Et un
modérateur qui ouvre par réflexe des liens déposés par des inconnus est la
cible la plus facile de la plateforme : il faut la copier pour l'ouvrir, et ce
demi-obstacle transforme un réflexe en décision.

**Un refus exige un motif**, et le motif s'efface si l'offre est finalement
publiée — garder l'ancien ferait afficher « refusée pour X » sur une offre en
ligne.

**Vérifier n'est pas publier.** Toute offre en ligne a été relue ; le badge dit
qu'un humain est allé contrôler que l'entreprise existe et qu'on ne demande pas
d'argent au candidat. Les confondre viderait le badge de son sens — un badge que
tout le monde porte ne protège plus personne. C'est aussi pourquoi il se retire.

### 20.3 La file se vide du plus ancien

C'est l'inverse de partout ailleurs dans le produit, où l'on montre le plus
récent. Un journal se lit du plus récent ; une file d'attente se vide du plus
ancien. Trier à l'envers ferait vieillir indéfiniment les offres du bas pendant
que les nouvelles passent devant — et l'annonceur le plus patient serait le plus
mal servi.

---

## 21. J4 — ce que la lecture publique a révélé

*Écrit le 2 septembre 2026.*

### 21.1 J2 avait livré une action sans écran

`lib/jobs/actions.ts` existait depuis J2 et **aucune page ne l'appelait**. Du
code écrit et inatteignable — la famille de défaut qu'on traque partout
ailleurs, et qu'on avait laissée passer chez soi.

Ce n'est pas un test qui l'a trouvé : c'est le typage des routes, quand la
liste a voulu un lien vers `/jobs/deposer`. Leçon à garder pour les trois CMS
suivants : **une action serveur sans écran ne se voit dans aucune suite de
tests**, puisque les tests l'appellent directement.

### 21.2 Une seule clause de visibilité

État `PUBLIE` **et** échéance non passée, écrites ensemble dans
`clausePublique`. Les recopier à la main dans chaque requête est ce qui, un
jour, laisserait passer l'une sans l'autre.

Un test applique les deux conditions séparément **et ensemble**, parce que le
défaut classique n'est pas d'oublier les deux : c'est d'en appliquer une.

### 21.3 Trois blocs dessinés, absents à dessein

| Bloc | Pourquoi il n'est pas là |
|---|---|
| Compteur de propositions + jauge | J5. Afficher « 12 propositions » serait inventer le chiffre sur lequel un candidat décide de postuler |
| « Répond en moyenne sous 6 h » | Rien ne le mesure, et la métrique vient d'être abandonnée sur le profil créateur. La garder ici rétablirait par la fenêtre ce qu'on a retiré par la porte |
| Livrables + Profil recherché | Pas des champs. La description les porte en prose ; les structurer demande de les collecter au dépôt — donc J2, pas J4 |

Le bouton « Mes propositions » de l'en-tête est retiré pour la même raison
qu'il n'y a pas de compteur : il n'ouvrirait sur rien.

### 21.4 L'écran où quelqu'un envoie son CV à un inconnu

Deux ajouts que la maquette ne demandait pas, et qui méritent d'être discutés :

- **l'hôte de l'adresse externe est affiché avant le clic.** C'est la seule
  information qui permette de reconnaître une adresse sans rapport avec
  l'entreprise annoncée. Avec `noopener` et `nofollow` — on ne prête pas notre
  référencement à une adresse qu'on n'a pas choisie ;
- **quand l'offre n'est pas vérifiée, on le dit.** « Relue, pas vérifiée »,
  avec l'avertissement qu'aucun recruteur sérieux ne réclame d'argent. Sans
  cela, l'absence de badge ne se remarque pas — et c'est précisément sur les
  offres sans badge que le risque existe.

### 21.5 L'argent ne décide pas seul de l'ordre

`isFeatured` passe devant, et c'est assumé — mais **à égalité c'est la
fraîcheur qui tranche**. Un annuaire où l'argent seul ordonne cesse d'être
consulté, et la place payante ne vaut alors plus rien.

---

## 22. J5 — la candidature, du dépôt à la purge

*Écrit le 3 septembre 2026.*

### 22.1 Le CV vit avec l'offre — et disparaît à sa clôture

Un candidat qui envoie son CV à un inconnu doit pouvoir savoir **quand** ce
fichier sera effacé, sans avoir à le demander. La décision : il vit exactement
le temps de l'offre. Retirée, refusée, expirée — le fichier part.

Trois conséquences en découlent, chacune dans un module :

- **la promesse elle-même** vit dans le message affiché au succès du dépôt et
  dans l'avertissement de la page « Postuler ». Sans texte, la garantie ne se
  voit pas ;
- **la purge** est branchée sur le cron `commandes` existant, plutôt qu'ouvrir
  une cinquième route. Une entrée d'ordonnanceur de plus est une entrée à
  configurer sur Vercel — donc une à oublier, et un ménage qui ne se ferait
  jamais sans que rien ne le dise. C'est le même raisonnement qu'en v1.40.0
  pour les renouvellements d'abonnement ;
- **la panne du stockage n'annule pas la ligne.** Si le fichier refuse de
  partir, on log l'incident et on efface la ligne quand même — perdre un
  fichier qu'on récupérera un jour par une purge de stockage est moins grave
  que de retenter indéfiniment à chaque passage.

### 22.2 Le CV n'est pas rendu dans le HTML du recruteur

Une page qui rendrait cinquante URL signées les mettrait toutes en clair dans
la source de la page. Un onglet ouvert pendant qu'un collègue jette un œil, ou
un incident où le HTML fuit ailleurs, exposerait cinquante CV.

La page candidature affiche `/api/jobs/candidatures/[id]/cv`. Cette route :

- refait la garde — offre appartenant au recruteur connecté ;
- appelle `signerTelechargement` pour **cinq minutes** ;
- redirige (`303`) vers l'URL signée, qui n'existe donc que le temps du clic ;
- rend `404` pour tout refus — non connecté, mauvaise offre, autrui. Dire
  « accès refusé » apprendrait qu'un CV existe à cet identifiant.

### 22.3 Le magic-byte, pas l'extension

`accept="application/pdf,.pdf"` est un indice pour le navigateur, pas un
contrôle. Un ZIP renommé `cv.pdf` passe l'attribut, et un lecteur PDF côté
recruteur qui déroulerait un fichier arbitraire est une surface d'attaque qu'on
ne veut pas offrir.

La vérification vit dans `depotAcceptable` : les cinq premiers octets doivent
faire `%PDF-`. C'est le seul contrôle qui ne se contourne pas en renommant.

### 22.4 Le rollback du fichier

L'ordre est : dépôt du fichier au stockage, puis écriture de la ligne. Si la
ligne échoue sur l'unicité `(jobId, userId)`, le fichier a été déposé — et
sans rattrapage, il reste orphelin. Le code demande explicitement sa
suppression après un `P2002`.

Ce cas s'observe : un envoi automatisé qui rejoue, un bouton double-cliqué.
L'unicité protège la file de relecture ; le rollback protège le stockage.

### 22.5 L'écran recruteur vit dans `/dashboard`, la garde vit dans la requête

`app/dashboard/jobs/[id]/candidatures` charge l'offre avec
`where: { id, recruiterId: utilisateur.id }`. Un curieux qui devinerait
l'identifiant d'une offre voisine y répond `404`, sans qu'aucun message ne lui
apprenne pourquoi.

Le lien vers cet écran est posé sur la fiche publique de l'offre, réservé à
son propre auteur — le CTA « Postuler » y est remplacé par « Voir les
candidatures reçues ». Sans ce lien, la seule voie était l'URL directe.

### 22.6 Aucune messagerie ici

Le recruteur voit l'adresse du candidat en clair, avec un `mailto:` préfilé.
Ouvrir un fil de discussion sur Baobart pour Jobs aurait été un chantier
autonome, sans rapport avec la candidature elle-même — et sans messagerie
générale ailleurs sur le site, ce fil aurait vécu seul, sans notifications ni
historique cherchable. Le courrier est déjà tout cela.

Cette absence est écrite à l'écran, pour que le recruteur ne cherche pas un
bouton qui n'existe pas.

---

## 23. Services — découpage

*Écrit le 3 septembre 2026, après J5.*

### 23.1 Cinq pas, dans l'ordre de la contrainte

| | Contenu |
|---|---|
| **S1** | Schéma : `BadgeCode` étendu (`FREELANCE` / `AGENCE`), `ServiceCategory`, `ServiceOffer` (état `BROUILLON` par défaut, catégorie non nulle) + seed des 5 catégories de la maquette + module pur `lib/services/badges.ts` pour l'exclusivité | ✅ |
| **S2** | Dépôt d'une offre : formulaire authentifié, garde par `peutPublier("service")`, limitation de débit, état SOUMIS | ✅ |
| **S3** | File de modération : brancher `service` sur la file existante, audit | ✅ |
| **S4** | Lecture publique : `/services`, `/services/[id]`, filtre par catégorie | ✅ |
| **S5** | Bouton « Commander » : sans messagerie ici non plus, `mailto:` sur l'adresse du créateur tant qu'un fil interne n'existe pas ailleurs sur le site | ✅ |

### 23.2 L'exclusivité Freelance/Agence vit dans le code, pas dans le schéma

La maquette des badges (E.1) le dit franchement : **Freelance et Agence
s'excluent**. Un compte qui afficherait les deux dirait à l'acheteur qu'il
est simultanément indépendant et structure — ce qui n'a pas de sens et brouille
la lecture au moment précis où elle sert à décider.

Trois façons d'imposer la règle, une seule qui tient :

- **une contrainte SQL** demanderait de connaître les identifiants des badges
  (`badgeId`), non leur code. Ils sont posés par un seed, et changent d'un
  environnement à l'autre ; la contrainte n'aurait rien de portable et
  finirait recopiée dans chaque migration ;
- **un CHECK sur un futur `Profile.professionalBadge`** ferait tomber le
  droit sur `Profile`, alors qu'il vit sur `UserBadge` avec `awardedAt` — les
  deux se désynchroniseraient au premier retrait ;
- **un module pur** rend une décision : « rien à faire », « retirer l'autre
  d'abord », ou « refuser, déjà posé ». Il se relit sans base, se teste sans
  monter et vit à côté de `lib/cms/droits.ts`, qui déjà connaît la
  sémantique.

`lib/services/badges.ts` porte cette décision. Six tests unitaires en
dépendent — trois pour la pose, trois pour l'exclusivité.

### 23.3 Une catégorie ne s'énumère pas — elle vit

`ServiceCategory` est une table, pas un enum. Ouvrir « Vidéo » ou
« Rédaction » demanderait sinon une migration à chaque décision d'ergonomie.
L'administration ajoute, cache et réordonne sans livraison.

Une catégorie peut être *cachée* (`isActive = false`) sans être supprimée :
`onDelete: Restrict` sur la relation. Effacer une catégorie qui a servi
orphelinerait ses offres, et une offre sans catégorie ne se trouve dans aucun
filtre — donc ne se trouve pas.

Le seed pose les cinq catégories de la maquette. Elles ne sont pas un contrat,
seulement un point de départ.

### 23.4 Un abonnement suspendu ne casse pas ce qui est vendu

C'est la §18.3 dernière partie, et le schéma la rend possible : rien dans
`ServiceOffer` ne dépend de l'abonnement du créateur. Le seul filtre à la
lecture publique est l'état `PUBLIE`, jamais l'abonnement — l'échéance
retire le droit de publier de *nouvelles* prestations sans effacer celles
qui existent, ni couper les commandes en cours.

Il n'y aura donc aucun ordonnanceur qui « archive » les services d'un abonné
en retard. Un tel passage serait exactement le genre de seconde vérité qu'on
évite partout ailleurs.

### 23.5 S2 — le dépôt, avec trois portes qui s'ouvrent dans l'ordre

Le pas est plus court que J2, parce que la sémantique est plus simple : ni
échéance à interpréter à la fin du jour, ni URL externe à filtrer. La
validation refuse tout ce qui n'est pas un nombre (un « prix à débattre »
n'existe pas ici) et impose un plancher (`1 000 F` : en dessous, les frais de
mobile money mangent la prestation) et un plafond symbolique (`5 000 000 F` :
un zéro de trop se voit).

L'écran fait quelque chose que Jobs ne fait pas : **il annonce le refus
avant le formulaire**. Trois conditions cumulatives (§18.3) mènent à trois
chemins de correction distincts — s'abonner, publier une ressource, écrire
pour le badge. Laisser saisir puis refuser à la validation ferait
recommencer un créateur qui n'aurait, de toute façon, aucun moyen de
publier.

`lib/services/qualifications.ts` rassemble en une lecture ce qu'il faut
savoir pour appeler `peutPublier("service")` : l'état de l'abonnement (par
`accesOuvert` de Ndank — la même règle qui décide de l'accès au
téléchargement) et la présence d'un badge Freelance ou Agence. On ne stocke
pas le verdict : il se recalcule à chaque tentative.

Comme Jobs, le module d'écriture n'accepte pas l'identifiant de l'auteur
en paramètre : il est lu de la session par l'action. Le recevoir suffirait à
publier au nom de quelqu'un d'autre.

### 23.6 S3 — une file, deux sources, aucun bouton en trop

`lib/cms/moderation.ts` lit maintenant `JobPosting` et `ServiceOffer` en
parallèle, puis mélange et trie par ancienneté avant de tronquer. Le tri à
la fusion — plutôt qu'un `UNION` SQL — vit dans le code parce que Prisma ne
sait pas croiser deux tables sans dénaturer le typage, et parce que la file
reste petite (quelques dizaines de fiches sur les gros jours).

Un modérateur ne travaille pas par type : il ouvre sa file le matin et la
vide. Le sélecteur en haut de l'écran n'a jamais existé, et ne doit pas
apparaître — lui demander de visiter deux pages garantit qu'il en
oubliera une.

**Le badge « vérifiée » n'existe pas pour un service.** Sur Jobs, il
contrepèse le vecteur d'arnaque des URL externes ; un service n'ouvre pas
d'URL — la commande passe par un `mailto:`. Ajouter un badge de fiche
diluerait « Créateur vérifié » qui vit déjà sur le profil. La carte cache
donc ce bouton pour les services, et le module `lib/services/moderation.ts`
n'expose pas `marquerVerifiee`.

En revanche, elle affiche la **catégorie, le prix et le délai** : un
modérateur ne peut pas juger d'un prix aberrant sans le voir. C'est le
champ `meta` de `ElementAModerer`, propre au type.

L'audit consigne `contenu.approuver` / `contenu.refuser` / `contenu.retirer`
avec la ressource `service:<id>` — les mêmes actions que pour Jobs, la
différence de préfixe suffisant à retrouver « tout ce qui a touché ce
service ».

### 23.7 S4 — la lecture publique, avec trois blocs de la maquette absents

`/services` et `/services/[id]` sont câblés dans le même esprit que Jobs :
lecture ouverte à tout le monde, filtre par catégorie via
`?cat=<slug>` (un slug inconnu ou d'une catégorie retirée retombe sur
« Tous » — mieux qu'un 404 sur un lien qu'un moteur de recherche a peut-être
déjà indexé), tri « mise en avant devant, fraîcheur à égalité ».

Ce que la maquette montre et qu'on n'affiche pas :

- **un aperçu visuel par service** — le champ `portfolioMediaIds` existe
  en base mais reste vide, aucun écran ne le remplit. Un placeholder ferait
  passer un vrai créateur pour un profil non fini ;
- **les avis clients et la note moyenne** — le module d'avis n'existe pas
  encore. `ratingAvg` et `ratingCount` sont sur `ServiceOffer` mais toujours
  à zéro. Afficher « ★ 0 · 0 avis » découragerait plus qu'il n'informerait ;
- **le nombre de commandes livrées** — même famille. « 0 commande » fait
  passer un nouveau créateur pour un amateur sans clients.

Le CTA « Commander ce service » de la maquette est remplacé par un encart
neutre — S5 le câble sur un `mailto:` vers l'adresse publique du créateur,
faute de messagerie interne.

Dix tests d'intégration sur les queries : le fait qu'aucun état autre que
`PUBLIE` ne sort — quel que soit le chemin d'accès — est vérifié pour
`SOUMIS`, `REFUSE` et `RETIRE`, plutôt que de faire confiance à la clause
qui apparaît trois fois.

### 23.8 S5 — deux boutons `mailto:`, l'adresse en clair, aucune messagerie

Le CTA « Commander » de la maquette pointe vers un `mailto:` sur l'adresse
publique du créateur — même arbitrage qu'en §22.6 pour Jobs. Ouvrir un fil
interne rien que pour Services demanderait un système de notifications, un
historique cherchable, une modération : le courrier fait déjà tout cela.

Deux boutons plutôt qu'un, exactement comme la maquette :

- **« Commander ce service »** — sujet préfilé « Commande — <titre> »,
  corps qui rappelle la prestation et l'URL de la fiche ;
- **« Poser une question »** — même mécanique, sujet « Question — <titre> ».

Les fondre ferait perdre l'intention au premier tri de la boîte du créateur.
Le module `lib/services/contact.ts` compose l'URL — pur, testable, et son
échappement fait l'objet de quatre tests unitaires : `&`, `#`, `+`,
apostrophe, chacun casse le `mailto:` sur au moins un client sans encodage.

**Deux choix d'implémentation à défendre :**

1. `URLSearchParams` remplace les espaces par `+`. Outlook les interprète
   comme des signes plus littéraux dans le sujet et le corps. On encode
   donc chaque paramètre à la main avec `encodeURIComponent`, qui produit
   `%20`.
2. L'adresse du créateur apparaît en clair sous les boutons, en plus du
   `mailto:`. Les scrapers d'e-mails la trouveront — c'est le prix d'une
   fiche publique. La cacher (via image ou obfuscation JS) n'arrête aucun
   scraper sérieux et rendrait l'adresse invisible aux lecteurs d'écran.

Le créateur qui regarde sa propre fiche voit un rappel au lieu des boutons.
Un `mailto:` vers sa propre boîte serait une porte qui s'ouvre sur rien.

Le lien « Services » du menu principal était `href: null` — les items
placés-là parce que la page n'existait pas retrouvent une destination avec
S4/S5. Rien de plus qu'un point-virgule dans `nav-data.ts`.

---

## 24. Événements — découpage

*Écrit le 10 septembre 2026, après Services.*

### 24.1 Cinq pas, et un régime différent des deux précédents

Événements n'est **pas** une variante de Jobs ni de Services, et le confondre
avec eux ferait construire deux écrans inutiles. §18.1 tranche : c'est
l'administration qui publie, et personne d'autre. Donc **pas de file de
modération, pas de fil de soumission** — ce qui existe a été publié par
quelqu'un qui en avait le droit.

Ce qui remplace la modération comme travail principal : **les inscriptions**.
C'est là que vit la complexité de ce CMS.

| | Contenu |
|---|---|
| **E1** | Schéma : `Event` corrigé (relations, `ContentState`, annulation séparée), `EventRegistration` reliée à `User` + module pur `lib/evenements/phases.ts` | ✅ |
| **E2** | Création et édition par l’administration : formulaire, garde `publier_du_contenu`, brouillon → publié | ✅ |
| **E3** | Lecture publique : `/evenements`, `/evenements/[id]`, filtre par type | ✅ |
| **E4** | Inscription : s'inscrire, se désinscrire, verrou de capacité, une par personne | ✅ |
| **E5** | Gestion des inscrits : liste, export CSV, annulation d'un événement | à faire |

Les **concours** — jury, dotation, saisie des résultats (§5.2) — sortent de ce
périmètre. Le schéma leur garde `prizeAmount` et `jury` ; les écrans viendront
quand un premier concours sera réellement prévu, plutôt que d'être devinés.

### 24.2 Deux horloges, et `status` les confondait

C'est le défaut que E1 corrige, et c'est le même que J1 avait trouvé sur
`JobPosting`. `Event.status` valait `"upcoming"` par défaut — une chaîne
libre, qui répondait à deux questions sans rapport :

- **l'état éditorial** — ce contenu existe-t-il pour le public ? Il résulte
  d'une décision humaine, donc il se range. C'est `state`, le même
  `ContentState` que les trois autres CMS ;
- **la phase** — où en est-on du calendrier ? Elle résulte du temps qui passe,
  donc elle se **calcule**, dans `lib/evenements/phases.ts`.

Les tenir dans une colonne rendait l'une des deux fausse dès qu'on touchait à
l'autre. Et le défaut `"upcoming"` publiait tout événement dès sa création,
avant même qu'on ait fini de le rédiger.

Un statut rangé aurait aussi demandé un ordonnanceur pour faire passer chaque
événement de « à venir » à « en cours » à l'heure dite. Le jour où ce passage
rate son tour, un atelier commencé s'annonce encore à venir — et prend des
inscriptions pour une salle déjà pleine.

### 24.3 Terminé n'est pas expiré

Jobs fait disparaître une offre périmée : elle n'aide plus personne, et un
annuaire de fantômes se vide de ses lecteurs. **Un événement passé reste
consultable** — on vient y lire ce qui s'est produit, les résultats d'un
concours, la composition du jury.

C'est pourquoi `estPublic` accepte une échéance *facultative* : Jobs la lui
donne, Événements ne la lui donne jamais.

### 24.4 Annuler n'est pas retirer

`cancelledAt` vit à part de `state`, et la distinction n'est pas cosmétique.

Un événement annulé doit **rester visible**. Les inscrits ont noté la date,
prévu un déplacement, peut-être payé un billet — les envoyer sur une page
absente les laisserait chercher. `cancelReason` accompagne, parce qu'un
« annulé » sans raison fait écrire tous les inscrits un par un.

`RETIRE` reste pour ce qui n'aurait pas dû paraître ; `cancelledAt` pour ce
qui n'aura pas lieu et qui doit le dire.

### 24.5 On s'inscrit encore pendant, pas après

Le choix mérite d'être écrit parce que l'inverse semble plus naturel : fermer
les inscriptions au coup d'envoi. Il serait faux pour la moitié du catalogue —
une exposition court deux semaines, un concours reste ouvert jusqu'à sa
clôture, un atelier en ligne accepte un retardataire.

C'est donc la **fin** qui ferme. Un organisateur qui veut arrêter plus tôt a
deux moyens honnêtes : le plafond de capacité, ou l'annulation.

L'ordre des refus suit la même logique qu'ailleurs : ce qui est définitif —
annulé, terminé — passe devant ce qui peut changer. Et « déjà inscrit » passe
devant « complet », parce que sur un événement plein les deux sont vrais et
seul le premier renseigne la personne.

### 24.6 Se désinscrire efface la ligne

`EventRegistration` n'a **pas** de colonne d'état, et c'est délibéré. La
version précédente portait `status String @default("registered")`, qui aurait
servi à marquer une désinscription — sauf que l'unicité `(eventId, userId)`
aurait alors **empêché de se réinscrire**. Quelqu'un qui se désiste puis change
d'avis se serait heurté à sa propre ligne annulée, sans que rien ne le dise.

La présence de la ligne fait donc foi. La trace de ce qui a été payé est une
autre affaire : un billet remboursé appartient au registre des paiements, pas
à celui des présences.

### 24.7 E2 — écrire un événement, sans file et sans faire semblant

Trois écrans sous `/dashboard/evenements` : la liste, la création, l'édition.
Gardés par `publier_du_contenu`, et **pas** par `moderer_le_contenu` — les deux
métiers sont distincts, et §20.1 raconte ce que coûte de les confondre.

**Le chemin est `BROUILLON → PUBLIE`, directement.** `lib/cms/cycle.ts` le
prévoit depuis J1 « pour le blog et les événements » : leur auteur porte déjà
le droit de publier, et lui faire traverser une file l'obligerait à
s'auto-approuver. `SOUMIS` et `REFUSE` restent donc inatteignables ici — un
état non atteint ne coûte rien, un état manquant coûte une réécriture.

**La liste montre deux colonnes d'état**, parce qu'il y a deux horloges :
l'état éditorial et la phase calculée. Les afficher ensemble est le seul moyen
de voir d'un coup ce qu'on cherche — *un brouillon dont la date approche*.

**Les heures se saisissent en GMT**, et l'écran le dit. C'est exact pour
Abidjan, Dakar, Bamako, Ouagadougou, Lomé et Accra ; faux d'une heure pour
Douala. Un champ de fuseau sur `Event` réglerait le cas, mais l'inventer
aujourd'hui ferait porter un sélecteur à tous les écrans pour une situation
qui ne s'est pas encore présentée. La règle vit **à un seul endroit** — la
validation, à la saisie ; la disperser dans chaque écran d'affichage
garantirait que l'un d'eux l'oublie.

**Le lieu disparaît quand l'événement passe en ligne**, et le champ avec. Le
garder ferait saisir une adresse que la validation efface — du travail demandé
puis jeté sans le dire. Inversement, un présentiel sans adresse est refusé :
c'est la seule chose qui permette de venir.

**La gratuité s'écrit d'une seule façon.** Vide et `0` disent la même chose,
et la validation range `null` dans les deux cas — pour qu'aucun écran n'ait à
traiter deux écritures du même fait.

**Un billet payant ferme l'inscription en ligne**, et l'écran d'édition
l'annonce dès maintenant : l'encaissement des billets n'est pas branché, et
donner des places sans les faire payer serait pire que ne pas en donner. C'est
E4 qui portera le refus.

Seize tests d'intégration, dont la course entre deux personnes sur la même
fiche et le fait qu'une seconde annulation n'écrase pas la première raison.

### 24.8 E3 — la lecture publique, et le piège du compte à rebours

`/evenements` et `/evenements/[id]`, traduits de `Baobart Accueil.dc.html`,
section `PAGE CONCOURS & EVENEMENTS`. Lecture ouverte à tout le monde ;
s'inscrire demandera un compte (E4), la même asymétrie que Jobs.

**Une seule clause de visibilité, et c'est une de moins que Jobs.** L'état
`PUBLIE`, rien d'autre. Jobs en porte deux — état *et* échéance — parce
qu'une offre périmée n'aide personne ; un événement passé, si : on vient y
lire ce qui s'est produit (§24.3). Un annulé reste visible lui aussi, et sa
fiche annonce l'annulation **avant le titre** — c'est ce qu'un inscrit doit
lire en premier (§24.4).

**Deux requêtes plutôt qu'un tri unique.** « Les prochains du plus proche au
plus lointain, puis les passés du plus récent au plus ancien » ne s'exprime
pas dans un seul `orderBy` : les deux moitiés se trient dans des sens
opposés autour d'un pivot qui est l'instant présent. Tout rapatrier pour
trier en mémoire chargerait des années d'archives pour afficher quarante
lignes.

**Le compte à rebours ne calcule rien au premier rendu.** C'est le piège
exact que la documentation de React cite — *« Variable input such as
`Date.now()` which changes each time it's called »* : le serveur rend son
heure, le navigateur recalcule la sienne, et les deux diffèrent forcément.

On n'y répond pas par `suppressHydrationWarning` : ce serait éteindre
l'alarme au lieu de traiter la cause. Le premier rendu affiche des tirets —
identiques des deux côtés, vérifié dans le HTML servi — et le décompte
n'apparaît qu'après le montage, quand seul le navigateur parle. Il bat à la
minute et non à la seconde : la maquette n'affiche pas les secondes, et les
rafraîchir soixante fois par minute se paierait en batterie.

**L'encart « Édition en cours » est élargi aux quatre genres.** La maquette
le réserve au concours du moment ; s'il fallait un concours pour le remplir,
la page serait vide toutes les semaines où il n'y en a pas. Un bandeau vide
vaut moins qu'un bandeau qui annonce l'atelier de jeudi. Le décompte vise le
début tant que l'événement n'a pas commencé, puis la fin — un compteur figé
à zéro pendant deux semaines d'exposition ne dirait plus rien.

**Deux blocs dessinés, absents :** le bouton « Proposer un événement » ne
mène nulle part, parce que publier est réservé à l'administration (§18.1) et
qu'un bouton qui ouvre sur un refus vaut moins qu'une phrase qui explique ;
les trois étapes « Comment ça se passe » sont du texte éditorial que rien ne
porte en base — les écrire en dur les ferait vieillir sans que personne ne
puisse les corriger.

Le lien « Concours & Événements » du menu principal, jusqu'ici `href: null`,
retrouve sa destination.

### 24.9 E4 — la dernière place ne se donne pas deux fois

C'est le seul vrai problème de ce pas, et il ne se voit pas en lisant du code
naïf. Deux personnes ouvrent la fiche au même instant, il reste une place :

```
A lit participantsCount = 49, capacity = 50  → il reste une place
B lit participantsCount = 49, capacity = 50  → il reste une place
A écrit 50, B écrit 50
```

Deux inscrits pour une place, et le compteur affiche 50 au lieu de 51 : on ne
s'en aperçoit même pas. **Vérifier avant d'écrire ne suffit jamais** — entre
la lecture et l'écriture, le monde a changé.

La réservation tient donc en **une seule instruction**, où la condition et
l'incrément sont indissociables :

```sql
UPDATE "Event" SET "participantsCount" = "participantsCount" + 1
WHERE "id" = … AND ("capacity" IS NULL OR "participantsCount" < "capacity")
```

PostgreSQL sérialise les écritures sur une même ligne : la seconde attend la
première, relit la valeur à jour, et sa condition devient fausse. Le nombre de
lignes touchées dit si la place a été prise — zéro signifie « complet », et
c'est une réponse, pas une supposition.

Deux tests le prouvent, et ils ne pouvaient pas s'écrire contre un faux : il
faut une vraie ligne PostgreSQL pour que le verrou ait quelque chose à
verrouiller. Le second lance **dix candidats sur trois places** et vérifie que
le compteur et le nombre de lignes tombent tous deux sur trois.

### 24.10 On compense plutôt qu'on n'enveloppe

La première version entourait les deux écritures d'un `$transaction`, et
levait une exception pour dire « c'est complet ». Elle a été retirée après
l'avoir vue échouer.

Une transaction interactive **retient une connexion du pool** pendant toute sa
durée, et le seul moyen de l'annuler est d'y lever. Utiliser une exception
pour un cas parfaitement ordinaire faisait donc tenir des connexions sur le
flux normal, jusqu'à épuiser le pool sous concurrence : dix tests
d'intégration sur treize échouaient, non pas sur leurs assertions, mais sur le
nettoyage qui n'obtenait plus de connexion.

La place se rend désormais par une **écriture de compensation explicite**. Le
prix est réel et vaut d'être écrit : si le processus meurt entre la
réservation et l'inscription, une place reste retenue sans occupant. C'est
rare, sans gravité — une place de trop sur un atelier — et cela se corrige en
recomptant les lignes. Une connexion épuisée, elle, bloque tout le monde.

### 24.11 Ce que l'inscription refuse, et pourquoi elle le dit avant

Les règles vivent dans `peutSInscrire` (§24.5), pur et éprouvé sans base.
S'y ajoute un refus que E2 avait annoncé : **un billet payant reste fermé**
tant que l'encaissement n'est pas branché. Donner des places sans les faire
payer serait pire que ne pas en donner.

La fiche l'annonce **avant** le clic plutôt que de laisser le bouton refuser :
un bouton qui ouvre sur un refus vaut moins qu'une phrase qui explique.

**Se désinscrire efface la ligne** et rend la place — c'est ce que l'absence
de colonne d'état achète (§24.6), et un test vérifie qu'on peut effectivement
se réinscrire ensuite. Le compteur ne descend jamais sous zéro : un compteur
désynchronisé rendrait sinon un « -1 inscrit » que la fiche afficherait tel
quel.

Le bouton de retrait est **distinct** de celui d'inscription, jamais une
bascule : l'un rend une place, l'autre en prend une, et sur un événement
complet la place rendue par mégarde est reprise dans la minute.
