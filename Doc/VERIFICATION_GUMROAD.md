# Vérification du plan contre le dépôt Gumroad

**Relevé des écarts entre `PLAN_REFONTE_BAOBART_GUMROAD.md` (v10) et le code réel**
**Document V — v1.0 — 2 août 2026**

---

## 0. Pourquoi ce document

Le plan directeur v10 décrit ce que le dépôt Gumroad contient, à partir d'une
exploration menée sans exécuter ni lire le code ligne à ligne. Ce document
consigne ce qui a été **vérifié dans les fichiers**, et distingue trois cas :

| Marque | Sens |
|---|---|
| ✅ | Affirmation du plan **confirmée** dans le code |
| ❌ | Affirmation du plan **erronée** ou trompeuse |
| ➕ | Élément **absent du plan**, découvert à la lecture |

Il existe pour une raison précise : dans six mois, personne ne saura plus
distinguer, dans le plan, ce qui avait été vérifié de ce qui avait été supposé.
Ce document est la trace. Le plan sera corrigé, mais c'est ici qu'on retrouvera
*sur quoi* la correction s'appuie.

### Source de référence

| | |
|---|---|
| Dépôt | `antiwork/gumroad` — licence **MIT** |
| Commit | `a475e3f9e5f5b3e6303cdd74448b3703dca62920` (1er août 2026) |
| Portée lue | `app/`, `lib/`, `db/`, `config/` — 3 082 fichiers Ruby |
| Nature | **Spécification**. Aucun code Ruby n'est copié ; la marque Gumroad n'est jamais réutilisée. |

Le clone est local et en lecture seule, **hors du dépôt Baobart**, pour qu'aucun
fichier sous licence tierce n'entre dans notre historique git.

---

## 1. Synthèse

Sur les affirmations vérifiées : **9 confirmées, 6 erronées, 8 découvertes**.

Les trois erreurs qui changent une décision :

1. **Les devises africaines ne servent pas à fixer des prix chez Gumroad** (§3.2).
   Il n'y a rien à porter pour la tarification en FCFA : c'est 100 % à écrire.
2. **Le « boost de découverte » n'est pas de la publicité au CPM** (§3.6-D).
   C'est un partage de revenus. Le créateur n'avance rien — nettement plus
   adapté à un marché où les créateurs n'ont pas de trésorerie.
3. **Gumroad ne facture pas un taux unique** (§2.4, §2.8-1).
   Il facture selon qui a amené l'acheteur. Cela dissout le dilemme « 10 % ou
   20 % » au lieu de le trancher.

---

## 2. Le modèle économique

### 2.1 ❌ La commission n'est pas un taux unique — §2.4, §2.8-1

**Ce que dit le plan** : hésite entre 10 % et 20 %, cherche un taux unique.

**Ce que fait Gumroad** (`app/models/purchase.rb`, `calculate_fees`) :

```
taux ‰ = commission (100) + processeur (29 si la charge passe par Gumroad)
si la vente vient de Discover :
    taux ‰ += 300 − 100 − 29           →  taux total = 300
frais variables = arrondi(prix × taux ‰ / 1000)
frais fixes     = vente Discover ? 0 : (50 ¢ Gumroad + 30 ¢ processeur)
ce que touche le vendeur = prix − frais totaux
```

| Origine de la vente | Taux | Part fixe |
|---|---|---|
| Le créateur amène l'acheteur | **10 %** (+2,9 % si Gumroad encaisse) | 0,50 $ + 0,30 $ |
| La marketplace amène l'acheteur | **30 %** | **aucune** |

**Constantes vérifiées** : `GUMROAD_FLAT_FEE_PER_THOUSAND = 100`,
`GUMROAD_DISCOVER_FEE_PER_THOUSAND = 300`,
`GUMROAD_DISCOVER_EXTRA_FEE_PER_THOUSAND = 100`,
`GUMROAD_FIXED_FEE_CENTS = 50`, `PROCESSOR_FEE_PER_THOUSAND = 29`,
`PROCESSOR_FIXED_FEE_CENTS = 30`.

> ⚠️ **`_per_thousand` signifie « pour mille », pas « par millier d'impressions ».**
> `100` se lit **10 %**. C'est un dénominateur de pourcentage. Cette lecture
> erronée est à l'origine de l'erreur §3.6-D ci-dessous.

**Autres règles vérifiées** : un produit gratuit ne coûte rien
(`price_cents == 0 → fee_cents = 0`) ; chaque vendeur peut porter un
`custom_fee_per_thousand` négocié ; `waive_gumroad_fee_on_new_sales?` met la
commission à zéro.

