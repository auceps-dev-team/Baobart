# Vérification du plan contre le dépôt Gumroad

**Relevé des écarts entre `PLAN_REFONTE_BAOBART_GUMROAD.md` (v10) et le code réel**
**Document V — v2.0 — 31 août 2026**

> **Deux passes, un mois d'écart.** Les sections 1 à 15 datent du 2 août et
> restent valables sauf mention contraire ; la **section 12** consigne la
> seconde passe. Le dépôt référent a reçu **581 commits** dans l'intervalle, et
> une couche entière y est apparue que ni le plan ni la première passe ne
> connaissaient.

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
| Commit — passe 1 | `a475e3f9e5f5b3e6303cdd74448b3703dca62920` (1er août 2026) |
| Commit — passe 2 | `3fd2d6663da864777ab45a0a11b5f1776a1041c6` (31 août 2026) |
| Écart entre les deux | **581 commits** |
| Portée lue | `app/`, `lib/`, `db/`, `config/` — 3 082 fichiers Ruby à la passe 1 |
| Nature | **Spécification**. Aucun code Ruby n'est copié ; la marque Gumroad n'est jamais réutilisée. |

Le clone est local et en lecture seule, **hors du dépôt Baobart**, pour qu'aucun
fichier sous licence tierce n'entre dans notre historique git.

---

## 1. Synthèse

Sur les affirmations vérifiées : **19 confirmées, 14 erronées, 30 découvertes**.

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

> **➕ RÉALISÉ en v1.30.0-1.32.0** — `lib/payments/encaissement/contrat.ts`.
> La prédiction s'est vérifiée : le contrat tient en cinq méthodes
> (`configure`, `ouvrir`, `authentifier`, `lire`, `confirmer`) plutôt que
> vingt, parce qu'on n'a ni cartes enregistrées ni prélèvement récurrent.
>
> **Un écart assumé sur la fenêtre.** `TIME_TO_COMPLETE_SCA` vaut quinze
> minutes chez Gumroad ; notre péremption vaut **vingt-quatre heures**. Le
> mobile money n'a pas le rythme de l'authentification bancaire européenne :
> l'invite part sur un téléphone qui peut être hors réseau ou dans une autre
> pièce, et les opérateurs rappellent parfois avec des heures de retard après
> un incident chez eux. Fermer à quinze minutes fabriquerait le pire cas
> possible — un acheteur qui a payé, et une commande refermée avant qu'on le
> sache.
>
> Ce n'est donc pas une fenêtre d'autorisation, c'est du ménage. Le cas où un
> paiement arrive malgré tout sur une commande refermée est traité à part, et
> **bruyamment** : aucun code ne peut le réparer seul, il faut qu'un humain le
> voie.
>
> `holder_of_funds` n'a **pas** été transposé : il désigne qui détient l'argent
> entre l'encaissement et le versement, ce qui n'a de sens qu'avec plusieurs
> détenteurs. Baobart n'en a qu'un pour l'instant.

---

## 8. Les versements — §3.9-A

Vérifié dans `app/modules/user/payout_schedule.rb`,
`app/business/payments/payouts/payout_rail_schedule.rb`, `app/models/payment.rb`
et `app/services/instant_payouts_service.rb`.

### 8.1 ✅ Jour de versement par rail — le plan est exact

Les versements ne sont pas une seule exécution hebdomadaire : plusieurs jobs
tournent des jours différents, chacun payant les vendeurs d'un rail donné.
Banque philippine le mardi, britannique le mercredi, américaine le jeudi,
PayPal le vendredi.

**Détail de conception à retenir** : la table des jours est **dérivée du fichier
cron lui-même**. La projection et l'exécution lisent la même source, donc elles
ne peuvent pas diverger — ajouter un type de compte à un créneau cron déplace
automatiquement la date annoncée. Le commentaire précise que cette table vivait
avant uniquement dans le cron, et que tout ce qui voulait annoncer une date se
trompait pour chaque rail non-vendredi.

### 8.2 ➕ Il y a DEUX dates, pas une — le point central

C'est la découverte structurante de cette section, et elle est absente du plan.

| | Rôle |
|---|---|
| **Date de cycle** | Ancrée un vendredi. Décide **quelles ventes** entrent dans le versement. |
| **Date de versement** | Le jour où le rail du créateur est exécuté, dans la semaine de ce cycle. C'est la date qu'on **montre**. |

