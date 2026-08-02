# Refonte de Baobart — Plan directeur

**Baobart = Dribbble × Pinterest × monétisation, pour l'Afrique créative**
**Document v10.1 — 2 août 2026** (v10 : exploration finale — admin produits, policies, équipes multi-rôles, Staff Picked, lib/helpers · **v10.1 : corrections issues de la lecture du code**)

> ### ⚠️ Statut de vérification
>
> Les sections **§2.4, §2.8, §3.2, §3.4-C, §3.4-E, §3.6-D, §3.9-A, §6.1, §10.1, §10.2, §10.4, §10.5** ont été
> **confrontées au code source** de `antiwork/gumroad` (commit `a475e3f`, 1er août 2026) et
> corrigées. Chacune porte une note de vérification datée.
>
> **Tout le reste de ce document décrit le dépôt sans l'avoir lu ligne à ligne.** Les chiffres
> qui y figurent — « 84 endpoints » du Store Agent, « 226 workers Sidekiq », « 48 policies »,
> « 25+ ressources API », « 19 contrôleurs mobile », « 21 mailers » — sont **non vérifiés**
> tant qu'ils n'apparaissent pas dans `VERIFICATION_GUMROAD.md`.
>
> Le relevé complet des écarts, avec ses sources fichier par fichier, vit dans
> **`VERIFICATION_GUMROAD.md`**. Ce plan reste le document de décision ; c'est là-bas qu'on
> retrouve *sur quoi* chaque correction s'appuie.

---

## 0. Résumé exécutif

- **Le concept produit** : un mixte **Dribbble** (portfolios, shots, likes, followers, défis) + **Pinterest** (découverte visuelle, feed masonry, épingler) avec **options de vente et de monétisation** en FCFA.
- **Modèle économique** (§2) : **abonnements acheteurs** (3 paliers) + **commission créateurs 10 %** + **monétisation Jobs/Services** (§2.9) + **sponsoring** + deux différenciateurs : **« Baobart Shield »** (protection droits d'auteur en 4 couches) et **gamification** (badges).
- **Licences** (§3.1) : Gumroad fournit l'**infrastructure de clés de licence** (sérialisation, vérification, activation/désactivation) et la **gestion des politiques de remboursement** — mais pas de catalogue de types de licences : Baobart définira les siens (personnelle / commerciale / étendue) liés aux plans.
- **Architecture** : **Next.js** ; dépôt Gumroad (MIT) comme **spécification** de la logique monétaire, traduite en TypeScript.
- **Passage à l'échelle** (§8) : « centaines de milliers d'utilisateurs » est très atteignable avec Postgres + Prisma — **à condition** de poser dès M0 les fondations : index, pagination curseur, compteurs dénormalisés, cache, pooling, partitionnement. Prisma n'est pas le goulot ; ce sont les *patterns de requêtes* qui le sont.
- **MVP** : publier un shot → feed → like/save → acheter en FCFA. **~4-5 mois, 2 devs.**
- **Exploration approfondie du dépôt (v5)** : Gumroad contient bien plus que le commerce pur — notamment un **copilote IA pour vendeurs (« Store Agent ») avec 84 actions exécutables**, un **programme d'affiliation** complet, la **récupération de paniers abandonnés**, l'**échelonnement des paiements**, les **codes promo/upsells**, les **cartes cadeaux et pourboires**, l'**email marketing intégré**, la **parité de pouvoir d'achat**, et **11 types de produits** (dont membreships et « coffee »). Catalogue complet au **§3.4**, priorisé pour Baobart.
- **Exploration zones admin/sécurité/ops (v6)** : **modération de contenu automatisée** (anti-spam, stratégies), **fraude & disputes** (alertes précoces, chargebacks), **2FA TOTP + passkeys WebAuthn**, **blocklist IP/objets avec expiration**, **226 workers Sidekiq** (payouts, caches, modération), **21 mailers transactionnels** (reçus, remboursements, « Year in Review », « Top Creator »), et un **système de « boost de découverte » payant** (les vendeurs paient pour plus de visibilité). Détail au **§3.6**.
- **Deux spécifications livrées (v6)** : **« Baobart Assistant » IA** (§9) et **catalogue d'intégration « Croissance »** (§10).
- **Exploration v7 — API & infrastructure (nouveau, §3.7)** : une **API publique complète** (25+ ressources : ventes, payouts, abonnés, licences…), les **intégrations** Discord/Circle/Zoom/Google Calendar, la **conformité RGPD** (effacement de données), l'**anti-bot** (reCAPTCHA score-based), le **moteur de recommandations + suggestions de recherche**, la **conversion de devise au checkout** (devis FX avec expiration), le **pattern d'upload direct S3** (presign), l'**analytics créateur avec cache**, et la **gestion de la délivrabilité email** (suppression des bounces/spams).
- **Exploration v8 — le moteur de confiance (nouveau, §3.8)** : Gumroad embarque un **système Trust & Safety complet** : machine à états de risque des vendeurs (`not_reviewed → compliant / on_probation / suspendu`), **anti-fraude automatique** (LowBalanceFraudCheck : solde < −100 $ → remboursements désactivés + mise en probation auto), **file de revue des nouveaux vendeurs** (admin), scoring de risque des paiements (Stripe Radar), **suspension automatique** (sessions invalidées, liens désactivés, IP bloquée, followers retirés) et **récupération auto** à la réintégration. C'est LA brique qui sécurisera le marché Baobart. Détail au **§3.8**.
- **Exploration v9 — argent & livraison (nouveau, §3.9)** : le **mouvement d'argent** est finement orchestré : **fréquence de payout configurable** (hebdo/mensuel + **instantané quotidien**), **jours de payout par type de compte** (banque selon pays, PayPal, Stripe Connect), **projection « quand serai-je payé »** pour chaque vendeur, **générateur IA de fiche produit** (nom, description, prix) déjà opérationnel, **livraison sécurisée des fichiers** (URLs signées S3 avec expiration), **suivi de consommation** (téléchargements/lectures — la base du compteur « téléchargements »), **précommandes** (paiement au jour de sortie), **API mobile complète** (19 contrôleurs — l'app mobile existe déjà côté Gumroad), **profils créateurs modulaires** (sections : produits vedettes, posts, abonnements, wishlists) et **stats de reviews dénormalisées** (compteurs par étoile). Détail au **§3.9**.
- **Exploration v10 — dernière passe (nouveau, §3.10)** : le **« Staff Picked »** (sélection éditoriale manuelle des produits — exactement vos « collections triées à la main »), les **48 policies** (autorisations fines par rôle), le **système d'équipes multi-rôles** (admin/marketing/support/comptable — vos espaces d'équipe), le **statut « VIP Creator »** (par seuil de payouts cumulés — le badge « Top créateur »), la **détection de devise par IP/pays** (prix localisé automatiquement), les **UTM links** (tracking de campagnes), l'**expédition physique par pays**, et les **helpers** (CDN, currency, URLs signées). Détail au **§3.10**.

---

## 1. Le concept produit : Baobart, et son « core loop »

### Positionnement

| Inspiration | Ce que Baobart reprend | Ce que Baobart change |
|---|---|---|
| **Dribbble** | Portfolios, « shots », likes, commentaires, followers, défis, **job board** | Ancré Afrique, matériel local, vente intégrée |
| **Pinterest** | Feed visuel masonry, découverte, épingler en tableaux | Axé création pro |
| **Gumroad** | Vendre ressources, services, commissions, payer/recevoir en monnaie locale | Devises africaines + mobile money |

### Le core loop

> **1. Le créatif publie un shot** → **2. la communauté le découvre dans un feed visuel** → **3. likes / épingles dans les tableaux** → **4. followers** → **5. shots optionnellement liés à un produit vendable, un service ou une commission** → **6. gains en FCFA et en réputation.**

---

## 2. Modèle économique (« comment on gagne de l'argent »)

### 2.1 Principes

Marché **biface** : revenus côté **acheteurs** (abonnements), côté **créateurs** (commission), et **services de valeur ajoutée** (protection, gamification, visibilité) qui justifient les frais. **Freemium découverte** : le gratuit attire le trafic, la monétisation porte sur premium/HD/licences commerciales/services/abonnements.

### 2.2 Flux de revenus

| Flux | Qui paie | Mécanique | Statut |
|---|---|---|---|
| **Abonnements acheteurs** | Acheteurs | 3 paliers (Découverte / Explorer / Studio) | **Modèle détaillé §2.3** |
| **Commission sur ventes** | Créateurs | 10 % par vente directe | À valider (vs 20 % maquette) |
| **Frais de traitement** | Les deux | mobile money / cartes (~1-3 %) | À intégrer |
| **Sponsoring** | Annonceurs | 3 formats maquettés (bannière, collection sponsorisée, newsletter) | Déjà conçu |
| **Jobs (recruteurs)** | Recruteurs | Publication d'offres payante, mises en avant | **§2.9** |
| **Services (boost/visibilité)** | Créateurs | Mise en avant de services, abonnements créateurs | **§2.9** |
| **Événements / concours** | Organisateurs | Hébergement, frais d'inscription optionnels | Futur |

### 2.3 Modèle de plans (acheteurs) — détaillé

**Cible** : l'abonnement doit rendre l'illimité tenable (pool créateurs) et segmenter par *usage* : particulier vs professionnel (licence commerciale).

| Dimension | **Découverte** (gratuit) | **Explorer** | **Studio** |
|---|---|---|---|
| Prix indicatif | 0 F | ~2 500 F/mois (≈4 €) | ~7 500 F/mois (≈11 €) |
| Téléchargements | 3/mois (ressources GRATUIT) | 15/mois | **Illimité** |
| Résolution | Basse, filigranée | HD | HD / sources |
| **Licence incluse** | Usage personnel, essai | **Personnelle** | **Personnelle + Commerciale** |
| **Shield (protection)** | — | Standard | **Renforcé** |
| Badge | — | — | « Membre Studio » |
| Accès anticipé / packs | — | — | Oui |
| Accès services (commissions) | Voir + commenter | Réserver | Réserver + priorité |

**Modèle de données (bloc « monétisation »)** :

```
Plan            code (decouverte/explorer/studio), nom, prix_par_mois, devise,
                quotas (telechargements_par_mois), license_included, shield_level, features[]
Subscription    user, plan_id, statut (active/annulee/expiree), cycle, paiement (mobile money)
DownloadQuota   subscription_id, periode (AAAA-MM), utilises, limite
LicenseType     code (personnelle/commerciale/etendue), titre, description, conditions,
                niveau (print/edition/broadcast…), prix_supplement (optionnel)
ProductLicense  product_id, license_type_id  (quelle licence s'applique au produit)
```

**Points clés** :
- **Licence personnelle vs commerciale = le vrai moteur du palier Studio** : c'est le levier qui fait monter en gamme les acheteurs pro (agences, studios — 31 % de l'audience maquettée).
- Licence **étendue** (print, édition, broadcast, merchandising) = **option payante par produit** pour les gros usages → revenu supplémentaire simple.
- Le palier Découverte **filtre la résolution** : c'est à la fois une protection anti-copie (couche 2 du Shield) et un argument commercial.
- Paiement **mobile money récurrent** (Flutterwave subscriptions) — clé de la conversion locale.
- **Pool créateurs** (§2.4) alimenté par une part des abonnements Explorer/Studio.

### 2.4 Commission créateurs

> ✅❌ **Vérifié le 2 août 2026** contre `app/models/purchase.rb` → voir `VERIFICATION_GUMROAD.md` §2.1.
> **Gumroad ne facture pas un taux unique** : il facture selon **qui a amené l'acheteur**.
> 10 % quand le créateur amène son public, **30 % quand la marketplace l'amène** — et
> dans ce second cas, aucune part fixe. Le dilemme « 10 % ou 20 % » ci-dessous en est
> dissous plutôt que tranché : Baobart peut annoncer 10 % sans sacrifier sa marge,
> puisque le feed se rémunère sur les ventes qu'il génère réellement.
> **Porté** dans `lib/domain/fees.ts` (régimes `DIRECT` / `DECOUVERTE`).

- **10 %** (positionnement agressif : Gumroad ≈ 10 % + frais, Envato ≈ 50 %, Creative Market 30-50 %).
- Maquette affichait « garde 80 % » (= 20 %) → **choisir** : 10 % pour l'acquisition, 20 % pour la marge directe. Recommandation : **10 %** + pool d'abonnement **60-70 % redistribué** (parts proportionnelles aux téléchargements, modèle Envato Elements).
- **Exemple indicatif** : pack 3 000 F → créateur 2 700 F, Baobart 300 F + frais (~1-2 %). Abonnement Studio : 7 500 F × 1 000 abonnés = 7,5 M F/mois → pool 60 % = 4,5 M F répartis, Baobart garde 3 M F/mois.

### 2.5 Protection des droits d'auteur — « Baobart Shield »

**Positionnement** : « la plateforme qui protège les créations africaines contre l'entraînement IA et le vol » — différenciateur majeur, justifie commission + premium.

**Réalité technique (à assumer)** : ❌ le « pixel unique » est inefficace (les modèles lisent des caractéristiques globales, pas des pixels). ✅ Ce qui fonctionne :
- **Glaze** (brouille le style), **Nightshade** (empoisonne les données d'entraînement), **PhotoGuard** (perturbe l'édition IA) — perturbations adversariales du labo de l'Université de Chicago.
- **Filigranes robustes** (détectables après recadrage/compression) → provenance.
- **C2PA / Content Credentials** → provenance cryptographique (norme Adobe).

**Défense en 4 couches** :
1. **Provenance** : filigrane invisible + métadonnées C2PA + horodatage de dépôt.
2. **Aperçus dégradés** : public = basse résolution filigranée ; pleine qualité après achat/abonnement (aussi un levier commercial).
3. **Perturbation anti-IA** (Glaze/Nightshade-like) : opt-in par le créateur, niveau réglable (protection vs dégradation).
4. **Juridique + application** : licences claires, robots.txt, procédure de retrait (DMCA-like), veille + recherche inversée.

