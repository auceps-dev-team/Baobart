# Baobart — Blueprint technique Next.js (Point B)

**Architecture cible, schéma Prisma détaillé, mapping Gumroad → TypeScript**
**Document B — v1.0 — août 2026**

> Complète le plan directeur (`PLAN_REFONTE_BAOBART_GUMROAD.md`). Le dépôt Gumroad (MIT) sert de **spécification** : on traduit sa logique métier, on ne copie pas son code.

---

## 1. Stack cible (rappel consolidé)

| Couche | Choix | Justification |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript strict** | SSR/ISR pour le feed, Server Actions pour les actions |
| BDD | **PostgreSQL 16 + Prisma ORM** (+ `$queryRaw` sur les chemins chauds) | Schéma typé, migrations, curseur natif |
| Cache | **Redis** (Upstash/self-hosted) | Feed, compteurs, sessions, quotes FX |
| Auth | **NextAuth (Auth.js) ou Lucia** — email + OTP + **passkeys (WebAuthn)** | 2FA dès M0 (§3.6 du plan) |
| Paiements | **Flutterwave** (prim) + **Paystack** + **CinetPay/PayDunya** + Stripe (cartes) | Mobile money OM/MTN/Wave (§6.1) |
| Abonnements | Flutterwave subscriptions / Stripe Billing | Paliers acheteurs + membreships |
| Médias | **S3-compatible + CDN** (Cloudflare R2/CloudFront), upload direct presign | Shots = produit principal (§3.7-G) |
| Jobs async | **Inngest** (ou BullMQ) | Compteurs, payouts, modération, résumés IA |
| Emails | **Resend** + gestion bounces/suppressions | Newsletters créateurs (§10.6) |
| Recherche | Postgres full-text (v1) → **Meilisearch** (v2) + suggestions/autocomplete | §3.7-E |
| IA | API LLM (Claude/GPT/Gemini) + streaming | Assistant (§9), fiche produit (§3.9-B) |
| Observabilité | Sentry + OpenTelemetry + slow-query logs | Dès M0 (§8) |

---

## 2. Structure du projet

```
baobart/
├── app/
│   ├── (marketing)/            # Accueil, Explorer, Créateurs, Tarifs, À propos
│   │   ├── page.tsx
│   │   └── tarifs/page.tsx
│   ├── explore/                # Feed masonry ← Pinterest
│   │   └── page.tsx
│   ├── shots/[id]/             # Détail shot, likes, commentaires, acheter lié
│   ├── boards/[id]/            # Tableaux, épingler (saves) ← Pinterest
│   ├── creatifs/[username]/    # Portfolios, followers, badges ← Dribbble
│   ├── products/[slug]/        # Fiche produit, checkout
│   ├── services/  jobs/  events/
│   ├── communaute/  forum/
│   ├── dashboard/              # Portail vendeur (KPI, gains, ventes, dépôt)
│   │   ├── layout.tsx          # Shell : nav latérale, garde de rôle
│   │   └── (gains|ventes|services|jobs|evenements|assistant)/
│   └── api/                    # Route handlers (webhooks, upload, IA)
├── prisma/
│   ├── schema.prisma           # §4 — schéma complet
│   └── migrations/
├── lib/
│   ├── domain/                 # ★ logique portée de Gumroad (traduction TS)
│   │   ├── orders.ts           #   cycle de vie d'une commande
│   │   ├── balances.ts         #   soldes + transactions (versé/en attente)
│   │   ├── commissions.ts      #   services en 2 temps (acompte 50 %)
│   │   ├── payouts.ts          #   fréquence + projection + rails
│   │   ├── trust.ts            #   machine à états de risque vendeur (§3.8)
│   │   └── pool.ts             #   pool d'abonnement créateurs (§2.4)
│   ├── payments/               # Adaptateurs sur une même interface
│   │   ├── charge-processor.ts #   pattern ChargeProcessor (du dépôt)
│   │   ├── flutterwave.ts  paystack.ts  cinetpay.ts  stripe.ts
│   │   └── payout-schedule.ts  #   rails par pays/mobile money (§3.9-A)
│   ├── shield/                 # ★ Baobart Shield (Point C)
│   │   ├── pipeline.ts         #   flux d'upload complet
│   │   ├── watermark.ts        #   filigrane invisible robuste
│   │   ├── c2pa.ts             #   manifest C2PA (provenance)
│   │   ├── perturbation.ts     #   Glaze/Nightshade-like (GPU job)
│   │   └── fingerprint.ts      #   pHash + recherche inversée
│   ├── ai-assistant/           # catalogue d'actions + exécuteur + streaming
│   ├── growth/                 # affiliation, codes promo, panier abandonné
│   ├── gamification/           # badges, critères, moteur
│   └── i18n/                   # fr-FR, formatage 180 000 F / ₦45 000
├── jobs/                       # Inngest : compteurs, payouts, modération…
├── components/  hooks/  types/
├── docker-compose.yml          # postgres + redis (+ minio en dev)
└── vitest.config.ts  eslint/  playwright/
```

