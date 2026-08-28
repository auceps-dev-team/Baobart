# Baobart.

> **Le studio partagé de l'Afrique créative.** Une plateforme où les créateurs du continent publient, découvrent, partagent et vendent leurs œuvres — numériques et physiques — et se font payer en FCFA, mobile money.

<p align="center">
  <em>Dribbble × Pinterest × monétisation · pensé pour l'Afrique · « du vrai matériel local »</em>
</p>

---

## 📌 Sommaire

- [Présentation](#-présentation)
- [Problème & solution](#-problème--solution)
- [Objectifs](#-objectifs)
- [Fonctionnalités](#-fonctionnalités)
- [Le concept : core loop](#-le-concept--core-loop)
- [Stack technique](#-stack-technique)
- [Architecture & documentation](#-architecture--documentation)
- [Modèle économique (résumé)](#-modèle-économique-résumé)
- [Roadmap](#-roadmap)
- [Installation & déploiement](#-installation--déploiement)
- [Structure du projet](#-structure-du-projet)
- [Contribuer](#-contribuer)
- [Licence & mentions](#-licence--mentions)

---

## 🎨 Présentation

**Baobart** est une plateforme communautaire de **création, découverte et monétisation** pour les créateurs africains (designers, illustrateurs, photographes, motion designers, typographes, artistes, artisans).

Baobart mélange trois mondes :
- **Dribbble** — des portfolios, des « shots » (publications visuelles), des likes, des followers, des défis ;
- **Pinterest** — un **feed visuel** infini, des tableaux, l'épinglage des créations ;
- **Gumroad** — vendre des ressources, des services, des commissions, **payées en monnaie locale**.

La promesse : **« du vrai matériel local, pas de banque d'images générique ».** Chaque œuvre raconte le continent : motifs wax, photographies de Dakar à Abidjan, typographies inspirées des écritures locales, artisanat, peinture, sculpture.

Baobart protège aussi les créateurs : **Baobart Shield** (protection des œuvres contre l'entraînement IA et le vol) et un système de **badges** (Créateur vérifié, Top créateur, VIP) qui récompensent le mérite.

> **« Enfin des visuels qui ressemblent à nos clients. »** — un créateur Baobart (extrait des maquettes)

---

## ❓ Problème & solution

### Le problème
- Les créateurs africains **vendent mal en ligne** : pas de paiement local (FCFA/mobile money), pas de visibilité internationale, pas de protection de leurs œuvres.
- Les acheteurs (agences, studios, diaspora) **ne trouvent pas** de ressources adaptées au contexte local — ils se rabattent sur des banques d'images génériques.
- La collaboration d'équipe repose sur WhatsApp et des captures d'écran (les « espaces d'équipe » Baobart y répondent).

### La solution
Une **place de marché communautaire** qui combine :
1. **Découverte visuelle** (feed masonry + tableaux) — le moteur d'audience ;
2. **Portfolios & social** — la crédibilité des créateurs ;
3. **Commerce en FCFA** — la monétisation (mobile money : Orange Money, MTN MoMo, Wave) ;
4. **Protection & gamification** — la confiance (Shield, badges) ;
5. **Communauté** — le lien (forum, concours, événements, job board).

---

## 🎯 Objectifs

| Objectif | Détail |
|---|---|
| **Devenir la plateforme de référence des créatifs africains** | 1re place dans l'esprit des créateurs UEMOA → continent |
| **Monétiser en monnaie locale** | Paiements FCFA / NGN / GHS + mobile money dès la v1 |
| **Protéger les œuvres** | Baobart Shield : anti-entraînement IA, filigranes, provenance C2PA |
| **Récompenser le mérite** | Badges transparents, jamais achetables |
| **Créer un écosystème complet** | Ressources + services + jobs + événements + forum |
| **Maîtriser les coûts** | Déploiement auto-hébergeable (Docker/VPS) pour contrôler le budget |
| **Atteindre des centaines de milliers d'utilisateurs** | Architecture scalable (voir Performance) |

---

## ✨ Fonctionnalités

### Découverte (Pinterest)
- Feed visuel masonry infini, **pagination curseur** (rapide à grande échelle)
- Filtres par familles : Mockups, Logos, Modèles, Images, Illustrations, Vidéos, Fonts, Icônes, Arts, Packs
- **Tableaux** (boards) et **épinglage** (saves), collections suivables
- Recherche avec **autocomplete + suggestions**, collections **éditoriales** (Staff Picked)

### Portfolios & social (Dribbble)
- **Shots** : publications visuelles, likes, commentaires, followers
- Profils créateurs modulaires (grille de shots, onglets Ressources/Services/Événements/À propos)
- **Badges** : Créateur vérifié, Top créateur, Nouveau talent, Pilier de la communauté, VIP

### Commerce & monétisation (Gumroad)
- Produits numériques : mockups, fonts, packs, illustrations, vidéos, 3D, audio, e-books, flyers, affiches
- **Paiements africains** : Flutterwave, Paystack, CinetPay, Stripe — mobile money + cartes
- Multi-devises : **FCFA / NGN / GHS / KES / ZAR / MAD / USD / EUR**, conversion automatique, PPP
- **Abonnements** : plans Découverte (gratuit) / Explorer (2 500 F) / Studio (7 500 F, licence commerciale)
- **Licences** : personnelle / commerciale / étendue, certificat PDF, clés d'activation
- **Services** (commissions en 2 temps : acompte 50 % + solde à la livraison), consultations (calls)
- **Livraison numérique** : formats originaux (PNG, PDF, TIFF, AI, ZIP, MP4, MP3…), ZIP streamé, previews multi-format (image, vidéo, audio, **3D**, PDF, fonts)
- **Produits physiques** (phase 2) : print-on-demand, peintures, sculptures, artisanat — avec **escrow** et suivi

### Communauté & offres
- **Forum** threadé (catégories, topics, modération) + espaces d'équipe (rôles admin/marketing/support/comptable)
- **Concours & événements** (jury, prix FCFA, compte à rebours), **Job board** payant avec vérification des recruteurs
- **Emails/newsletters** intégrés pour les créateurs

### Créateurs (dashboard)
- Tableau de bord : KPI (revenus du mois, ventes, téléchargements, note), graphique 6 mois, dernières ventes (Versé / En attente)
- **Baobart Assistant** (IA) : copilote conversationnel (stats, création de produit, réponses)
- Affiliation (peer + ambassadeurs), codes promo, upsell, panier abandonné, échelonnement
- **Intégrations outils** : connecter **Figma / Canva / Framer**, publier ses créations sans quitter l'outil (plugin « Publier sur Baobart »)

### Confiance & sécurité
- **Baobart Shield** : filigranes invisibles, provenance C2PA, perturbation anti-IA (Glaze/Nightshade), aperçus dégradés
- **Moteur de confiance** : machine à états de risque des vendeurs, anti-fraude automatique, KYC
- **2FA** (TOTP + passkeys), login social (Google, GitHub, Apple, Discord) + **téléphone OTP**
- RGPD (effacement de données), blocklist, modération automatisée

### Admin (back-office)
- Super Admin : dashboard KPI, modération unifiée, gestion vendeurs (KYC, suspensions), payouts, sponsoring, audit complet
- **CMS** : blogs, événements, jobs, services

---

## 🔄 Le concept : core loop

> **1.** Le créatif publie un **shot** → **2.** la communauté le découvre dans le **feed** → **3.** likes / épingles dans les tableaux → **4.** followers → **5.** certains shots sont **optionnellement liés** à un produit vendable, un service ou une commission → **6.** gains en **FCFA** et en réputation.

Chaque shot peut être monétisé : c'est l'hybride unique — *« Pinterest/Dribbble où tu peux acheter ce que tu regardes, en FCFA, avec du vrai matériel local »*.

---

## 🛠 Stack technique

| Couche | Techno |
|---|---|
| Framework | **Next.js 15 (App Router)** + TypeScript strict |
| UI | **Tailwind CSS** — design system « Sticker » (lavande/ambre, contours encre) |
| Base de données | **PostgreSQL 16 + Prisma ORM** (curseur, compteurs dénormalisés) |
| Cache | **Redis** (feed, compteurs, sessions) |
| Auth | NextAuth — email + OTP téléphone + social + **passkeys** |
| Paiements | **Flutterwave / Paystack / CinetPay** (mobile money) + Stripe |
| Médias | S3-compatible (R2 / MinIO) + CDN, upload direct presign |
| Jobs | **Inngest** (cloud) / **BullMQ** (self-host) via abstraction |
| Emails | Resend / SMTP via abstraction |
| Recherche | Postgres full-text (v1) → Meilisearch (v2) |
| IA | LLM API (Claude/GPT/Gemini) — Assistant, fiches produit, résumés |
| Observabilité | Sentry + OpenTelemetry + slow-query logs |

---

## 📚 Architecture & documentation

Le projet est entièrement documenté dans `docs/` (voir aussi les specs à la racine) :

| Document | Contenu |
|---|---|
| [`PLAN_REFONTE_BAOBART_GUMROAD.md`](PLAN_REFONTE_BAOBART_GUMROAD.md) | Plan directeur v11 : concept, modèle économique, catalogue des découvertes Gumroad (MIT), roadmap M0→M8. Le §0-bis est le journal d'avancement réel |
| [`AUDIT_GUMROAD_2026-08-28.md`](AUDIT_GUMROAD_2026-08-28.md) | **Audit le plus récent** : écart plan/code, statut des points bloquants, catalogue Gumroad croisé avec le code réel |
| [`MATRICE_IMPLEMENTATION.md`](MATRICE_IMPLEMENTATION.md) | **Inventaire vivant** spec → module → statut → tests → dette, mis à jour à chaque commit qui fait avancer une fonctionnalité |
| [`VERIFICATION_GUMROAD.md`](VERIFICATION_GUMROAD.md) | **Relevé des écarts** entre le plan et le code réel de Gumroad (le référent) — ce qui est vérifié, ce qui est faux, ce qui manquait |
| [`BLUEPRINT_NEXTJS_BAOBART.md`](BLUEPRINT_NEXTJS_BAOBART.md) | Architecture Next.js, mapping Gumroad → TypeScript. ⚠️ Son schéma est un brouillon : la source de vérité est `prisma/schema.prisma` |
| [`SPEC_BAOBART_SHIELD.md`](SPEC_BAOBART_SHIELD.md) | Protection droits d'auteur (4 couches) |
| [`SPEC_LIVRAISON_PREVIEWS_ASSETS.md`](SPEC_LIVRAISON_PREVIEWS_ASSETS.md) | Livraison numérique + previews multi-format |
| [`SPEC_PRODUITS_PHYSIQUES_BAOBART.md`](SPEC_PRODUITS_PHYSIQUES_BAOBART.md) | Catalogue étendu + livraison physique (escrow) |
| [`SPEC_LICENCES_BAOBART.md`](SPEC_LICENCES_BAOBART.md) | Licences, certificat, clés d'activation |
| [`SPEC_GAMIFICATION_BAOBART.md`](SPEC_GAMIFICATION_BAOBART.md) | Badges, formules, cycles |
| [`SPEC_ADMIN_CMS_BAOBART.md`](SPEC_ADMIN_CMS_BAOBART.md) | Super Admin + CMS (blogs, events, jobs, services) |
| [`SPEC_AUTH_INTEGRATIONS_BAOBART.md`](SPEC_AUTH_INTEGRATIONS_BAOBART.md) | Login social + intégrations Figma/Canva/Framer |
| [`SPEC_DEPLOIEMENT_SELFHOSTING_BAOBART.md`](SPEC_DEPLOIEMENT_SELFHOSTING_BAOBART.md) | Docker, Vercel, VPS, coûts |
| [`ANALYSE_DESIGN_SYSTEM_BAOBART.md`](ANALYSE_DESIGN_SYSTEM_BAOBART.md) | Analyse du design system « Sticker » + contrastes |
| [`CHARTE_EDITORIALE_BAOBART.md`](CHARTE_EDITORIALE_BAOBART.md) | Charte éditoriale (ton inspiré de Gumroad) |
| [`MODELE_ECONOMIQUE_BAOBART.xlsx`](MODELE_ECONOMIQUE_BAOBART.xlsx) | Modèle économique chiffré (hypothèses, projection 24 mois) |
| [`MAQUETTES_BAOBART.html`](MAQUETTES_BAOBART.html) | Maquettes fonctionnelles (tarifs, badges, profil, jobs, bibliothèque, admin) |

---

## 💰 Modèle économique (résumé)

| Flux | Mécanique |
|---|---|
| **Abonnements acheteurs** | Découverte (gratuit) · Explorer (2 500 F/mois) · Studio (7 500 F/mois) |
| **Commission créateurs** | **10 %** sur ventes directes (recommandé) |
| **Pool créateurs** | 60 % des abonnements redistribués (modèle Envato Elements) |
| **Autres** | Sponsoring, job board payant, boosts, événements, POD physique |
| **Frais de paiement** | ~1,5 % (mobile money / cartes) |

**Projection (mois 12, scénario 10 %)** : revenus ≈ **6,3 M F/mois**, coûts ≈ 3,9 M F → **marge nette ≈ +2,4 M F/mois**. Point d'équilibre ≈ 1 350 abonnés Studio (ou 13 100 ventes/mois). Cumul positif au mois 15. *(Voir le modèle Excel.)*

---

## 🗺 Roadmap

| Phase | Contenu |
|---|---|
| **M0 — Socle** (3-4 sem) | Next.js + Prisma + Tailwind, auth (social + OTP + passkeys), i18n fr, docker-compose prod, observabilité |
| **M1 — Core loop (MVP)** (4-5 mois) | Shots + feed masonry + upload presign + likes + boards + follows + produits + checkout FCFA + bibliothèque + previews |
| **M2 — Paiements africains** (+6-8 sem) | Mobile money, multi-devises, payouts projetés, plans d'abonnement, codes promo, échelonnement |
| **M3 — Vendeurs & Services** (+6-8 sem) | Dashboard KPI, moteur de confiance, KYC par pays, générateur IA, RGPD |
| **M4 — Jobs & Événements** (+6-8 sem) | Job board payant, concours avec compte à rebours |
| **M5 — Communautés & Forum** (+8-10 sem) | Espaces membres, forum, modération, newsletters |
| **M6 — Shield & Gamification** (+6-8 sem) | Protection 4 couches, badges, VIP |
| **M7 — Assistant IA + Croissance** (+10-12 sem) | Copilote IA, affiliation, intégrations Figma/Canva, feed curé |
| **M8 — Super Admin & CMS + physique** (transversal) | Back-office complet, print-on-demand, seller-shipped |

**Total : ~14-16 mois** avec 2-3 devs. **M1+M2 = MVP** (« publier → découvrir → aimer → acheter → télécharger »).

---

## 🐳 Installation & déploiement

### Déploiement « deploy anywhere » (Vercel OU VPS)

Le projet est **indépendant du fournisseur** (12-factor app) : le même code tourne sur Vercel (managé) ou sur un VPS via Docker (self-hosting — contrôle des coûts). Détails complets : [`SPEC_DEPLOIEMENT_SELFHOSTING_BAOBART.md`](SPEC_DEPLOIEMENT_SELFHOSTING_BAOBART.md).

```bash
# 1) Cloner et configurer
git clone https://github.com/votre-org/baobart.git && cd baobart
cp .env.example .env && vi .env

# 2) Self-host : lancer la stack complète (Docker)
docker compose up -d --build
docker compose exec app npx prisma migrate deploy

# 3) Ou déployer sur Vercel
vercel --prod        # (pooling DB + Inngest pour les jobs)
```

**Coûts indicatifs** : Vercel ~50-100 $/mois · VPS Hostinger ~10-35 $/mois.

---

## 📁 Structure du projet

```
baobart/
├── app/                    # Pages Next.js (App Router)
│   ├── (marketing)/        # Accueil, Explorer, Créateurs, Tarifs
│   ├── explore/  shots/  boards/  creatifs/
│   ├── products/  services/  jobs/  events/
│   ├── communaute/  forum/  library/
│   ├── dashboard/          # Portail vendeur
│   └── admin/              # Super Admin + CMS
├── prisma/schema.prisma    # Schéma de données
├── lib/
│   ├── domain/             # Logique métier portée de Gumroad (MIT)
│   ├── payments/           # ChargeProcessors (Flutterwave, Paystack…)
│   ├── shield/             # Protection des œuvres
│   ├── ai-assistant/  growth/  gamification/
│   └── i18n/               # fr-FR, formats 180 000 F
├── jobs/                   # Inngest / BullMQ
├── components/  hooks/  types/
├── docker-compose.yml      # app + worker + postgres + redis + minio + caddy
└── Dockerfile              # Next.js standalone
```

---

## 🤝 Contribuer

Baobart s'appuie sur des standards ouverts :
- **Dépôt Gumroad** (`antiwork/gumroad`) — licence **MIT** — utilisé comme **spécification** de la logique commerce (soldes, commissions, licences, multi-devises), traduite en TypeScript. La marque Gumroad n'est **jamais** réutilisée.
- Le code est en **TypeScript**, les migrations via **Prisma**, les tests via **Vitest + Playwright**.

Pour contribuer : ouvrir une issue ou une PR. Les changements touchant l'argent (paiements, soldes) exigent des **tests** et la conformité aux patterns du dépôt.

---

## ⚖️ Licence & mentions

- **Code Baobart** : licence à définir (recommandé : MIT, avec attribution).
- **Inspiration / spécification** : dépôt Gumroad — **MIT** (Copyright © 2024 Gumroad, Inc.) — la notice doit être conservée ; le nom et le logo Gumroad restent leurs marques.
- **Dépendances tierces** : voir chaque licence (Tailwind MIT, Prisma Apache-2.0, Flutterwave SDK, C2PA Apache-2.0…).
- **Données & œuvres** : appartiennent aux créateurs ; Baobart ne revend pas les œuvres sans licence.

---

<p align="center">
  <strong>Baobart.</strong> · Le studio partagé de l'Afrique créative ·
  <em>du premier croquis au premier encaissement.</em>
</p>
