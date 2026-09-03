# Maquettes manquantes ou décalées — relevé du 31 août 2026

**Application v1.46.0** · confronté à `Baobart Design/*.dc.html`

> Mis à jour le 2 septembre 2026 : les trois écrans de la section **A.4** ont
> été dessinés puis câblés. Il reste trois écrans à dessiner.

---

## Comment lire ce document

Il compare **ce que le code fait** à **ce que les maquettes montrent**, et
distingue quatre cas :

| Marque | Sens | Ce que vous avez à faire |
|---|---|---|
| 🔴 | Écran ou état qui existe en code, sans aucune maquette | **Dessiner** |
| 🟠 | Maquette existante à qui il manque un état | **Compléter** |
| 🔵 | Maquette existante, code absent | Rien — c'est une intention, pas un décalage |
| ⚪️ | Aucun des deux, et c'est peut-être normal | Décider si ça vaut une maquette |

Les quatre maquettes actuelles couvrent bien plus que ce document ne relève :
`Accueil` décrit vingt-sept sections, `Dashboard` nomme vingt des vingt et un
écrans du tableau de bord. **Ce qui suit est le reste** — pas un jugement sur
l'ensemble.

---

## 🔴 A. Écrans en code, sans aucune maquette

Ce sont les trois seuls écrans que j'ai construits sans modèle. Ils fonctionnent
et ils sont testés, mais leur apparence est de moi, pas de vous.

### A.1 — `/reinitialiser/[jeton]` · **dessiné et câblé** (v1.43.0)

Les trois états sont maquettés (`Baobart Auth.dc.html`, écrans `nouveau`,
`perime`, `inconnu`) et câblés. Sur les deux états morts, le formulaire
disparaît entièrement : un bloc jaune dit pourquoi, avec « Rien à remplir sur
cet écran », puis une seule sortie.

Le choix du type de compte à l'inscription est câblé lui aussi. Un point à
connaître : **il n'accorde aucun droit**. `lib/auth/roles.ts` pose qu'il
n'existe aucune colonne de rôle — on devient créateur en publiant, pas en le
déclarant. Le choix décide seulement d'où l'on atterrit après l'inscription.

---

### A.2 — `/achat/[orderId]` · Retour depuis l'opérateur de paiement

Là où l'acheteur atterrit en revenant de chez Orange Money, Wave ou Paystack.
Aucune section de `Baobart Accueil.dc.html` ne le prévoit.

Cet écran est **le seul endroit** où l'on doit dire à quelqu'un « on ne sait pas
encore », et c'est ce qui le rend délicat à dessiner. Il ne décide de rien : il
lit l'état que le rappel de l'opérateur a écrit.

**Quatre états, quatre tons :**

| État | Titre | Ton | Ce qu'il dit |
|---|---|---|---|
| En attente | *On attend la confirmation* | jaune | Ton opérateur ne nous a pas encore répondu. C'est normal : il lui faut parfois une minute ou deux. |
| Payé | *C'est payé* | vert | Paiement confirmé, ressource dans ton espace, reçu en route. |
| Rien à encaisser | *C'est à toi* | vert | Rien n'a été encaissé, et la ressource est dans ton espace. |
| Échoué | *Le paiement n'est pas passé* | orange | Opérateur refusé ou transaction interrompue. **Rien ne t'a été débité.** Tu peux réessayer. |

**Éléments communs**, quel que soit l'état :
- Le nom de la ressource et le montant
- La référence de commande, en petit — c'est elle qu'on cite au support
- Deux liens : *Mes achats* et *Revenir à la fiche*

**Le détail qui compte :** l'état « en attente » se rafraîchit tout seul toutes
les huit secondes. Une page qui dit « on attend » sans jamais changer d'avis
pousse à recharger, puis à **repayer**. La maquette doit montrer ce que voit
quelqu'un qui reste dessus.

### A.3 — Pages d'erreur et d'absence

Il n'existe **aucune** page `not-found`, `error` ou `loading` dans le projet.
Une ressource inexistante rend donc le 404 par défaut de Next.js — écran blanc,
police système, aucun rapport avec Baobart.