---

## 3. Règles d'architecture (à respecter dès M0)

1. **Prisma est un moyen, pas une fin** : chemins chauds (feed, compteurs, pool) en `$queryRaw` ; tout le reste via Prisma typé.
2. **Pagination curseur partout** (`(created_at, id)`) — jamais d'OFFSET sur les grandes tables.
3. **Compteurs dénormalisés** sur les modèles (likesCount, downloadsCount…) mis à jour **par jobs async**, jamais en lecture directe.
4. **CQRS léger** : écritures transactionnelles (ordre, balance) / lectures via cache Redis + CDN.
5. **Jobs async** pour tout ce qui n'est pas critique (notifications, analytics, emails, modération).
6. **Rôles & permissions** : un système de policies TS (équipes multi-rôles §3.10-B) dès le dashboard.
7. **Le domaine monétaire** est traduit **avec les règles exactes** des modèles Rails (statuts, transitions) — pas réinventé.

---

## 4. Schéma Prisma détaillé

> ### ⚠️ Ce schéma n'est plus la source de vérité
>
> Le schéma réel vit dans **`prisma/schema.prisma`**, à la racine du dépôt. Il est
> implémenté, migré et validé. Ce qui suit est le brouillon de conception, conservé pour
> mémoire — il contient des erreurs corrigées depuis :
>
> - `User.profile` y est déclaré **deux fois** (§4.1) : le schéma ne compile pas tel quel ;
> - `ShieldLevel` (§4.0) écrit `WATERMARK ONLY` sans souligné, ce qui crée **5 valeurs au lieu de 4** ;
> - la plupart des relations n'ont qu'une extrémité, ce que Prisma refuse.
>
> **Le bloc argent (§4.3) a par ailleurs été refondu** après lecture du code Gumroad
> (voir `VERIFICATION_GUMROAD.md` §5) : `Balance` est journalier et non unique par vendeur,
> `BalanceTransaction` porte **six** colonnes monétaires et non une, `refunded` n'est **pas**
> un statut mais un enregistrement `Refund` — ce qui seul permet le remboursement partiel —
> et l'état de l'argent vit sur la **ligne d'achat**, pas sur la commande.

### 4.0 Enums

```prisma
enum UserRiskState { NOT_REVIEWED COMPLIANT ON_PROBATION FLAGGED_FRAUD FLAGGED_TOS SUSPENDED_FRAUD SUSPENDED_TOS }
enum TeamRole { ADMIN MARKETING SUPPORT ACCOUNTANT }
enum ProductType { DIGITAL BUNDLE COMMISSION CALL COFFEE PHYSICAL MEMBERSHIP }
enum ProductStatus { DRAFT PUBLISHED ARCHIVED }
enum OrderStatus { IN_PROGRESS SUCCESSFUL REFUNDED FAILED NOT_CHARGED }
enum PayoutStatus { PENDING ISSUING PAID FAILED REVERSED }
enum PayoutMethod { BANK MOBILE_MONEY }
enum LicenseCode { PERSONAL COMMERCIAL EXTENDED }
enum PlanCode { DISCOVERY EXPLORER STUDIO }
enum SubscriptionStatus { ACTIVE CANCELLED EXPIRED }
enum CommunityVisibility { PUBLIC PRIVATE INVITE_ONLY }
enum ForumRole { MEMBER MODERATOR ADMIN }
enum BadgeCode { VERIFIED_CREATOR TOP_CREATOR NEW_TALENT COMMUNITY_PILLAR VIP_CREATOR }
enum JobType { FREELANCE CDD CDI INTERN APPRENTICE }
enum JobMode { REMOTE HYBRID ONSITE }
enum EventKind { CONTEST WORKSHOP CONFERENCE EXHIBITION }
enum ShieldLevel { NONE WATERMARK ONLY PERTURBATION PERTURBATION_PLUS }
enum Currency { XOF NGN GHS KES ZAR MAD USD EUR }
```

