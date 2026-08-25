# Nos systèmes éprouvés au regard de Gumroad

**Août 2026 · Baobart v1.24.0 · référence `antiwork/gumroad` @ `a475e3f9`**

> Le dépôt Gumroad (MIT) sert de **spécification**, jamais de source à copier.
> Il est cloné hors de ce dépôt — aucun fichier sous licence tierce n'entre
> dans notre historique. Ce document décrit des logiques observées, dans nos
> propres mots.
>
> L'exercice ne cherche pas la ressemblance. Il cherche les cas qu'une
> plateforme de vente finit par rencontrer et que nous n'avons pas prévus.

---

## Ce que la confrontation a révélé

### 1. La plateforme n'a pas de compte — et cela se voit sur un remboursement

**Prouvé, pas supposé.** `lib/domain/argent-remboursement.integration.test.ts`
fixe le trajet des fonds sur une vente à 5 000 F :

| Étape | Acheteur | Créateur | Plateforme |
|---|---|---|---|
| Vente | −5 000 | +4 425 | +575 *(nulle part inscrit)* |
| Remboursement intégral | +5 000 | −4 425 | −575 |

Notre grand livre est tenu **par utilisateur** : chaque écriture porte un
`userId`. La plateforme n'étant pas un utilisateur, ce qu'elle prélève —
500 F de commission, 75 F de frais d'opérateur — n'existe que comme différence
entre ce que l'acheteur a payé et ce que le créateur a reçu.

Deux conséquences, l'une comptable, l'autre financière.

**On ne peut pas répondre à « combien la plateforme a-t-elle gagné ce mois-ci ».**
Il faut la recalculer en sommant les frais figés sur chaque ligne. C'est
faisable, mais ce n'est pas une lecture de solde — c'est une reconstitution.

**Sur un remboursement, la plateforme rend sa commission et absorbe en plus les
frais d'opérateur.** Les 75 F de la passerelle ne reviennent pas : le
prestataire de paiement les garde. Personne n'a décidé cela ; c'est ce qui
arrive faute de compte plateforme.

Gumroad, de son côté, garde sur chaque remboursement une notion de commission
**retenue** (`retained_fee_cents` dans `app/models/refund.rb`), et distingue les
cas où les frais sont dispensés. Autrement dit : chez eux, rendre ou garder la
commission est un **choix inscrit ligne par ligne**. Chez nous, il n'y a pas de
choix — il n'y a qu'un effet de bord.

**Ce n'est pas un bug.** Rembourser intégralement l'acheteur, commission
comprise, est une politique commerciale défendable, et même généreuse. Mais
elle doit être décidée, pas subie. Sur un marché où le remboursement est un
argument de confiance, chaque retour coûte à Baobart la commission *et* les
frais de passerelle.

**À trancher :** garde-t-on la commission sur un remboursement ? Qui supporte
les frais d'opérateur non récupérables ? Tant que la réponse n'est pas prise,
le test ci-dessus fixe le comportement actuel pour qu'il ne dérive pas en
silence.

### 2. Une licence émise que rien ne consomme

Nous générons une clé à chaque achat et l'oublions. Gumroad suit un compteur
d'usages sur la sienne, sait la désactiver puis la réactiver, plafonne le
nombre d'usages, et — détail qui trahit l'expérience — sépare « fixer le
compteur à cette valeur » de « l'incrémenter », les deux opérations prises sous
verrou.

La distinction n'est pas gratuite : deux activations simultanées d'un même
greffon qui liraient puis écriraient le compteur en perdraient une.

Sans interface de vérification de licence, notre clé reste décorative. Ce n'est
pas urgent — mais le jour où on l'exposera, le compteur devra naître verrouillé.

### 3. Les états d'achat : un écart qui n'en est pas un

Leur machine à états en compte beaucoup plus que nos quatre. La différence
tient à des fonctionnalités que nous n'avons pas : cadeaux, préventes, achats
de test par le vendeur lui-même.

Aucune correction à faire. Noté pour qu'on ne prenne pas cet écart pour une
lacune la prochaine fois qu'on ouvrira leur code.

---

## Ce sur quoi nous sommes plus stricts

Trois points où notre implémentation refuse ce que la leur laisse passer.

**Le grand livre est immuable par contrainte de base.** Un déclencheur
PostgreSQL refuse tout `UPDATE` et tout `DELETE` sur `BalanceTransaction` :
corriger passe obligatoirement par une écriture inverse. Chez Gumroad, la
même discipline existe, mais elle repose sur les habitudes du code. La nôtre
tient même contre un `psql` ouvert par mégarde — vérifié à mes dépens en
tentant d'effacer une vente d'essai.

**On n'achète pas sa propre ressource.** Nous refusons ; leur modèle d'achat ne
porte pas ce garde-fou. Sans lui, un créateur pourrait faire tourner ses
propres ventes pour gonfler ses compteurs, et se créditer le net de son propre
argent.

**Deux achats simultanés donnent une commande.** Transaction sérialisable et
vérification de possession à l'intérieur, éprouvées par un test qui lance deux
achats en parallèle et vérifie qu'un seul crédit atteint le créateur.

---

## Ce que la confrontation a confirmé

Ces choix, faits plus tôt sans certitude, se révèlent alignés :

- **Le remboursement est un enregistrement, pas un statut.** Plusieurs
  remboursements partiels s'empilent sur la même ligne — comme chez eux.
- **Le litige est distinct du remboursement.** L'argent repris par la banque
  n'est pas un geste du vendeur ; les deux colonnes restent séparées.
- **Le seuil minimum de versement existe** des deux côtés, et le compte
  suspendu, l'enquête en cours et les versements suspendus sont bien trois
  motifs de refus distincts — un créateur peut être payé alors qu'il est sous
  contrôle, ou suspendu sans que ses versements le soient.
- **Un produit gratuit aboutit sans encaissement**, dans un état dédié.

---

## Ce que je n'ai pas vérifié

Par honnêteté sur la portée de l'exercice : je n'ai pas confronté la fiscalité,
la conformité par pays, les abonnements récurrents, les préventes, ni la
détection de fraude. Ce sont des pans entiers de leur code, et nous n'avons rien
en face à comparer.

Je n'ai pas non plus mesuré nos taux de commission contre les leurs : les
nôtres sont des décisions commerciales ouvertes, déjà signalées comme telles
dans `lib/domain/fees.ts`, et ce n'est pas une question technique.

---

## Suite proposée

Un seul point demande une décision humaine avant tout code : **la politique de
remboursement**. Le reste peut attendre son besoin.