Trois écrans à dessiner, tous en dehors du cadre habituel puisqu'ils s'affichent
justement quand le cadre a échoué :
- **404** — la page n'existe pas, ou plus. Doit proposer une sortie :
  l'explorateur, l'accueil
- **Erreur** — quelque chose a cassé de notre côté. Doit permettre de réessayer
  sans perdre ce qu'on faisait
- **Chargement** — l'état transitoire des écrans lourds (explorateur, tableau de
  bord)

### A.4 — L'abonnement mobile money · **dessiné le 2 septembre 2026**

Les trois écrans sont maquettés (`Baobart Parcours Achat.dc.html`, écrans
`renew`, `renewret`, `notifs`) et **câblés en v1.42.0**. Ils ne sont plus une
dette ; ce qui suit est le relevé des deux endroits où le code s'écarte du
dessin, et pourquoi.

**Un état de plus sur `/abonnement/[id]/renouveler`.** La maquette dessine
trois états ; le code en rend quatre. Entre l'échéance et la coupure vit la
**grâce** : pendant ces jours-là l'abonné a encore son accès. Lui afficher
« Ton accès est en pause » serait faux, et le ferait renoncer en croyant avoir
déjà tout perdu. Le quatrième état garde l'allure orange de `suspendu` et dit
la vérité : *« Ton échéance est passée. Ton accès continue encore N jours. »*

**Les libellés de relance ne sont pas recopiés.** La maquette écrit
« RELANCE J−7 » et « RAPPEL J−1 » ; le code les **dérive** de `PALIERS`. Un
écran qui annonce un calendrier que le moteur ne tient pas est un mensonge que
personne ne voit — sauf l'abonné, une fois, le jour où le message n'arrive pas.
Le calendrier du moteur a donc été aligné sur la maquette, et non l'inverse.

Reste à dessiner, découvert en câblant : rien sur cette famille d'écrans.

---

## 🟠 B. Maquettes existantes à compléter

### B.1 — Le choix du moyen de paiement, au moment d'acheter

`Baobart Accueil.dc.html` mentionne Orange Money et Wave dans son argumentaire,
mais **aucun sélecteur** n'existe dans la fiche produit ni dans le panier.

Le code est prêt : l'action d'achat lit un champ `moyen` et le transmet à
l'opérateur. Sans maquette, il retombe sur Orange Money pour tout le monde.

Ce qu'il faut décider en le dessinant :
- Où il vit — sur la fiche, ou après avoir cliqué « Acheter » ?
- Quatre rails : Orange Money, Wave, MTN, Moov. Faut-il les montrer tous, ou
  seulement ceux du pays de l'acheteur ?
- Faut-il demander le numéro de téléphone ? Paystack ne l'exige pas — il le
  demande sur sa propre page — mais Flutterwave en a besoin pour viser le bon
  réseau.

### B.2 — L'espace acheteur ne nomme jamais ce qu'on vient d'acheter

**Le décalage le plus gênant du relevé**, trouvé par les tests au navigateur.

Juste après un achat :
- `/dashboard/achats` affiche *« Commande ABC123 · 1 article · 5 000 F »* — une
  référence, jamais le nom de la ressource
- `/dashboard/telechargements` liste ce qui a **déjà été retiré**. Il est donc
  vide tant qu'on n'a rien téléchargé

Résultat : entre le paiement et le premier téléchargement, **rien dans l'espace
de l'acheteur ne dit ce qu'il possède**. Le reçu d'achat pointait d'ailleurs sur
l'écran des téléchargements — corrigé en v1.35.0, il mène maintenant aux achats,
mais le fond du problème reste un choix d'écran qui vous appartient.

Trois façons de le résoudre, à trancher en maquette :
1. Les achats montrent les ressources, pas seulement les commandes
2. Les téléchargements listent aussi ce qu'on possède et qu'on n'a pas encore
   retiré, avec un état distinct
3. Un troisième écran — une bibliothèque — et les deux autres restent des
   historiques

### B.3 — L'état « en cours » d'une commande