### 4.1 Auth & utilisateurs

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  emailVerified DateTime?
  phone         String?  @unique            // mobile money
  passwordHash  String?
  riskState     UserRiskState @default(NOT_REVIEWED)   // §3.8 machine à états
  kycStatus     String   @default("none")   // none | pending | verified
  defaultCurrency Currency @default(XOF)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  profile       Profile?
  accounts      Account[]
  sessions      Session[]
  memberships   TeamMembership[] @relation("member")
  teams         TeamMembership[] @relation("seller")
  workItems     WorkItem[]
  boards        Board[]
  profile     Profile?  // (dupliqué ci-dessous, évité — un seul)
}

model Profile {
  id          String @id @default(cuid())
  userId      String @unique
  username    String @unique
  displayName String
  bio         String? @db.Text
  city        String?
  country     String?                        // ISO 3166-2
  avatarUrl   String?
  bannerUrl   String?
  isVerified  Boolean @default(false)        // badge Créateur vérifié
  ratingAvg   Decimal @default(0)            // dénormalisé (§3.9-H)
  ratingCount Int     @default(0)
  workCount   Int     @default(0)            // compteurs dénormalisés
  user        User    @relation(fields: [userId], references: [id])
}

model TeamMembership {                         // espaces d'équipe multi-rôles §3.10-B
  id        String @id @default(cuid())
  memberId  String
  sellerId  String
  role      TeamRole
  member    User   @relation("member", fields: [memberId], references: [id])
  seller    User   @relation("seller", fields: [sellerId], references: [id])
  @@unique([memberId, sellerId])
}

model Account  { id String @id @default(cuid()); userId String; provider String; providerAccountId String;  user User @relation(fields: [userId], references: [id]); @@unique([provider, providerAccountId]) }
model Session  { id String @id @default(cuid()); userId String; expiresAt DateTime; user User @relation(fields: [userId], references: [id]) }
model Passkey  { id String @id @default(cuid()); userId String; credentialId String @unique; publicKey String; user User @relation(fields: [userId], references: [id]) }  // WebAuthn §3.6
```

### 4.2 Social visuel — le cœur Pinterest/Dribbble

```prisma
model WorkItem {                              // « shot » — publication visuelle
  id           String   @id @default(cuid())
  authorId     String
  title        String
  caption      String?  @db.Text
  coverImageId String?                        // image de couverture
  status       String   @default("published") // draft | published | archived
  shieldLevel  ShieldLevel @default(WATERMARK)
  likesCount   Int      @default(0)           // compteurs dénormalisés
  commentsCount Int     @default(0)
  savesCount   Int      @default(0)
  viewsCount   Int      @default(0)
  createdAt    DateTime @default(now())

  author       User     @relation(fields: [authorId], references: [id])
  images       WorkImage[]
  tags         WorkItemTag[]
  likes        Like[]
  comments     Comment[]
  saves        Save[]
  product      Product?                      // le shot peut devenir vendable

  @@index([createdAt, id])                    // pagination curseur feed
  @@index([authorId])
}

model WorkImage {
  id         String @id @default(cuid())
  workItemId String
  mediaId    String                            // → MediaAsset (S3, variantes)
  variant    String @default("original")       // original | preview | thumb
  width      Int?   height Int?
  workItem   WorkItem @relation(fields: [workItemId], references: [id])
}

model Tag     { id String @id @default(cuid()); slug String @unique; name String; workItems WorkItemTag[] }
model WorkItemTag { workItemId String; tagId String; workItem WorkItem @relation(fields: [workItemId], references: [id]); tag Tag @relation(fields: [tagId], references: [id]); @@id([workItemId, tagId]) }

