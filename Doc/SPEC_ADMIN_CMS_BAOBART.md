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