Un vendeur payé le mardi 28 juillet et un vendeur payé le vendredi 31 touchent
**les mêmes ventes** — celles arrêtées au 24 — parce que la période est ancrée
sur le cycle, jamais sur le jour de paiement.

Le code documente le bug que la confusion produit : comparer un lot de
versements à la date propre du vendeur fait paraître un lot exécuté plus tard
dans la semaine — un job réessayé, par exemple — comme appartenant à la semaine
suivante, et **saute tous les vendeurs qu'il contenait**.

### 8.3 ❌ Quatre fréquences, pas deux — §3.9-A

Le plan annonce « `weekly` ou `monthly` » plus l'instantané quotidien. Il y en a
**quatre** : `DAILY`, `WEEKLY`, `MONTHLY`, **`QUARTERLY`**.

### 8.4 ➕ Délai de rétention et seuil minimum

- **`PAYOUT_DELAY_DAYS = 7`** : une vente n'est jamais versable avant sept
  jours. C'est la marge qui absorbe impayés et litiges.
- **Seuil minimum par vendeur** : en dessous, aucun versement — la somme
  **roule** sur le cycle suivant et s'y cumule. Elle n'est jamais perdue, et le
  vendeur reçoit une note expliquant le report.

### 8.5 ➕ La projection utilise le même modèle que le versement réel

`upcoming_payouts` construit des objets `Payment` **non sauvegardés**. La
projection a donc exactement la forme de la chose projetée : même modèle, mêmes
champs, mêmes soldes rattachés. Il n'existe pas de second modèle « prévision »
qui pourrait diverger du vrai.

### 8.6 ❌ Huit états de versement, pas cinq — blueprint §4.0

États réels de `Payment` : `creating`, `processing`, `unclaimed`, `completed`,
`cancelled`, `failed`, `reversed`, `returned`.

Le blueprint en prévoyait cinq. Manquaient `unclaimed` (envoyé, en attente
d'action du bénéficiaire), `cancelled`, et surtout **`returned`** — l'argent qui
revient. Et `completed → returned` est une transition valide : **un versement
réussi n'est pas définitif**, il peut rebondir ensuite.

**La règle à ne pas perdre** : un versement qui passe en `cancelled` ou `failed`
**remet ses soldes en `unpaid`**, pour qu'ils soient repris au cycle suivant.
C'est ce qui referme la boucle entre l'état du solde et celui du versement ;
sans elle, l'argent d'un créateur disparaît dans un versement raté.

### 8.7 ➕ Versement instantané : plancher, plafond et découpage

- un **montant minimum** (100 $) sous lequel la demande est refusée ;
- un **montant maximum par versement** : au-delà, les soldes sont **découpés en
  plusieurs versements** qui restent chacun sous le plafond ;
- une éligibilité vérifiée avant tout (`instant_payouts_supported?`) ;
- le versement quotidien vit **hors du cycle hebdomadaire** : il paie le solde
  instantanément versable de la veille, demain.

### 8.8 Conséquence pour Baobart

Porté dans **`lib/payments/payout-schedule.ts`** : les deux dates, les quatre
fréquences, le délai de rétention, le seuil qui fait rouler la somme, et la
projection des prochaines échéances. Les rails deviennent les opérateurs mobile
money et le virement bancaire par pays, chacun avec son jour — **à confirmer
avec chaque opérateur**, puisque ce sont leurs fenêtres de compensation qui
décident, pas nous.

Le délai de sept jours, le seuil minimum et le jour d'ancrage sont regroupés
dans une configuration explicite : ce sont des décisions commerciales, pas des
constantes techniques.

---

## 9. Le moteur de confiance — §3.8

Vérifié dans `app/models/user.rb` (machine à états `user_risk_state`),
`app/models/concerns/user/low_balance_fraud_check.rb`, `app/models/blocked_object.rb`
et `app/services/radar/seller_risk_stats_service.rb`.

**C'est la section du plan qui tient le mieux.** Le §3.8 est globalement exact ;
les corrections portent sur des détails qui changent le comportement, pas sur la
description générale.

### 9.1 ✅ Machine à états et effets de suspension — §3.8-A

Les 7 états et les 7 événements sont confirmés. Les effets à la suspension le
sont aussi, **tous les six**, plus un que le plan mentionnait déjà :

sessions invalidées · produits désactivés · IP bloquée · abonnés retirés ·
domaine personnalisé supprimé · autres comptes du vendeur suspendus ·
ajout au filtre anti-abus Gmail.

À la réintégration : IP débloquée, produits et autres comptes réactivés, retrait
du filtre anti-abus.

**Détail non relevé par le plan** : à l'inscription, une validation refuse un
e-mail qui est une **variante Gmail d'un compte suspendu** (les points et les
`+alias` désignent la même boîte). C'est de l'anti-contournement, pas de la
validation d'adresse.