model Like {
  id         String   @id @default(cuid())
  userId     String
  workItemId String
  createdAt  DateTime @default(now())
  user       User     @relation(fields: [userId], references: [id])
  workItem   WorkItem @relation(fields: [workItemId], references: [id])
  @@unique([userId, workItemId])
}

model Comment {
  id         String   @id @default(cuid())
  authorId   String
  workItemId String
  parentId   String?                          // réponses threadées
  body       String   @db.Text
  likesCount Int      @default(0)
  createdAt  DateTime @default(now())
  workItem   WorkItem @relation(fields: [workItemId], references: [id])
  @@index([workItemId, createdAt])
}

model Board {                                 // « tableau » Pinterest
  id          String @id @default(cuid())
  ownerId     String
  title       String
  description String?
  isPublic    Boolean @default(true)
  coverImageId String?
  saves       Save[]
  owner       User    @relation(fields: [ownerId], references: [id])
}

model Save {                                  // épingler (shot ou produit)
  id        String  @id @default(cuid())
  boardId   String
  workItemId String?
  productId String?
  createdAt DateTime @default(now())
  board     Board   @relation(fields: [boardId], references: [id])
  @@unique([boardId, workItemId])
  @@unique([boardId, productId])
}

model Follow {
  id         String @id @default(cuid())
  followerId String
  followingId String
  createdAt  DateTime @default(now())
  @@unique([followerId, followingId])
}
```

### 4.3 Commerce (porté de Gumroad, nommage Baobart)

```prisma
model Product {
  id           String      @id @default(cuid())
  sellerId     String
  workItemId   String?                       // shot lié (optionnel)
  name         String
  description  String?     @db.Text
  coverImageId String?
  type         ProductType @default(DIGITAL)
  status       ProductStatus @default(DRAFT)
  price        Int                            // ENTIERS FCFA (pas de cents) — décision §6.1
  currency     Currency    @default(XOF)
  isStaffPicked Boolean   @default(false)     // §3.10-A collections éditoriales
  isBoosted    Boolean     @default(false)    // boost de découverte §10.9
  discoverFeePerThousand Int?                 // pay-to-boost (pattern Gumroad)
  licenseTypeId String?
  createdAt    DateTime    @default(now())
  @@index([createdAt, id])                    // curseur feed
  @@index([sellerId])
}

model ProductFile {
  id        String @id @default(cuid())
  productId String
  mediaId   String
  filename  String
  sizeBytes Int
  order     Int    @default(0)
  product   Product @relation(fields: [productId], references: [id])
}

model Variant {
  id         String @id @default(cuid())
  productId  String
  name       String
  priceDelta Int    @default(0)               // supplément en FCFA
  product    Product @relation(fields: [productId], references: [id])
}

model Cart {
  id        String @id @default(cuid())
  userId    String
  items     Json    @default("[]")            // [{productId, variantId, qty}]
  updatedAt DateTime @updatedAt
}

model Order {
  id        String    @id @default(cuid())
  buyerId   String
  status    OrderStatus @default(IN_PROGRESS) // machine à états §3.9
  total     Int
  currency  Currency  @default(XOF)
  createdAt DateTime  @default(now())
  items     OrderItem[]
  @@index([buyerId, createdAt])
}

model OrderItem {
  id        String @id @default(cuid())
  orderId   String
  productId String
  variantId String?
  quantity  Int    @default(1)
  price     Int
  licenseKey LicenseKey?
  order     Order   @relation(fields: [orderId], references: [id])
  product   Product @relation(fields: [productId], references: [id])
}

model Balance {                               // solde vendeur (§3.9-A)
  id       String @id @default(cuid())
  userId   String @unique
  unpaid   Int    @default(0)
  held     Int    @default(0)                 // en attente / on-hold
  paid     Int    @default(0)
  currency Currency @default(XOF)
}

model BalanceTransaction {                    // statuts Versé / En attente (maquette)
  id        String   @id @default(cuid())
  userId    String
  type      String                            // sale | commission | refund | payout | affiliate | pool
  amount    Int
  status    String   @default("on_hold")      // on_hold | issuing | paid | failed
  orderItemId String?
  createdAt DateTime @default(now())
  @@index([userId, status])
}

