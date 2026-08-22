# Vérification approfondie des fonctionnalités Gumroad utilisées par Baobart

**Date : 2026-08-21**  
**Dépôt Gumroad vérifié :** `antiwork/gumroad` cloné localement  
**Commit observé :** `182df6a89154892daa13e3530e6889069d382df5` (`182df6a8`)  
**Document Baobart vérifié :** `Doc/PLAN_REFONTE_BAOBART_GUMROAD.md`

> Objectif : reprendre toutes les fonctionnalités Gumroad mentionnées dans le plan Baobart, vérifier leur existence réelle dans le code Gumroad, noter les corrections éventuelles et indiquer l'impact pour Baobart.

---

## 0. Méthode de vérification

La vérification a été faite par passes répétées sur le dépôt Gumroad :

1. lecture du plan Baobart et extraction des sections `3.1` à `3.10` ;
2. clone local du dépôt `antiwork/gumroad` ;
3. recherche globale par familles de fonctionnalités (`rg`) ;
4. lecture ciblée des fichiers sources trouvés ;
5. recompte des volumétries annoncées ;
6. comparaison avec le modèle déjà porté dans Baobart ;
7. synthèse en matrice de vérification.

Commandes/passes principales utilisées :

```bash
git clone --depth 1 https://github.com/antiwork/gumroad.git /home/user/gumroad-audit
rg -n -i "license|refund|affiliate|upsell|offer_code|payout|risk|fraud|recaptcha|oauth|direct_upload|consumption|staff_picked|team|utm|vip" app lib config db
find app/sidekiq -type f -name '*.rb' | wc -l
find app/mailers -type f -name '*.rb' | wc -l
find app/policies -type f -name '*.rb' | wc -l
find app/controllers/api/mobile -type f -name '*.rb' | wc -l
```

---

## 1. Relevés globaux sur le commit vérifié

| Élément | Relevé actuel | Statut par rapport au plan |
|---|---:|---|
| Fichiers Git | 13 555 | indicatif |
| Fichiers Ruby | 5 348 | indicatif |
| Sidekiq workers (`app/sidekiq`) | **264** | différent des anciens relevés `226/244` ; le dépôt a évolué |
| Mailers (`app/mailers`) | **24** | différent de `21` dans le plan |
| Policies (`app/policies`) | **66** | différent de `48/69` selon ancienne passe |
| Contrôleurs `api/mobile` | **20** | différent de `19` dans le plan |
| Contrôleurs mobile + `api/v2/walks` | **24** | utile si on compte Walks dans le périmètre mobile |
| Contrôleurs `api/v2` | **37** | confirme une API publique importante |
| Store Agent endpoints | **83** | confirme la correction `83`, pas `84` |

**Conclusion de volumétrie :** les fonctionnalités existent, mais les chiffres du plan doivent être considérés comme dépendants du commit. Pour éviter une dette documentaire, il faut toujours citer le commit vérifié.

---

## 2. Matrice de vérification

Légende :

- ✅ confirmé : l'affirmation est présente dans le code.
- 🟡 confirmé avec nuance : l'idée est vraie mais la formulation du plan doit être corrigée.
- ❌ non confirmé : je n'ai pas trouvé de preuve suffisante dans le code audité.
- 🔁 déjà porté : une partie existe déjà dans Baobart.