`Baobart Dashboard.dc.html` traite les commandes payées et remboursées. Depuis
le mobile money, une commande peut rester **ouverte pendant des heures** en
attendant le rappel de l'opérateur, puis se refermer toute seule au bout de
vingt-quatre heures.

Deux états à ajouter à l'écran des commandes :
- **En attente de l'opérateur** — avec le lien vers l'écran de retour (A.2)
- **Abandonnée** — la commande n'a jamais abouti, rien n'a été débité

---

## 🔵 C. Maquettes qui attendent du code

Rien à redessiner ici. C'est la liste de ce que vos maquettes promettent et que
le code ne fait pas encore — utile pour ne pas croire ces écrans terminés.

De `Baobart Accueil.dc.html` :

| Section | Route attendue | État |
|---|---|---|
| PAGE CATEGORIE | `/categories/[slug]` | Aucun code |
| ~~PAGE CREATEURS · PROFIL CREATEUR~~ | `/createurs`, `/@[username]` | ✅ **câblé en v1.45.0** — voir §F pour ce qui reste |
| PANIER | `/panier` | Aucun code — l'achat se fait à l'unité |
| ~~PAGE JOBS · FICHE MISSION~~ | `/jobs`, `/jobs/[id]` | ✅ **câblé en v1.46.0.** Trois blocs dessinés restent absents — voir §G |
| PAGE SERVICES · FICHE SERVICE | `/services` | Aucun code (M3) |
| PAGE CONCOURS & EVENEMENTS | `/evenements` | Aucun code (M4) |
| PAGE SPONSORISER | `/sponsoriser` | Aucun code |
| PAGE FONCTIONNALITES | `/fonctionnalites` | Aucun code |
| TARIFS | `/tarifs` | Aucun code |
| BLOG | `/blog` | Aucun code (M5) |
| PAGES DOC / LEGAL / COMMUNAUTE | `/doc`, `/legal`, … | Aucun code |
| MON COMPTE | — | Le tableau de bord en tient lieu |

---

## ⚪️ D. Ce qui n'a aucune maquette, et n'en a peut-être pas besoin

### D.1 — Les cinq courriels

`BIENVENUE`, `RECU_ACHAT`, `AVIS_VERSEMENT`, `REINITIALISATION_MOT_DE_PASSE` et
`LIEN_TELECHARGEMENT` sont rendus en **texte brut**, sans mise en forme.

Ce n'est pas un oubli : le texte brut arrive partout, ne casse dans aucune
messagerie, et ne finit pas en indésirable pour cause d'images distantes. Un
courriel en HTML est un chantier à lui seul — gabarits, tests sur une douzaine
de clients, version texte de repli obligatoire.

**À décider :** est-ce que ça vaut la peine maintenant ? Si oui, ce sont cinq
maquettes de plus, plus une charte pour l'en-tête et le pied.

### D.2 — Le bac à sable de paiement

`/achat/[orderId]` affiche deux boutons de développement — *le paiement
réussit* / *le paiement échoue* — qui n'apparaissent jamais en production. Ils
n'ont pas besoin d'être beaux, seulement d'être clairement identifiés comme
n'appartenant pas au produit.

---

## 🎖 E. Les badges — liste exhaustive à dessiner

*Demandée le 2 septembre 2026, en vue du système de gamification.*

Le schéma porte déjà `Badge`, `UserBadge` et un enum `BadgeCode` à cinq
valeurs — aucune n'est attribuée nulle part. Ce qui suit est la liste complète
à couvrir, familles comprises.

### ⚠️ Deux familles qui ne doivent jamais se confondre

C'est **le** point de conception de tout ce système, et il se joue avant le
premier dessin.

| | **Badges de statut** | **Badges de mérite** |
|---|---|---|
| D'où ils viennent | **accordés** par l'administration | **calculés** depuis l'activité |
| Ce qu'ils font | **ouvrent des droits** | ne donnent **aucun droit** |
| Exemple | Freelance ouvre la publication de services | « 100 ventes » ne débloque rien |
| Se perdent | par retrait, tracé à l'audit | tout seuls, quand le compte ne les vérifie plus |