model Payout {
  id          String   @id @default(cuid())
  userId      String
  method      PayoutMethod
  provider    String                          // om | mtn | wave | bank | stripe
  accountRef  String
  amount      Int
  currency    Currency @default(XOF)
  status      PayoutStatus @default(PENDING)
  scheduledDate DateTime?                     // projection « quand serai-je payé »
  processedAt DateTime?
  isInstant   Boolean  @default(false)        // payout instantané quotidien §3.9-A
  createdAt   DateTime @default(now())
}

model MobileMoneyAccount {                    // KYC mobile money §6.1
  id         String @id @default(cuid())
  userId     String
  provider   String                            // om | mtn | moov | wave
  phone      String
  country    String
  verifiedAt DateTime?
  kycStatus  String @default("none")
  @@unique([userId, provider])
}

model ExchangeRate {                          // conversion affichage §6.1
  id        String @id @default(cuid())
  from      Currency
  to        Currency
  rate      Decimal
  date      DateTime @default(now())
  @@unique([from, to, date])
}
```

### 4.4 Monétisation & licences

```prisma
model Plan {
  id              String    @id @default(cuid())
  code            PlanCode  @unique
  name            String
  priceMonthly    Int                          // FCFA
  downloadsPerMonth Int                       // null = illimité (Studio)
  licenseIncluded LicenseCode                  // PERSONAL (Explorer) | COMMERCIAL (Studio)
  shieldLevel     ShieldLevel
  features        Json      @default("{}")
}

model Subscription {
  id          String   @id @default(cuid())
  userId      String
  planId      String
  status      SubscriptionStatus @default(ACTIVE)
  cycleStart  DateTime @default(now())
  cycleEnd    DateTime
  paymentProvider String
  createdAt   DateTime @default(now())
  @@index([userId, status])
}

model DownloadQuota {                          // compteur de téléchargements/mois
  id             String @id @default(cuid())
  subscriptionId String
  period         String                          // "2026-08"
  used           Int    @default(0)
  limit          Int
  @@unique([subscriptionId, period])
}

model ConsumptionEvent {                       // compteur « téléchargements » maquette §3.9-D
  id        String @id @default(cuid())
  userId    String?
  productId String
  eventType String                             // download | stream | read
  consumedAt DateTime @default(now())
  @@index([productId, consumedAt])
}

model LicenseType {
  id          String     @id @default(cuid())
  code        LicenseCode @unique
  title       String
  description String
  conditions  Json        @default("{}")       // print, edition, broadcast, merchandising…
  pricePremium Int?                            // licence étendue payante
}

model ProductLicense { productId String; licenseTypeId String; @@id([productId, licenseTypeId]) }

model LicenseKey {                             // pattern clés de licence Gumroad §3.1
  id         String   @id @default(cuid())
  productId  String
  orderItemId String  @unique
  serial     String   @unique                  // XXXXXXXX-XXXX-XXXX
  status     String   @default("active")       // active | disabled
  usesCount  Int      @default(0)
  disabledAt DateTime?
  createdAt  DateTime @default(now())
}

model RevenuePool {                            // pool créateurs §2.4
  id          String @id @default(cuid())
  periodStart DateTime
  periodEnd   DateTime
  totalInt    Int
  creatorsShareInt Int                          // 60-70 % redistribué
  distributedAt DateTime?
  allocations RevenuePoolAllocation[]
}

model RevenuePoolAllocation {
  id         String @id @default(cuid())
  poolId     String
  userId     String
  amount     Int
  downloadsCount Int
  pool       RevenuePool @relation(fields: [poolId], references: [id])
}
```

### 4.5 Gamification

```prisma
model Badge {
  id          String @id @default(cuid())
  code        BadgeCode @unique
  name        String
  description String
  criteria    Json      @default("{}")          // formules publiées (transparence §2.6)
}