### 9.2 ➕ Le garde-fou est posé à l'entrée, pas à la sortie

Le plan mentionne « une protection contre les lectures périmées ». Le mécanisme
mérite d'être compris, parce qu'il est contre-intuitif.

La garde `refuse_unauthorized_seller_suspension_clear` n'est pas posée sur la
*sortie* d'un état suspendu, mais sur l'**entrée** dans les trois états qui
réhabilitent : `compliant`, `on_probation` **et** `not_reviewed`.

Deux raisons, toutes deux documentées dans le code :

1. **La probation réhabilite autant que la conformité.** Elle remet les produits
   en vente exactement comme `compliant`. On pourrait croire que seule la
   conformité lève une suspension : c'est faux, et `not_reviewed` la lève aussi
   en ramenant le compte à son état initial.
2. **L'objet en mémoire peut être plus vieux que la ligne en base.** Le chemin
   réaliste n'est pas un humain dans l'interface d'administration : c'est le
   contrôle de solde négatif, qui décide d'agir en lisant `suspended?` sur une
   copie en mémoire. Au moment où il écrit, la ligne a pu être suspendue par
   quelqu'un d'autre. C'est précisément cette lecture périmée que la garde
   existe pour rattraper.

Lever une suspension exige donc de le dire explicitement (`clear_suspension:
true`) : une revue de routine « ce compte a l'air correct » ne peut pas défaire
une suspension qu'elle n'a jamais examinée.

### 9.3 ❌ Le contrôle de solde négatif a deux seuils, pas un — §3.8-B

**Ce que dit le plan** : « solde sous −100 $ → probation ; si le solde se
rétablit → probation levée automatiquement ».

**Ce que fait le code** : il faut descendre sous **−100 $** pour être
sanctionné, mais remonter au-dessus de **+100 $** pour en sortir.

Cet écart n'est pas un détail : avec un seuil unique, un solde qui oscille
autour ferait entrer et sortir le créateur de probation en boucle. Le plan parle
de « rétablissement » sans dire qu'il faut repasser franchement au positif.

**Deuxième correction** : le plan écrit « probation (2 mois) », comme si la
sanction durait deux mois. Ce n'est pas ça — c'est un **délai de carence** : le
même contrôle ne peut pas re-sanctionner le même compte avant deux mois. La
probation, elle, dure jusqu'à ce que le solde se rétablisse.

### 9.4 ➕ Les conditions de la levée automatique

Le plan dit « sous conditions ». Elles sont au nombre de trois, et chacune
protège d'une erreur différente :

1. **La probation doit avoir été posée par ce contrôle lui-même.** Une probation
   décidée par un administrateur ne se lève pas toute seule.
2. **Aucune décision de risque plus récente ne doit exister.** Si quelqu'un a
   tranché depuis, le contrôle ne revient pas dessus.
3. **Le compte ne doit pas être suspendu.** Une suspension survenue pendant que
   le contrôle était en vol surclasse un rétablissement de solde : ce contrôle
   ignore *pourquoi* le compte a été suspendu, donc il n'y touche jamais.

Et la levée **restitue l'état d'avant** (`compliant` ou `not_reviewed`), relu
dans l'historique. Faute de trace, elle retombe sur `not_reviewed` — jamais sur
`compliant`, qui accorderait une confiance que personne n'a décidée.

**Conséquence pour Baobart** : cela impose une table de journal des décisions de
risque. Sans elle, la levée automatique ne peut pas distinguer sa propre
décision de celle d'un humain. C'est `RiskStateChange` dans le schéma.

### 9.5 ➕ Les deux écritures sont transactionnelles

Couper les remboursements et poser la probation doivent réussir ou échouer
ensemble. Le code le dit : sans transaction, un refus tardif de la probation
laisserait le compte avec ses remboursements coupés **par un traitement censé
ignorer les comptes suspendus** — donc des remboursements bloqués que personne
n'a décidé de bloquer.

### 9.6 ✅ Blocage d'IP à six mois — §3.6-A