**Un badge de mérite ne doit jamais ouvrir un droit.** Sinon accumuler de
l'activité devient un chemin d'élévation de privilège : quelqu'un qui publie
cent ressources bidon obtiendrait ce qu'on réserve à un professionnel vérifié.

**Un badge de statut ne doit jamais s'obtenir automatiquement.** C'est
précisément la case qu'un arnaqueur cocherait.

Visuellement, les deux familles doivent être **impossibles à confondre** : un
statut engage Baobart — « nous avons vérifié cette personne » —, un mérite
constate. Ce sont deux formes, deux traitements, peut-être deux emplacements.

### E.1 — Statut · accordés, ouvrent des droits

| Code | Nom | Comment on l'obtient | Ce qu'il ouvre |
|---|---|---|---|
| `VERIFIED_CREATOR` | Créateur vérifié | vérification par l'administration | mise en avant, confiance affichée |
| `FREELANCE` | Freelance | accordé, **+ abonnement actif** | publier des services (§18.3 de la spec admin) |
| `AGENCE` | Agence | accordé, **+ abonnement actif** | publier des services, profil d'équipe |
| `VERIFIED_RECRUITER` | Recruteur vérifié | contrôle de l'entité qui recrute | le badge « Offre vérifiée » sur ses offres |
| `KYC_VERIFIED` | Identité vérifiée | `KycStatus = VERIFIED` | seuils de versement relevés |

> **Freelance et Agence sont exclusifs** : on est l'un ou l'autre, pas les deux.
> Et le badge seul ne suffit pas — sans abonnement actif, le droit se referme
> (sans effacer ce qui est déjà publié).

### E.2 — Ancienneté · calculés

| Code | Nom | Critère |
|---|---|---|
| `NEW_TALENT` | Nouveau talent | compte de moins de 90 jours **et** au moins une publication |
| `PIONEER` | Pionnier | parmi les N premiers comptes de la plateforme |
| `ONE_YEAR` | Un an | compte créé il y a plus d'un an |
| `THREE_YEARS` | Trois ans | idem, trois ans |
| `LOYAL_SUBSCRIBER` | Fidèle | 12 cycles d'abonnement **sans interruption** — Ndank sait le dire |

### E.3 — Production · calculés

| Code | Nom | Critère |
|---|---|---|
| `FIRST_PUBLICATION` | Première pierre | une ressource publiée |
| `TEN_RESOURCES` | Atelier fourni | dix ressources publiées |
| `FIFTY_RESOURCES` | Grand atelier | cinquante |
| `HUNDRED_RESOURCES` | Bibliothèque | cent |

### E.4 — Ventes · calculés

| Code | Nom | Critère |
|---|---|---|
| `FIRST_SALE` | Première vente | une vente aboutie |
| `TEN_SALES` | Dix ventes | dix |
| `HUNDRED_SALES` | Cent ventes | cent |
| `THOUSAND_SALES` | Mille ventes | mille |
| `TOP_CREATOR` | Créateur du mois | dans le haut du classement **sur 30 jours glissants** |

> `TOP_CREATOR` **doit expirer** — c'est à cela que sert `UserBadge.validUntil`.
> Un badge de classement qui ne se perd jamais finit porté par tout le monde, et
> ne veut plus rien dire.

### E.5 — Qualité · calculés

| Code | Nom | Critère |
|---|---|---|
| `WELL_RATED` | Bien noté | note ≥ 4,5 sur au moins 20 avis |
| `NO_DISPUTE` | Sans litige | 50 ventes sans un seul litige |
| `FAST_RESPONDER` | Répond vite | services : délai médian de réponse sous 24 h |

> Le seuil d'avis compte autant que la note. « 5,0 » sur deux avis ne dit rien,
> et l'afficher comme un mérite récompenserait la rareté.

### E.6 — Communauté · calculés

| Code | Nom | Critère |
|---|---|---|
| `COMMUNITY_PILLAR` | Pilier | 500 abonnés |
| `HELPFUL_REVIEWER` | Bon public | 25 avis rédigés |
| `VIP_CREATOR` | VIP | distinction éditoriale, décidée par l'administration |