| Fonctionnalité du plan | Verdict | Sources Gumroad | Lecture corrigée | Impact Baobart |
|---|---|---|---|---|
| Clés de licence : génération, vérification, activation/désactivation | ✅ | `app/models/license.rb`, `config/routes.rb`, `app/controllers/licenses_controller.rb`, `app/controllers/api/v2/licenses_controller.rb`, `app/services/ai/store_agent_api_catalog.rb` | Gumroad a bien une infrastructure de license keys. Ce n'est pas un catalogue de licences personnelle/commerciale/étendue. | Garder `LicenseType` Baobart pour les types métier ; porter endpoints de vérification plus tard. |
| Remboursements comme lignes séparées, y compris partiels | ✅ | `app/models/refund.rb`, `app/models/purchase.rb`, migrations `add_partial_refunds_to_purchase` | Un remboursement n'est pas simplement un état `refunded` ; le modèle conserve montants et effets. | 🔁 Déjà aligné avec `Refund` + `refundedAmount`. Correctifs concurrence ajoutés. |
| État de paiement au niveau purchase/ligne, pas seulement commande globale | ✅ | `app/models/purchase.rb` (`purchase_state`, `successful`, `failed`, `not_charged`, précommandes, gifts) | Gumroad a beaucoup plus d'états que Baobart v1, mais le principe ligne-par-ligne est confirmé. | 🔁 `OrderItem.state` Baobart est la bonne base. |
| Calcul frais Gumroad différencié selon contexte | ✅ | `app/models/purchase.rb`, champs `fee_cents`, `affiliate_credit_cents`, `was_discover_fee_charged`, `discover_fee_per_thousand` | Le plan a raison : il ne faut pas un taux unique naïf. | 🔁 `computeFees` reprend le modèle direct/découverte. |
| Balance journalière et montants figés hors `unpaid` | ✅ | `app/models/balance.rb` (`unpaid → processing → paid`, `forfeited`, validation montants) | Confirmé. | 🔁 Porté + trigger Postgres dans Baobart. |
| Grand livre / BalanceTransaction | ✅ | `app/models/balance_transaction.rb` | Confirmé ; Gumroad a une logique riche de sélection de balance et devises issued/holding. | 🔁 Porté dans `BalanceTransaction`, à compléter par contraintes d'origine. |
| Payouts : états nombreux, dont `returned` | ✅ | `app/models/payment.rb` (`creating`, `processing`, `unclaimed`, `completed`, `failed`, `cancelled`, `reversed`, `returned`) | Huit états confirmés. `completed → returned` existe. | 🔁 Aligné dans Prisma. |
| Payout échoué/annulé remet les balances à `unpaid` | ✅ | `app/models/payment.rb` callbacks `mark_balances_as_unpaid` | Confirmé et critique. | À implémenter côté jobs payout Baobart. |
| Fréquences payout : daily, weekly, monthly, quarterly | ✅ | `app/modules/user/payout_schedule.rb` | Quatre fréquences confirmées. | 🔁 Porté dans `lib/payments/payout-schedule.ts`. |
| Délai de rétention payout de 7 jours | ✅ | `app/modules/user/payout_schedule.rb` `PAYOUT_DELAY_DAYS = 7` | Confirmé. | 🔁 Porté. |
| Deux dates payout : date de cycle vs date réelle de versement | ✅ | `app/modules/user/payout_schedule.rb`, `app/business/payments/payouts/payout_rail_schedule.rb` | Confirmé. C'est une correction structurante. | 🔁 Porté. |
| Rails de paiement exécutés certains jours | ✅ | `app/business/payments/payouts/payout_rail_schedule.rb`, `config/sidekiq_schedule.yml` | Confirmé pour banques, PayPal, Stripe Connect. | Adapter en Wave/OM/MTN/Moov/banque. |
| Payouts instantanés quotidiens | ✅ | `app/sidekiq/perform_daily_instant_payouts_worker.rb`, `app/controllers/instant_payouts_controller.rb`, `User::PayoutSchedule::DAILY` | Confirmé. | À porter après payout standard. |
| LowBalanceFraudCheck | ✅ | `app/models/concerns/user/low_balance_fraud_check.rb`, `app/sidekiq/low_balance_fraud_check_worker.rb` | Confirmé : seuil bas -100 USD, seuil haut +100 USD, délai de carence 2 mois, auteur `LowBalanceFraudCheck`. | 🔁 Décideur porté dans `lib/domain/trust.ts`. |
| Machine d'états risque vendeur | ✅ | `app/models/user.rb`, `app/modules/user/risk.rb` | Confirmé : `not_reviewed`, `compliant`, `on_probation`, flags/suspensions TOS/fraud. | 🔁 Porté partiellement dans Prisma + `trust.ts`. |
| Effets de suspension : sessions, produits, IP, follows, domaines | ✅ | `app/models/user.rb` transitions `after_transition` | Confirmé. | À porter via services transactionnels + jobs. |
| File admin de revue vendeurs | ✅ | `app/controllers/admin/unreviewed_users_controller.rb`, `app/services/admin/unreviewed_users_service.rb` | Confirmé. | Module admin futur. |
| Scoring risque paiement / Stripe Radar | ✅ | `app/services/radar/charge_risk_level_service.rb`, `app/services/radar/seller_risk_stats_service.rb` | Confirmé. | Adapter aux scores Flutterwave/Paystack/CinetPay/Stripe. |
| Suspension massive admin | ✅ | `app/controllers/admin/suspend_users_controller.rb` | Confirmé. | Utile pour admin Trust v2. |
| 2FA TOTP | ✅ | `app/models/concerns/two_factor_authentication.rb`, `app/controllers/two_factor_authentication_controller.rb`, `two_factor_authentication_mailer` | Confirmé. | À porter après auth de base. |
| Passkeys WebAuthn | ✅ | `app/models/webauthn_credential.rb`, `app/controllers/logins/passkeys_controller.rb`, `config/initializers/webauthn.rb` | Confirmé. | Prisma a déjà `Passkey`. Implémentation à faire. |
| Blocklist IP/objets avec expiration | ✅ | `app/models/blocked_customer_object.rb`, `app/sidekiq/block_object_worker.rb`, `app/sidekiq/block_suspended_account_ip_worker.rb` | Confirmé. | Prisma a `BlockedObject`. Jobs à faire. |
| Modération contenu automatisée | ✅ | `app/services/content_moderation/*`, `app/models/product_review_video/*`, workers associés | Confirmé. | Baobart Shield/Trust future étape. |
| Workers Sidekiq nombreux | ✅ | `app/sidekiq/*.rb` | Confirmé, mais **264** sur commit actuel. | Baobart doit prévoir workers tôt. |
| Mailers transactionnels nombreux | ✅ | `app/mailers/*.rb` | Confirmé, mais **24** sur commit actuel. | Module email prioritaire avant prod. |
| Boost de découverte payant | ✅ | `app/models/link.rb` `DEFAULT_BOOSTED_DISCOVER_FEE_PER_THOUSAND`, `discover_fee_per_thousand`, `was_discover_fee_charged` | Confirmé. | Prisma a `isBoosted` / `discoverFeePerThousand`. Algo feed à faire. |
| Store Agent IA | ✅ | `app/services/ai/store_agent_*`, `app/controllers/api/internal/agent_*`, `app/services/ai/store_agent_api_catalog.rb` | Confirmé. Le catalogue audité expose **83 endpoints**. | Baobart Assistant peut reprendre le pattern catalogue + scopes. |
| Générateur IA de fiche produit | ✅ | `app/services/ai/product_details_generator_service.rb`, `app/controllers/api/internal/ai_product_details_generations_controller.rb` | Confirmé : génération détails produit + throttling 10/h. | À porter après dépôt produit/upload. |
| Throttling IA 10 requêtes/heure | ✅ | `app/controllers/api/internal/ai_product_details_generations_controller.rb` | Confirmé : `AI_REQUESTS_PER_PERIOD = 10`. | À intégrer dans Baobart Assistant. |
| Affiliation directe/globale | ✅ | `app/models/affiliate.rb`, `direct_affiliate.rb`, `global_affiliate.rb`, `affiliate_credit.rb`, controllers affiliés | Confirmé. | Prisma a base affiliate ; logique à porter plus tard. |
| Commission affilié en basis points | ✅ | `app/models/affiliate.rb`, `app/models/oauth_application.rb` | Confirmé, limites et conversions existent. | 🔁 `affiliateBasisPoints` déjà dans `computeFees`. |
| Paniers abandonnés | ✅ | `app/models/sent_abandoned_cart_email.rb`, `app/services/default_abandoned_cart_workflow_generator_service.rb`, workers/mails | Confirmé. | Plus tard : dépend email + checkout. |
| Codes promo / offer codes | ✅ | `app/models/offer_code.rb`, `app/controllers/offer_codes_controller.rb`, API v2 | Confirmé et plus riche que le schéma Baobart actuel : validité, fixed/percent, produits exclus/inclus, clients existants, durées. | Baobart `OfferCode` est minimal ; enrichir avant lancement promo. |
| Upsells / cross-sells checkout | ✅ | `app/models/upsell.rb`, `app/controllers/checkout/upsells_controller.rb`, API v2 upsells | Confirmé. | À porter après checkout. |
| Cartes cadeaux | ✅ | `app/models/gift.rb`, purchase gift states | Confirmé. | Hors MVP Baobart. |
| Pourboires / tips / coffee | ✅ | `app/models/link.rb` type natif `coffee`, `app/services/tip_options_service.rb` | Confirmé. | Baobart peut garder `COFFEE` ou `TIP`. |
| Échelonnement des paiements / installment plans | ✅ | `ProductInstallmentPlan`, `pay_in_installments`, services subscription/installment | Confirmé. | Hors MVP ; important services premium. |
| Précommandes | ✅ | `app/models/preorder.rb`, workers `charge_preorder_worker`, `cancel_preorder_worker`, states purchase preorder | Confirmé. | Prisma peut ajouter module si lancement/concours. |
| Types produits Gumroad | 🟡 | `app/models/link.rb` `NATIVE_TYPES_TO_TAX_CODE`, flags `is_physical`, `is_bundle`, `is_recurring_billing` | Il y a bien **12 native types** dans le commit actuel : digital, course, ebook, newsletter, membership, podcast, audiobook, physical, bundle, commission, call, coffee. Mais ce n'est pas un simple enum métier : types natifs + flags + relations. | Baobart `ProductType` est simplifié ; suffisant M0 mais devra évoluer. |
| API publique complète | ✅ | `app/controllers/api/v2/*`, `config/routes.rb`, OAuth/Doorkeeper | Confirmé : produits, ventes, payouts, licences, subscribers, files, offer codes, upsells, UTM, workflows... | Baobart API publique à planifier après back-office. |
| OAuth scopes/applications | ✅ | `app/models/oauth_application.rb`, `app/controllers/oauth/*`, Doorkeeper | Confirmé : scopes par défaut, access token durable, applications. | À porter pour intégrations créatives. |
| Intégrations Discord/Circle/Zoom/Calendar | 🟡 | `app/services/discord_api.rb`, `app/services/circle_api.rb`, recherches Zoom/Calendar dans intégrations | Discord/Circle confirmés directement. Zoom/Calendar existent dans le périmètre intégrations/produits mais demandent une passe plus ciblée pour contrat exact. | Priorité moyenne. |
| Conformité RGPD / suppression données | 🟡 | `User` soft deletion, commentaires GDPR dans `user.rb`, services de suppression/anonymisation à explorer | Présence de préoccupations RGPD confirmée, mais le plan doit éviter de prétendre un module RGPD unique exhaustif sans citer les services précis. | À spécifier séparément pour Baobart. |
| Anti-bot reCAPTCHA score-based | ✅ | `app/controllers/concerns/validate_recaptcha.rb`, `config/initializers/rack_attack.rb` | Confirmé : reCAPTCHA Enterprise, seuils score, fail-open par surface, limite taille token, throttles Rack Attack. | Baobart doit ajouter rate limiting + CAPTCHA adaptatif. |
| Recherche et recommandations | ✅ | `app/controllers/discover/search_autocomplete_controller.rb`, `app/models/discover_search_suggestion.rb`, `app/services/recommended_products/*`, Elasticsearch workers | Confirmé. | Feed Baobart à renforcer avec search index/cache. |
| Suggestions de recherche | 🟡 | `discover/search_autocomplete_controller`, `discover_search`, `discover_search_suggestion` | Le plan doit distinguer recherche catalogue, autocomplete et historique/suggestions. | Baobart actuel recherche seulement par nom produit. |
| Checkout multi-devises / FX quote | ✅ | `app/services/checkout/buyer_currency_quote.rb`, `presentment` services, `Charge::PresentmentAllocator` | Confirmé : quote avec expiration, allocation multi-charge/multi-seller. | Baobart devra reprendre le pattern pour diaspora. |
| Charges groupées multi-vendeurs | ✅ | `Checkout::BuyerCurrencyQuote`, `Charge::PresentmentAllocator`, `Order`/`Charge` services | Confirmé : un panier peut couvrir plusieurs charges. | Baobart `Order` + `OrderItem` est compatible conceptuellement. |
| Upload direct S3/ActiveStorage | ✅ | `app/controllers/api/v2/direct_uploads_controller.rb` | Confirmé : réservation blob, checksum, content type, taille max, `service_url_for_direct_upload`. | Baobart doit implémenter presign S3/MinIO. |
| Livraison sécurisée via URL signée | ✅ | `app/models/url_redirect.rb`, `SignedUrlHelper`, `s3_utility_controller` | Confirmé. | 🔁 Décideur durée/droit porté ; route réelle à faire. |
| Durée URL dépend de la taille | ✅ | `app/models/url_redirect.rb`, helpers signed URL | Confirmé dans le comportement de livraison. | 🔁 Porté dans `lib/domain/delivery.ts`. |
| Consumption events | ✅ | `app/models/consumption_event.rb`, `app/controllers/concerns/create_consumption_event.rb` | Confirmé : types de consommation plus nombreux que le plan initial. | 🔁 Porté partiellement. |
| API mobile | ✅ | `app/controllers/api/mobile/*`, `app/controllers/api/v2/walks/*` | Confirmé. Commit actuel : 20 contrôleurs `api/mobile`, 24 si on ajoute Walks v2. | Futur Baobart mobile. |
| Walks mobile IA + App Attest | ✅ | `app/controllers/api/v2/walks/*`, `app/services/walks_app_attest_verifier.rb`, `WalksFreeTrial` | Confirmé. | Inspiration v2, pas MVP. |
| Profils créateurs modulaires | ✅ | `SellerProfile`, pages, layout endpoints Store Agent, `get_user_profile_layout` | Confirmé. | Baobart profile public à construire. |
| Reviews/stats dénormalisées | ✅ | `app/models/product_review.rb`, `Product::ReviewStat`, champs counts/ratings | Confirmé. | Prisma a déjà rating counters. |
| Staff Picked | ✅ | `app/models/staff_picked_product.rb`, `app/models/concerns/product/staff_picked.rb`, `Link#staff_picked?` | Confirmé. | 🔁 Baobart a `isStaffPicked`. |
| Policies fines | ✅ | `app/policies/*.rb` | Confirmé, mais **66** sur commit actuel. | Baobart devra ajouter authorization layer. |
| Équipes multi-rôles | ✅ | `app/models/team_membership.rb`, `app/models/concerns/user/team.rb`, `settings/team/*` | Confirmé. Rôles à vérifier dans la constante `ROLES`, avec contrainte owner. | Prisma a `TeamMembership` + rôles. |
| VIP Creator | ✅ | `app/models/concerns/user/vip_creator.rb` | Confirmé : seuil basé sur payouts complétés. | À adapter en badge Baobart. |
| Détection/localisation devise par IP/pays | ✅ | `CurrencyHelper`, `BuyerCurrencyQuote`, `PurchasingPowerParityService`, `ip_country`, currency attributes | Confirmé. | À porter avec prix localisés + devises africaines. |
| UTM links/tracking campagnes | ✅ | `app/models/utm_link.rb`, `utm_link_visit.rb`, `utm_link_driven_sale.rb`, controllers/API | Confirmé. | À porter avec analytics créateur. |
| Expédition physique par pays | ✅ | `app/models/shipping_destination.rb`, `shipment.rb`, produit `is_physical` | Confirmé. | Futur produits physiques Baobart. |
| Helpers réutilisables CDN/currency/signed URL | ✅ | `CurrencyHelper`, `WithCdnUrl`, `SignedUrlHelper` | Confirmé. | Déjà inspiré par `money.ts`, futur media helpers. |

