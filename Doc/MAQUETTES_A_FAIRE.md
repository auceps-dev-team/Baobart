# Maquettes manquantes ou décalées — relevé du 31 août 2026

**Application v1.41.0** · confronté à `Baobart Design/*.dc.html`

> Mis à jour le 2 septembre 2026 : la section **A.4** ajoute les trois écrans
> nés de l'abonnement mobile money et de l'application installable.

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

### A.1 — `/reinitialiser/[jeton]` · Choisir un nouveau mot de passe

Le quatrième écran d'authentification. `Baobart Auth.dc.html` en couvre trois —
connexion, inscription, mot de passe oublié — et s'arrête là. Celui-ci est
l'écran sur lequel arrive quelqu'un qui **clique le lien reçu par courriel**.

Il a **deux états**, et le second compte autant que le premier :

**État « le lien est valable »**
- Titre : *Nouveau mot de passe*
- Sous-titre : *Choisis-le, puis retape-le pour être sûr.*
- Deux champs mot de passe : le nouveau (avec la jauge de force, comme à
  l'inscription) et sa confirmation (sans jauge)
- Une case à cocher : *Je comprends que mes autres sessions vont se fermer*
- Bouton : *Changer le mot de passe*
- Argumentaire à gauche : *Choisis ta nouvelle clé* — lien à usage unique,
  valable une heure ; toutes les sessions ouvertes se ferment ; aucun mot de
  passe stocké en clair

**État « le lien ne marche plus »** — c'est celui qui manque le plus
- Deux raisons différentes, deux textes différents :
  - **périmé ou déjà utilisé** : *Il a déjà servi, ou l'heure de validité est
    passée. C'est voulu : un lien de réinitialisation est une clé, et une clé
    qui traîne indéfiniment dans une boîte mail finit par être ramassée par
    quelqu'un d'autre.*
  - **inconnu** : *Ce lien ne correspond à aucune demande. Vérifie que tu l'as
    copié en entier — les messageries en coupent parfois la fin.*
- Un lien : *Demander un nouveau lien* → `/mot-de-passe-oublie`
- **Pas de formulaire.** Rien à remplir : il n'y a rien à valider.

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

### A.4 — L'abonnement mobile money et l'application installable

Trois écrans arrivés en v1.40.0 et v1.41.0. Aucun n'a de modèle : leur
apparence est de moi, et suit la charte sans plus.

**`/abonnement/[id]/renouveler`** — où mènent toutes les relances Ndank, donc
l'écran le plus vu par un abonné sur le point de perdre son accès. Il réutilise
le sélecteur de rails du parcours d'achat, mais il l'entoure de trois états que
rien ne décrit :
- **il reste des jours** — « il te reste N jours d'accès » ;
- **l'accès est suspendu** — un renouvellement le rétablit immédiatement, et
  l'ancienneté est conservée ;
- **l'abonnement est clos** — pas de bouton, on en reprend un neuf.

La phrase qui porte tout : *« Rien n'est prélevé sans ta validation. »* Elle
n'est pas rassurante par politesse, elle est mécaniquement vraie — le mobile
money ne sait pas prélever. C'est ce qui distingue un abonnement Baobart d'un
abonnement à carte dont on a peur, et cela mériterait d'être dessiné plutôt
qu'écrit dans un encart.

**`/abonnement/[id]/paiement/[paiementId]`** — le retour depuis l'opérateur,
jumeau de `/achat/[orderId]` (§A.2) avec trois états : *en attente*,
*renouvelé*, *refusé*. Une différence de fond : l'information principale n'est
pas « c'est payé » mais **la prochaine échéance**. C'est la seule chose qui
évite à quelqu'un de revenir vérifier chaque semaine.

**Le réglage des notifications**, sur `/dashboard/forfait`. Cinq états, et les
quatre derniers comptent autant que le premier :
- **inactif** — le seul avec un bouton. Il dit à quoi sert la permission AVANT
  de la demander : un refus est définitif côté web, on ne peut plus jamais
  redemander ;
- **actif** — « actives sur cet appareil », plus un moyen d'arrêter ;
- **refusé** — il faut expliquer que ça se rétablit dans les réglages du
  navigateur, parce que nous ne pouvons plus rien ;
- **navigateur incapable** — sur iPhone, il faut d'abord ajouter Baobart à
  l'écran d'accueil. Sans cette phrase, un utilisateur iOS ne comprend pas
  pourquoi il n'a pas de bouton ;
- **Baobart pas configuré** — aucune clé côté serveur ; on ne montre pas un
  bouton qui échouerait.

À dessiner aussi : **l'invitation à installer**. Il n'y en a aucune aujourd'hui
— l'application est installable, et rien ne le dit. C'est pourtant là qu'est
l'économie : chaque abonné qui installe est un SMS qu'on n'envoie pas.

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
| PAGE CREATEURS · PROFIL CREATEUR | `/createurs`, `/@[username]` | Aucun code — **on peut suivre quelqu'un sans pouvoir visiter sa page** |
| PANIER | `/panier` | Aucun code — l'achat se fait à l'unité |
| PAGE JOBS · FICHE MISSION | `/jobs` | Aucun code (micro-service M4) |
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

## Récapitulatif

**À dessiner en priorité** — six écrans :

1. `/reinitialiser/[jeton]` · deux états (valable, plus valable)
2. `/achat/[orderId]` · quatre états (attente, payé, gratuit, échoué)
3. Les pages 404 / erreur / chargement
4. `/abonnement/[id]/renouveler` · trois états — **le plus vu par un abonné sur
   le point de perdre son accès**
5. `/abonnement/[id]/paiement/[paiementId]` · trois états
6. Le réglage des notifications · cinq états, plus l'invitation à installer
   qui n'existe pas encore

**À compléter** — trois décisions de conception :

4. Le sélecteur de moyen de paiement
5. Comment l'espace acheteur nomme ce qu'on possède *(le plus important)*
6. Les états « en attente » et « abandonnée » d'une commande

**À trancher** : les courriels en HTML, ou pas.