model UserBadge {
  id        String   @id @default(cuid())
  userId    String
  badgeId   String
  awardedAt DateTime @default(now())
  validUntil DateTime?                          // cycles glissants
  @@unique([userId, badgeId])
}
```

### 4.6 Jobs, Événements, Services

```prisma
model JobPosting {
  id          String @id @default(cuid())
  recruiterId String
  title       String
  type        JobType
  mode        JobMode
  country     String?
  city        String?
  salaryMin   Int?
  salaryMax   Int?
  currency    Currency @default(XOF)
  description String  @db.Text
  deadline    DateTime?
  status      String   @default("published")     // draft | published | filled | closed
  isFeatured  Boolean  @default(false)           // offre payante §2.9
  isVerified  Boolean  @default(false)           // badge « Offre vérifiée »
  createdAt   DateTime @default(now())
  @@index([status, createdAt])
}

model Event {
  id             String   @id @default(cuid())
  organizerId    String
  title          String
  kind           EventKind
  startsAt       DateTime
  endsAt         DateTime
  location       String?
  isOnline       Boolean  @default(false)
  ticketPrice    Int?                            // FCFA
  currency       Currency @default(XOF)
  capacity       Int?
  status         String   @default("upcoming")   // upcoming | ongoing | finished
  prizeAmount    Int?                            // concours (FCFA)
  jury           Json?                           // [{name, role}]
  participantsCount Int @default(0)
  createdAt      DateTime @default(now())
  registrations  EventRegistration[]
}

model EventRegistration {
  id        String @id @default(cuid())
  eventId   String
  userId    String
  status    String @default("registered")
  ticketPaid Int?
  event     Event  @relation(fields: [eventId], references: [id])
  @@unique([eventId, userId])
}

model Commission {                              // service en 2 temps §3.1
  id          String @id @default(cuid())
  sellerId    String
  buyerId     String
  productId   String
  status      String @default("in_progress")    // in_progress | completed | cancelled
  depositAmount Int                              // acompte 50 %
  completionAmount Int?                          // solde à la livraison
  brief       String? @db.Text                   // via CustomField au checkout
  createdAt   DateTime @default(now())
}

model Call {                                    // consultations §3.1
  id          String @id @default(cuid())
  sellerId    String
  buyerId     String
  productId   String
  scheduledAt DateTime
  durationMin Int
  meetingUrl  String?
  status      String @default("scheduled")
}
```

### 4.7 Communauté & forum

```prisma
model Community {
  id          String @id @default(cuid())
  creatorId   String
  name        String
  description String? @db.Text
  coverImageId String?
  visibility  CommunityVisibility @default(PUBLIC)
  memberCount Int    @default(0)
  status      String @default("active")
  members     CommunityMembership[]
  categories  ForumCategory[]
  chatMessages CommunityChatMessage[]
}

model CommunityMembership {
  id          String @id @default(cuid())
  communityId String
  userId      String
  role        ForumRole @default(MEMBER)
  joinedAt    DateTime @default(now())
  @@unique([communityId, userId])
}

model CommunityChatMessage {                    // chat d'équipe (espaces privés)
  id          String   @id @default(cuid())
  communityId String
  authorId    String
  body        String   @db.Text
  createdAt   DateTime @default(now())
  @@index([communityId, createdAt])
}

model ForumCategory {
  id          String @id @default(cuid())
  communityId String
  name        String
  slug        String
  position    Int
  topics      ForumTopic[]
}

model ForumTopic {
  id          String   @id @default(cuid())
  categoryId  String
  authorId    String
  title       String
  viewsCount  Int      @default(0)
  repliesCount Int     @default(0)
  isPinned    Boolean  @default(false)
  isLocked    Boolean  @default(false)
  createdAt   DateTime @default(now())
  posts       ForumPost[]
  @@index([categoryId, createdAt])
}

model ForumPost {
  id        String   @id @default(cuid())
  topicId   String
  authorId  String
  body      String   @db.Text
  likesCount Int     @default(0)
  isFlagged Boolean  @default(false)
  createdAt DateTime @default(now())
  topic     ForumTopic @relation(fields: [topicId], references: [id])
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      String                             // reply | mention | sale | follow | payout…
  payload   Json     @default("{}")
  readAt    DateTime?
  createdAt DateTime @default(now())
  @@index([userId, readAt])
}
```

### 4.8 Croissance & confiance

```prisma
model Affiliate {                             // §10.1
  id          String @id @default(cuid())
  sellerId    String                           // vendeur concerné
  affiliateUserId String?                      // affilié direct (peer)
  type        String   @default("DIRECT")      // DIRECT | GLOBAL (ambassadeur)
  basisPoints Int      @default(1000)          // 10 %
  cookieLifetimeDays Int @default(7)
  status      String   @default("active")
}