**Règle d'or** : promettre « la meilleure protection du marché », jamais « impénétrable ».

### 2.6 Gamification — badges

| Badge | Critères proposés | Effet |
|---|---|---|
| **Créateur vérifié** | KYC (identité, téléphone, portfolio) | Confiance, filtre de recherche |
| **Top créateur** | Ventes + engagement (likes, saves, note) sur période glissante | Mise en avant, badge, boost visibilité |
| **Nouveau talent** | Ascension rapide d'un compte récent | Découverte |
| **Pilier de la communauté** | Contribution forum, entraide, modération | Renforce la communauté |

Règles : critères **transparents**, **jamais de badge acheté**, cycles glissants, effets réels (visibilité, filtres, tri).

### 2.7 Synthèse économique

- **Acheteur** : freemium → abonnement Explorer/Studio (licences, illimité, HD, Shield renforcé) + achats uniques + licences étendues.
- **Créateur** : gratuit, commission 10 % + pool d'abonnement.
- **Plateforme** : commission + marge abonnements (30-40 %) + sponsors + jobs + événements + boosts.
- **Différenciateurs** (Shield + badges) = argument de vente central.

### 2.8 Décisions à trancher

1. ~~Commission **10 % ou 20 %**.~~ → **reformulée** après vérification (§2.4) : la question
   n'est plus « quel taux unique », mais **quels deux taux** — celui qui s'applique quand
   le créateur amène l'acheteur, et celui qui s'applique quand le feed l'amène.
   Proposition portée dans le code : 10 % / 30 %. Le second reste à calibrer sur le marché.
2. Mécanique créateurs sur abonnements : **pool (A)** / par téléchargement (B) / remise (C).
3. Prix exacts des paliers (étude marché locale + coût mobile money).
4. Shield : défaut vs opt-in ; niveau de dégradation acceptable.
5. Badges : uniquement mérités.

### 2.9 Monétiser Jobs & Services (modèle Dribbble) — nouveau

**Dribbble facture les recruteurs pour publier et mettre en avant des offres.** Baobart peut faire pareil, sans complexité supplémentaire :

| Offre | Cible | Tarif indicatif | Mécanique |
|---|---|---|---|
| **Publication d'offre** | Recruteur | 25 000-50 000 F / offre | Paiement avant publication (mobile money) |
| **Offre mise en avant** | Recruteur | ×2-3 le prix d'une offre | Épinglée en tête du job board + newsletter |
| **Pack recruteur** | Agences | Abonnement (ex. 5 offres/mois) | Volume, facturation simple |
| **Badge « Offre vérifiée »** | Recruteur | Inclus avec vérification | Confiance (anti-arnaque — essentiel) |
| **Boost de service** | Créateur | À la carte (ex. 5 000 F/semaine) | Service mis en avant dans sa catégorie |
| **Abonnement créateur Pro** (futur) | Créateur | Optionnel | Statistiques avancées, multi-espaces, Shield renforcé |