Confirmé, et la raison mérite d'être reprise telle quelle : **les adresses IP
sont réattribuées**. Un blocage permanent finirait par punir quelqu'un qui n'a
rien fait — et ferait grossir la liste indéfiniment.

À noter : débloquer n'efface pas l'enregistrement, cela vide seulement la date
de blocage. La trace reste.

### 9.7 ➕ Statistiques de risque par vendeur

Fenêtre glissante de **90 jours** : nombre de ventes réussies, alertes précoces
de fraude ventilées par niveau de risque et par type, nombre de litiges et
surtout **taux** de litiges. C'est le taux, pas le compte brut, qui distingue un
gros vendeur d'un vendeur à problèmes.

### 9.8 Conséquence pour Baobart

Porté dans **`lib/domain/trust.ts`** : les 7 états, les transitions autorisées,
le garde-fou à l'entrée des états réhabilitants, les effets de bord retournés
sous forme de liste, et le contrôle de solde à deux seuils avec ses trois
conditions de levée.

Le module **ne touche à rien** : il décide et retourne les effets à exécuter.
Pour du code capable de couper les revenus d'un créateur, pouvoir le tester sans
base ni réseau n'est pas un confort.

Les deux seuils sont une **décision Baobart** — seul le principe des deux seuils
distincts est porté, pas les montants en dollars.

---

## 10. La livraison des fichiers — §3.9-C, §3.9-D, §13

Vérifié dans `app/helpers/signed_url_helper.rb`, `app/models/url_redirect.rb`,
`app/controllers/url_redirects_controller.rb` et `app/models/consumption_event.rb`.

### 10.1 ✅ URLs signées avec expiration — §3.9-C

Confirmé. Chaque achat reçoit une URL signée à durée de vie limitée, avec
`response-content-disposition=attachment` pour forcer le téléchargement sous le
nom d'origine. Trois états d'indisponibilité existent bien : accès expiré,
location expirée, abonnement inactif.

### 10.2 ➕ La durée de validité dépend de la TAILLE du fichier

C'est la découverte importante, et elle est absente du plan.

```
durée = borner( taille_octets / débit_supposé , plancher , plafond )
```

Chez Gumroad : plancher **10 minutes**, plafond **3 heures**, vidéos **12
heures**, et un débit supposé de **~51 200 o/s (50 Kio/s)**.

Une durée fixe condamnerait soit les gros fichiers — l'URL expire au milieu du
téléchargement — soit la sécurité des petits, en les laissant partageables trop
longtemps.

**Conséquence pour Baobart, et elle est sérieuse** : 50 Kio/s est une hypothèse
optimiste sur une connexion mobile ouest-africaine. Un pack de 200 Mo tiendrait
tout juste dans les 3 heures à ce débit — mais à 12,8 Ko/s, un plancher 3G
réaliste, il faut plus de **4 h 30**. Avec les valeurs de Gumroad, l'URL
expirerait avant la fin et l'acheteur, qui a payé, verrait son téléchargement
échouer.

Nous retenons donc **12 800 o/s** et un plafond relevé à **6 heures**.
L'arbitrage est explicite : une URL qui vit plus longtemps peut être partagée
plus longtemps. On tranche en faveur de l'acheteur qui a payé.

### 10.3 ➕ Deux chemins de distribution selon la taille

Les petits fichiers passent par un CDN cacheable avec une signature HMAC ; les
gros par une distribution signée par clé privée. Le seuil est la limite de cache
du CDN. Les petits fichiers sont donc servis depuis le cache, sans toucher au
stockage.

### 10.4 ➕ La normalisation Unicode des noms de fichiers

Avant de déclarer un fichier introuvable, le code cherche s'il existe sous une
**autre forme de normalisation Unicode** du même nom : la base peut stocker en
NFC pendant que le stockage a reçu du NFD écrit par un poste macOS.

**Très concret pour Baobart** : les noms de fichiers français sont truffés
d'accents — `créations-wax-été.zip`. C'est exactement le cas où NFC et NFD
divergent, et où un acheteur se verrait répondre « fichier introuvable » pour un
fichier bien présent.

### 10.5 ❌ Sept types de consommation, pas trois — §3.9-D

Le plan parle de « téléchargement, lecture, stream ». Les types réels sont :
`download`, `download_all`, `folder_download`, `listen`, `read`, `view`, `watch`.