model AffiliateRequest {
  id          String @id @default(cuid())
  sellerId    String
  applicantId String
  status      String @default("pending")
  createdAt   DateTime @default(now())
}

model AffiliateCredit {
  id         String @id @default(cuid())
  affiliateId String
  orderItemId String
  amount     Int
  status     String @default("on_hold")
  createdAt  DateTime @default(now())
}

model OfferCode {                             // §10.2
  id          String  @id @default(cuid())
  sellerId    String
  code        String
  type        String                            // PERCENT | FIXED
  amount      Int
  durationDays Int?
  maxUses     Int?
  usesCount   Int     @default(0)
  isCancellationDiscount Boolean @default(false)
  productIds  Json    @default("[]")            // [] = tous
  expiresAt   DateTime?
  @@unique([sellerId, code])
}

model Upsell {                                 // §10.5
  id            String @id @default(cuid())
  sellerId      String
  triggerProductId String
  offerProductId  String
  variantId     String?
  discountPercent Int?
  isActive      Boolean @default(true)
}

model SentAbandonedCartEmail {                 // §10.3
  id        String   @id @default(cuid())
  cartId    String   @unique
  sentAt    DateTime @default(now())
  converted Boolean  @default(false)
}

model CustomField {                            // §10.8 (briefs, candidatures)
  id        String @id @default(cuid())
  productId String
  name      String
  fieldType String                            // TEXT | CHOICE | BOOLEAN | FILE | TERMS
  isRequired Boolean @default(false)
  options   Json    @default("[]")
}

model Post {                                   // newsletters créateurs §10.6
  id          String   @id @default(cuid())
  sellerId    String
  title       String
  body        String   @db.Text
  audienceFilter Json   @default("{}")         // tous / acheteurs / followers / segment
  scheduledAt DateTime?
  sentAt      DateTime?
  openRate    Decimal?
  createdAt   DateTime @default(now())
  deliveries  PostDelivery[]
}

model PostDelivery {
  id       String @id @default(cuid())
  postId   String
  email    String
  status   String @default("pending")          // pending | sent | opened | bounced
  post     Post   @relation(fields: [postId], references: [id])
}

model BlockedObject {                          // §3.6 blocklist
  id         String   @id @default(cuid())
  objectType String                            // IP | EMAIL | PHONE | OBJECT
  objectValue String
  reason     String?
  expiresAt  DateTime?
  createdAt  DateTime @default(now())
  @@index([objectType, objectValue])
}

model ModerationLog {                          // §3.6 modération
  id        String @id @default(cuid())
  entityType String                           // product | shot | comment | forum_post
  entityId  String
  reason    String
  action    String                             // blocked | flagged | approved
  actorId   String?
  createdAt DateTime @default(now())
}

model FraudWarning {                           // §3.8 alertes précoces
  id         String @id @default(cuid())
  orderItemId String
  processor  String
  riskLevel  String
  status     String @default("open")
  createdAt  DateTime @default(now())
}

model AuditLog {                               // §9.4 journalisation
  id        String   @id @default(cuid())
  actorId   String
  action    String
  resource  String
  details   Json     @default("{}")
  createdAt DateTime @default(now())
}

model MediaAsset {                             // upload direct §3.7-G + Shield
  id            String   @id @default(cuid())
  ownerId       String
  purpose       String                         // shot | product | avatar | banner | preview
  s3Key         String   @unique
  checksum      String
  sizeBytes     Int
  contentType   String
  width         Int?
  height        Int?
  status        String   @default("processing")// processing | ready | failed
  shieldLevel   ShieldLevel @default(WATERMARK)
  watermarkPayload String?                     // userId+assetId+timestamp chiffré
  c2paManifestId String?
  phash         String?                        // empreinte perceptuelle §C
  createdAt     DateTime @default(now())
}