**Conséquence pour Baobart** : porté dans `lib/domain/fees.ts` avec deux
régimes, `DIRECT` et `DECOUVERTE`. Baobart peut annoncer **10 %** — le chiffre
agressif du §2.4 — sans sacrifier sa marge, puisque le feed se rémunère sur les
ventes qu'il génère réellement. Le §2.8-1 n'a plus à être tranché tel qu'il est
posé.

### 2.2 ❌ Le « boost de découverte » — §3.6-D

**Ce que dit le plan** : « les vendeurs paient pour plus de visibilité (frais
par millier d'impressions) ».

**Ce que fait Gumroad** : la colonne `links.discover_fee_per_thousand` vaut
**100 par défaut** (10 %). Le vendeur qui veut être mieux classé la **monte
jusqu'à 300** — `DEFAULT_BOOSTED_DISCOVER_FEE_PER_THOUSAND = 300`. Il accepte
donc de céder 30 % au lieu de 10 % **sur les ventes issues du feed**. Aucune
impression n'est vendue, aucun budget n'est avancé.

**Conséquence pour Baobart** : c'est un bien meilleur modèle que le CPM pour
l'Afrique de l'Ouest. Vendre des impressions à des créateurs sans trésorerie
revient à leur vendre du risque ; ici le créateur ne paie que s'il a vendu.
À unifier avec le « sponsoring » du §2.9, qui reste, lui, un vrai achat d'espace
destiné aux annonceurs — ce sont deux produits différents.

---

## 3. Les devises et les prix

### 3.1 ❌ « Devises africaines définies + conversion » — §3.2

**Ce que dit le plan** : range « XOF, NGN, GHS définis (+ AOA, BWP, RWF, TZS…)
+ conversion » dans le tableau **« ce qui existe et sert Baobart »**.

**Ce que fait Gumroad** (`app/business/payments/currency.rb`) : le fichier
sépare explicitement deux listes, et le commentaire du second bloc est sans
ambiguïté :

> ces devises servent uniquement à créer des comptes Stripe Connect et à faire
> des versements ; elles ne peuvent pas servir de devise par défaut d'un compte
> ni à fixer le prix d'un produit ; les helpers de conversion ne les supportent
> pas.

XOF, NGN, GHS, KES et MAD sont **dans ce second bloc**. Sur les **19** devises
capables de porter un prix produit (`config/currencies.json`), **une seule est
africaine : ZAR**.

**Conséquence pour Baobart** : il n'y a **rien à porter** pour la tarification
en FCFA — ni pricing, ni conversion, ni arrondi, ni prix plancher. Le §6.1 avait
raison de la traiter comme à construire ; le §3.2 la présente à tort comme
acquise. C'est un poste de travail entier, pas une adaptation.

### 3.2 ✅ Comptes bancaires par pays — §3.2

`app/models/cote_d_ivoire_bank_account.rb` existe : IBAN CI de 28 caractères,
`currency → XOF`, validation de structure écrite à la main parce que la
bibliothèque Ibandit rejette à tort tous les IBAN ivoiriens valides. Le pattern
« un modèle de compte bancaire par pays » est réel et transposable.

### 3.3 ➕ Prix plancher par devise

Chaque devise porte un `min_price` (99 pour l'USD, soit 0,99 $). Il sert à deux
choses : empêcher qu'un code promo fasse passer un produit sous ce seuil (sauf
à l'amener exactement à zéro), et servir de plancher au calcul de parité de
pouvoir d'achat — `max(facteur × prix, min_price)`.

**Conséquence pour Baobart** : il faudra fixer un plancher en FCFA. Sans lui,
les parts fixes rendent les petits produits déficitaires pour le créateur.
`minimumViablePrice()` est déjà dans `lib/domain/fees.ts`.

---

## 4. Le modèle produit

### 4.1 ❌ « 11 types de produits » — §3.4-E

Il y en a **12**, et le plan se trompe des deux côtés
(`NATIVE_TYPES_TO_TAX_CODE` dans `app/models/link.rb`) :

| Type | Statut |
|---|---|
| digital, ebook, membership, physical, bundle, commission, call, coffee | vivants — le plan les liste ✅ |
| **course** | vivant — **absent du plan** ➕ |
| podcast, newsletter, audiobook | **`LEGACY_TYPES`, dépréciés** ❌ |

**Conséquence pour Baobart** : `course` (formation) est un type pertinent, à
ajouter à `ProductType`. À l'inverse, le plan suggère d'« activer
progressivement » podcast et audiobook alors que Gumroad les a lui-même
abandonnés — mauvais signal à suivre.

Groupement utile relevé : `SERVICE_TYPES = [commission, call, coffee]`, qui
recoupe exactement le bloc « Services » du plan.

### 4.2 ✅ Sélection éditoriale « Staff Picked » — §3.10-A

Confirmé : `staff_picked_product` est un enregistrement séparé avec suppression
douce, et `staff_picked_at` dérive de son horodatage. Le plan est exact.

### 4.3 ➕ Prix libre et prix suggéré

Les produits portent `customizable_price` (l'acheteur fixe son prix) et
`suggested_price_cents`. Utile pour le type « coffee » et le soutien libre.

---

## 5. L'argent : soldes et grand livre

### 5.1 ❌ La forme de `Balance` — blueprint §4.3

**Ce que dit le blueprint** : une ligne par vendeur, avec trois colonnes
`unpaid / held / paid`.

**Ce que fait Gumroad** (`app/models/balance.rb`, `db/schema.rb`) : une ligne
par **(vendeur, compte marchand, jour)**, chacune avec sa propre machine à
états :

```
unpaid → processing → paid
unpaid → forfeited
```

Avec une invariante : *les montants ne sont modifiables qu'en état `unpaid`*.

**Conséquence pour Baobart** : c'est le découpage journalier qui rend le
versement par lot possible — sans lui, impossible de dire « voici exactement ce
qui part mercredi ». Corrigé dans le schéma, avec l'invariante tenue par un
trigger Postgres.

### 5.2 ❌ `BalanceTransaction` n'a pas un montant mais six — blueprint §4.3

Colonnes réelles : `issued_amount_{currency, gross_cents, net_cents}` et
`holding_amount_{currency, gross_cents, net_cents}`.

- **issued** : ce qui a été encaissé, dans la devise de l'acheteur ;
- **holding** : ce que la plateforme doit au vendeur, dans sa devise de
  versement ;
- **gross / net** : avant et après frais, taxes et part d'affiliation.

Le fichier documente deux incidents de production causés par une mauvaise devise
sur ces lignes — dans les deux cas l'argent du vendeur est **bloqué**, pas
seulement mal étiqueté.

**Conséquence pour Baobart** : c'est précisément le cas diaspora — un acheteur
paie en EUR à Paris, un créateur est crédité en XOF à Abidjan. Avec un montant
unique, on perd soit l'encaissement réel, soit la dette réelle. Corrigé.

### 5.3 ❌ `refunded` n'est pas un état d'achat — blueprint §4.0

Les états de `purchase_state` sont : `in_progress`, `successful`, `failed`,
`not_charged`, deux états cadeau, quatre états de précommande, deux états de
test. **`refunded` n'en fait pas partie.**

Un remboursement est un enregistrement `Refund` avec son propre montant, plus un
drapeau sur l'achat.

**Conséquence pour Baobart** : un statut « remboursé » est incapable
d'exprimer un remboursement **partiel**, qui est le cas courant. Corrigé :
`Refund` est un modèle, `OrderItem.refundedAmount` cumule.

### 5.4 ➕ L'état de l'argent vit sur la ligne, pas sur la commande

Chez Gumroad la machine à états est portée par `Purchase` — l'équivalent de
notre `OrderItem` — et non par la commande. Un panier multi-vendeurs produit une
charge par vendeur, dont l'une peut échouer sans annuler les autres (c'est le
mécanisme des « charges groupées » du §3.8-F). Corrigé.

---

## 6. Les outils de croissance

### 6.1 ❌ Le cookie d'affiliation n'est pas de 7 jours — §10.1

Il y a **deux** durées :

| Programme | Durée | Portée |
|---|---|---|
| `DirectAffiliate` (entre créateurs) | **30 jours** | les produits que le vendeur lui ouvre |
| `GlobalAffiliate` (ambassadeurs) | **7 jours** | uniquement les produits présents dans Discover |

Le plan applique 7 jours aux deux. Pour l'affiliation entre créateurs — celle
qui doit « renforcer la communauté » (§3.4-C) — c'est quatre fois trop court.

### 6.2 ➕ Un affilié direct ne touche rien sur une vente issue du feed

`DirectAffiliate#eligible_for_purchase_credit?` commence par
`return false if opts[:was_recommended]`.

C'est le principe des deux régimes de frais appliqué à l'affiliation : celui qui
a amené l'acheteur est payé, et là c'est la plateforme. Sans cette règle,
Baobart verserait une commission d'apport à quelqu'un qui n'a rien apporté.

Deux finesses à conserver : un affilié ne touche rien sur son propre achat ; et
le retrait d'un vendeur du programme s'applique aux **renouvellements**
d'abonnements déjà référés — sinon il paie 10 % par mois à vie sur un parrainage
qu'il ne peut plus dénoncer. Le code précise qu'on ne re-juge délibérément *pas*
les autres conditions des années plus tard, pour ne pas retirer rétroactivement
une commission légitimement gagnée.

### 6.3 ✅ Calcul de la part d'affilié — §3.4-C

```
part affilié = (basis_points / 10 000) × prix affiché
             − (basis_points / 10 000) × frais de la plateforme
```

L'affilié touche un pourcentage du **brut**, diminué de sa quote-part de la
commission plateforme ; un drapeau `bears_affiliate_fee?` bascule cette charge
sur le vendeur. Les `basis_points` peuvent être définis **par produit**. Arrondi
au plancher. Porté dans `lib/domain/fees.ts`.

### 6.4 ❌ Les codes promo font trois fois plus que ce que décrit le §10.2

Au-delà du « % ou montant fixe, durée, usages max, exclusions,
anti-résiliation » (`app/models/offer_code.rb`) :

- **remises par ancienneté** — `ownership_duration_tiers`, jusqu'à
  `MAX_OWNERSHIP_DURATION_TIERS = 10` paliers : la remise varie selon depuis
  combien de temps l'acheteur possède le produit ou l'abonnement ;
- **remises par défaut**, appliquées sans qu'aucun code soit saisi ;
- **ciblage des clients existants** — les inclure ou les exclure ;
- **codes universels**, valables sur toute la boutique ;
- **codes sans code** : un `OfferCode` rattaché à un upsell n'a pas de chaîne
  saisissable, il ne porte que la remise ;
- **évaluation par acheteur** (`evaluate_for_buyer`) — la remise n'est pas une
  valeur figée ;
- **plancher de prix** : un code ne peut pas faire passer un produit sous le
  prix minimum de sa devise, sauf à l'amener exactement à zéro.

Les remises par ancienneté sont un levier de fidélisation que le plan ne
mentionne nulle part.

### 6.5 ❌ Upsell : deux mécanismes, et au checkout — §10.5

Un seul modèle, un booléen `cross_sell` :

- **upsell** — faire monter en gamme sur *le même* produit (variante
  supérieure) ;
- **cross-sell** — proposer un *autre* produit, déclenché par le contenu du
  panier.

Et cela se joue **au moment du checkout**, pas seulement après l'achat comme le
décrit le plan. La remise est portée par un `OfferCode` rattaché. `paused`
existe séparément de `deleted` : on suspend une offre sans la perdre.

### 6.6 ✅ Échelonnement des paiements — §10.4

Exact : le reste va sur la **première** échéance
(`i.zero? ? base_price + remainder : base_price`).

Deux règles à ajouter au plan : seuls `call`, `course`, `digital`, `ebook` et
`bundle` y ont droit — ni abonnements, ni précommandes, ni prix libre ; et
chaque tranche doit rester au-dessus du prix minimum de la devise.

### 6.7 ✅ Services en deux temps — §3.1, §6.2

`COMMISSION_DEPOSIT_PROPORTION = 0.5`, statuts
`in_progress / completed / cancelled`. Le solde est calculé comme
`(acompte / 0,5) − acompte`, et le pourboire éventuel est mis à l'échelle de la
même façon. Le plan est exact.

---

## 7. Les passerelles de paiement

### 7.1 ➕ `ChargeProcessor` est directement transposable au mobile money

`app/business/payments/charging/charge_processor.rb` définit un contrat de 20
méthodes autour d'un cycle `créer l'intention → confirmer → encaisser`, avec une
fenêtre d'authentification de **15 minutes** (`TIME_TO_COMPLETE_SCA`), une
normalisation des webhooks (`handle_event`) et un `holder_of_funds` qui indique
qui détient l'argent.

**Conséquence pour Baobart** : cette fenêtre existe chez Gumroad pour
l'authentification forte européenne, mais **le mobile money a exactement la même
forme** — on crée une demande, l'acheteur valide sur son téléphone par OTP ou
USSD, l'encaissement se confirme ensuite. Orange Money, Wave et MTN entrent dans
ce contrat sans le déformer. C'est l'abstraction la plus directement réutilisable
du dépôt.

---

## 8. Ce qui reste à vérifier

Ce relevé couvre le bloc commerce et les outils de croissance. N'ont pas encore
été ouverts :

- le moteur de confiance (§3.8) — machine à états de risque, anti-fraude ;
- les versements (§3.9-A) — fréquence, rails par pays, projection ;
- la découverte et les recommandations (§3.7-E) ;
- l'assistant IA (§3.4-A) — le chiffre de « 84 endpoints » n'est pas vérifié ;
- les workers (§3.6-B) — le chiffre de « 226 workers » n'est pas vérifié ;
- la livraison des fichiers et les URLs signées (§3.9-C).

Les chiffres cités par le plan dans ces sections doivent être considérés comme
**non vérifiés** tant qu'ils ne figurent pas ici.