**Points clés** :
- Le **job board payant** est une source de revenus **B2B** simple et éprouvée (Dribbble, Behance l'ont validé). À activer en **M4**, une fois le trafic là.
- La **vérification des recruteurs** (badge « Offre vérifiée ») est un **impératif de confiance** en Afrique de l'Ouest (arnaque aux faux recrutements très répandue) — c'est un différenciateur sécurité.
- Les **boosts** restent optionnels et jamais trompeurs (affichage « sponsorisé » clair) pour préserver la confiance.

---

## 3. Ce que le dépôt Gumroad apporte réellement — et ce qu'il n'apporte pas

### 3.1 Licences & remboursements — ce que Gumroad offre réellement (vérifié) — nouveau

**Gumroad n'a PAS de catalogue de « types de licences »** (personnelle/commerciale…) — ce sont les vendeurs qui les définissent librement dans leurs pages produit. **Mais le dépôt contient une infrastructure de licence complète et exploitable comme spécification :**

| Élément | Ce que fait Gumroad | Fichiers (à consulter) | Usage pour Baobart |
|---|---|---|---|
| **Clés de licence** | Génération de sérial (`XXXXXXXX-XXXXXXXX-…`), attachée à un achat | `app/models/license.rb` | Vendre des **fonts**, **logiciels**, assets exclusifs avec clé d'activation |
| **Vérification d'activation** | Endpoint API `verify`, compteur d'usages, `enable`/`disable`/`rotate` | `app/controllers/api/v2/licenses_controller.rb` | Activation/désactivation distante (applications, font managers) |
| **Page de recherche de clé** | Les acheteurs retrouvent leurs licences | `app/javascript/pages/Public/LicenseKeyLookup.tsx` | Page « Mes licences » côté acheteur |
| **Politiques de remboursement** | Par produit (`ProductRefundPolicy`), par vendeur (`SellerRefundPolicy`), détection « no refunds » assistée IA | `app/models/product_refund_policy.rb`, `refund_policy.rb` | Règles de remboursement propres à Baobart (ex. 14 jours, numérique) |

**Conséquence pour le plan** : Baobart **définit ses propres types de licences** (Personnelle / Commerciale / Étendue — cf. §2.3) comme entité de données (`LicenseType`), et réutilise l'**architecture des clés de licence** de Gumroad pour les produits qui en ont besoin. C'est un gain net : l'infrastructure existe, le catalogue est à nous.

### 3.2 Ce qui existe dans le dépôt et sert Baobart

| Domaine | Modules présents | Fichiers clés |
|---|---|---|
| Vente de ressources | `Link` (produit), prix, variantes, bundles, checkout | `app/models/link.rb`, `checkout_controller.rb` |
| ~~**Devises africaines**~~ ❌ | **CORRIGÉ** — XOF/NGN/GHS existent **uniquement comme devises de versement** Stripe Connect : elles ne peuvent **pas** fixer un prix produit, et la conversion ne les supporte pas. Sur les 19 devises pouvant porter un prix, **une seule est africaine (ZAR)**. La tarification FCFA est **100 % à construire**. Voir `VERIFICATION_GUMROAD.md` §3.1 | `app/business/payments/currency.rb`, `config/currencies.json` |
| **Payouts panafricains** | **Comptes bancaires par pays (CI, BJ…)** + balances « versé/en attente » | `cote_d_ivoire_bank_account.rb`, `balance.rb`, `balance_transaction.rb` |
| **Services** | **Commissions** : acompte 50 % + solde à la livraison | `commission.rb`, `commissions_controller.rb` |
| Consultations | Calls (créneaux) | `call.rb`, `calls_controller.rb` |
| Social (partiel) | Followers, reviews, wishlists, commentaires | `follower.rb`, `product_review.rb`, `wishlist.rb`, `comment.rb` |
| Dashboard vendeur | Dashboard, Analytics, Balance, Payouts (Recharts) | `dashboard_controller.rb`, `analytics_controller.rb` |
| Communautés | Chat lié à un produit | `community.rb`, `community_chat_message.rb` |
| **Licences & remboursements** | Clés de licence, vérification, refund policies | **cf. §3.1** |

### 3.3 Ce qui n'existe pas (à construire)

Feed masonry, shots, boards, saves, jobs, événements, forum, **mobile money**, **i18n FR**, **Shield**, **badges**, **catalogue de licences** — voir tableau complet de la v3 (résumé : la base Gumroad ≈ 100 % du commerce, ~20-30 % du produit total).

### 3.4 Catalogue des éléments utiles découverts (exploration approfondie) — nouveau

Exploration systématique du dépôt au-delà du commerce de base. Chaque élément est classé par **priorité pour Baobart** (🔴 fort / 🟠 moyen / 🟡 faible).

#### A. L'IA « Store Agent » — le copilote des créateurs 🔴

**Ce que fait Gumroad** : un onglet « Agent » dans le dashboard où le vendeur **discute avec une IA qui peut agir sur sa boutique**. Architecture complète :
- `AiConversation` / `AiMessage` — chat conversationnel avec **historique persisté** (survit au rafraîchissement), titré automatiquement.
- `store_agent_api_catalog.rb` — **84 endpoints** exposés à l'IA en « function calling » : créer/modifier/supprimer des **produits**, variantes, **codes promo**, pages, médias, champs personnalisés, politiques de remboursement, custom HTML…
- `store_agent_action_executor.rb` — exécution réelle des actions (avec scopes d'autorisation, `read` vs `write`, admin-only).
- Streams de messages, throttling, prévisualisations custom HTML.
- `community_chat_recap.rb` — **résumé IA des conversations de communauté**.
- Détection IA « no refunds » dans les politiques de remboursement.
- Les vendeurs peuvent aussi **vendre des produits « chat hébergé »** (conversations IA avec leurs clients — OpenA/Claude) : un produit à part entière.

**Ce que ça apporte à Baobart** :
- **« Baobart Assistant »** : un copilote pour chaque créateur — « crée mon produit avec cette description », « prépare une promo pour le lancement », « réponds aux demandes de service ». **Différenciateur majeur** face aux marketplaces classiques, et surtout : c'est le *pattern* (catalogue d'actions + LLM + exécuteur) qui se **traduit tel quel en TypeScript** avec n'importe quel LLM.
- **Résumé IA** des discussions d'équipe et du forum (très utile pour la communauté).
- **Produits « chat »** : des créateurs pourraient vendre du conseil par conversation IA (déjà pertinent pour Services).
- Démarrer simple : en v1, l'Assistant fait du **read-only** (aide à comprendre sa compta, ses stats) puis étendre aux actions en v2.

#### B. Acquisition & conversion — 🔴

| Élément | Ce que fait Gumroad | Où | Utile pour Baobart | Prio |
|---|---|---|---|---|
| **Codes promo** | Remises % ou montant fixe, par produit ou globale, limite d'usages, durée, produits exclus | `offer_code.rb` | Remises de lancement, partenariats, rétention des abonnés (code anti-résiliation) | 🔴 |
| **Upsell post-achat** | Après un achat, proposition d'un produit/variant complémentaire | `upsell.rb`, `upsell_variant.rb` | « Complétez votre pack », version HD, licence étendue | 🔴 |
| **Panier abandonné** | Email automatique aux paniers non finalisés | `sent_abandoned_cart_email.rb` | **Récupération de ventes** — vital avec mobile money (taux d'abandon élevé) | 🔴 |
| **Échelonnement** | Paiement en plusieurs fois (3 tranches), calcul auto des prix | `product_installment_plan.rb` | Packs chers en FCFA (ex. 100 000 F en 3×) → gros levier de conversion | 🔴 |
| **Cartes cadeaux** | Acheter un produit/abonnement pour quelqu'un (email destinataire) | `gift.rb` | Offrir un pack ou un abonnement Studio — périodes de fêtes | 🟠 |
| **Pourboires** | Montant libre ajouté à un achat | `tip.rb` | Soutenir un créateur gratuit — culture du soutien | 🟠 |
| **Parité pouvoir d'achat (PPP)** | Prix ajusté selon le pays de l'acheteur | `is_purchasing_power_parity_discounted` (achats) | Prix adaptés Dakar/Abidjan/diaspora — très pertinent marché panafricain | 🟠 |

#### C. Croissance organique — affiliation 🔴

**Ce que fait Gumroad** : un **programme d'affiliation complet** :
- `affiliate.rb` / `affiliate_credit.rb` — commissions à % (basis points), crédits automatiques sur les ventes référées, y compris **renouvellements de membreships**.
- `direct_affiliate.rb` — chaque vendeur crée ses **propres programmes d'affiliation** en self-service (n'importe qui peut postuler → `affiliate_request.rb`).
- `global_affiliate.rb` — le **programme « ambassadeur » global** de Gumroad (cookie 7 jours, ~10 %).

> ✅❌ **Vérifié le 2 août 2026** → `VERIFICATION_GUMROAD.md` §6.1-6.3. Deux corrections :
> **il y a deux durées de cookie**, pas une — **30 jours** pour l'affiliation entre créateurs
> (`DirectAffiliate`), 7 jours seulement pour les ambassadeurs. Et **un affilié direct ne
> touche rien sur une vente issue du feed** (`return false if opts[:was_recommended]`) :
> c'est la plateforme qui a amené l'acheteur, pas lui.

**Ce que ça apporte à Baobart** :
- **Programme d'ambassadeurs panafricain** : blogueurs, créateurs de contenu, écoles de design qui réfèrent → commission sur les ventes. **Acquisition organique massive** pour un lancement à budget limité.
- **Affiliation peer-to-peer** : un créateur recommande le pack d'un autre → commission. Renforce la communauté.
- Pattern simple à porter (cookie de tracking + crédit sur BalanceTransaction).

#### D. Fidélisation & rétention — 🟠

| Élément | Ce que fait Gumroad | Où | Utile pour Baobart | Prio |
|---|---|---|---|---|
| **Emails marketing intégrés** | Les vendeurs envoient des **emails/newsletters à leurs acheteurs et followers** (planifiés, segmentés, relance des non-ouvreurs) | `post_email_blast.rb`, `creator_email_*`, `installment.rb` | Les créateurs gardent leur audience sur Baobart (pas besoin de Mailchimp) — fidélisation + monétisation | 🔴 |
| **Membreships (abonnements)** | Produits récurrents, changement de plan, événements de souscription | `subscription.rb`, `subscription_plan_change.rb`, `base_variant.rb`, `price.rb` | **Soutien mensuel aux créateurs** (patreon-like) + vos paliers acheteurs | 🔴 |
| **Wishlists suivables** | Listes d'envies publiques qu'on peut suivre | `wishlist.rb`, `wishlist_follower.rb` | Relier au système Boards (Pinterest) — les tableaux suivables | 🟠 |
| **Produits « coffee »** | Soutien ponctuel sans contrepartie (style Ko-fi) | `NATIVE_TYPE_COFFEE` | Bouton « Offrir un café » mobile money aux créateurs | 🟠 |
| **Domaines personnalisés** | Les vendeurs branchent leur propre domaine | `custom_domain.rb` | Créateurs pros → leur portfolio sous leur nom | 🟡 |

#### E. Types de produits (~~11~~ **12**) — à exploiter 🟠

> ❌ **Vérifié le 2 août 2026** contre `NATIVE_TYPES_TO_TAX_CODE` dans `app/models/link.rb`
> → `VERIFICATION_GUMROAD.md` §4.1. Le compte était faux **des deux côtés**.

**Vivants** : `digital` (fichiers), `ebook`, `membership` (récurrent), **`course` (formation — oublié dans la v10)**, `physical` (avec expédition), `bundle` (packs), `commission` (services), `call` (consultations), `coffee` (soutien libre).

**Dépréciés** (`LEGACY_TYPES`) : ~~`newsletter`~~, ~~`podcast`~~, ~~`audiobook`~~ — Gumroad les a lui-même abandonnés.

Groupement utile relevé : `SERVICE_TYPES = [commission, call, coffee]`, qui recoupe exactement le bloc « Services » du plan.

**Pour Baobart** : la maquette a déjà les familles (Mockups, Logos, Fonts…) — le typage permet en plus : **packs (bundle)**, **membreships** (soutenir un créateur), **soutien libre (coffee)**, **formations (`course`)** et **physique** (imprimés wax, textiles — un vrai marché ouest-africain). En revanche, ne pas suivre Gumroad sur podcast/audiobook : il les abandonne.

#### F. Outils vendeurs & divers — 🟡

| Élément | Ce que fait Gumroad | Où | Utile pour Baobart | Prio |
|---|---|---|---|---|
| **Champs personnalisés au checkout** | Questions posées à l'achat (texte, choix, case, fichier, termes) | `custom_field.rb` | **Services** (collecter le brief), **Jobs** (portfolio du candidat), **Événements** (taille de t-shirt) | 🔴 |
| **Thumbnails/traitement d'images** | Variantes d'images redimensionnées (CDN) | `thumbnail.rb` | Le pipeline d'images des shots — à réutiliser côté Next.js | 🟠 |
| **Analytics quotidiens** | Compilation quotidienne des métriques plateforme | `gumroad_daily_analytic.rb` | Tableau de bord interne Baobart | 🟠 |
| **Vues de pages produits** | Tracking dans Elasticsearch | `product_page_view.rb` | Analytics des shots | 🟠 |
| **Taxonomie de découverte** | Catégories hiérarchiques + stats | `taxonomy.rb`, `taxonomy_stat.rb` | Les « familles » de la maquette + tri | 🟠 |
| **Taxes / facturation** | Gestion TVA numérique, backtaxes | `user/taxation.rb`, `backtax_*` | Factures légales pour les pros (à reprendre en version simplifiée) | 🟡 |
| **Question IA « no refunds »** | L'IA détermine si une politique interdit les remboursements | `product_refund_policy.rb` | Modération auto des politiques des vendeurs | 🟡 |

### 3.5 Synthèse : ce qu'on récupère en priorité

| Priorité | Éléments à traduire en TypeScript |
|---|---|
| 🔴 **Fort** | Store Agent (pattern 84 actions) • codes promo • upsell • panier abandonné • échelonnement • affiliation (peer + ambassadeurs) • emails aux clients • membreships • champs personnalisés • modération de contenu • anti-fraude/chargebacks |
| 🟠 **Moyen** | cartes cadeaux • pourboires • PPP • wishlists suivables • coffee • types de produits (bundle, podcast, physique) • thumbnails • analytics • taxonomie • 2FA (TOTP + WebAuthn) • boost de découverte |
| 🟡 **Faible** | custom domains • taxes complexes • produits « chat » (v2) |

### 3.6 Zones admin, sécurité, jobs & mailers — découvertes (nouveau)

#### A. Sécurité & confiance — 🔴 (indispensable pour un marché panafricain)

| Élément | Ce que fait Gumroad | Où | Utile pour Baobart |
|---|---|---|---|
| **2FA** | TOTP (authentification à deux facteurs par code) + **WebAuthn** (passkeys) | `totp_credential.rb`, `webauthn_credential.rb`, `two_factor_authentication_mailer.rb` | Sécurité des comptes vendeurs (comptes financiers) — essentiel |
| **Blocklist** | Blocage d'IP (6 mois avec expiration auto), objets bloqués (emails, IP, cartes…) avec durée de vie | `blocked_object.rb`, `blocked_customer_object.rb`, `block_object_worker.rb` | Anti-arnaque, anti-spam — **indispensable pour un marché où la fraude sévit** |
| **Anti-fraude & disputes** | Alertes précoces de fraude (liées aux processeurs), gestion des disputes/chargebacks, **suspension de payouts en cas de chargeback excessif**, litiges avec preuves | `early_fraud_warning.rb`, `dispute_evidence/`, `release_chargeback_rate_payout_pause_for_seller_job.rb` | Protéger créateurs et plateforme — pattern à porter dès M3 |
| **Modération de contenu** | Service de modération **automatisé** (extraction de contenu, stratégies, raisons « spam », blocage de publication) appliqué aux produits, posts, commentaires + note d'audit laissée au vendeur | `content_moderation/moderate_record_service.rb`, `content_moderation_admin_comment_job.rb`, `moderate_products_job.rb` | **Anti-spam et protection des créateurs** — vital pour un UGC (shorts, forum, services) |

#### B. Jobs & workers — 🟠 (patterns d'infrastructure)

**226 workers Sidekiq** — une bibliothèque de patterns éprouvés, tous transposables en jobs asynchrones Next.js (Inngest/BullMQ) :

| Catégorie | Workers | Usage pour Baobart |
|---|---|---|
| **Payouts** | `execute_scheduled_payouts_job`, `payout_users_worker`, `perform_daily_instant_payouts_worker`, `retry_failed_*`, `sync_stuck_payouts_job`, `update_payout_status_worker` | Le cycle complet « soldes → versement → retry → statut » |
| **Cache & compteurs** | `cache_product_data_worker`, `calculate_sale_numbers_worker`, `invalidate_product_cache_worker`, `update_user_balance_stats_cache_worker`, `recalculate_recent_wishlist_follower_count_job` | **Dénormalisation des compteurs** (likes, ventes, followers) — cf. §8.2 |
| **Médias** | `analyze_file_worker`, `delete_product_files_worker`, `delete_expired_product_cached_values_worker` | Analyse/cycle de vie des fichiers uploadés |
| **Emails** | `delete_old_sent_email_info_records_job`, `mail_delivery_job`, `sent_post_email` | Files d'emails propres |
| **Taxes / rapports** | `create_vat_report_job`, `annual_tax_summary_export_worker`, `compile_gumroad_daily_analytics_job` | Rapports périodiques (version simplifiée) |
| **Modération** | `moderate_products_job`, `content_moderation_admin_comment_job` | File de modération asynchrone |

#### C. Mailers — 🟠 (21 mailers transactionnels)

| Mailer | Rôle | Utile pour Baobart |
|---|---|---|
| `customer_mailer.rb` | Reçus (groupés), **factures automatiques**, reçus de précommande, remboursements (plein/partiel) | Cycle d'emails acheteur complet |
| `creator_mailer.rb` | **« Year in Review »** (bilan annuel avec stats), **« Top Creator »**, `gumroad_day_fee_saved`, notifications de payouts | Fidélisation + **gamification par email** (« Top Creator » !) |
| `comment_mailer.rb`, `follower_mailer.rb`, `service_mailer.rb`, `team_mailer.rb` | Notifications : commentaires, nouveaux followers, services, invitations d'équipe | Notifications du hub communautaire |
| `community_chat_recap_mailer.rb` | **Résumé IA des discussions** envoyé par email | « Voici ce qui s'est passé cette semaine » pour les espaces |
| `two_factor_authentication_mailer.rb` | Emails de sécurité 2FA | Sécurité |

#### D. « Boost de découverte » payant — 🟠 (monétisation native)

> ❌ **Vérifié le 2 août 2026** → `VERIFICATION_GUMROAD.md` §2.2. **Ce n'est pas de la publicité.**
> `_per_thousand` signifie « **pour mille** », pas « par millier d'impressions » : c'est un
> dénominateur de pourcentage. `links.discover_fee_per_thousand` vaut **100 par défaut (10 %)** ;
> le vendeur qui veut être mieux classé la **monte jusqu'à 300**, c'est-à-dire qu'il accepte de
> céder **30 % au lieu de 10 % sur les ventes issues du feed**. Aucune impression n'est vendue,
> aucun budget n'est avancé.

**Pour Baobart** : ce modèle est bien meilleur que le CPM sur ce marché — **le créateur n'avance rien** et ne paie que si la plateforme lui a effectivement vendu quelque chose. Vendre des impressions à des créateurs sans trésorerie revient à leur vendre du risque. À ne **pas** confondre avec le **sponsoring** (§2.9), qui reste un vrai achat d'espace destiné aux annonceurs : ce sont deux produits distincts.

#### E. Synthèse zones admin/sécurité/ops

| Priorité | Éléments à traduire |
|---|---|
| 🔴 **Fort** | Modération auto • blocklist + fraude/chargebacks • 2FA (TOTP + WebAuthn) |
| 🟠 **Moyen** | Patterns workers (payouts, caches, médias) • mailers transactionnels • boost de découverte • Year in Review |
| 🟡 **Faible** | Rapports fiscaux lourds, exports annuels |

### 3.7 API publique, intégrations, RGPD, anti-bot, recommandations, checkout, upload, analytics (nouveau)

#### A. API publique complète — 🔴 (ouverte aux outils tiers)

**Ce que fait Gumroad** : une **API REST publique v2 documentée** (25+ ressources) avec OAuth (Doorkeeper) : `links` (produits), `sales`, `payouts`, `earnings` (gains), `subscribers`, `offer_codes`, `upsells`, `licenses`, `custom_fields`, `refund_policies`, `categories`, `covers`, `thumbnails`, `files`, `media`, `skus`, `variants`, `pages`, `emails`, `users`, `tax_forms`… + console de doc interactive (`ApiDocumentation/`), endpoint `direct_uploads` (upload direct), et scopes OAuth (`edit_products` etc.).

**Ce que ça apporte à Baobart** :
- **Écosystème d'outils tiers** : intégrations, plugins, applications de la diaspora, CLIs.
- **Automatisation** : les créateurs peuvent publier depuis leurs outils (Figma, Photoshop, Lightroom) via l'API — très différentiant.
- **Le pattern** (ressources REST + OAuth scopes + doc) est simple à ré-exposer en TypeScript/Next.js (route handlers).
- Démarrer avec un **sous-ensemble public** (produits, ventes, earnings) en v2, ouvrir le reste selon la demande.

#### B. Intégrations tierces — 🟠 (Discord, Zoom, Circle, Google Calendar)

**Ce que fait Gumroad** : les vendeurs **connectent des outils** pour livrer l'accès à leurs produits : serveurs **Discord** (attribution auto d'un rôle à l'achat), **Circle** (communautés), **Zoom** (appels/formations), **Google Calendar** (créneaux de calls) — via `discord_integration.rb`, `circle_integration.rb`, `zoom_integration.rb`, `google_calendar_integration.rb`, `product_integration.rb` + contrôleurs dédiés.

**Ce que ça apporte à Baobart** :
- **Communauté** : le créateur peut gérer son espace privé (Discord/Circle) et donner accès automatiquement à ses acheteurs/abonnés.
- **Services & formations** : Zoom + Google Calendar pour les calls (créneaux déjà gérés par `Call`).
- Priorité 🟠 : à activer quand la demande existe ; le pattern (webhook OAuth + attribution d'accès) est standard à porter.

#### C. Conformité RGPD — 🔴 (obligatoire)

**Ce que fait Gumroad** : des services complets d'effacement : `gdpr_data_erasure_service.rb` (anonymise PII : email, infos de compliance, paniers, cartes de crédit, achats), `gdpr_buyer_erasure_service.rb`, `email_redactor_service.rb`, et la gestion des **demandes de suppression** d'un acheteur.

**Ce que ça apporte à Baobart** : la **conformité RGPD** est un prérequis (acheteurs UE, diaspora) : droit à l'effacement (Article 17), anonymisation des données PII, exports. Pattern à porter **dès M3** avec la gestion des comptes. Aussi utile pour la loi sénégalaise/ivoirienne sur les données personnelles.

#### D. Anti-bot & anti-abus — 🔴

**Ce que fait Gumroad** : `checkout_recaptcha.rb` (reCAPTCHA Enterprise, **score-based** — pas de puzzle, un score de risque 0-1 vérifié côté serveur, avec cohortes de déploiement), `follow_recaptcha.rb`, `adult_keyword_detector.rb`, `gmail_abuse_filter.rb`, `email_suppression_manager.rb` (gestion bounces/spam_reports/blocks pour la délivrabilité).

**Ce que ça apporte à Baobart** : protection du checkout et des followers contre les **bots et le spam** (comptes fake, fausses ventes), et une **délivrabilité email saine** (les adresses qui rebondissent sont automatiquement supprimées — vital pour les newsletters créateurs).

#### E. Moteur de recommandations + recherche — 🔴 (le cœur du feed Baobart)

**Ce que fait Gumroad** : `recommended_products_controller.rb`, `product/recommendations.rb` (logique `recommendable?`), `discover_curated_products.rb` (**feed éditorial curé**), `discover_search.rb`, `discover_search_suggestion.rb` (**suggestions de recherche**), `search_autocomplete_controller.rb` (autocomplete), `create_discover_search.rb`.

**Ce que ça apporte à Baobart** : le **feed « Découvre aujourd'hui »** de la maquette a besoin exactement de ça : produits **curés** + **recommandés** + recherche avec **autocomplete et suggestions**. Les patterns (curated feed, recommandation par signaux, suggestions) se traduisent directement ; l'algorithmique fine reste à adapter au cas d'usage Pinterest-like (shorts, boards).

#### F. Checkout multi-devises — 🟠 (diaspora & acheteurs internationaux)

**Ce que fait Gumroad** : `buyer_currency_quote.rb` (**devis de conversion** avec taux FX et expiration — `stripe_fx_quote_id`, `expires_at`), `presentment_rounding.rb` (arrondi d'affichage), `buyer_currency_eligibility.rb` (éligibilité devise), `payment_method_resolver.rb`.

**Ce que ça apporte à Baobart** : **afficher le prix dans la devise de l'acheteur** (FCFA, EUR, USD, NGN…) avec un taux figé le temps du checkout — indispensable pour la diaspora (un acheteur à Paris voit le prix en €, le créateur reçoit en FCFA). Complète le système `ExchangeRate` (§6.1).

#### G. Upload direct & médias — 🔴 (le flux des shots)

**Ce que fait Gumroad** : `direct_uploads_controller.rb` (réservation d'upload : filename, taille, checksum ; **URLs presignées S3** via `files_controller.rb`), `create_public_media_service.rb` (pipeline image), limites par type de contenu et taille (jusqu'à 20 Go, images/vidéos), `thumbnail.rb` (variantes redimensionnées CDN).

**Ce que ça apporte à Baobart** : le **pattern d'upload exact des shots** : réservation → presign S3 → upload direct depuis le navigateur → traitement image (variantes, WebP, CDN) → thumbnails. C'est le socle de la section « déposer des fichiers » de la maquette (PNG/JPG/AI/PSD/TTF/ZIP ≤ 200 Mo pour les ressources ; images/vidéos pour les shots).

#### H. Analytics créateur (avec cache) — 🟠

**Ce que fait Gumroad** : `creator_analytics/` : `caching_proxy.rb` (**cache des stats par date**, régénération en arrière-plan), `sales.rb`, `product_page_views.rb` (vues produits, ES), `following.rb`, `churn.rb`, `hourly_sales_curve.rb`.

**Ce que ça apporte à Baobart** : les **KPI du dashboard** (revenus du mois, ventes, téléchargements, note, courbe 6 mois) sont **calculés en cache** (jamais en direct sur des millions de lignes) — exactement le pattern « compteurs dénormalisés » du §8.2.

#### I. Onboarding vendeur par pays — 🟠

**Ce que fait Gumroad** : `merchant_registration/` (onboarding Stripe Connect), `user_compliance_info_fields.rb` (**champs de conformité par pays** : nom légal, type d'entité, adresse, documents), `firs_tin_validation_service.rb`, `abn_validation_service.rb` (validations par pays), `auto_invoice_eligibility.rb` (factures auto).

**Ce que ça apporte à Baobart** : le **KYC vendeur adapté à chaque pays** (CI, SN, NG, GH…) : collecte des infos légales + validation — la base du badge « Créateur vérifié » (§2.6) et des payouts conformes.

#### J. Synthèse v7

| Priorité | Éléments à traduire |
|---|---|
| 🔴 **Fort** | API publique (sous-ensemble) • RGPD (effacement) • anti-bot reCAPTCHA • recommandations + suggestions • upload direct presign • délivrabilité email |
| 🟠 **Moyen** | Intégrations (Discord/Zoom/Circle/Calendrier) • checkout multi-devises (devis FX) • analytics avec cache • onboarding vendeur par pays |
| 🟡 **Faible** | TaxJar (taxes complexes) • fichiers jusqu'à 20 Go (médias lourds) |

### 3.8 Le moteur de confiance (Trust & Safety) — la découverte clé (nouveau)

C'est probablement **la brique la plus précieuse** trouvée dans le dépôt : un système complet qui décide, en continu, **à qui on peut faire confiance pour vendre et encaisser**. Pour un marché panafricain où la fraude et les arnaques sont un risque majeur de réputation, c'est ce qui protège la marque Baobart.

#### A. Machine à états de risque des vendeurs — 🔴

`user.rb` (state_machine `user_risk_state`, état initial `not_reviewed`) :

```
not_reviewed ──► compliant (vérifié, peut vendre)
    │
    ├─► flagged_for_fraud / flagged_for_tos_violation  (signalé, en revue)
    ├─► on_probation            (probation : ventes désactivées, remboursements coupés)
    └─► suspended_for_fraud / suspended_for_tos_violation  (suspendu)
```

**Transitions automatiques** (pattern à porter tel quel) :
- **À la suspension** : sessions invalidées, **produits désactivés**, **IP bloquée**, **followers retirés**, custom domain supprimé, filtre anti-abus Gmail.
- **À la réintégration** (compliant/on_probation) : remboursements réactivés, **IP débloquée**, produits réactivés, autres comptes du vendeur réactivés.
- **Gardes de sécurité** : impossible de lever une suspension sans explicitement le vouloir (`clear_suspension: true`) ; protection contre les lectures périmées (stale reads).

#### B. Anti-fraude automatique « LowBalanceFraudCheck » — 🔴

**Le mécanisme le plus astucieux** : `low_balance_fraud_check.rb`
- Si le **solde d'un vendeur passe sous −100 $** (excès de remboursements/disputes) → **remboursements automatiquement désactivés** + le vendeur passe **en probation** (2 mois).
- Si son solde **se rétablit** → probation levée **automatiquement** (sous conditions : c'est bien ce check qui l'avait posée, pas un admin).
- C'est une **ceinture de sécurité** : un vendeur qui reçoit beaucoup de disputes ne peut plus creuser son déficit — protège la plateforme ET les acheteurs.

#### C. File de revue des nouveaux vendeurs — 🟠

`admin/unreviewed_users_controller.rb` + `Admin::UnreviewedUsersService` : une **file de modération** des vendeurs non encore vérifiés, avec **cache** des données (performant même à grande échelle) et date de coupure. Permet à l'équipe Baobart de **valider manuellement** les comptes à risque avant qu'ils ne vendent.

#### D. Scoring de risque des paiements (Stripe Radar) — 🟠

`radar/charge_risk_level_service.rb`, `radar/seller_risk_stats_service.rb` : intégration **Stripe Radar** pour scorer le risque de chaque charge et calculer des **statistiques de risque par vendeur**. Transposable avec les scores de risque de Flutterwave/Paystack/CinetPay (ils en fournissent aussi).

#### E. Suspension massive & outils admin — 🟡

`admin/suspend_users_controller.rb` : suspension de masse par liste d'identifiants avec raisons pré-définies. Utile pour les campagnes de nettoyage (fake accounts).

#### F. Checkout avancé (complément §3.7) — 🟠

- **Charges groupées** : un panier multi-produits peut générer **plusieurs charges** (une par vendeur) — `presentment_orchestrator` + `presentment_allocator` répartissent les montants par devise.
- **Surcharges** : calcul de taxe + livraison + conversion par produit (`customer_surcharge_controller`).
- **Pour Baobart** : le panier multi-vendeurs (acheter 3 packs de 3 créateurs en une fois) est un vrai plus UX.

#### G. OAuth & applications (complément §3.7-A) — 🟠

`oauth_application.rb` : applications tierces avec **scopes par défaut** configurés, `get_or_generate_access_token`. Confirme le pattern de l'API publique : chaque app tierce demande des scopes (ex. `edit_products`), le porteur de l'app est identifié et tracé.

#### H. « Walks » (fonction mobile IA, à connaître) — 🟡

Un système **mobile** (`walks_*`) : attestation App Store (anti-usage abusif), **essai gratuit** unique, et **synthèse IA** (Anthropic) qui transforme « une promenade » en **brouillon de produit** (une marche → un brouillon). C'est une idée très Baobart pour le futur : un créateur photographie son travail en rue/atelier depuis le mobile et **l'IA prépare la fiche produit**. À retenir comme inspiration mobile (hors scope v1).

#### I. Synthèse v8 — ce qu'on récupère

| Priorité | Éléments à traduire |
|---|---|
| 🔴 **Fort** | Machine à états de risque vendeur • LowBalanceFraudCheck (anti-fraude auto) |
| 🟠 **Moyen** | File de revue des vendeurs • scoring risque paiements • charges groupées multi-vendeurs • OAuth scopes |
| 🟡 **Faible** | Suspension massive • « Walks » mobile IA (inspiration v2+) |

### 3.9 Argent, livraison, IA produit, mobile, profils — découvertes (nouveau)

#### A. Mouvement d'argent : fréquence & projection des payouts — 🔴

> ✅❌➕ **Vérifié le 2 août 2026** → `VERIFICATION_GUMROAD.md` §8. **Porté** dans
> `lib/payments/payout-schedule.ts`. Le jour par rail est confirmé ; le reste demandait
> des corrections, dont une structurante :
>
> **Il y a DEUX dates, pas une.** La **date de cycle** (ancrée un vendredi) décide *quelles
> ventes* entrent dans le versement ; la **date de versement** est le jour où le rail du
> créateur est exécuté dans cette semaine — c'est celle qu'on montre. Deux créateurs payés
> mardi et jeudi touchent **les mêmes ventes**. Le code documente le bug que la confusion
> produit : un lot exécuté plus tard dans la semaine (un job réessayé) paraît appartenir à
> la semaine suivante et **saute tous les créateurs qu'il contenait**.
>
> Autres corrections : **quatre fréquences** et non deux (le **trimestriel** manquait) ·
> **7 jours de rétention** avant qu'une vente soit versable · **un seuil minimum** en
> dessous duquel la somme **roule** sur le cycle suivant au lieu d'être versée ·
> **huit états de versement** et non cinq, dont `returned` — un versement réussi peut
> rebondir ensuite · et la règle qui referme la boucle : **un versement annulé ou échoué
> remet ses soldes en `unpaid`**, sinon l'argent du créateur disparaît.
>
> Versement instantané : montant minimum, **montant maximum par versement** au-delà duquel
> les soldes sont découpés en plusieurs envois.

**Ce que fait Gumroad** :
- **Fréquence configurable par vendeur** : `daily` / `weekly` / `monthly` / **`quarterly`** (`User::PayoutSchedule`), avec **payouts instantanés quotidiens** (`InstantPayoutsService`, `perform_daily_instant_payouts_worker`).
- **Jour de payout par type de compte** (`PayoutRailSchedule`) : chaque rail de paiement (type de compte bancaire par pays, PayPal, Stripe Connect) est payé **un jour précis de la semaine** (banque philippine mardi, UK mercredi, US jeudi, PayPal vendredi…), dérivé automatiquement du fichier cron pour ne jamais dériver.
- **Projection** : le vendeur voit **quand il sera payé** (`next_payout_date`, `upcoming_payouts`) et **combien** (`payout_amount_for_payout_date`).

**Ce que ça apporte à Baobart** :
- **La promesse « quand serai-je payé »** est un argument de confiance énorme pour les créateurs africains (l'incertitude de paiement est LE frein).
- Adapter : rails = **mobile money** (OM/MTN/Wave) + **virement bancaire** par pays + Stripe Connect. Ex. : payouts mobile money le mercredi, banque CI le jeudi, etc.
- **Payouts instantanés** (moyennant frais) = différenciateur fort (un créateur à besoin de son argent tout de suite).
- Pattern **traduit** dans `lib/payments/payout-schedule.ts` (17 tests).

#### B. Générateur IA de fiche produit (déjà opérationnel) — 🔴

**Ce que fait Gumroad** : `ai/product_details_generator_service.rb` — à partir d'un **prompt** (ou d'une description), l'IA génère : **nom, description, résumé, nombre de pages, prix suggéré** — avec **throttling** (10 requêtes/heure/vendeur, `AI_REQUESTS_PER_PERIOD`), **sanitisation du prompt**, et endpoint dédié `ai_product_details_generations_controller`.

**Ce que ça apporte à Baobart** :
- Une brique **prête à l'emploi** pour le « Baobart Assistant » (§9) : en v1, le créateur décrit son pack et l'IA prépare la fiche (nom, description, prix FCFA).
- Le pattern de **throttling + sanitisation + quota** est à reprendre tel quel (protège les coûts IA).

#### C. Livraison sécurisée des fichiers — 🔴 (le cœur de la vente de ressources)

**Ce que fait Gumroad** : `url_redirects_controller.rb` — chaque achat reçoit une **URL signée S3 avec expiration** (`signed_download_url_for_s3_key_and_filename`), pages de téléchargement/lecture/stream, avec états (expired, rental_expired, membership_inactive) et redirection propre vers la bibliothèque.

**Ce que ça apporte à Baobart** : le **pattern de livraison** de vos packs : achat → génération d'URL signée → téléchargement sécurisé (jamais de lien public), expiration, pages d'erreur propres. Indispensable pour vendre des fichiers en FCFA sans les laisser fuir.

#### D. Suivi de consommation des fichiers — 🟠 (le compteur « téléchargements »)

**Ce que fait Gumroad** : `consumption_event.rb` — chaque **téléchargement, lecture, stream** d'un fichier est un événement horodaté (avec plateforme détectée depuis le user-agent). C'est ce qui alimente les compteurs et l'analytics.

**Ce que ça apporte à Baobart** : le **compteur « téléchargements »** de la maquette (ex. « gratuit — 2 340 dl ») : chaque consommation = événement → compteur dénormalisé (§8.2). Pattern simple à porter.

#### E. Précommandes — 🟠 (lancements & concours)

**Ce que fait Gumroad** : `preorder.rb` — machine à états (in_progress → authorization_successful → charge_successful), **autorisation au checkout, paiement au jour de sortie**, reçus de précommande.

**Ce que ça apporte à Baobart** : pour les **lancements de packs très attendus** et les **concours** (pré-inscription rémunérée), le pattern « autoriser maintenant, débiter à la sortie » est un levier de trésorerie et d'engagement. Facile à adapter avec mobile money.

#### F. API mobile complète — 🟠 (l'app mobile Baobart, futur)

**Ce que fait Gumroad** : une **API mobile dédiée** (19 contrôleurs) : agent IA, analytics, calls, commissions, subscriptions, sales, purchases, licences, preorders, devices, feature flags… C'est le backend de leur app mobile.

**Ce que ça apporte à Baobart** : la **feuille de route mobile** (v2+) est déjà tracée : le modèle de l'API mobile à reproduire côté Next.js (route handlers dédiés mobile). Et le pattern **feature flags par device** (`devices_controller`, `feature_flags_controller`) permet de **déployer par paliers** — utile dès M0 pour tester des features.

#### G. Profils créateurs modulaires — 🟠 (le portfolio Baobart)

**Ce que fait Gumroad** : `seller_profile_section.rb` + sous-classes — le profil d'un vendeur est composé de **sections modulaires** : produit vedette (`featured_product`), produits (`products`), posts, texte riche, **abonnement** (`subscribe`), wishlists. L'ordre et le contenu sont configurables par le vendeur.

**Ce que ça apporte à Baobart** : le **portfolio créateur** de la maquette (grille de shots + sections) s'appuie exactement sur ce pattern : des sections empilables (Shots récents, Produits, Services, À propos, Événements). L'UX « personnalise ton profil » est un différenciateur Dribbble-like.

#### H. Stats de reviews dénormalisées — 🟠 (la « note moyenne »)

**Ce que fait Gumroad** : `product_review_stat.rb` — **compteurs par étoile** (1 à 5) dénormalisés sur le produit, mis à jour à chaque review (`update_product_review_stat`), + `update_review_stat_via_rating_change`.

**Ce que ça apporte à Baobart** : la **« note moyenne » des profils** (maquette : « 4.9 sur 128 avis ») est calculée par **compteurs pré-agrégés** (jamais de `AVG()` live) — le pattern exact du §8.2, avec le détail par étoile (utile pour l'affichage « 5★ 4★ 3★… »).

#### I. Synthèse v9

| Priorité | Éléments à traduire |
|---|---|
| 🔴 **Fort** | Fréquence/projection des payouts • générateur IA de fiche produit • livraison sécurisée (URLs signées) |
| 🟠 **Moyen** | Suivi de consommation (compteur téléchargements) • précommandes • API mobile (v2) • profils modulaires • stats reviews dénormalisées |
| 🟡 **Faible** | Feature flags par device • « Walks » mobile IA |

### 3.10 Dernière passe : admin produits, policies, équipes, sélection éditoriale (nouveau)

#### A. « Staff Picked » — sélection éditoriale 🔴 (vos « collections triées à la main »)

**Ce que fait Gumroad** : `product/staff_picked.rb` + `admin/products/staff_picked_controller.rb` — l'équipe Gumroad **marque manuellement certains produits** (`staff_picked_product`, horodaté, restaurable). Ces produits sont ensuite **mis en avant dans Discover** (`staff_picked` dans l'as_json produit).

**Ce que ça apporte à Baobart** : votre maquette affiche « **PLUS DE 170 RESSOURCES, TRIÉES À LA MAIN** » — c'est exactement ce mécanisme : une sélection éditoriale manuelle qui alimente les sections « Collections » et « À la une » du feed. Pattern trivial à porter (une table + un flag + une section de feed).

#### B. Équipes multi-rôles — 🔴 (vos « espaces d'équipe »)

**Ce que fait Gumroad** : `user/team.rb` + 48 `policies` — un vendeur peut **inviter des membres** avec des **rôles** : `admin`, `marketing`, `support`, `accountant` (comptable). Chaque rôle a des permissions fines (les policies contrôlent chaque action : qui peut créer un produit, voir les stats, gérer les remboursements…).

**Ce que ça apporte à Baobart** : vos **espaces d'équipe** (maquette : « Vos espaces d'équipe », invitations, commentaires ancrés) s'appuient directement sur ce pattern : membres + rôles + permissions. À combiner avec l'idée des **collections partagées** et des **commentaires ancrés** (déjà maquettés). C'est un **différenciateur majeur** pour les studios/agences.

#### C. « VIP Creator » — 🔴 (le badge « Top créateur » de la maquette)

**Ce que fait Gumroad** : `user/vip_creator.rb` — un vendeur devient « VIP » automatiquement quand ses **payouts cumulés dépassent un seuil** ($5 000). Un statut dérivé, automatique, sans intervention humaine.

**Ce que ça apporte à Baobart** : la gamification du §2.6 (« Top créateur ») peut être **automatique et objective** exactement comme ça : `vip_creator?` = seuil de **payouts cumulés en FCFA** (ou de ventes). Simple, transparent, impossible à acheter — le badge « mérité » par excellence. Associer au « Year in Review » (§3.6) pour la mise en avant.

#### D. Détection de devise par IP/pays — 🟠 (prix localisés automatiquement)

**Ce que fait Gumroad** : `currency_helper.rb` — `buyer_currency_for_ip(ip)` → `buyer_currency_for_country(country_code)` (via GeoIP + ISO3166) → si la devise est supportée, le **prix est affiché en devise locale** avec conversion (`buyer_local_price_cents`).

**Ce que ça apporte à Baobart** : la **localisation automatique des prix** par pays : un visiteur d'Abidjan voit `FCFA`, un visiteur de Paris voit `€`, de Lagos `₦` — conversion via `ExchangeRate`. Complète le checkout multi-devises (§3.7-F) et la parité de pouvoir d'achat (§3.4).

#### E. UTM links & tracking de campagnes — 🟠 (mesure marketing)

**Ce que fait Gumroad** : `utm_link.rb` (+ `utm_link_driven_sale.rb`, `utm_link_visit.rb`) — les vendeurs créent des **liens UTM uniques** (source, medium, campaign, term, content) et suivent **visites → ventes attribuées** à chaque campagne.

**Ce que ça apporte à Baobart** : la **mesure de l'efficacité marketing** des créateurs (et de vos campagnes à vous) : chaque lien UTM = quelles visites, quelles ventes, quel taux. Indispensable pour l'affiliation (§10.1) et les ambassadeurs — on sait exactement qui apporte des ventes.

#### F. Expédition physique par pays — 🟠 (le marché « physique »)

**Ce que fait Gumroad** : `shipping_destination.rb` — taux d'expédition **par pays** (1 article / plusieurs articles), calcul du coût selon la quantité et la devise.

**Ce que ça apporte à Baobart** : le **type de produit « physique »** (imprimés wax, textiles, affiches) a besoin de ça : tarifs d'expédition par pays d'Afrique et pour la diaspora. C'est ce qui permet de vendre **autre chose que du numérique** — un marché réel pour les créateurs textile.

#### G. Helpers réutilisables — 🟠

**Ce que fait Gumroad** : `cdn_url_helper.rb` (URLs CDN), `signed_url_helper.rb` (URLs signées S3/CloudFront/Cloudflare avec expiration selon taille), `currency_helper.rb` (formatage, conversion, devise par IP), `money_formatter.rb` (formatage montant/symbole).

**Ce que ça apporte à Baobart** : une **boîte à outils** pour les médias (CDN) et l'argent (formatage FCFA/NGN/GHS) — directement transposable dans `lib/i18n/` et `lib/payments/` (formatage `180 000 F`).

#### H. Synthèse v10 — fin de l'exploration

| Priorité | Éléments à traduire |
|---|---|
| 🔴 **Fort** | Staff Picked (collections éditoriales) • équipes multi-rôles • VIP Creator (badge auto) |
| 🟠 **Moyen** | Devise par IP/pays • UTM links + attribution • expédition physique par pays • helpers CDN/currency |
| 🟡 **Faible** | Mailer previews • JSON schemas (validation profils) |

---

## 4. Décision d'architecture : Next.js (actée)

### Pourquoi
Le monolithe Rails ne sert que la partie commerce ; le prendre en entier pour un produit dont les 70 % visibles sont à créer, c'est payer la complexité Rails en plus.

### Ce qu'on conserve / ce qu'on jette

| Élément | Conservation | Comment |
|---|---|---|
| Logique métier du commerce (achat, balances, commissions 2 temps, multi-devises, statuts) | ✅ **Spécification MIT** | Traduire en TypeScript dans `lib/domain/` |
| Modèle conceptuel des données | ✅ **Modèle conceptuel** | Réadapter en Prisma/Postgres (nommage Baobart) |
| **Infrastructure clés de licence** (§3.1) | ✅ **Pattern à traduire** | `License` → modèle `ProductLicenseKey` + API |
| Composants React / front | ❌ Jeter | Vos maquettes sont meilleures |
| Code Ruby/Rails | ❌ Jeter | — |
| Nom/logo Gumroad | ❌ Ne pas réutiliser | Marque interdite |

### Stack cible

| Couche | Techno |
|---|---|
| Framework | **Next.js (App Router)** + TypeScript |
| UI | **Tailwind CSS** (palette lavande/ambre) |
| BDD | **PostgreSQL + Prisma ORM** (+ `$queryRaw` pour les chemins chauds) |
| Cache | **Redis** (feed, compteurs, sessions) |
| Auth | NextAuth / Lucia (email + OTP) |
| Paiements | **Flutterwave** (mobile money OM/MTN/Wave), **Paystack**, **CinetPay/PayDunya** ; Stripe cartes |
| Abonnements | Flutterwave subscriptions / Stripe Billing |
| Stockage / médias | S3-compatible (CDN en tête) + upload direct |
| Recherche | Postgres full-text (v1) → **Meilisearch/Typesense** (v2) + **suggestions/autocomplete** (§3.7-E) |
| Jobs & emails | Inngest / BullMQ + Resend + **gestion bounces/suppressions** (§3.7-D) |
| **Shield** | Glaze/Nightshade-like + filigrane + C2PA + aperçus dégradés |
| **API publique** | Route handlers Next.js + **OAuth scopes** (§3.7-A) — sous-ensemble dès la v2 |
| **Intégrations** | Discord / Circle / Zoom / Google Calendar (§3.7-B) — à la demande |
| **RGPD** | Services d'effacement + anonymisation (§3.7-C) — dès M3 |
| **Trust & Safety** | Machine à états de risque vendeur + LowBalanceFraudCheck + file de revue (§3.8) — dès M3 |
| Observabilité | Sentry + logs + **slow query monitoring dès M0** |

### Structure du projet

```
app/
  (marketing)/          → Accueil, Explorer, Créateurs, Tarifs (plans §2.3), À propos
  explore/              → feed masonry, filtres, tags          ← Pinterest
  shots/                → détail shot, likes, commentaires, acheter lié
  boards/               → tableaux, épingler (saves)           ← Pinterest
  creatifs/             → portfolios, followers, badges        ← Dribbble
  products/ services/ calls/
  jobs/ events/         → job board payant (§2.9) en M4
  communaute/ forum/
  dashboard/            → portail vendeur (KPI, gains, ventes, dépôt)
prisma/schema.prisma
lib/domain/             → logique portée de Gumroad (commerce, soldes, statuts)
lib/payments/           → adaptateurs (ChargeProcessor en TS, pattern du dépôt)
lib/shield/             → protection droits d'auteur (4 couches)
lib/gamification/       → badges, critères, moteur
lib/ai-assistant/       → « Baobart Assistant » (pattern Store Agent : catalogue
                          d'actions + LLM + exécuteur) + résumés IA
lib/growth/             → affiliation, codes promo, upsell, panier abandonné (§3.4)
lib/i18n/               → fr-FR, formats 180 000 F / ₦45 000 / GH₵120
```

---

## 5. Modèle de données cible (Prisma)

### Bloc « social visuel » (nouveau)

```
User ── Profile (bio, note moyenne, badge, devise)
 ├── WorkItem ("shot") ── images (variantes), caption, tags, statut,
 │        likes_count, commentaires, shield_level
 │        └── (optionnel) → Product
 ├── Board ("tableau") ── Save
 ├── Follow (créatif ↔ créatif)
 └── Comment, Like, Notification
```

### Bloc « commerce » (porté de Gumroad)

```
Product ── Price(s) ── Variant(s) ── Order ── PurchaseItem
Order → Balance → BalanceTransaction (versé / en attente / remboursé)
Commission (service : acompte 50 % + solde à la livraison)
Payout (bank account par pays + mobile money account)
Currency (XOF, NGN, GHS, KES, ZAR, MAD, USD) + ExchangeRate
```

### Bloc « monétisation & gamification » (nouveau)

```
Plan ── Subscription ── DownloadQuota          (§2.3)
LicenseType (personnelle / commerciale / étendue) ── ProductLicense (§2.3, §3.1)
ProductLicenseKey (sérial, statut, usages)     (pattern porté de Gumroad)
RevenuePool (parts créateurs par période)
Badge ── UserBadge ── BadgeCriterion
JobListing (offre payante, statut, featured)   (§2.9)
ServiceBoost (boost de service, période)       (§2.9)
```

### Bloc « communauté & offres » (nouveau)

```
JobPosting (titre, type, mode, pays/ville, salaire, deadline, statut)
Event (concours/atelier/conférence, dates, compte à rebours, jury, prix FCFA)
EventRegistration
Community → ForumCategory → ForumTopic → ForumPost ; ForumMembership (rôles)
```

---

## 6. Les 4 modules à construire

### 6.1 Monnaies africaines + mobile money (+ abonnements)

> ➕ **Vérifié le 2 août 2026** → `VERIFICATION_GUMROAD.md` §3.1, §7.1. Deux points :
> **(a)** rien n'est à porter depuis Gumroad pour la tarification en FCFA — les devises
> africaines n'y servent qu'aux versements. Ce module est **intégralement à écrire**, et il
> faudra y fixer un **prix plancher** par devise (sans lui, les parts fixes rendent les petits
> produits déficitaires pour le créateur).
> **(b)** en revanche, l'abstraction `ChargeProcessor` est **directement transposable** : son
> cycle `créer l'intention → confirmer → encaisser`, avec une fenêtre d'authentification de
> 15 minutes, a exactement la forme d'un paiement mobile money — on crée une demande,
> l'acheteur valide sur son téléphone par OTP ou USSD, l'encaissement se confirme.
> Orange Money, Wave et MTN entrent dans ce contrat sans le déformer.

- Devise par défaut **XOF**, bascule vendeur (XOF, NGN, GHS, KES, ZAR, MAD, USD).
- **FCFA sans cents** : entiers FCFA (adapter, pas copier, le modèle cents de Gumroad).
- Formatage localisé : `180 000 F`, `₦45 000`, `GH₵120`, `KSh 5 000`.
- `ExchangeRate` (paire + taux + date) pour la conversion d'affichage.
- Passerelles : Flutterwave (prim) + Paystack + CinetPay/PayDunya (OM/MTN/Moov/Wave) + Stripe.
- Payouts : virement local + **mobile money** (numéro vérifié, KYC).
- **Paiement récurrent** des plans §2.3 via Flutterwave subscriptions.

### 6.2 Jobs, Services, Événements (Jobs monétisés en M4)
- **Services** : commissions 2 temps (acompte 50 % + solde), catégories, prix « à partir de », délai, note, badge.
- **Jobs** : publication **payante** (§2.9) — freelance/CDD/CDI/stage, remote/hybride/site, pays + ville, salaire XOF, candidature par formulaire.
- **Événements** : concours (jury, prix FCFA, compte à rebours), ateliers, conférences ; inscriptions.

### 6.3 Profils vendeurs + tableau de bord
- Profil public : portfolio en grille, onglets Ressources/Services/Événements/À propos, note, **badges**, Suivre.
- Dashboard : KPI (Revenus du mois +%, Ventes, Téléchargements, Note), graphe 6 mois (Recharts), ventes avec statuts **Versé/En attente**, gestion produits/services/jobs/événements.

### 6.4 Communautés + forum
- Espaces communautaires (public/privé/invitation, modérateurs).
- Forum threadé : catégories → topics → posts (TipTap), épinglés, vues, likes, signalements.
- Notifications. Chat d'équipe (concept Gumroad) pour les espaces privés.
- **Résumés IA** des discussions (pattern `community_chat_recap`) — un vrai plus pour les espaces actifs.

### 6.5 « Baobart Assistant » IA + outils de croissance (nouveau — découvert au §3.4)
- **Assistant IA du créateur** (pattern Store Agent) : chat avec historique, catalogue d'actions exposé à l'IA (lire les stats → puis créer/éditer produits, promos, répondre aux demandes), exécuteur avec scopes de sécurité.
- **Croissance** : codes promo (lancement, anti-résiliation), upsell post-achat, **email de panier abandonné**, **affiliation** (peer + ambassadeurs panafricains), **échelonnement** des paiements.
- **Fidélisation** : emails/newsletters intégrés aux créateurs (pattern `post_email_blast`), membreships de soutien, pourboires, cartes cadeaux, PPP.
- **Vente avancée** : champs personnalisés au checkout (briefs services, candidatures jobs), bundle produits, produits « coffee ».

---

## 7. Feuille de route

| Phase | Durée | Contenu | Livrable |
|---|---|---|---|
| **M0 — Socle** | 3-4 sem | Next.js + Prisma + Tailwind, auth (**2FA TOTP + WebAuthn + login social Google/GitHub/Apple/Discord + téléphone OTP** — §L), i18n fr-FR, palette, infra dev, **docker-compose production + Dockerfile standalone + env vars (deploy anywhere)** (§M), **observabilité + index** (§8), **blocklist de base** (§3.6) | « Baobart » tourne en local ET est déployable (Vercel ou VPS) |
| **M1 — Core loop (MVP)** | 4-5 mois | Shots + feed masonry (pagination curseur) + **upload direct presign** (§3.7-G) + likes + boards + follows + produits + checkout XOF + **profils modulaires** (§3.9-G) + **suivi de consommation** (§3.9-D) + **Staff Picked (collections éditoriales)** (§3.10-A) + **bibliothèque acheteur + previews image/PDF + ZIP streamé** (§13) | **MVP : publier → découvrir → aimer → acheter → télécharger en FCFA** |
| **M2 — Paiements africains** | +6-8 sem | Mobile money, conversion, payouts + KYC, **fréquence/projection des payouts + instantané** (§3.9-A), **checkout multi-devises (devis FX)** (§3.7-F), **livraison sécurisée (URLs signées)** (§3.9-C), **paliers d'abonnement + pool créateurs**, **codes promo + panier abandonné + échelonnement** (§3.4), **reCAPTCHA** (§3.7-D), **previews vidéo (clip) + audio (extrait 30 s) + ZIP listing + certificat PDF** (§13) | Paiement OM réel (sandbox) + plans + payouts projetés |
| **M3 — Vendeurs & Services** | +6-8 sem | Dashboard KPI, dépôt, services (commissions), commission 10 %, **champs personnalisés au checkout**, **moteur de confiance complet** (§3.8), **générateur IA de fiche produit** (§3.9-B), **précommandes** (§3.9-E), **RGPD + KYC par pays** (§3.7-C/I), **upsell + affiliation peer** (§10), **charges groupées** (§3.8-F), **previews 3D (model-viewer) + spécimen fonts + HLS v2** (§13) | Portail vendeur complet + Trust & Safety |
| **M4 — Jobs & Événements** | +6-8 sem | JobPosting **payant** (§2.9), Event, concours | Job board + événements monétisés |
| **M5 — Communautés & Forum** | +8-10 sem | Espaces membres, forum, notifications, **équipes multi-rôles (admin/marketing/support/comptable)** (§3.10-B), **modération automatisée** (§3.6), **emails clients/newsletters + délivrabilité** (§10.6, §3.7-D), **résumés IA** | Hub Communauté |
| **M6 — Shield & Gamification** | +6-8 sem | Protection 4 couches, badges, moteur de critères, **VIP Creator (badge auto par seuil)** (§3.10-C) | Badges + protection active |
| **M7 — Baobart Assistant + Croissance** | +10-12 sem | **Copilote IA** (§9), **affiliation ambassadeurs + UTM links (attribution)** (§3.10-E), **membreships de soutien**, **PPP + devise par IP** (§3.10-D), **boost de découverte** (§10.9), **Year in Review** (§3.6), **API publique + intégrations Discord/Zoom** (§3.7-A/B), **intégrations outils Figma/Canva + plugin « Publier sur Baobart »** (§L), **feed curé + recommandations avancées** (§3.7-E), **API mobile** (§3.9-F, préparation v2) | Assistant IA + boucles de croissance + partage depuis les outils |
| **M8 — Super Admin & CMS** | transversal | Shell `/admin` + rôles + audit (M0) • dashboard + KYC + médias (M1) • payouts + sponsors + flags (M2) • CMS Services + litiges (M3) • CMS Jobs (vérif recruteurs) + CMS Événements (M4) • CMS Blog + modération centralisée (M5) — cf. `SPEC_ADMIN_CMS_BAOBART.md` | Back-office complet, phase par phase avec chaque module |

> **Total : ~14-16 mois**, 2-3 devs. **M1+M2 = MVP** (avec abonnements simples). Couche 2 du Shield (aperçus dégradés) dès M1 — c'est aussi un levier commercial. Les éléments de croissance du **M7 peuvent être activés progressivement** dès M2 (panier abandonné, codes promo) : pas besoin d'attendre la fin.

---

## 8. Performance & passage à l'échelle (Prisma à grande échelle) — nouveau

### 8.1 Le vrai sujet (démystification)

**Prisma n'est pas le goulot d'étranglement.** C'est un ORM qui traduit en SQL ; ce qui casse à grande échelle, ce sont les **patterns de requêtes** et l'**infrastructure** autour. « Centaines de milliers d'utilisateurs » est très atteignable avec **un seul Postgres bien indexé + Redis + CDN**, si on applique les règles ci-dessous dès le départ.

Les 4 pièges classiques avec Prisma : **N+1** (includes imbriqués naïfs), **pagination OFFSET** sur de grandes tables (`skip/take` ralentit en profondeur), **épuisement du pool de connexions** en concurrence, **agrégats lourds** (COUNT/GROUP BY en temps réel).

### 8.2 Règles à appliquer dès M0-M1

**1. Modèle de données & index**
- Index sur **toutes** les clés étrangères et colonnes de filtre/tri (date de création, likes, note, devise…).
- **Compteurs dénormalisés** : `likes_count`, `downloads_count`, `views_count` mis à jour **par jobs asynchrones** (jamais de `COUNT(*)` live sur des millions de lignes).
- Médias **jamais en BDD** : S3/CDN (les images de shots = le produit principal → CDN dès M1).
- Partitionnement Postgres des tables à forte croissance (transactions, analytics, notifications) — dès la conception.

**2. Pagination curseur (obligatoire)**
- Le feed masonry doit utiliser la **pagination par curseur** (clé `(created_at, id)`) et **non** OFFSET → feed infini rapide quelle que soit la profondeur. Prisma le supporte nativement (`cursor`).

**3. Lecture vs écriture — séparer**
- Le produit est **lecture-lourde** (90/10) : feed, profils, produits consultés en masse.
- **Cache Redis** par couche : feed par défaut, profils chauds, ressources populaires, filtres/taxonomie (invalidation par événement : nouvelle publication, like, vente).
- **CDN** pour les médias (images des shots, aperçus, produits) → 80-90 % du trafic ne touche jamais le serveur.
- **Réplicas de lecture** Postgres quand le volume monte : écritures sur le primaire, lectures lourdes sur les réplicas.

**4. Prisma, bien utilisé**
- `select` explicites (pas de `SELECT *`), profils de `include` maîtrisés (pas de nested includes profonds).
- **`$queryRaw`** pour les chemins chauds et les agrégats complexes (le pool, les stats) — le SQL brut est votre ami.
- **PgBouncer** (ou Prisma Accelerate) pour le pooling de connexions en concurrence.
- Transactions uniquement là où c'est nécessaire (achat) ; le reste (notifications, analytics, compteurs) **en jobs asynchrones** (Inngest/BullMQ).

**5. Mesurer dès le premier jour**
- `EXPLAIN ANALYZE` sur chaque requête lente, `pg_stat_statements`, slow query logs, Sentry.
- **Tests de charge k6** avant chaque phase majeure (feed, checkout).
- Revue de requêtes : interdit de merger une feature sans savoir ce qu'elle requête.

### 8.3 Plan de croissance par paliers

| Paliers | Infrastructure | Ce qui change |
|---|---|---|
| **0 → 50k utilisateurs** | 1 Postgres + 1 Redis + CDN | Hygiène de base (index, curseur, cache, jobs). Rien d'autre à faire |
| **50k → 500k** | + réplicas de lecture, + partitionnement, + Meilisearch/Typesense, + PgBouncer | Recherche externalisée, lectures distribuées, agrégats déplacés en cache/raw |
| **500k+** | + sharding si besoin, services dédiés (notifications, search), kafka-like si nécessaire | Découpage par domaine SI et seulement si les données le justifient |

> **Message clé** : ne pas sur-dimensionner aujourd'hui. Les règles de §8.2 coûtent presque rien en M0 et évitent 100 % des réécritures douloureuses. Le passage à l'échelle est un **escalier**, pas un mur — à condition de poser les fondations (index, curseur, cache, jobs, CDN) maintenant.

---

## 9. Spécification « Baobart Assistant » IA (G) — nouveau

### 9.1 Objectif
Un **copilote conversationnel** pour chaque créateur dans le dashboard : l'IA comprend la boutique (stats, ventes, soldes) puis **agit** (créer un produit, préparer une promo, répondre à un message). **Pattern porté de `store_agent_api_catalog.rb` + `store_agent_action_executor.rb`** (84 endpoints chez Gumroad), traduit en TypeScript avec n'importe quel LLM.

### 9.2 Architecture (transposition du pattern Gumroad)

```
app/dashboard/assistant/          → UI : chat docké (pattern AgentChat.tsx)
lib/ai-assistant/
  catalog.ts                      → catalogue d'actions exposé au LLM (function calling)
  executor.ts                     → exécuteur : valide, autorise, exécute, journalise
  conversation.ts                 → historique persisté (pattern AiConversation/AiMessage)
  moderation.ts                   → filtres anti-injection (l'IA ne fait que ce qui est autorisé)
  streaming.ts                    → réponse en streaming (pattern agent_message_streams)
```

### 9.3 Catalogue d'actions — v1 (lecture) puis v2 (écriture)

**v1 — Lire (sans risque)**
- stats : ventes, revenus du mois, produits populaires, téléchargements
- solde : montant disponible, payouts en cours, statuts « versé / en attente »
- catalogue : mes produits/shots, leurs performances, commentaires, avis
- communauté : messages récents, demandes de service en attente

**v2 — Écrire (avec confirmation explicite par l'utilisateur)**
- produits : créer/éditer (titre, description via LLM, prix FCFA, visuel), archiver, dupliquer
- offres : créer un code promo (lancement, anti-résiliation), planifier
- contenus : brouillon de post/newsletter, répondre à un commentaire, répondre à une demande de service
- shop : changer la politique de remboursement, mettre à jour le profil

### 9.4 Sécurité (non négociable)
- **Scopes** : catalogue marqué `read` / `write` / `admin-only` (pattern exact de Gumroad).
- **Confirmation** : toute action d'écriture affiche un résumé cliquable « Valider / Annuler ».
- **Jamais** : accès aux numéros de carte, clés API des passerelles, coordonnées bancaires complètes.
- **Journalisation** : chaque action exécutée est tracée (qui, quoi, quand — pattern `admin_api_audit_log`).
- **Anti-prompt-injection** : le contenu utilisateur (titre produit, commentaire) est traité comme *donnée*, pas comme *instruction* pour l'IA.
- **Coût** : quota par créateur (ex. 30 messages/jour gratuit, puis compteur) — à suivre dès le début.

### 9.5 Choix LLM & coût
- **Par API** (Claude / GPT / Gemini) avec streaming — pas de self-host en v1.
- Estimation : ~2-5k tokens/échange → quelques FCFA par échange. À ce stade, **budget marketing/différenciation** plus que revenu direct ; le M7 pourra l'inclure dans le plan « Créateur Pro ».
- Résumé IA des discussions (pattern `community_chat_recap` + `community_chat_recap_mailer`) : tourne en batch quotidien, coût faible.

### 9.6 Cas d'usage concrets Baobart
1. « Prépare la page produit de mon pack Wax avec cette description » → v2 génère brouillon.
2. « Quels sont mes revenus ce mois-ci ? » → v1 synthétise les stats.
3. « Réponds aux demandes de service en attente avec un délai de 3 jours » → v2 propose 5 réponses à valider.
4. « Résume ce qui s'est dit dans l'espace d'équipe cette semaine » → batch.
5. « Fais-moi un code promo de lancement de -20 % sur 7 jours » → v2 propose le code.

### 9.7 Livrables de la phase (M7)
- `catalog.ts` v1 (15-20 actions lecture) + exécuteur + UI chat dockée + historique.
- v2 (écriture) après validation v1 par les premiers utilisateurs.
- Résumés IA des communautés (intégré à M5).

---

## 10. Catalogue d'intégration « Croissance » (H) — nouveau

Implémentation détaillée des éléments 🔴 du §3.4 dans l'architecture Next.js. **Ordre recommandé** : 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.

### 10.1 Affiliation (peer + ambassadeurs) — M3-M4

> ❌➕ **Vérifié le 2 août 2026** → `VERIFICATION_GUMROAD.md` §6.1-6.3.

- **Données** : `Affiliate` (créateur/vendeur), `AffiliateRequest` (demande de devenir affilié), `AffiliateCredit` (commission), cookie `ref` : **30 jours** entre créateurs (`DirectAffiliate`) et **7 jours** pour les ambassadeurs (`GlobalAffiliate`) — ~~7 jours~~ pour les deux était une erreur de la v10.
- **Règle vérifiée à porter** : un **affilié direct ne touche rien sur une vente issue du feed** — c'est la plateforme qui a amené l'acheteur. Même principe que les deux régimes de commission (§2.4).
- **Deux finesses à conserver** : aucun crédit sur son propre achat ; et le retrait d'un vendeur du programme s'applique aux **renouvellements** d'abonnements déjà référés, sinon il paie à vie sur un parrainage qu'il ne peut plus dénoncer — sans pour autant re-juger rétroactivement les conditions d'origine.
- **Part de l'affilié** (formule vérifiée) : `(basis_points / 10 000) × prix affiché − (basis_points / 10 000) × commission plateforme`, arrondie au plancher ; un drapeau bascule cette quote-part sur le vendeur. Les `basis_points` peuvent être définis **par produit**. **Portée** dans `lib/domain/fees.ts`.
- **Mécanique** : cookie `?ref=<id>` → à l'achat, crédit `affiliate_basis_points` (en % — ex. 10 %) ajouté au solde de l'affilié via `BalanceTransaction`.
- **Ambassadeurs** (programme global Baobart) : les influenceurs créatifs africains réfèrent des créateurs ; commission sur leurs ventes.
- **Renouvellements** : crédit sur les renouvellements d'abonnements (pattern confirmé dans `affiliate.rb`).
- **UI** : section « Affiliation » dans le dashboard (lien personnel, taux, gains).

### 10.2 Codes promo — M2

> ❌ **Vérifié le 2 août 2026** contre `app/models/offer_code.rb` → `VERIFICATION_GUMROAD.md` §6.4.
> Le modèle réel fait **trois fois plus** que ce que décrivait la v10.

- **Données** : `OfferCode` (code, type %, montant fixe, durée, usages max, produits cibles/exclus, `is_cancellation_discount`).
- **Mécaniques supplémentaires vérifiées** :
  - **remises par ancienneté** — jusqu'à 10 paliers : la remise varie selon depuis combien de temps l'acheteur possède le produit ou l'abonnement. **Levier de fidélisation absent de la v10** ;
  - **remises par défaut**, appliquées sans qu'aucun code soit saisi ;
  - **ciblage des clients existants** (les inclure ou les exclure) ;
  - **codes universels**, valables sur toute la boutique ;
  - **codes sans code** : un `OfferCode` rattaché à un upsell ne porte que la remise ;
  - **évaluation par acheteur** — la remise n'est pas une valeur figée ;
  - **plancher de prix** : un code ne peut pas passer sous le prix minimum de la devise, sauf à amener exactement à zéro.
- **Usages Baobart** : lancement (-30 %), partenariats, **anti-résiliation d'abonnement** (code de remise pour un abonné qui veut partir), campagnes de fin d'année.
- **UI** : création depuis le dashboard (assistée par l'IA en M7) + affichage au checkout.

### 10.3 Panier abandonné — M2
- **Données** : `Cart` (persisté, avec produits) + `SentAbandonedCartEmail` (déduplication).
- **Mécanique** : job asynchrone (Inngest) → panier non finalisé depuis 3 h → email de rappel avec lien de reprise ; relance à 24 h si non converti.
- **Pourquoi vital** : avec mobile money, le taux d'abandon dépasse souvent 70 % ; chaque relance = ventes récupérées.
- **UI** : email template + page de reprise du panier.

### 10.4 Échelonnement des paiements — M2-M3

> ✅ **Vérifié le 2 août 2026** → `VERIFICATION_GUMROAD.md` §6.6. Le reste va bien sur la
> **première** tranche. Deux règles à ajouter : seuls `call`, `course`, `digital`, `ebook`
> et `bundle` y ont droit (ni abonnements, ni précommandes, ni prix libre), et **chaque
> tranche** doit rester au-dessus du prix minimum de la devise.

- **Données** : `ProductInstallmentPlan` (nombre de tranches, calcul auto du prix par tranche — pattern `calculate_installment_payment_price_cents` avec reste sur la première).
- **Mécanique** : produit éligible → l'acheteur choisit « payer en 3× » → 3 prélèvements planifiés ; le créateur est payé progressivement (ou au complet selon règle Baobart).
- **Pourquoi** : un pack à 100 000 F devient accessible en 3 × 33 333 F — levier de conversion FCFA direct.

### 10.5 Upsell ~~post-achat~~ **au checkout** — M3

> ❌ **Vérifié le 2 août 2026** contre `app/models/upsell.rb` → `VERIFICATION_GUMROAD.md` §6.5.
> Ce sont **deux mécanismes** derrière un seul modèle (booléen `cross_sell`), et ils se jouent
> **au moment du checkout**, pas seulement après l'achat :
> **upsell** = monter en gamme sur *le même* produit (variante supérieure) ;
> **cross-sell** = proposer un *autre* produit, déclenché par le contenu du panier.
> La remise est portée par un `OfferCode` rattaché, et `paused` existe séparément de
> `deleted` — on suspend une offre sans la perdre.

- **Données** : `Upsell` (produit déclencheur → produit/variant proposé), `UpsellPurchase` (trace).
- **Cas Baobart** : « vous avez acheté le pack de 20 motifs → version complète à -40 % », licence étendue, version HD du shot.
- **UI** : page de remerciement enrichie + email.

### 10.6 Emails aux clients (newsletters créateurs) — M5-M6
- **Données** : `Post` (contenu), `PostEmailBlast` (envoi à l'audience : acheteurs, followers, segments), `Installment` (planification), `SentPostEmail` (déduplication).
- **Mécanique** : le créateur écrit un post (TipTap) → choisit le segment → envoi immédiat ou planifié → **relance des non-ouvreurs** (pattern `RECIPIENT_FILTER_UNOPENED`).
- **Pourquoi** : les créateurs gardent leur audience **sur Baobart** (pas de Mailchimp) → fidélisation + trafic retour.

### 10.7 Membreships (soutien récurrent) — M6
- **Données** : `Subscription` (état : active / pending_cancellation / cancelled), `SubscriptionPlanChange` (up/downgrade), `BaseVariant`/`Price` (les paliers du soutien).
- **Cas Baobart** : « Soutenir Awa Diallo » (patreon-like), accès mensuel aux exclusivités, fonds d'urgence créatifs. + **vos paliers acheteurs** (Explorer/Studio) peuvent s'appuyer sur ce même moteur.
- **Renouvellements** automatiques mobile money (Flutterwave subscriptions).

### 10.8 Champs personnalisés au checkout — M3
- **Données** : `CustomField` (types : texte, choix, booléen, fichier, **termes/conditions**).
- **Cas Baobart** : **Services** (collecter le brief du client), **Jobs** (portfolio/lettre du candidat), **Événements** (t-shirt taille), **Formations** (niveau).
- **UI** : configuration par produit dans le dashboard + rendu au checkout.

### 10.9 Boost de découverte (pay-to-boost) — M6-M7
- **Données** : `discover_fee_per_thousand` (pattern Gumroad : frais par millier d'impressions).
- **Cas Baobart** : « Mettre mon shot en avant 7 jours » / « sponsoriser ma collection » → visibilité feed + newsletter. Revenu B2B, simple, pousse l'adoption.
- **À rapprocher** du sponsoring maquetté (§2.9) et du boost de service — unifier la mécanique.

### 10.10 Indicateurs à suivre par brique
- Affiliation : part des ventes référées, coût d'acquisition.
- Panier abandonné : taux de récupération (cible > 10 %).
- Échelonnement : part des ventes en plusieurs fois, taux de défaut.
- Emails : taux d'ouverture/clic, désabonnements.
- Membreships : churn mensuel, revenu récurrent (MRR).
- Boost : impressions, clics, coût par impression.

---

## 11. Risques & pièges

1. **Scope « super-app »** : prioriser le core loop ; le reste s'ajoute après validation.
2. **Paiement = risque n°1** : mobile money, KYC, frais, compliance, PCI. Sandbox d'abord. Traduire fidèlement la logique de soldes/statuts de Gumroad.
3. **Promesse de protection surfaite** : jamais « impénétrable » (risque réputationnel/juridique).
4. **Économie des abonnements** : mal calibrés, ils cannibalisent les ventes directes. Modéliser le pool avant lancement.
5. **Traduction du domaine monétaire** : avec les règles exactes des modèles Rails (spécification MIT).
6. **FCFA sans cents** : convention « entiers FCFA » dès le départ.
7. **Licence** : conserver la notice MIT ; ne jamais réutiliser la marque Gumroad.
8. **Médias lourds** : CDN dès M1 ; traitement d'images (resize, WebP).
9. **i18n FR** : budgété explicitement.
10. **Confiance des transactions** : vérification des recruteurs/vendeurs (anti-arnaque) dès M4 — non négociable pour le marché ouest-africain.

---

## 12. Prochaines étapes possibles (à choisir)

- **A. Modèle économique chiffré** — ✅ **livré** (voir `MODELE_ECONOMIQUE_BAOBART.xlsx`) : hypothèses ajustables, revenus par pilier, coûts, point d'équilibre + matrice de sensibilité, projection 24 mois, comparaison commission 10 vs 20 %. Chiffres clés : marge nette mois 12 ≈ 2,36 M F/mois (10 %), point d'équilibre ≈ 1 350 abonnés Studio (ou 13 100 ventes/mois), cumul positif au mois 15.
- **B. Blueprint complet Next.js** — ✅ **livré** (voir `BLUEPRINT_NEXTJS_BAOBART.md`) : structure du projet, **schéma Prisma complet** (auth, social visuel, commerce, monétisation, gamification, communauté, confiance), mapping Gumroad → TypeScript, bootstrap M0.
- **C. Spécification « Baobart Shield »** — ✅ **livrée** (voir `SPEC_BAOBART_SHIELD.md`) : 4 couches de défense, choix des librairies (invisible-watermark, C2PA, Glaze/Nightshade), intégration au pipeline d'upload, niveaux de protection, coûts, communication honnête.
- **D. Spécification gamification** — ✅ **livrée** (voir `SPEC_GAMIFICATION_BAOBART.md`) : badges (Créateur vérifié, Top créateur, Nouveau talent, Pilier de la communauté, VIP), **formules chiffrées publiées** (score composite, seuils), cycles glissants, moteur de calcul, intégration UI, anti-abus.
- **E. Spécification licences** — ✅ **livrée** (voir `SPEC_LICENCES_BAOBART.md`) : 3 types standardisés (**Personnelle / Commerciale / Étendue**) + conditions précises, **certificat PDF** par achat, **clés d'activation** (API verify/enable/disable/rotate, pattern Gumroad), matrice plan → licence.
- **I. Spécification livraison des assets & previews** — ✅ **livrée** (voir `SPEC_LIVRAISON_PREVIEWS_ASSETS.md`) : téléchargement **en formats originaux** (PNG/PDF/TIFF/AI/ZIP/MP4/MP3…), bibliothèque acheteur persistante, ZIP streamé, quotas par plan, et **moteur de previews multi-format** (image, vidéo, audio, 3D via model-viewer, PDF, fonts, ZIP).
- **J. Spécification Super Admin & CMS** — ✅ **livrée** (voir `SPEC_ADMIN_CMS_BAOBART.md`) : back-office `/admin` avec rôles (SUPER_ADMIN, CONTENT_MANAGER, MARKETING, MODERATOR, SUPPORT, ACCOUNTANT, COMPLIANCE), **CMS Blogs** (éditeur TipTap, workflow draft→review→publié, SEO, planification), **CMS Événements** (concours, jury, prix FCFA, inscriptions + export CSV), **CMS Jobs** (vérification recruteurs + badge « Offre vérifiée », anti-arnaque, paiement des offres), **CMS Services** (catégories, modération, litiges), modération unifiée, gestion vendeurs (KYC, risk states, suspension), payouts admin, sponsoring, feature flags, audit complet.
- **F. Maquettes des pages** — ✅ **livrées** (voir `MAQUETTES_BAOBART.html`) : 6 maquettes HTML fidèles au design system (Tarifs 3 plans, Badges & gamification, Profil créateur, Job board, Bibliothèque acheteur, Back-office Super Admin), avec nav interactive.
- **K. Analyse du design system v1** — ✅ **livrée** (voir `ANALYSE_DESIGN_SYSTEM_BAOBART.md`) : inventaire complet des tokens (Sticker System : couleurs, typo Archivo Black/Poppins/Space Mono, ombres dures, cartes 3 traitements), points forts, **3 contrastes à corriger** (orange sur lavande 2,7:1, blanc sur lavande profond 2:1, jaune en texte 1,1:1), tokens manquants (spacing, breakpoints, états forms, z-index), mapping Tailwind + checklist de conformité.
- **L. Spécification connexions tierces & intégrations outils** — ✅ **livrée** (voir `SPEC_AUTH_INTEGRATIONS_BAOBART.md`) : **login social** (Google, GitHub, Apple, Discord, X, LinkedIn via NextAuth natif + **téléphone OTP en mode principal** pour l'Afrique, account linking, niveaux de confiance, 2FA indépendante) ; **connexion à Figma/Canva/Framer** (OAuth + API : export frames Figma en PNG/SVG/PDF, export asynchrone Canva avec limites rate vérifiées, Framer par plugin/lien) avec 3 mécanismes (connecter+importer, **plugin « Publier sur Baobart »**, import par lien), pipeline Shield réutilisé, webhooks Figma, modèle Prisma (IntegrationConnection, ImportedAsset).
- **M. Spécification déploiement & self-hosting** — ✅ **livrée** (voir `SPEC_DEPLOIEMENT_SELFHOSTING_BAOBART.md`) : stratégie « build once, deploy anywhere » (12-factor), **Dockerfile Next.js standalone** + **docker-compose production complet** (app + worker + Postgres 16 + Redis + MinIO + Caddy/HTTPS auto), config par env vars, déploiement **Vercel** (pooling, Inngest, crons) et **VPS Hostinger/OVH** (guide pas-à-pas), abstraction `lib/jobs` (Inngest/BullMQ) et `lib/email` (Resend/SMTP), coûts comparés (**Vercel ~50-100 $/mois vs VPS ~10-35 $/mois**), sauvegardes + DR, scaling, checklist « deploy anywhere ».
- **N. Spécification catalogue étendu & produits physiques** — ✅ **livrée** (voir `SPEC_PRODUITS_PHYSIQUES_BAOBART.md`) : avis stratégique (v1 numérique → **physique en phase 2**), catalogue complet (numérique + physique : peintures, sculptures, artisanat, textile, bijoux, estampes), le **pont POD** (shots → affiches/tirages numérotés), **3 modèles** (POD → seller-shipped avec **escrow** → **hubs de confiance**), **flux escrow complet** (fonds retenus jusqu'à confirmation de réception), **5 zones de livraison** (retrait → national → UEMOA → continent → diaspora), tarifs, emballage par type d'œuvre, **certificat d'authenticité**, retours/litiges (preuves photo, délais), modèle Prisma (PhysicalOrder escrow, ShippingZone, PrintJob), impact roadmap (POD M4-M5, seller-shipped M6-M7, hubs M8+).
- **O. README + Charte éditoriale** — ✅ **livrés** (voir `README.md` + `CHARTE_EDITORIALE_BAOBART.md`) : README complet du projet (présentation, objectifs, fonctionnalités, stack, doc, modèle éco, roadmap, déploiement, licence) ; charte éditoriale inspirée des **techniques de communication Gumroad** (message unique « du premier croquis au premier encaissement », chiffres signature en FCFA, ton direct « tu », structure avant/après, témoignages chiffrés, micro-moments « 🎉 Encaissé ! », anti-hésitation, preuve continue) avec formules prêtes à l'emploi, tons par contexte, règles d'écriture, anti-exemples et checklist qualité.
- **G. Spécification « Baobart Assistant » IA** — ✅ **livrée** (voir §9) : catalogue d'actions v1/v2, sécurité, choix LLM, cas d'usage.
- **H. Catalogue d'intégration « croissance »** — ✅ **livré** (voir §10) : affiliation, codes promo, panier abandonné, échelonnement, upsell, emails clients, membreships, champs personnalisés, boost — avec ordre d'implémentation et indicateurs.

---

## 13. Livraison des assets & previews — synthèse (nouveau)

> Détail complet : **`SPEC_LIVRAISON_PREVIEWS_ASSETS.md`** (document I).

**Comment le client récupère ses assets ?** Après paiement → `fulfill-order` ajoute les fichiers à sa **bibliothèque acheteur persistante** (page `/library`), avec :
- **Téléchargement dans les formats originaux** (PNG, JPG, TIFF, AI, EPS, SVG, PSD, ZIP, MP4, MP3, WAV, TTF, OTF, GLB…) — aucune conversion forcée, `Content-Disposition: attachment` avec le nom d'origine.
- **Tout télécharger = ZIP streamé à la volée** (jamais de fichier pré-généré).
- **Re-téléchargement illimité** tant que le compte existe et la licence est valide ; URLs signées avec expiration mais régénérables.
- **Quotas par plan** (3/mois Découverte, 15/mois Explorer, illimité Studio) ; achats à l'unité jamais comptés.
- **Certificat de licence PDF** + **clé d'activation** (si applicable) sur la page produit acheté.
- Chaque téléchargement = `ConsumptionEvent` → compteur « 2 340 dl » + analytics.

**Previews multi-format** (public = aperçus limités/filigranés ; acheteur = preview complet) :

| Format | Preview publique | Preview acheteur | Techno |
|---|---|---|---|
| Image (PNG/JPG/TIFF/SVG) | Miniature + aperçu filigrané (Shield couche 2) | Plein format + zoom | `sharp` |
| AI/EPS/PSD | Couverture + aperçu rendu (si possible) | Idem + téléchargement original | `mupdf`/couverture |
| Vidéo (MP4/MOV/WebM) | **Extrait 5-10 s** bouclé + poster | Lecture complète | `ffmpeg` ; v2 : **HLS** (hls.js) |
| Audio (MP3/WAV/FLAC…) | **Extrait 30 s** + waveform | Lecture complète | `ffmpeg` + lecteur custom |
| **3D (GLB/GLTF/OBJ/FBX)** | **Visualiseur 3D** en rotation auto | Visualiseur interactif complet | **`@google/model-viewer`** + `gltf-transform` (Draco) |
| PDF | Premières 3-5 pages en images | **Visionneuse PDF intégrée** | `pdfjs-dist` |
| ZIP | **Listing du contenu** (noms + tailles) | Listing + téléchargement | index au pipeline |
| Fonts (TTF/OTF/WOFF) | **Spécimen** interactif (AaBbCc…) | Spécimen + téléchargement | canvas `FontFace` |

**Décisions assumées** : **aucun DRM** sur les fichiers téléchargés (la licence fait foi — SPEC_LICENCES) ; la protection est à la source (Shield : previews filigranés, couche 2). Formats non preview-ables (RAW, certains PSD) → couverture + liste de fichiers.

---

## Annexe — Repères dans le dépôt Gumroad (vérifiés, spécification de référence)

```
app/business/payments/currency.rb            # XOF, NGN, GHS… + conversion
app/models/cote_d_ivoire_bank_account.rb     # IBAN CI (modèle payouts par pays)
app/models/balance.rb / balance_transaction.rb  # soldes, statuts versé/en attente
app/models/commission.rb                     # acompte 50 % + solde (services)
app/models/license.rb                        # clés de licence (sérial, usages, enable/disable/rotate)
app/controllers/api/v2/licenses_controller.rb  # API verify/enable/disable/rotate
app/models/product_refund_policy.rb          # politique de remboursement par produit
app/models/follower.rb / product_review.rb / wishlist.rb / comment.rb  # social (partiel)
app/models/community.rb / community_chat_message.rb  # chat (à généraliser en forum)
app/controllers/dashboard_controller.rb / analytics_controller.rb     # dashboard vendeur
db/schema.rb                                 # modèle conceptuel des tables commerce

# --- Découvertes v5 (§3.4) ---
app/services/ai/store_agent_api_catalog.rb  # IA Agent : 84 endpoints exécutables
app/services/ai/store_agent_action_executor.rb  # exécuteur d'actions de l'IA
app/models/ai_conversation.rb / ai_message.rb   # historique de chat IA
app/models/community_chat_recap.rb          # résumé IA des discussions
app/models/offer_code.rb                    # codes promo (%/montant, durée, exclusions, anti-résiliation)
app/models/upsell.rb / upsell_variant.rb    # upsell post-achat
app/models/sent_abandoned_cart_email.rb     # email panier abandonné
app/models/product_installment_plan.rb      # échelonnement des paiements (3×)
app/models/affiliate.rb / direct_affiliate.rb / global_affiliate.rb  # affiliation peer + ambassadeurs
app/models/gift.rb / tip.rb                 # cartes cadeaux / pourboires
app/models/post_email_blast.rb              # emails/newsletters des vendeurs aux clients
app/models/subscription.rb / subscription_plan_change.rb  # membreships récurrents
app/models/custom_field.rb                  # champs personnalisés au checkout
app/models/taxonomy.rb / taxonomy_stat.rb   # catégories de découverte + stats
app/models/gumroad_daily_analytic.rb        # analytics quotidiens plateforme
# (pattern PPP : is_purchasing_power_parity_discounted sur purchases)

# --- Découvertes v6 (admin/sécurité/jobs/mailers, §3.6) ---
app/services/content_moderation/moderate_record_service.rb  # modération automatisée (spam, stratégies)
app/models/blocked_object.rb                # blocklist IP/objets avec expiration
app/models/early_fraud_warning.rb           # alertes précoces de fraude
app/models/totp_credential.rb / webauthn_credential.rb      # 2FA (TOTP + passkeys)
app/sidekiq/                                # 226 workers : payouts, caches, modération, médias…
app/mailers/customer_mailer.rb / creator_mailer.rb  # reçus, factures, Year in Review, Top Creator
app/models/link.rb (discover_fee_per_thousand)   # « boost de découverte » payant

# --- Découvertes v7 (API/intégrations/RGPD/anti-bot/reco/checkout/upload, §3.7) ---
app/controllers/api/v2/                         # API publique REST (25+ ressources) + OAuth scopes
app/services/checkout/buyer_currency_quote.rb   # devis de conversion devise (FX avec expiration)
app/services/checkout/presentment_rounding.rb   # arrondi d'affichage multi-devise
app/controllers/api/v2/direct_uploads_controller.rb / files_controller.rb  # upload direct presign S3
app/models/discord_integration.rb / circle_integration.rb / zoom_integration.rb / google_calendar_integration.rb  # intégrations tiers
app/services/gdpr_data_erasure_service.rb       # effacement RGPD (anonymisation PII)
app/services/checkout_recaptcha.rb / follow_recaptcha.rb  # anti-bot score-based
app/services/email_suppression_manager.rb       # délivrabilité email (bounces, spams, blocks)
app/controllers/recommended_products_controller.rb / app/modules/product/recommendations.rb  # recommandations
app/models/discover_search.rb / discover_search_suggestion.rb  # recherche + suggestions
app/services/creator_analytics/caching_proxy.rb  # analytics créateur en cache (KPI dashboard)
app/services/merchant_registration/ + user_compliance_info_fields.rb  # KYC/onboarding vendeur par pays

# --- Découvertes v8 (moteur de confiance, §3.8) ---
app/models/user.rb (state_machine user_risk_state)   # machine à états de risque vendeur
app/models/concerns/user/low_balance_fraud_check.rb  # anti-fraude auto (solde < -100$ → probation)
app/controllers/admin/unreviewed_users_controller.rb # file de revue des nouveaux vendeurs
app/services/radar/charge_risk_level_service.rb      # scoring risque des charges (Stripe Radar)
app/services/checkout/presentment_orchestrator.rb    # charges groupées multi-vendeurs
app/models/walks_free_trial.rb / walks_app_attest_key.rb  # « Walks » mobile IA (inspiration v2)

# --- Découvertes v9 (argent/livraison/IA produit/mobile/profils, §3.9) ---
app/modules/user/payout_schedule.rb                 # fréquence payout (weekly/monthly) + projection
app/business/payments/payouts/payout_rail_schedule.rb  # jour de payout par type de compte/pays
app/services/ai/product_details_generator_service.rb   # générateur IA de fiche produit (nom, desc, prix)
app/controllers/url_redirects_controller.rb         # livraison sécurisée (URLs signées S3 + expiration)
app/models/consumption_event.rb                     # suivi de consommation (téléchargements/lectures)
app/models/preorder.rb                              # précommandes (autorisation → charge à la sortie)
app/controllers/api/mobile/                         # API mobile (19 contrôleurs) — feuille de route v2
app/models/seller_profile_section.rb (+ sous-classes) # profils créateurs modulaires (portfolio)
app/models/product_review_stat.rb                   # stats de reviews dénormalisées (compteurs/étoile)

# --- Découvertes v10 (dernière passe, §3.10) ---
app/models/concerns/product/staff_picked.rb         # « Staff Picked » : sélection éditoriale manuelle
app/models/concerns/user/team.rb + app/policies/    # équipes multi-rôles (admin/marketing/support/comptable) + 48 policies
app/models/concerns/user/vip_creator.rb             # « VIP Creator » : badge auto par seuil de payouts
app/helpers/currency_helper.rb                      # devise par IP/pays + conversion (prix localisés)
app/models/utm_link.rb (+ driven_sale/visit)        # UTM links + attribution de ventes aux campagnes
app/models/shipping_destination.rb                  # expédition physique par pays (taux par quantité)
app/modules/money_formatter.rb / app/helpers/cdn_url_helper.rb / signed_url_helper.rb  # helpers réutilisables
```