model UploadReservation {
  id          String   @id @default(cuid())
  ownerId     String
  purpose     String
  filename    String
  byteSize    Int
  checksum    String
  presignedUrl String
  expiresAt   DateTime
  status      String   @default("pending")
}
```

---

## 5. Mapping Gumroad → TypeScript (référence)

| Domaine | Fichier Gumroad (spécification) | Équivalent TypeScript Baobart | Notes |
|---|---|---|---|
| Cycle d'achat | `app/models/purchase.rb` (state_machine) | `lib/domain/orders.ts` | États : in_progress → successful / refunded / failed |
| Soldes vendeur | `balance.rb`, `balance_transaction.rb` | `lib/domain/balances.ts` | Statuts on_hold / issuing / paid |
| Services 2 temps | `commission.rb` | `lib/domain/commissions.ts` | Acompte 50 % + solde à la livraison |
| Payouts | `payout_schedule.rb`, `payout_rail_schedule.rb` | `lib/payments/payout-schedule.ts` | Fréquence, rails par pays, projection |
| Trust & Safety | `user.rb` (user_risk_state), `low_balance_fraud_check.rb` | `lib/domain/trust.ts` | Machine à états + anti-fraude auto |
| Pool créateurs | (concept Envato — à modéliser) | `lib/domain/pool.ts` | Répartition §2.4 |
| Passerelles | `charge_processor.rb`, `stripe_charge_processor.rb` | `lib/payments/*.ts` | Interface ChargeProcessor unique |
| IA Assistant | `store_agent_api_catalog.rb`, `store_agent_action_executor.rb` | `lib/ai-assistant/` | Catalogue d'actions + exécuteur |
| Fiche produit IA | `ai/product_details_generator_service.rb` | `lib/ai-assistant/product-details.ts` | Nom, description, prix suggéré |
| Clés de licence | `license.rb`, `api/v2/licenses_controller.rb` | `lib/domain/licenses.ts` | Sérial, verify, enable/disable/rotate |
| Emails clients | `post_email_blast.rb` | `lib/growth/newsletters.ts` | Segments + relance non-ouvreurs |
| Affiliation | `affiliate.rb`, `global_affiliate.rb` | `lib/growth/affiliates.ts` | Peer + ambassadeurs, cookie 7 j |
| Recommandations | `recommendations.rb`, `discover_curated_products.rb` | `lib/discovery/` | Curated + signal-based |
| Upload | `api/v2/direct_uploads_controller.rb`, `thumbnail.rb` | `lib/shield/pipeline.ts` | Presign → variants → Shield |
| Modération | `content_moderation/moderate_record_service.rb` | `lib/trust/moderation.ts` | Stratégies + raisons + file |
| Rôles équipe | `user/team.rb` + `app/policies/` | `lib/domain/policies.ts` | Admin/marketing/support/comptable |

---

## 6. Bootstrap M0 (feuille de route concrète)

1. `pnpm create next-app` (TypeScript, App Router, Tailwind, ESLint).
2. `prisma init` + Postgres + Redis via `docker-compose.yml` ; migrer le schéma de base (User, Profile, MediaAsset).
3. Auth (NextAuth) : email + OTP + **passkeys WebAuthn** ; rôles d'équipe basiques.
4. i18n fr-FR : `next-intl`, formats `180 000 F`.
5. Palette lavande/ambre + design system minimal (cartes, boutons, badges).
6. Observabilité : Sentry + slow-query logs + `EXPLAIN ANALYZE` sur chaque requête.
7. Tests : Vitest + Playwright (1 parcours de test par brique métier).

**Critère de sortie M0** : « Baobart » se charge en local, un utilisateur peut s'inscrire, un créateur peut uploader une image et elle passe dans le pipeline Shield v1 (couche 2 : previews filigranés).

---

## 7. Risques propres au blueprint

- **Prisma et gros graphes** : surveiller les `include` imbriqués (N+1) ; profils de lecture dédiés par page.
- **Monolithique Next.js** : garder `lib/domain/` sans dépendances React (testable, portable).
- **Migrations longues** : planifier les migrations lourdes (index, backfills) hors pics.
- **Coût IA/pipeline Shield** : quotas par créateur dès M1 (cf. Point C).