> `VIP_CREATOR` est le seul de cette famille qui s'accorde. Il devrait
> probablement rejoindre E.1 le jour où il ouvrira un droit.

### E.7 — Ce qu'il faut décider en dessinant

1. **Où vivent-ils.** Sur le profil public seulement, ou aussi sur la vignette
   d'une ressource, dans les résultats, à côté d'un avis ? Un badge qui apparaît
   partout ne se voit nulle part.
2. **Combien s'affichent à la fois.** Quelqu'un peut en porter douze. Il faut
   une règle de troncature, et elle doit garder les statuts avant les mérites.
3. **L'état « pas encore obtenu ».** Montrer les badges verrouillés motive, et
   encombre. À trancher.
4. **La forme du critère.** `Badge.criteria` est prévu pour être **publié** —
   la transparence est déjà au schéma. L'écran doit donc pouvoir afficher
   « il te manque 3 ventes », pas seulement un badge gris.
5. **La perte.** Un mérite qui se perd doit-il se dire ? Perdre « Répond vite »
   en silence est déloyal ; l'annoncer bruyamment est humiliant.

### E.8 — Note technique, pour quand on câblera

Un badge de mérite est **dérivé**, jamais déclaré. `UserBadge` est donc un
**cache**, pas une vérité : tout doit pouvoir se recalculer depuis zéro, et un
recalcul complet doit rendre exactement le même résultat.

C'est la même leçon que `lib/auth/roles.ts` et que Ndank : un statut rangé en
base se désynchronise dès qu'un passage rate son tour. Ici, le symptôme serait
un « 100 ventes » porté par quelqu'un qui en a eu 40 remboursées.

---

## ⚠️ F. Le profil créateur — ce qui est câblé, ce qui reste

*Relevé le 2 septembre 2026 en câblant l'écran. **Arbitré le même jour.***

`Baobart Accueil.dc.html`, section `PROFIL CREATEUR`, dessine cinq indicateurs
et une phrase d'en-tête. Deux ne reposaient sur aucune donnée.

| Dessiné | Décision |
|---|---|
| produits | ✅ câblé — ressources **publiées**, pas `workCount` qui compte les brouillons |
| ventes à vie | ✅ câblé |
| abonnés | ✅ câblé |
| **vues de page** | 🔜 **à construire** — gardé, mais rien ne les compte encore |
| abonnements | retiré — renseigne sur la personne, pas sur son travail |
| « répond en moyenne en 4 h » | ❌ **retiré de la maquette** |

### F.1 Le délai de réponse est abandonné

À retirer du dessin. Ce n'était pas seulement une donnée manquante : c'est une
donnée **coûteuse à rendre honnête**. Répondre à quoi — un message, une
commande, un litige ? Sur quelle fenêtre ? Et un créateur en vacances verrait sa
moyenne s'effondrer sans avoir rien fait de mal.

### F.2 Les vues de page sont gardées, et restent à construire

C'est un indicateur qui parle au créateur autant qu'à l'acheteur. Trois choix
seront à faire en l'écrivant, et aucun n'est neutre :

- **compter quoi.** Une vue par chargement gonfle le chiffre à chaque
  rafraîchissement. Une vue par visiteur et par jour dit quelque chose ;
- **ne pas écrire à chaque requête.** Un `UPDATE` par visite sur une page
  populaire met la base à genoux. Il faut agréger, ou écrire par lot ;
- **les robots.** Une bonne part du trafic d'un site public est automatisée. Un
  compteur qui les inclut mesure surtout l'appétit des moteurs.

Tant que ce n'est pas fait, **l'indicateur n'est pas affiché**. Un chiffre
inventé sur un profil public est un mensonge que l'acheteur prend pour une
mesure — et c'est précisément sur ces chiffres-là qu'il décide d'acheter.

### F.3 Trois onglets sur quatre manquent

Services attend son CMS, Collections publiques n'existe pas. Un seul onglet est
affiché : des onglets vides feraient croire à une page cassée plutôt qu'à une
page en construction.

---

## ⚠️ G. Les offres d'emploi — trois blocs dessinés, absents à dessein