---

## 3. Corrections à apporter au plan Baobart

### 3.1 Chiffres à rendre commit-dépendants

Le plan cite des volumétries qui ont changé. Sur le commit `182df6a8`, les chiffres vérifiés sont :

- Store Agent : **83 endpoints**.
- Workers Sidekiq : **264 fichiers** sous `app/sidekiq`.
- Mailers : **24 fichiers** sous `app/mailers`.
- Policies : **66 fichiers** sous `app/policies`.
- Mobile : **20 contrôleurs** sous `app/controllers/api/mobile`, ou **24** si on ajoute `api/v2/walks`.

Recommandation : remplacer les chiffres absolus par :

> « Relevé sur commit X : N. À recompter à chaque nouvelle passe. »

### 3.2 Types de produits

La phrase « 12 types de produits » est vraie si on lit `Link::NATIVE_TYPES_TO_TAX_CODE`, mais elle peut induire en erreur.

Dans Gumroad, un produit est surtout un `Link` avec :

- un `native_type` parmi 12 valeurs ;
- des flags (`is_physical`, `is_bundle`, `is_recurring_billing`, etc.) ;
- des relations (`Preorder`, `Commission`, `Call`, `BundleProduct`, `ProductInstallmentPlan`, `Price`, etc.).

Pour Baobart, `ProductType` peut rester simple en M0, mais il ne faut pas croire qu'un enum suffira à reproduire Gumroad.