La distinction compte pour les compteurs : « tout télécharger » n'est pas un
téléchargement de fichier, et écouter n'est pas lire. Chaque événement porte
aussi la **plateforme** déduite du user-agent et l'**adresse IP**.

### 10.6 ➕ Le modèle de location

`TIME_TO_WATCH_RENTED_PRODUCT_AFTER_PURCHASE = 30 jours` et
`TIME_TO_WATCH_RENTED_PRODUCT_AFTER_FIRST_PLAY = 72 heures` : deux compteurs qui
courent en parallèle — un mois pour commencer, trois jours une fois commencé.
Hors périmètre Baobart pour l'instant, mais le double compteur est un motif
réutilisable pour un accès à durée limitée.

### 10.7 Conséquence pour Baobart

Porté dans **`lib/domain/delivery.ts`** : la durée de validité calculée depuis
la taille, la décision d'accès avec ses cinq motifs de refus, et les règles de
quota du §13 — **un achat à l'unité ne décompte jamais**, et un
**re-téléchargement non plus**, sinon une connexion coupée en route coûterait
deux téléchargements à l'acheteur.

L'ordre des refus est délibéré : d'abord ce qui relève du paiement, ensuite le
droit d'accès, le quota en dernier — pour que le message affiché soit celui que
l'acheteur peut corriger.

---

## 11. Les chiffres avancés par le plan

Le plan cite plusieurs volumétries pour justifier des priorités. Vérification par
comptage direct sur le commit de référence :

| Affirmation | Plan | Réel | |
|---|---|---|---|
| Workers Sidekiq (§3.6-B) | 226 | **244** | ❌ sous-estimé |
| Policies d'autorisation (§3.10-B) | 48 | **69** | ❌ sous-estimé |
| Mailers transactionnels (§3.6-C) | 21 | **21** | ✅ exact |
| Contrôleurs API v2 (§3.7-A) | « 25+ ressources » | **33** | ✅ cohérent |
| Contrôleurs API mobile (§3.9-F) | 19 | **19** | ✅ exact |
| Endpoints du Store Agent (§3.4-A) | 84 | **83** | ✅ à une unité près |

Les deux écarts vont dans le même sens — le dépôt a grossi depuis l'exploration.
Aucun ne change une décision : ils renforcent les priorités du plan au lieu de
les contredire.

---

## 12. L'assistant IA — §3.4-A, §9

Vérifié dans `app/services/ai/store_agent_api_catalog.rb` (308 lignes).

### 12.1 ✅ Le catalogue d'actions existe — 83 endpoints

37 en lecture, 46 en écriture, dont 7 réservés au propriétaire du compte.
Dix portées OAuth distinctes : `view_profile`, `edit_profile`, `view_sales`,
`edit_sales`, `edit_products`, `edit_emails`, `refund_sales`, `view_payouts`,
`view_tax_data`, `mark_sales_as_shipped`.

### 12.2 ➕ L'architecture est plus intéressante que le nombre

Le §9 décrit « catalogue d'actions + LLM + exécuteur ». C'est juste, mais il
manque les quatre décisions qui font la solidité du système.

**Deux outils génériques, pas 83.** Le modèle ne reçoit pas 83 outils : il en
reçoit **deux** — lire et écrire — et un catalogue déclaratif qui associe un
identifiant stable à une méthode HTTP et un gabarit d'URL. Ajouter une capacité,
c'est une ligne dans le catalogue, pas un outil de plus. Et le modèle ne peut
appeler qu'un identifiant qui existe dans la liste : il ne peut pas fabriquer
une URL.

**Chaque appel est rejoué contre le vrai contrôleur.** L'agent ne dispose
d'aucun chemin d'autorisation parallèle : la vérification de portée, les droits
par rôle, la validation et la sérialisation sont celles de l'API publique,
réutilisées telles quelles. La conséquence est nette — *l'agent ne peut jamais
dépasser ce que le jeton d'API du créateur lui-même pourrait faire*.

**Les lectures s'exécutent seules, les écritures se confirment.** Et une
écriture doit être précédée d'une **lecture complète de la même cible dans le
même tour** : on n'écrase pas ce qu'on n'a pas lu.

**Les paramètres acceptés sont une liste blanche.** Pas par excès de prudence :
l'API v2 ignore silencieusement les clés inconnues, donc une clé mal nommée
— `price_cents` au lieu de `price` — ferait disparaître la valeur sans erreur.
La liste blanche transforme un silence en refus.