*Relevé le 2 septembre 2026 en câblant `/jobs` et la fiche mission.*

`Baobart Accueil.dc.html`, sections `PAGE JOBS` et `FICHE MISSION`. Le reste est
câblé à la lettre ; ce qui suit ne l'est pas, et pour des raisons différentes.

| Bloc dessiné | Pourquoi il n'est pas affiché |
|---|---|
| **« N propositions »** sur chaque carte, et la jauge sur la fiche | Les candidatures arrivent avec **J5**. Aucune ne peut exister aujourd'hui : afficher un compteur serait inventer le chiffre sur lequel un candidat décide de postuler ou non |
| **Bouton « Mes propositions »** | Même raison. Une porte qui ouvre sur le vide coûte plus cher qu'une porte absente |
| **« Le client répond en moyenne sous 6 h »** | Rien ne le mesure — et cette métrique vient d'être **abandonnée** sur le profil créateur (§F.1). La garder ici rétablirait par la fenêtre ce qu'on a retiré par la porte |
| **« Livrables attendus »** et **« Profil recherché »** | Ce ne sont pas des champs. La description les porte en prose |

### G.1 Livrables et compétences — une décision à prendre

Ce sont les deux seuls qui ne sont pas bloqués par une fonctionnalité manquante :
ils demandent de **collecter** l'information au dépôt, donc de rouvrir le
formulaire de J2.

Trois façons de faire, et le choix vous revient :

1. **Laisser en prose.** La description accepte huit mille signes ; un annonceur
   sérieux structure déjà son texte. Rien à construire, rien à imposer.
2. **Deux listes libres**, une ligne par livrable et par compétence. Facile à
   remplir, facile à afficher — mais rien ne garantit qu'on les remplisse, et
   une fiche à moitié structurée est plus laide qu'une fiche en prose.
3. **Des compétences choisies dans une liste fermée.** C'est le seul chemin qui
   permette un jour de **filtrer** les offres par compétence, ou de proposer une
   mission à quelqu'un dont le profil correspond. C'est aussi le plus lourd :
   il faut décider de la liste, et la tenir.

La troisième est la seule qui apporte quelque chose que la prose ne fait pas
déjà. Les deux autres ne font que déplacer du texte.

### G.2 Deux ajouts que la maquette ne demandait pas

Signalés parce qu'ils changent l'écran, et qu'il faut pouvoir les refuser :

- **l'hôte de l'adresse externe est affiché avant le clic**, avec la mention que
  la candidature se fait ailleurs. C'est la seule information qui permette de
  reconnaître une adresse sans rapport avec l'entreprise annoncée ;
- **quand l'offre n'est pas vérifiée, un encart le dit** — « relue, pas
  vérifiée », avec l'avertissement qu'aucun recruteur sérieux ne réclame
  d'argent au candidat. Sans lui, l'absence de badge ne se remarque pas, et
  c'est précisément sur les offres sans badge que le risque existe.

C'est l'écran où quelqu'un s'apprête à envoyer son CV à un inconnu. Il m'a
semblé qu'il ne pouvait pas se contenter d'être joli.

---

## Récapitulatif

**À dessiner en priorité** — deux écrans restants :

1. `/achat/[orderId]` · quatre états (attente, payé, gratuit, échoué)
2. Les pages 404 / erreur / chargement

> Les trois écrans de l'abonnement mobile money ont été dessinés et câblés en
> v1.42.0 (§A.4). La réinitialisation de mot de passe, le choix du type de
> compte et le panneau des versements l'ont été en v1.43.0 (§A.1).

**À compléter** — trois décisions de conception :

4. Le sélecteur de moyen de paiement
5. Comment l'espace acheteur nomme ce qu'on possède *(le plus important)*
6. Les états « en attente » et « abandonnée » d'une commande

**À trancher** : les courriels en HTML, ou pas.

**À dessiner, nouvelle famille** : les badges (§E) — vingt-cinq badges en sept
familles, dont **cinq qui ouvrent des droits** et doivent être visuellement
impossibles à confondre avec les vingt autres.