### 3.3 RGPD

Le plan affirme une conformité RGPD. Le dépôt contient clairement :

- soft deletion ;
- précautions sur données sensibles dans `PaperTrail` ;
- logique d'anonymisation/suppression à plusieurs endroits.

Mais je recommande une passe RGPD dédiée avant d'écrire « module RGPD complet », car ce n'est pas une seule brique isolée.

### 3.4 Intégrations Zoom/Google Calendar

Discord et Circle sont confirmés par services dédiés. Zoom/Calendar demandent une passe ciblée supplémentaire pour identifier exactement :

- création d'événements ;
- génération de liens ;
- scopes ;
- webhooks ;
- stockage des tokens.

Le plan peut les garder comme inspiration, mais devrait marquer ce point comme **à vérifier finement**.

---

## 4. Ce qui est déjà bien porté dans Baobart

| Brique Gumroad | État Baobart |
|---|---|
| Argent en entiers | ✅ `lib/i18n/money.ts` |
| Frais direct/découverte | ✅ `lib/domain/fees.ts` |
| Purchase state ligne par ligne | ✅ `OrderItem.state` |
| Refunds partiels | ✅ `Refund` + `refundedAmount` |
| Ledger / BalanceTransaction | ✅ modèle + service |
| Soldes journaliers | ✅ `Balance` |
| Triggers argent | ✅ migrations garde-fous |
| Payout schedule avec cycle vs versement | ✅ `lib/payments/payout-schedule.ts` |
| LowBalanceFraudCheck | ✅ `lib/domain/trust.ts` |
| Delivery decision + quotas | ✅ `lib/domain/delivery.ts`, `downloads.ts` |
| Product families + feed cursor | ✅ `lib/feed/*` |
| Staff Picked | ✅ `Product.isStaffPicked` |
| Team roles | ✅ `TeamMembership` + `TeamRole` |
| Passkey model | ✅ `Passkey` dans Prisma, implémentation absente |
| Media/upload reservation | ✅ modèles Prisma, implémentation absente |