S'y ajoute une frontière de sécurité explicite sur les paramètres d'URL : toute
valeur contenant `/`, `..` ou `%` est refusée, parce qu'elle est interpolée
**après** le contrôle d'autorisation et pourrait rerouter l'appel vers un
endpoint moins protégé.

### 12.3 Conséquence pour Baobart

Le §9 doit être révisé sur un point : ne pas exposer N outils au modèle, mais
**deux** plus un catalogue. Et surtout, faire passer l'assistant par notre propre
API plutôt que par un accès direct à la base — sinon nous entretiendrons deux
chemins d'autorisation, dont l'un finira par diverger. C'est la garantie
« l'assistant ne peut pas faire plus que le créateur » qui devient impossible à
tenir autrement.

---

## 13. Découverte et recommandations — §3.7-E

Vérifié dans `app/modules/product/recommendations.rb`,
`app/services/recommended_products/`, `app/models/discover_search*.rb`.

### 13.1 ➕ L'éligibilité au feed est une barrière, pas un classement

`recommendable?` exige que **toutes** ces conditions soient vraies :

vivant · non archivé · avis affichés · pas épuisé · **catégorie renseignée** ·
**au moins une vente réalisée** · plus les conditions propres au vendeur.

Ce n'est pas un score : c'est un seuil d'entrée. Un produit qui n'a jamais rien
vendu, ou qui n'est pas catégorisé, n'entre pas dans le bassin de recommandation
— indépendamment de sa qualité.

**Conséquence pour Baobart** : « au moins une vente » est un démarrage à froid
pour un créateur qui débute, et notre plan promet précisément de faire découvrir
les nouveaux talents (badge « Nouveau talent », §2.6). Il faudra une porte
d'entrée distincte — la sélection éditoriale du §3.10-A en est une, et c'est
sans doute pour ça qu'elle existe chez eux aussi.

Le drapeau est **dénormalisé dans l'index de recherche**, et le code prévient :
tout facteur qui change doit déclencher une réindexation. C'est exactement le
motif « compteurs dénormalisés + jobs asynchrones » du §8.2.

### 13.2 ➕ Les recommandations partent de ce que vous avez déjà

Les graines sont le **panier en cours** et les **produits déjà achetés**. Sont
exclus : ces mêmes produits, et ceux contenus dans les lots que vous possédez —
on ne recommande pas ce que l'acheteur a déjà, même indirectement.

Détail à retenir : quand il y a au moins quatre graines, le service n'en tire
qu'un **échantillon aléatoire de la moitié**. C'est une injection de diversité
délibérée — sans elle, un même panier produirait éternellement les mêmes
recommandations.

Le nom du modèle de recommandation est stocké **en session** : plusieurs modèles
coexistent et sont comparés.

### 13.3 ➕ Le créateur décide si on recommande les produits des autres

`User::RecommendationType` : `no_recommendations`, `own_products`,
`gumroad_affiliates_products`, `directly_affiliated_products`.

Le vendeur choisit ce qui peut apparaître à côté de ses propres produits — rien,
seulement les siens, ou ceux dont il tire une commission d'affiliation.

**C'est une question de consentement que le plan n'aborde nulle part.** Afficher
les créations d'un tiers sur la page d'un créateur sans son accord est une
décision qui lui appartient, pas à la plateforme.

### 13.4 ❌ Les « suggestions de recherche » sont un historique — §3.7-E

Le plan présente `discover_search_suggestion.rb` comme un moteur de suggestions.
C'est en réalité **l'historique de recherche personnel** : les recherches
récentes de la personne, rattachées à son compte ou, si elle n'est pas connectée,
à son navigateur — et **effaçables une par une**.

En revanche, `DiscoverSearch` enregistre bien la boucle de pertinence : chaque
recherche, sa catégorie, et **la ressource qui a été cliquée** derrière. C'est la
matière première d'un futur classement, pas un classement.

À noter enfin : le feed curé annoncé comme un service
(`discover_curated_products.rb`) est un **concern de contrôleur**, pas un service
autonome.

---

## 14. Les rôles — blueprint §4.1

Vérifié dans `app/models/user.rb` et `app/models/team_membership.rb`.

### 14.1 ➕ Il n'existe aucune colonne de rôle

C'est la découverte structurante de cette section. Gumroad ne stocke **pas** si
un compte est acheteur ou vendeur. La qualité se **dérive** :

```ruby
def is_buyer?
  !links.exists? && purchases.successful.exists?
end
```

« Un acheteur est quelqu'un qui n'a publié aucun produit et qui a déjà acheté. »
La définition est **exclusive** : publier fait sortir de la catégorie.

**Conséquence pour Baobart** : la capacité de vendre vient de la publication,
jamais d'un champ qu'un administrateur pourrait cocher. Personne ne peut donc
« être créateur » sans l'être vraiment, et il n'y a pas de rôle à maintenir
cohérent avec les faits.

Reste que nos maquettes demandent de choisir à l'inscription. Ce choix est réel
— il décide du tableau de bord d'arrivée — mais c'est une **intention**, pas une
permission. Les deux vivent côte à côte : `User.intention` oriente,
`lib/auth/roles.ts` autorise. Et le fait l'emporte : qui a publié voit sa
boutique, quoi qu'il ait déclaré.

### 14.2 ❌ Cinq rôles d'équipe, pas quatre — blueprint §4.0

`TeamMembership::ROLES = %w(owner accountant admin marketing support)`.

Le blueprint en listait quatre : **`owner` manquait**. Sans lui, on ne peut pas
exprimer qui possède la boutique autrement qu'en le devinant — par exemple en
supposant que c'est le vendeur lui-même, ce qui cesse d'être vrai dès qu'une
boutique change de mains.

---

## 15. Ce qui reste à vérifier

Les grandes zones du plan ont toutes été ouvertes au moins une fois. Restent des
sujets décrits mais jamais lus dans le détail :

- **Baobart Shield** (§2.5) — sans équivalent chez Gumroad, rien à vérifier :
  c'est du travail original, pas une traduction ;
- **modération automatisée** (§3.6-A) — les stratégies et les motifs de blocage ;
- **RGPD** (§3.7-C) — les services d'effacement et d'anonymisation ;
- **intégrations tierces** (§3.7-B) — Discord, Zoom, Circle, Calendrier ;
- **onboarding vendeur par pays** (§3.7-I) — les champs de conformité ;
- **profils modulaires** (§3.9-G) et **stats d'avis dénormalisées** (§3.9-H).

Sauf mention contraire dans ce document, une affirmation du plan reste **non
vérifiée**.

---

## 16. Seconde passe — 31 août 2026

Un mois, 581 commits. Cette section ne relit pas tout : elle consigne **ce qui a
changé depuis la première passe**, et ce que Baobart doit en retenir.

### 16.0 Ce qui n'a pas bougé

Les citations de fichiers de la première passe tiennent toutes celles qui ont
été revérifiées :

| Cité en §7.1 | Toujours à `app/business/payments/charging/charge_processor.rb` |
|---|---|
| `holder_of_funds.rb` | présent, même dossier |
| `charge_intent.rb`, `charge_event.rb` | présents |
| `balance.rb`, `balance_transaction.rb` | présents |

Les constats des sections 2 à 11 n'ont donc **pas** à être remis en cause en
bloc. Ce qui suit s'y ajoute.

### 16.1 ➕ LA DÉCOUVERTE : une couche de présentation en devise locale

C'est l'apport principal du mois, et il est entièrement absent du plan comme de
la première passe. Cinq fichiers neufs :

| Fichier | Rôle |
|---|---|
| `app/models/charge_presentment.rb` | Ce qui est montré et facturé, par processeur et par devise |
| `app/services/charge/presentment_orchestrator.rb` | Décide et fige les montants avant l'appel au processeur |
| `app/services/charge/presentment_allocator.rb` | Répartit le total exact entre les lignes d'achat |
| `app/services/charge/direct_listed_presentment.rb` | Le cas sans conversion |
| `app/services/charge/method_forced_presentment.rb` | Le cas où le moyen de paiement impose sa devise |

**« Présentation » veut dire les deux à la fois** : la devise dans laquelle
l'acheteur *voit* le prix, et celle dans laquelle il est *réellement débité*.
C'est la distinction que le §3.7-F du plan appelle « devis FX », et elle est
plus subtile qu'annoncé.

### 16.2 ➕ Cinq principes de conception à transposer

Chacun répond à une manière précise de perdre de l'argent ou la confiance.

**L'acheteur est débité exactement ce qu'il a vu.** Le devis qu'il a confirmé
est verrouillé et vérifié au moment de la charge ; aucun devis frais n'est émis
en cours de route. Sans cette règle, un taux qui bouge entre l'affichage et le
débit fait payer autre chose que le prix annoncé — et c'est indéfendable.