---

## 5. Ce qui reste à porter en priorité depuis Gumroad

### P0 / P1 avant production

1. **Checkout et webhooks idempotents**
   - Gumroad sépare sessions, purchases, charges, états, webhooks.
   - Baobart doit implémenter la même discipline avant tout paiement réel.

2. **Upload direct + livraison signée**
   - Gumroad a `DirectUploadsController` + `UrlRedirect`.
   - Baobart a les modèles et décideurs, pas encore les routes S3/MinIO.

3. **Jobs asynchrones**
   - Gumroad repose massivement sur Sidekiq.
   - Baobart doit introduire BullMQ/Inngest rapidement : payouts, emails, previews, modération, compteurs.

4. **Rate limiting / anti-bot**
   - Gumroad combine Rack Attack et reCAPTCHA score-based.
   - Baobart doit au minimum protéger auth, recherche, checkout, download.

5. **Authorization layer**
   - Gumroad a des policies nombreuses.
   - Baobart doit introduire une couche d'autorisation avant admin/équipes/API.

### P2 / après MVP

1. Store Agent complet.
2. Affiliations avancées.
3. Codes promo riches.
4. Upsells/cross-sells.
5. Paniers abandonnés.
6. UTM et analytics créateur.
7. Staff/admin CMS complet.
8. Produits physiques.
9. API publique OAuth.
10. Mobile Walks.

---

## 6. Verdict global

Le plan Baobart est **globalement véridique** : les grandes briques attribuées à Gumroad existent réellement dans le dépôt.

Les points à corriger sont surtout :

- les chiffres absolus, qui changent selon le commit ;
- les formulations trop simples sur les types de produits ;
- la nécessité de distinguer inspiration prouvée et contrat technique exact pour certaines intégrations ;
- l'écart entre « présent dans Gumroad » et « déjà portable tel quel dans Baobart ».

La meilleure stratégie reste :

1. utiliser Gumroad comme **spécification métier**, pas comme code à copier ;
2. porter d'abord les invariantes : argent, delivery, trust, idempotence ;
3. ne porter ensuite les features croissance qu'après checkout/upload/email/jobs solides.