**Le taux stocké inclut la marge du processeur, et le taux de base n'est
délibérément PAS conservé** — pour qu'on ne puisse pas reconstituer la marge.
C'est une décision sur ce qu'il ne faut *pas* écrire, et elle mérite d'être
notée : la plupart des schémas font l'inverse par réflexe.

**Trois champs de devis, tous présents ou tous vides.** Identifiant du devis,
date d'expiration, taux. Une ligne à moitié renseignée n'a aucun sens — soit la
charge est adossée à un devis, soit elle est en devise directe.

**L'écart d'arrondi est signé, et sa prise en charge est revérifiée.** Arrondir
le total de l'acheteur déplace quelques centimes ; la plateforme les absorbe,
mais seulement si sa commission réelle les couvre — ce qui est revérifié à la
charge, pas prédit au devis. Une remise ou une opération commerciale peut avoir
rendu la prédiction fausse entre-temps.

**On échoue fermé.** Si la répartition du total entre les lignes ne trouve
aucune composante non fiscale pour porter l'écart d'arrondi, la charge échoue —
elle ne retombe pas silencieusement en dollars. Débiter dans une autre devise
que celle annoncée serait pire que ne pas débiter.

### 16.3 ➕ Une table de taux de secours, versionnée avec le code

`lib/currency/backup_rates.json`. Une leçon d'exploitation, pas d'architecture :
quand le fournisseur de taux ne répond pas, on ne ferme pas la boutique — on
tombe sur une table périmée mais connue. Le prix est légèrement faux, la vente a
lieu, et l'écart se règle en comptabilité. L'inverse ferait perdre une journée
de ventes pour une panne chez un tiers.

### 16.4 ➕ `FlowOfFunds` — un paiement n'a pas un montant, il en a cinq

Un paiement international change de valeur à chaque étape, et chaque étape a sa
propre devise :

| Étape | Ce qu'elle porte |
|---|---|
| Émis | Ce que l'établissement d'origine a débité |
| Réglé | Ce qui est arrivé après le règlement interbancaire |
| Part plateforme | La commission prélevée |
| Brut marchand | Ce qui atteint le compte du vendeur |
| Net marchand | Ce qu'il touche après prélèvement |

Un champ unique suppose que la valeur ne bouge pas du début à la fin. Elle
bouge. C'est ce qui explique les six montants de `BalanceTransaction` relevés en
§5.2 : ils ne sont pas une coquetterie comptable, ils sont l'empreinte de ces
étapes.

### 16.5 Conséquences pour Baobart — ce qui change, ce qui ne change pas

**Rien de ceci n'est urgent.** Baobart vend en franc CFA à des acheteurs en zone
franc CFA : il n'y a pas de conversion, donc pas de présentation à gérer. La
`Currency` du schéma porte huit devises, mais une seule est réellement
exploitée.

**Cela le devient le jour où la diaspora achète.** Un acheteur payant en euro ou
en dollar fait entrer d'un coup les cinq principes du §12.2. C'est exactement le
chantier que le plan situe en M2 sous « checkout multi-devises », et il a
désormais un modèle de référence complet plutôt qu'une ligne de feuille de
route.

**Deux choses à faire tout de suite, et elles sont petites.** D'abord ne pas
créer de dette : `ExchangeRate` n'existe pas encore, et le jour où on l'écrira
il faudra y prévoir l'expiration du devis dès le premier jet — l'ajouter après
coup obligerait à réécrire les charges déjà émises. Ensuite, se souvenir que
notre `formatMoney` affiche déjà huit devises alors qu'une seule est encaissable
: c'est une promesse que l'interface tient et que le paiement ne tient pas.

### 16.6 Ce que cette passe n'a PAS fait

Elle a relu la trajectoire de l'argent, pas le dépôt. Les 581 commits touchent
aussi les passages programmés, les courriels de reçu, les intégrations et
l'administration — **non revus**. Les sections 2, 4, 6 et 9 à 15 datent donc
toujours du 2 août, et un mois de commits a pu les décaler sans qu'on le sache.

C'est un choix : relire un dépôt de trois mille fichiers à chaque jalon coûte
plus que ce qu'il rapporte. La trajectoire de l'argent a été privilégiée parce
que c'est là que Baobart travaillait ce mois-ci, et parce que c'est le seul
domaine où se tromper coûte de l'argent réel.

