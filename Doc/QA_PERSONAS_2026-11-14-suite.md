# Baobart — éprouver l'application face à ses utilisateurs

> **Ce que c'est.** La suite de la recette par personas du 14/11/2026
> (`Doc/QA_PERSONAS_2026-11-14.md`) : six pistes que personne n'avait
> demandées, pour éprouver l'application face à ses utilisateurs, et le mode
> d'emploi de la régie qui permet de regarder les personas agir en direct.
>
> **D'où vient ce fichier.** C'est l'export Markdown d'un document partagé sur
> claude.ai, rédigé par Claude à la demande du responsable du dépôt. Les
> mesures datent du 14/11/2026, sur `main` v1.107.0 (`132c75e`). Le document
> partagé peut avoir évolué depuis : en cas d'écart, il fait foi pour les
> commentaires, ce fichier pour l'historique du dépôt.
>
> **Pour rejouer sans l'auteur**, tests, régie et pistes : le mode d'emploi pas à
> pas est [`QA_PERSONAS_2026-11-14/REJOUER.md`](QA_PERSONAS_2026-11-14/REJOUER.md).
>
> Les chemins `qa/…` cités plus bas supposent qu'on a copié
> `Doc/QA_PERSONAS_2026-11-14/outils/` dans `qa/` à la racine (voir « Refaire
> soi-même »).

## En une page

Baobart tient son cœur de métier, mais pas toutes ses promesses : une classe ne peut pas s'inscrire, un visiteur anglophone fait planter la page, et l'argent de la créatrice bouge sans qu'elle le sache. La seconde campagne, menée le 14/11/2026, ajoute huit défauts, dont quatre majeurs, aux 36 de la première. Onze défauts sont désormais rejoués par des tests automatiques.

| Piste | Ce qui a été mesuré | Nouveaux défauts |
| --- | --- | --- |
| 1. Promesses contre réalité | 38 promesses des pages publiques : 20 tenues, 9 non tenues ou à moitié, 5 invérifiables ici, 4 renvoyées à la piste 3 | Q-37 majeur, Q-38 |
| 2. La salle de classe | 4 comptes créés sur 30 élèves d'une même connexion ; attente annoncée jusqu'à 108 minutes | Aucun : chiffre Q-01 |
| 3. L'horloge | 35 jours simulés ; les délais écrits sont tenus, l'argent non | Q-39 majeur, Q-40, Q-41 majeur, Q-42 |
| 4. Tests automatiques | 11 défauts rejoués : 11 rouges sur 11 en mode strict, 11 verts en mode normal | Aucun |
| 5. Yao en anglais | Avec la traduction de Chrome, un clic sur « J'aime » plante la page | Q-43, Q-44 majeur |
| 6. Une vraie séance | Protocole prêt pour 20 séances ; non joué | Aucun |

### Les quatre nouveaux défauts majeurs

- **Q-37** — Quand une créatrice dépublie une ressource, l'acheteur qui n'avait pas encore téléchargé ne retrouve plus ses fichiers payés.
- **Q-39** — Au bout de sept jours sans réponse, une demande de remboursement attend l'équipe sans que personne en soit prévenu.
- **Q-41** — Un remboursement fait deux jours avant un versement n'en est pas déduit : la plateforme avance l'argent. À confirmer : ce peut être un choix.
- **Q-44** — Avec la traduction automatique, « J'aime » ou « Suivre » font planter la page.

### Par où commencer, selon l'auteur

1. **Q-01**, l'inscription limitée par connexion : c'est la porte d'entrée, et le partenariat avec les écoles en dépend.
2. **Q-44**, la traduction : elle touche tout le public non francophone, dès le premier clic.
3. **Q-37**, les fichiers payés introuvables : c'est de l'argent, et une promesse écrite.
4. **Q-39 et Q-41**, l'argent de la créatrice : une décision à prendre avant d'ouvrir les versements réels.

### Ce que ce document vaut comme preuve

**Mesuré** veut dire observé le 14/11/2026 sur l'application qui tourne ; **lu** veut dire tiré d'un écran ou du code, sans aller plus loin. Les observations viennent d'une seule personne, l'auteur de la recette. Les onze tests automatiques sont la première preuve que quelqu'un d'autre peut rejouer telle quelle. Aucun test de sécurité n'a été fait.

Pour voir les défauts plutôt que les lire, la régie montre les quatre personas en direct (section « Refaire soi-même »).

## La méthode

On utilise l'application comme le ferait un client débutant, un geste à la fois, en regardant l'écran après chaque geste. Aucun audit précédent n'a été lu : c'était la consigne.

### Quatre questions avant chaque tâche

La règle vient du dépôt : aucune tâche ne commence sans ces quatre réponses écrites, et le compte rendu final dit pour chacune si elle a été appliquée.

| Question | Ce que la réponse devient |
| --- | --- |
| Que ferait le meilleur expert, qu'on ne m'a pas demandé ? | Le périmètre |
| Quelle est la matière la plus brute dont je peux partir ? | La première action : la collecter avant de construire |
| Quels outils et méthodes précis utiliserait-il ? | Le mode opératoire |
| Qu'est-ce qui, à part moi, prouverait que le résultat est bon ? | Le critère de fin |

### Les personas

Les quatre premiers viennent du bilan marketing du projet, qui précise qu'ils sont « construits, pas interviewés ». Chacun a son navigateur : écran, langue et fuseau horaire séparés.

| Persona | Qui | Écran simulé | Langue et fuseau |
| --- | --- | --- | --- |
| Awa Diallo | Illustratrice à Dakar, veut vendre et être payée en FCFA | Téléphone, 360 × 740 | fr-SN, Dakar |
| Serge Nkosi | Lead designer d'agence à Abidjan, achète pour son équipe | Ordinateur, 1440 × 900 | fr-CI, Abidjan |
| Yao Mensah | Étudiant en design à Accra, budget nul, veut des concours | Téléphone, 390 × 780 | en-GH, Accra |
| Fatou Sow | Directrice artistique à Paris, paie en euros | Portable, 1280 × 800 | fr-FR, Paris |
| Mariam Koné | Équipe Baobart, ajoutée pour la modération | Ordinateur, 1366 × 800 | fr-FR, Abidjan |

### Les règles de comportement

Chaque formulaire a été joué trois fois, comme le ferait quelqu'un sans expérience :

1. envoyé vide ;
2. rempli avec la saisie naturelle d'un débutant : « 5 000 F » dans un prix, « Sénégal » là où le champ attend « SN », un numéro sans indicatif ;
3. validé par double appui, ou par quatre appuis sur réseau lent.

Les comptes ont été inscrits à la main, un par un, par la page d'inscription : l'inscription et la connexion font partie du test. Seule exception, annoncée d'avance : le rôle d'administratrice, qu'aucun écran n'accorde.

Deux limites posées en cours de route par le responsable du dépôt : aucun test de sécurité, et aucune défense du site contournée. Les données sont utilisées telles quelles.

### Ce qui compte comme un défaut

- **Défaut** : observé, puis rejoué au moins une seconde fois avec le même résultat.
- **Observé une fois** : vu, non reproduit. Noté, pas compté.
- **Innocenté** : soupçonné, vérifié, et finalement pas un défaut. Trois fois, la première impression était fausse ; ces cas sont écrits aussi.

Partout dans ce document, **mesuré** veut dire observé ce jour-là sur l'application qui tourne, et **lu** veut dire tiré d'un écran ou d'un fichier sans vérification au-delà.

## L'environnement de test

Tout a tourné sur une copie isolée de l'application : rien n'a touché la base de développement ni la copie de travail principale. L'application est la version `main` 1.107.0 (commit `132c75e`), compilée comme en production, avec le paiement simulé.

| Ressource | Valeur | Pourquoi à part |
| --- | --- | --- |
| Copie de travail | `Baobart-qa-claude`, branche `claude/qa-personas` | La copie principale servait à un autre chantier |
| Base de la recette | `baobart_e2e_claude` | Les comptes des personas y vivent ; sauvegardée avant les tests |
| Base des tests automatiques | `baobart_e2e_claude_tests` | Le lanceur de tests la vide à chaque passage |
| Application | port 3400 ; 3410 pour les tests automatiques | 3100, 3200 et 3300 sont pris par d'autres |
| Pilote et régie | port 3499 |  |
| Stockage de fichiers | conteneur `baobart-minio-qa-claude`, port 9100 | MinIO n'existait plus sur ce poste |
| Courriels | conteneur `baobart-mailpit-qa-claude`, lecture sur 8125 | Pour lire les codes et liens reçus |

Le détail de l'installation est dans `Doc/QA_PERSONAS_2026-11-14.md`, section 4, sur la branche.

### Les pièges de cette seconde campagne

Mesurés le 14/11/2026. Les six pièges de la première campagne restent valables.

1. **Le poste a redémarré à 18 h 39 pendant une pause.** Docker, l'application et le pilote se sont arrêtés sans rien dire ; la première commande suivante a échoué sur « connexion refusée ». Docker Desktop ne démarre pas tout seul ici : il est installé dans le dossier de l'utilisateur, pas dans `Program Files`.
2. **L'anti-automate du site refuse une inscription remplie en moins de deux secondes.** C'est voulu. Un outil qui remplit d'un coup doit taper à vitesse humaine, sinon il mesure l'anti-automate et non l'inscription (piste 2).
3. **Une base de tests neuve doit être créée à la main avant le premier lancement**, avec `node scripts/setup-test-db.mjs e2e`. Le lanceur attend que le serveur réponde avant de créer la base. `CLAUDE.md` le dit, et c'est arrivé quand même.
4. **Les compteurs de tentatives vivent dans la mémoire du serveur.** Une passe ratée les remplit : il faut redémarrer le serveur avant de rejouer.
5. **Une horloge avancée ne déplace que le serveur.** La base garde l'heure vraie pour ses dates par défaut, le stockage refuse les liens signés en avance, le navigateur compte à rebours à l'heure vraie (piste 3).
6. **Un serveur lancé depuis une commande s'arrête avec elle.** Deux fois, arrêter une commande trop longue a emporté le pilote qu'elle avait lancé. Le pilote tourne maintenant comme une tâche à part.

## La première campagne : 36 défauts

La recette du 14/11/2026 au matin a relevé 36 défauts, dont 10 majeurs, en faisant jouer l'application à quatre clients types et une administratrice. Le détail, étape par étape, est dans `Doc/QA_PERSONAS_2026-11-14.md`, versé au dépôt par la PR #57.

Le cœur fonctionne : publier, acheter, télécharger, rembourser, commenter, postuler, écrire au support. Aucun doublon n'a été créé, même en tapotant les boutons sur réseau lent. Ce qui coince, c'est l'entrée (l'inscription) et le téléphone.

| N° | Défaut majeur | Test automatique (piste 4) |
| --- | --- | --- |
| Q-01 | L'inscription se ferme une demi-heure après cinq envois, formulaires vides compris, pour toute la connexion | Écrit, éteint |
| Q-02 | Une seule erreur vide les six champs de l'inscription | Oui |
| Q-03 | Sur téléphone, les sous-menus ne s'ouvrent pas : Jobs, Services, Concours, Contact, Support introuvables | Oui |
| Q-04 | Sur téléphone, le contenu commence sous le menu, hors du premier écran | Oui |
| Q-05 | Une offre de stage est enregistrée en « freelance à distance » après un refus du serveur | Oui |
| Q-06 | Une collection partagée dans une communauté ne s'ouvre pas | Oui |
| Q-07 | Le refus du profil de boutique s'affiche quatre écrans au-dessus du bouton | Oui |
| Q-08 | « Rembourser » part au premier appui, sans confirmation | Oui |
| Q-09 | Le bouton « Payer » affiche un autre montant que celui qui sera débité | Oui |
| Q-10 | Un code promo faux fait sortir du paiement | Oui |

Les 26 autres sont mineurs ou de texte : un appui sur Échap qui ferme deux fenêtres, une heure de concours sans fuseau, des accents manquants, le contraste de certaines couleurs.

Deux constats de cette campagne ont été corrigés par la seconde : le compteur de vues fonctionne, et la confirmation d'inscription à un concours existe (voir la piste 1).

## Piste 1 — Promesses contre réalité

Sur 38 promesses relevées dans le texte des pages publiques, 20 sont tenues, 9 ne le sont pas ou seulement à moitié, 5 ne peuvent pas être vérifiées dans cet environnement, et 4 dépendent du temps : elles sont jouées à la piste 3. La plus lourde : quatre pages promettent un versement « chaque semaine », alors que le réglage par défaut est « chaque mois ».

**Comment.** Le texte rendu de 30 pages publiques a été relevé dans le navigateur, puis chaque phrase qui engage (un chiffre, un délai, une garantie) a été jouée par un persona. Les modèles de courriel n'ont pas été relus un à un : seuls les courriels réellement partis ont servi.

### Les promesses non tenues, ou à moitié

| Promesse | Où elle est écrite | Ce qui a été mesuré le 14/11/2026 |
| --- | --- | --- |
| « Ton solde part chaque semaine » | Fonctionnalités (deux fois), À propos, Documentation, FAQ des tarifs | L'écran Versements d'une nouvelle vendeuse est réglé sur « Chaque mois — le rythme par défaut ». La cadence hebdomadaire est une option à choisir. La suite est à la piste 3. |
| « Tu peux la dépublier à tout moment. Ceux qui l'ont achetée gardent leurs fichiers » | Règles de publication | Faux pour l'acheteur qui n'a pas encore téléchargé. Sa bibliothèque affiche « À télécharger · Les 4 fichiers », et ce lien mène à « Cette page n'existe pas ». Aucun autre écran ne lui donne ses fichiers. **Nouveau défaut majeur, Q-37.** |
| « Collections partagées » avec ton équipe | Accueil (deux fois), Fonctionnalités, Documentation | La collection partagée dans une communauté s'affiche sans aucun lien : personne ne peut l'ouvrir (Q-06, première campagne). |
| « 6 903 F crédités aux créateurs sur les ventes des sept derniers jours » | À propos | Le chiffre compte une vente remboursée. Au moment du relevé, la seule créatrice détenait 1 903 F, soit 3,6 fois moins. |
| « Ou continuer avec » Téléphone, Google, Apple et six autres | Inscription | Les neuf boutons sont désactivés. |
| « Vends à tout le monde » | À propos | Quatre pays de facturation : Sénégal, Côte d'Ivoire, Ghana, Bénin. Fatou, à Paris, ne trouve pas le sien. |
| « Des téléchargements gratuits chaque mois » | Inscription | Contredit la page Tarifs, qui écrit « toutes les ressources offertes, sans limite ». Aucun quota n'a été rencontré. |
| « Un remboursement intégral referme l'accès au fichier » | Support, FAQ | L'accès est bien fermé. Mais l'historique affiche toujours « Disponible · Télécharger », et le bouton mène à une page blanche (erreur 403). |
| « Laisse l'acheteur choisir au-dessus d'un minimum » | Accueil, Fonctionnalités, À propos | Le prix libre fonctionne : 2 000 F payés pour un minimum de 500 F. Mais le bouton affiche « Payer 1 500 F » quel que soit le montant choisi. C'est Q-09, élargi. |

### Les promesses tenues

| Promesse | Preuve mesurée |
| --- | --- |
| « Garde 88,5 % de chaque vente » | Trois ventes : 5 000 F donnent 4 425 F ; 2 800 F donnent 2 478 F ; 2 000 F donnent 1 770 F. Exact au franc près, avec des frais d'opérateur simulés à 1,5 %. |
| « Des codes promo, à ta charge » | La part est calculée sur le prix réduit (2 800 F), pas sur le prix affiché (3 500 F). |
| « Un courriel de confirmation, puis rien sans ton clic. Désinscription en un lien. » | L'adresse passe de « en attente » à « confirmée » au clic, puis à « désinscrite » par le second lien. |
| « Un seul cookie facultatif. Le refuser ne change rien. » | Aucun cookie avant le choix. Un seul après, celui qui retient le choix, que l'on refuse ou que l'on accepte. |
| « Pas de traceur d'un autre site » | Aucune requête vers un autre site sur quatre pages. |
| La clé de licence, « sur la fiche dès que l'achat est payé », sans 0, O, 1, I ni L | Présente sous le bouton, au format annoncé. |
| La vérification d'une clé par un programme | L'appel décrit sur la page Licences répond comme écrit : compteur d'utilisations, option pour ne pas compter, « introuvable » pour une clé inconnue ou pour une autre ressource, aucune donnée sur l'acheteur. |
| « La recherche lit le titre, puis les mots-clés » | « gratuit », absent du titre, trouve la ressource qui porte ce mot-clé. |
| « 200 Mo max » et les formats acceptés | 201 Mo refusé tout de suite avec un message clair. SVG, TTF, WAV et GLB acceptés. Le plus gros fichier réellement déposé fait 48 Mo. |
| Le délai de remboursement, « figé au jour de ton achat » | La créatrice passe de 30 à 7 jours. L'achat ancien reste remboursable jusqu'au 14 décembre, le nouveau jusqu'au 21 novembre. |
| « Une ressource déjà vendue ne se supprime pas » | Le bouton de suppression n'est plus proposé. |
| « Ta ressource paraît aussitôt » | Publiée et visible dans la seconde. |
| « Tu vois combien de visiteurs passent » | Une visite depuis un téléphone fait passer le compteur de 0 à 1. Voir la correction ci-dessous. |
| La photo de profil publiée « sans ce qu'elle disait de l'endroit » | Un portrait portant des coordonnées GPS est publié en 400 × 400, sans aucune donnée de prise de vue. |
| Le bouton « Contact » d'une vitrine | Le message arrive à la créatrice (première campagne). |
| Le partage vers WhatsApp, Facebook, X, LinkedIn, Pinterest, Threads, courriel, copie | Les huit boutons sont sur la fiche. |
| La demande de sponsoring | Enregistrée, avec le message « L'équipe te répond à l'adresse que tu as donnée ». |
| Les forfaits payants | Affichés « bientôt », et la FAQ écrit : « ce qu'ils annoncent n'est pas encore appliqué ». |
| « Inscris-toi depuis sa fiche » (concours) | Fait par Yao à la première campagne. |
| « Double authentification, clés d'accès et effacement du compte : depuis ton profil » | Les trois rubriques sont à l'écran. Elles n'ont pas été essayées. |

### Ce qui ne se vérifie pas ici

- **Le paiement réel.** « La page sécurisée de Paystack », « mobile money et carte bancaire » : le paiement est simulé.
- **Les délais humains.** « Les services paraissent après relecture, reviens dans un jour ou deux » ; « l'équipe revient vers toi avec un plan et un tarif ».
- **Les rôles d'un espace** (membre, modérateur, administrateur) : non essayés.
- **Quatre promesses qui dépendent du temps**, jouées à la piste 3 : l'arbitrage au bout de sept jours, le lien de mot de passe valable une heure, la fiche d'un concours après sa date, la clôture d'une offre d'emploi.

### Deux corrections de la première campagne

- **Le compteur de vues fonctionne.** La première campagne avait écrit « les vues restent à 0 ». L'observation était juste, la conclusion fausse : le navigateur de test se présente comme un automate, et le site écarte les automates exprès.
- **La confirmation d'inscription à un concours existe.** Elle est éteinte par défaut, par choix écrit dans les tests du dépôt, et se règle dans les notifications. La première campagne avait écrit qu'elle n'existait pas.

### Un défaut de plus, trouvé en chemin

**Q-38 — Après un enregistrement réussi, les listes déroulantes réaffichent leur ancienne valeur.** Mesuré sur deux écrans : le délai de remboursement (enregistré à 7 jours, réaffiché à 30) et le mode de prix (enregistré « prix libre », réaffiché « prix fixe »). La bonne valeur revient au rechargement. C'est le mécanisme de Q-05, où une offre de stage était enregistrée comme une mission freelance.

## Piste 2 — La salle de classe

Sur trente élèves qui s'inscrivent depuis la même connexion, quatre obtiennent un compte. Les vingt-six autres lisent « Trop de tentatives », et l'attente annoncée passe de 22 à 108 minutes à mesure qu'ils réessaient. Mesuré le 14/11/2026, en 6 minutes 21 secondes.

C'est le défaut Q-01 de la première campagne, chiffré sur le scénario que le bilan marketing veut vendre aux écoles : « 200 étudiants d'un coup ».

### Le scénario, écrit avant de jouer

Chaque élève a son propre navigateur et remplit le formulaire d'inscription à vitesse de frappe humaine, l'un après l'autre. Rien n'est écrit en base par l'outil : il ne fait que remplir le formulaire.

| Profil | Élèves | Ce qu'il fait |
| --- | --- | --- |
| A | 18 | Remplit juste du premier coup |
| B | 6 | Tape un mot de passe de 7 caractères, puis corrige |
| C | 3 | Oublie la case des conditions, puis corrige |
| D | 3 | Touche le bouton sur le formulaire vide, puis remplit |

Douze élèves sur trente font donc une erreur, une seule. Un élève bloqué de profil B, C ou D retente une fois, tout de suite.

### Ce qui a été mesuré

| Mesure | Valeur | Ce que ça dit |
| --- | --- | --- |
| Comptes créés | 4 sur 30 | Les élèves 1 à 4. Le troisième a dû s'y reprendre à deux fois. |
| Premier élève bloqué | Le 5e | Au sixième envoi de la salle : son mot de passe trop court n'a même pas été examiné. |
| Envois de formulaire | 42 | Dont 5 examinés et 37 refusés sans examen. |
| Attente annoncée au 5e élève | 22 minutes |  |
| Attente annoncée au 14e | 60 minutes |  |
| Attente annoncée au 30e | 108 minutes | Plus longue que l'heure de la règle elle-même. |
| Saisie conservée après un refus | 0 fois sur 38 | Les six champs sont vidés à chaque refus (Q-02). |

### Pourquoi l'attente s'allonge

La règle est « cinq par heure et par adresse ». Lu dans le code : chaque envoi est compté avant d'être examiné, y compris ceux qui sont refusés. Chaque élève qui réessaie ajoute donc au compteur, et ce compteur pèse encore sur l'heure suivante.

Le commentaire de la règle dit vouloir « cinq comptes par heure », pour qu'une famille derrière un même routeur ne soit pas gênée. Ce qui est compté, ce sont cinq envois. Une salle qui insiste ne rentre jamais.

### Ce que cela veut dire pour une école

- Au rythme de la règle, et si personne ne se trompe ni ne réessaie, trente élèves demandent six heures. Deux cents en demandent quarante.
- La promesse « Deux minutes, aucune carte bancaire demandée » de la page d'inscription n'est tenue que pour les quatre premiers.
- La durée réelle du blocage n'a pas été attendue : les 108 minutes sont celles que l'écran annonce.

### Une première passe écartée, et ce qu'elle apprend

La première passe a été jetée : l'outil remplissait chaque formulaire en moins de deux secondes. Le site refuse tout envoi fait moins de deux secondes après l'ouverture de la page, pour écarter les automates, et il avait raison. Le serveur de test a été redémarré et la classe rejouée à vitesse humaine, sous d'autres adresses.

Cette passe ratée montre tout de même une chose : un envoi refusé comme « trop rapide » reçoit le message « Quelque chose a coincé. Réessaie dans un instant. » et consomme lui aussi un des cinq essais. Quatre refus de ce type et une inscription ont suffi à fermer la salle.

## Piste 3 — L'horloge

Les délais écrits sont tenus, mais l'argent se comporte autrement que les pages ne le disent. En faisant vieillir le serveur de 35 jours, quatre nouveaux défauts apparaissent, dont deux touchent l'argent de la créatrice.

### Comment le temps a été avancé

Le serveur de test a été redémarré six fois avec une horloge décalée : il croit qu'il est plus tard. Les données ne sont pas modifiées. À chaque étape, les tâches planifiées de l'application (celles qu'un ordonnanceur appelle chaque nuit) ont été appelées, puis les écrans relus.

Trois choses ne vieillissent pas avec le serveur, et bornent ce qu'on peut conclure : la base garde l'heure vraie pour ses dates par défaut, le stockage de fichiers refuse les liens signés en avance, et le navigateur calcule lui-même les comptes à rebours. Aucun téléchargement n'a donc été jugé sous décalage.

### Ce qui s'est passé, étape par étape

| Quand | Ce qui a été mesuré | Verdict |
| --- | --- | --- |
| + 2 heures | Le lien de mot de passe demandé par Fatou affiche « Ce lien a fait son temps » et propose d'en demander un autre. | Tenu : « valable une heure » |
| J+3, mardi 17 nov. | Le passage des versements ne prépare rien. Awa lit « 3 673 F en attente de validation ». | Tenu : sept jours de rétention |
| J+8, dimanche 22 nov. | L'achat fait avec un délai de 7 jours affiche « Le délai de remboursement de cet achat est passé ». | Tenu |
| J+8 | Le lien de confirmation de la lettre, vieux de huit jours, répond « Ce lien a expiré ». | Tenu : « le lien vaut 7 jours » |
| J+8 | La demande de remboursement laissée sans réponse apparaît sur l'écran de l'équipe. Mais aucune notification, aucun courriel, rien sur l'aperçu : il faut penser à ouvrir cet écran. L'acheteur lit toujours « En attente du créateur ». | **Q-39** |
| J+8 | L'équipe rembourse, en un clic, sans confirmation. Serge reçoit un courriel. Awa ne reçoit rien : ni courriel, ni notification. | **Q-40** |
| J+10, mardi 24 nov. | Le passage prépare un versement de 3 673 F pour Awa, « arrêté au 20 novembre ». Le remboursement de 2 800 F du 22 n'en est pas déduit. Awa lit ensuite : « Tu dois 2 800 F : des remboursements sont arrivés après ton dernier versement. » | **Q-41** |
| J+10 | Le versement reste « Préparé ». Rien n'est envoyé : aucun opérateur n'est branché. Awa ne reçoit ni courriel ni notification. | Non vérifiable au-delà |
| J+17, mardi 1er déc. | Rien de nouveau. Awa lit « Solde disponible −2 800 F ». |  |
| J+35, samedi 19 déc. | L'offre d'emploi, close depuis trois jours, n'est plus listée. La candidature de Yao et son CV sont effacés par le passage de nuit. | Tenu |
| J+35 | Serge est renvoyé à la connexion : les sessions durent 30 jours. | Attendu |

### Les quatre défauts de l'horloge

**Q-39 — « Sans réponse sous sept jours, l'équipe tranche » : personne n'est prévenu que le délai est passé.** La promesse est écrite sur cinq écrans. Au huitième jour, la demande est bien sur l'écran « Remboursements à trancher », mais l'équipe n'a ni notification ni courriel, et l'acheteur ne voit aucun changement. Si personne n'ouvre cet écran, la demande attend sans fin. Majeur.

**Q-40 — La créatrice n'apprend pas que l'équipe a remboursé à sa place.** Aucun courriel, aucune notification. Elle le découvre par une ligne « Tu dois 2 800 F » sur l'écran des gains. Sur les 35 jours, Awa n'a reçu aucun courriel : pas de rappel avant l'échéance des sept jours non plus. Mineur.

**Q-41 — Un remboursement fait deux jours avant un versement n'en est pas déduit.** Le versement préparé le 24 s'arrête aux mouvements du 20. Awa aurait reçu 3 673 F alors que son solde réel était de 873 F, et la plateforme aurait avancé 2 800 F, à récupérer sur des ventes futures qui peuvent ne jamais venir. Le texte « après ton dernier versement » est faux dans ce cas : le remboursement est arrivé avant. Majeur, à confirmer avec le responsable : cela peut être un choix, mais il n'est écrit nulle part côté créatrice.

**Q-42 — La cadence mensuelle ne paie pas le jour annoncé.** L'écran Versements écrit « un seul versement, le premier jour de versement du mois ». Mesuré : le versement d'Awa est préparé le 24 novembre, dernier mardi du mois. Lu dans le code : « un mensuel seulement au dernier cycle de son mois ». Texte.

### Ce que l'horloge confirme de la piste 1

La promesse « ton solde part chaque semaine » n'est pas tenue par défaut. Une vendeuse qui ne touche à rien est payée une fois par mois, au dernier cycle : une vente du 1er novembre aurait attendu le 24. Et dans cet environnement sans opérateur, le versement préparé ne part pas : l'écran des gains le dit lui-même.

### Ce que l'horloge n'a pas pu jouer

- **Le paiement abandonné** et sa relance : le paiement simulé aboutit tout de suite.
- **L'envoi réel d'un versement** et le courriel qui l'annonce.
- Le renouvellement du forfait gratuit, la parution planifiée d'un article et le « créateur du mois » : les tâches ont tourné, sans rien avoir à traiter.

## Piste 4 — Les défauts majeurs en tests automatiques

Onze défauts ont maintenant chacun un test de navigateur qui les rejoue sans intervention humaine. C'est la première preuve qui ne vient pas de l'auteur de la recette : n'importe qui peut lancer la commande et lire le même résultat.

Le fichier est `e2e/qa-personas.spec.ts`, dans la PR #58.

### Verts aujourd'hui, rouges le jour de la correction

Un test écrit normalement serait rouge tant que le défaut existe, et bloquerait toute l'équipe. Chaque test décrit donc le bon comportement, puis enferme cette seule vérification dans une enveloppe :

- le défaut est là : le test passe ;
- le défaut est corrigé : le test échoue, avec un message qui dit de retirer l'enveloppe. Il devient alors le garde-fou de la correction.

Les préparatifs (créer un compte, acheter, ouvrir la page) restent hors de l'enveloppe : s'ils cassent, le test échoue normalement. C'est ce qui a rattrapé une erreur de l'auteur pendant l'écriture, sur le test Q-08.

### Ce qui a été mesuré le 14/11/2026

| Passage | Résultat | Ce que ça prouve |
| --- | --- | --- |
| Mode strict, enveloppe retirée | 11 rouges sur 11 | Chaque défaut est rejoué, et chaque échec porte le message attendu |
| Mode normal | 11 verts, 1 éteint, en 1 min 18 s | Le fichier ne casse pas la suite de l'équipe |
| Lint et vérification des types | Aucune erreur |  |

| Défaut | Ce que le test attend | Ce qu'il reçoit aujourd'hui |
| --- | --- | --- |
| Q-02 Inscription vidée | Le courriel reste dans son champ après un mot de passe trop court | Champ vide |
| Q-03 Sous-menus au toucher | Jobs, Services et Concours atteignables en touchant le menu | Aucun des trois |
| Q-04 Contenu sous le menu | Le titre du tableau de bord dans les 740 px du premier écran | 982 px |
| Q-05 Offre d'emploi | « Stage » reste choisi après un refus du serveur | « Freelance » |
| Q-06 Collection partagée | Un lien vers la collection dans la communauté | Aucun lien |
| Q-07 Profil de boutique | Le message d'erreur visible à l'écran | Hors de l'écran |
| Q-08 Rembourser | Rien de remboursé après un seul appui | 4 000 F remboursés |
| Q-09 Bouton Payer | « Payer 2 500 F » après avoir choisi 2 500 F | « Payer 1 500 F » |
| Q-10 Code promo faux | L'achat aboutit, ou la page de paiement reste ouverte | Retour à la fiche |
| Q-37 Ressource dépubliée | La bibliothèque mène aux fichiers achetés | « Cette page n'existe pas » |
| Q-38 Liste après enregistrement | La liste affiche « 7 jours », le délai enregistré | « 30 jours » |

### Ce qui n'est pas automatisé

- **Q-01, l'inscription fermée après cinq envois.** Le test est écrit mais éteint. Le compteur est commun à tous les tests d'un même serveur : le jouer fermerait l'inscription aux autres tests pendant une heure. L'isoler demande de poser soi-même une adresse par test, ce qui touche à une défense du site ; cela sort du périmètre fixé pour cette recette.
- **Q-39 et Q-41**, les défauts de l'horloge : leur place est dans les tests des versements, qui savent déjà dater leurs données, pas dans un navigateur.

### La limite de cette preuve

Mesuré le 15/11/2026 : les tests ont été rejoués sur le `main` du jour (avec #57), puis dans l'intégration continue du dépôt, sur la PR #58. Les cinq contrôles sont verts ; « Parcours au navigateur » : 43 verts, 1 désactivé, comme sur le poste de l'auteur. Reste un rejeu par une autre personne, avec le seul mode d'emploi `Doc/QA_PERSONAS_2026-11-14/REJOUER.md`.

## Piste 5 — Yao en anglais

Un visiteur qui lit le site avec la traduction automatique de Chrome fait planter la page au premier « J'aime ». Mesuré le 14/11/2026 dans le vrai Chrome 157, avec un membre connecté : écran « Application error », plus aucun bouton ne répond, il faut recharger.

C'est la situation normale de Yao. Le site est entièrement en français et n'a pas de version anglaise ; son navigateur, réglé en anglais, lui propose donc de traduire chaque page.

### Comment

La traduction de Chrome ne change pas seulement les mots : elle remplace chaque morceau de texte de la page par deux balises qui portent la traduction. L'application, elle, croit toujours tenir ses morceaux de texte d'origine. Quand elle veut les modifier, ils ne sont plus là.

Deux passes ont été faites :

1. **Un traducteur simulé**, qui reproduit ce remplacement en mettant le texte entre crochets, sans rien envoyer hors du poste. Il a servi à trouver les gestes fragiles.
2. **Le vrai Chrome**, avec un profil neuf réglé sur « toujours traduire le français en anglais ». Il a servi à confirmer. Le texte des pages de test est alors parti chez le service de traduction de Google : uniquement des données fictives.

Chaque geste a été joué aussi sans traduction, comme témoin. Aucun témoin n'a planté.

### Ce qui a été mesuré

| Geste | Traducteur simulé | Vrai Chrome traduit |
| --- | --- | --- |
| Lire les pages, naviguer, revenir en arrière | Tenu | Tenu : 214 morceaux de texte traduits sur une fiche |
| L'indice « Encore 3 caractères » sous le mot de passe | Tenu | Non joué |
| « J'aime », visiteur non connecté | **Plante** : « Quelque chose a cassé » | Tenu |
| « J'aime », membre connecté | Tenu | **Plante** : « Application error » |
| « Suivre », membre connecté | **Plante** : « Application error » | Non jouable après le plantage |
| Filtrer la mosaïque par famille | Le compteur reste à « 3 ressources affichées » | Le compteur reste à « 3 resources displayed » |

Les deux traducteurs ne plantent pas sur les mêmes gestes : le défaut dépend de l'ordre exact dans lequel la page change. Ce qui est constant, c'est le mécanisme, et le message dans la console : « Failed to execute 'removeChild' on 'Node' ».

Après le plantage dans le vrai Chrome, la page rechargée montre que le clic avait bien été enregistré : l'action passe, c'est l'écran qui tombe.

### Les deux défauts

**Q-44 — Avec la traduction automatique, un clic sur « J'aime » ou « Suivre » fait planter la page.** Majeur : il touche tout visiteur dont le navigateur n'est pas en français, et c'est le public anglophone que vise le bilan marketing au Ghana. Le test automatique de la piste 4 ne le couvre pas encore.

**Q-43 — Avec la traduction, le compteur de la mosaïque ne bouge plus.** Le filtre s'applique, mais le texte « 3 ressources affichées » reste. Mineur.

### Ce que le site déclare

La page se déclare en français. Elle ne dit nulle part qu'une partie ne doit pas être traduite, et ne propose aucune autre langue. Le navigateur de Yao, en anglais, reçoit la même page que celui d'Awa.

La piste pour corriger est connue des développeurs React : marquer « à ne pas traduire » les petits morceaux de texte qui changent (compteurs, libellés de boutons), ou les entourer d'une balise à eux. C'est une piste, non vérifiée ici.

## Piste 6 — Une vraie séance d'utilisateurs

Cette piste n'a pas été jouée : seules de vraies personnes peuvent la jouer. Ce qui suit est le protocole prêt à l'emploi, pour vingt séances de 45 minutes, cinq par persona.

Les avis de persona écrits dans la première campagne ont été rédigés par l'auteur. Ils ne remplacent pas cette séance et ne doivent pas être cités comme des témoignages.

### Ce que la séance doit trancher

Chaque hypothèse vient d'un défaut mesuré. La séance dit s'il gêne vraiment, et combien.

| Hypothèse | Défaut d'origine | Ce qui la confirmerait |
| --- | --- | --- |
| Une classe ne peut pas s'inscrire ensemble | Q-01 | Moins de la moitié d'une classe de 10 inscrite en 15 minutes |
| Sur téléphone, personne ne trouve les concours ni les offres d'emploi | Q-03 | 3 personnes sur 5 abandonnent la tâche |
| « Tu dois 2 800 F » inquiète une créatrice au point de la faire partir | Q-08, Q-41 | 3 sur 5 disent qu'elles ne publieraient plus |
| Un anglophone traduit la page, et elle plante | Q-44 | La traduction est activée spontanément par 3 sur 5 |
| Un acheteur ne retrouve pas un fichier payé | Q-37 | Une seule fois suffit : c'est de l'argent |
| La promesse « chaque semaine » est comprise comme un versement hebdomadaire | Piste 1 | 3 sur 5 citent la semaine quand on leur demande quand ils seront payés |

### Qui recruter

- **Comme Awa** : vend déjà des créations en ligne ou sur WhatsApp, n'a jamais utilisé de boutique en ligne. Dakar ou Abidjan.
- **Comme Serge** : achète des visuels pour des clients, dans une agence ou en indépendant.
- **Comme Yao** : étudiant en design, anglophone. Accra. Pour l'hypothèse Q-01, une séance groupée de dix étudiants dans la même salle, sur le même Wi-Fi.
- **Comme Fatou** : directrice artistique en France, cliente possible de créatrices africaines.

Cinq personnes par profil est la règle courante en tests d'usage (Nielsen), citée ici de mémoire, sans source ouverte. Personne de l'équipe, ni de leurs proches.

### Le matériel

- **Leur propre téléphone ou ordinateur, et leur propre connexion.** C'est ce que la recette n'a pas pu simuler : un vrai réseau mobile, un vrai clavier, leurs réglages de langue.
- Une copie du site avec le paiement simulé : personne ne paie, personne ne donne de numéro de carte.
- Les comptes créés par les participants eux-mêmes, puis effacés après la séance.

### Le déroulé d'une séance de 45 minutes

1. **Accueil, 5 minutes.** On explique qu'on teste le site, pas la personne. Consentement écrit, enregistrement de l'écran seulement si elle l'accepte.
2. **Tâches, 30 minutes.** La personne pense à voix haute. L'observateur ne l'aide pas ; après 3 minutes bloquée, la tâche est notée échouée et on passe à la suivante.
3. **Entretien, 10 minutes.** Les questions de la fin de cette section.

### Les tâches, par profil

| Profil | Tâche, dite à la personne | Réussie si |
| --- | --- | --- |
| Awa | « Crée ton compte. » | Arrivée sur le tableau de bord |
| Awa | « Mets en vente une de tes créations à 2 000 F. » | Ressource publiée, avec un fichier |
| Awa | « Fais en sorte d'être payée sur ton Wave. » | Compte de versement enregistré |
| Awa | « Quand recevras-tu l'argent d'une vente faite aujourd'hui ? » | Réponse juste, lue à l'écran |
| Awa | « Un acheteur demande à être remboursé. Réponds-lui. » | Décision prise en connaissance de cause |
| Serge | « Trouve un mockup de menu pour un restaurant client, et achète-le avec le code promo donné. » | Achat abouti au prix réduit |
| Serge | « Montre cette ressource à ton équipe. » | Un collègue peut l'ouvrir |
| Serge | « Publie une offre de stage hybride à Abidjan. » | Offre enregistrée avec ces trois valeurs |
| Serge | « Ton client demande une preuve que tu as le droit d'utiliser ce visuel. » | Clé ou licence trouvée |
| Yao | « Crée ton compte. » (seul, puis en séance groupée) | Compte créé en moins de 5 minutes |
| Yao | « Trouve un concours et inscris-toi. » | Inscription enregistrée |
| Yao | « Postule à l'offre de stage, avec ton CV. » | Candidature reçue |
| Yao | « Mets un J'aime à une ressource que tu trouves belle. » | Le J'aime est enregistré et la page tient |
| Fatou | « Trouve une illustratrice qui travaille le wax, et écris-lui. » | Message envoyé |
| Fatou | « Achète une de ses ressources. » | Achat abouti, ou blocage noté avec sa raison |

### La grille d'observation, une ligne par tâche

| Ce qu'on note | Comment |
| --- | --- |
| Issue | Réussie seule, réussie après une hésitation, échouée |
| Temps | En secondes, du début de la consigne à l'issue |
| Premier clic | Où la personne a touché en premier |
| Erreurs | Chaque message d'erreur vu, mot pour mot |
| Citation | Ce qu'elle a dit à voix haute au moment où elle a hésité |
| Facilité perçue | « Sur une échelle de 1 à 7, c'était facile ? » posée juste après la tâche |

### Les questions de l'entretien

1. Qu'est-ce que tu as aimé ?
2. Qu'est-ce qui t'a gêné ?
3. Qu'est-ce qui ne te servirait à rien ?
4. Pour quoi serais-tu prêt à payer, et combien ?
5. Aujourd'hui, comment fais-tu sans ce site ? Pourquoi changerais-tu ?

### Le message de recrutement

> Bonjour ! Nous préparons Baobart, un site où les créatifs d'Afrique de l'Ouest vendent leurs illustrations, mockups et polices. Nous cherchons des personnes pour l'essayer 45 minutes, sur leur propre téléphone, et nous dire franchement ce qui ne va pas. Aucun paiement réel, aucune donnée gardée après la séance. Intéressé(e) ? Réponds simplement à ce message.

> Hello! We are building Baobart, a site where West African creatives sell their illustrations, mockups and fonts. We are looking for people to try it for 45 minutes on their own phone and tell us honestly what doesn't work. No real payment, no data kept after the session. Interested? Just reply to this message.

### Ce qui prouvera le résultat

Le taux de réussite de chaque tâche, par profil, comparé aux hypothèses ci-dessus. Les séances sont menées par une autre personne que l'auteur de la recette : sinon, elle chercherait les défauts qu'elle a déjà trouvés.

### Ce qui reste à décider

- Qui recrute, et par quel canal : les groupes WhatsApp de créatifs, une école partenaire à Accra ?
- Un dédommagement pour 45 minutes : en argent mobile, ou un crédit d'achat sur le site ?
- Où héberger la copie du site avec paiement simulé, pour qu'elle soit joignable depuis un téléphone à Accra.

## Ce qui n'a pas été testé

Écrit pour que personne ne lise « tout va bien » là où il faut lire « pas regardé ».

- **La sécurité.** Retirée du périmètre par le responsable du dépôt : aucun test des droits entre comptes, des fichiers piégés ni des défenses du site. C'est aussi pourquoi Q-01 n'est pas automatisé.
- **L'argent réel.** Les pages des opérateurs (Wave, Orange Money, MTN, Moov, carte), un paiement abandonné et sa relance, l'envoi effectif d'un versement : le paiement est simulé et aucun opérateur n'est branché.
- **Les autres navigateurs et les vrais appareils.** Firefox, Safari, un vrai téléphone sur un vrai réseau mobile, un lecteur d'écran, le clavier seul, le zoom à 200 %.
- **Un catalogue de taille réelle.** La recherche, le tri et les listes n'ont vu que quatre ressources.
- **La connexion par téléphone, les connexions sociales, la double authentification, les clés d'accès, les notifications sur le téléphone.**
- **Les publicités, les témoignages, l'envoi de la lettre d'information, les signalements, les badges accordés par l'équipe.**
- **Les performances sur un téléphone lent**, processeur compris : seul le réseau a été ralenti, à la première campagne.

### Ce qui reste à prouver

| Preuve | Où elle en est |
| --- | --- |
| Les défauts rejoués par quelqu'un d'autre que l'auteur | Les onze tests et `REJOUER.md` le permettent ; personne ne l'a encore fait |
| Les tests dans l'intégration continue du dépôt | Fait le 15/11 : PR #58, cinq contrôles verts |
| Q-41 : choix assumé ou défaut ? | À trancher par le responsable des versements |
| Les hypothèses de la piste 6 | Demandent de vrais utilisateurs |

## Refaire soi-même : la régie, les outils, les commandes

Tout l'outillage est dans le dépôt (PR #58), dans `Doc/QA_PERSONAS_2026-11-14/outils/`. On le copie dans un dossier `qa/` à la racine de sa copie de travail, et toutes les commandes ci-dessous se lancent depuis cette racine :

```sh
cp -r Doc/QA_PERSONAS_2026-11-14/outils qa
```

L'environnement lui-même (copie de travail, base, ports, stockage, courriels) se prépare comme décrit dans la section « L'environnement de test ». Le mode d'emploi pas à pas, écrit pour l'administrateur du dépôt, est `Doc/QA_PERSONAS_2026-11-14/REJOUER.md` : tests, régie et pistes, sans l'auteur.

### La régie : regarder les personas agir, en direct

Une seule page montre les quatre personas côte à côte pendant qu'ils utilisent le site : les deux téléphones à gauche, les deux ordinateurs à droite. Sous chaque écran, une légende dit ce que le persona est en train de faire et sur quelle page il se trouve. L'écran qui vient d'agir est encadré en jaune.

C'est l'outil pour montrer un défaut à quelqu'un qui n'a pas le temps de lire : on lance la scène, il regarde.

**La lancer**

```sh
QA_REGIE=1 node qa/pilote.mjs
# puis ouvrir dans un navigateur : http://127.0.0.1:3499/regie
```

**Jouer les quatre scènes de démonstration, en même temps (37 secondes)**

```sh
sh qa/demo/jouer.sh
```

| Écran | Ce qu'on voit | Défaut |
| --- | --- | --- |
| Yao, téléphone | Il remplit l'inscription avec un mot de passe de 7 caractères ; les six champs se vident | Q-02 |
| Awa, téléphone | Elle change son délai de remboursement ; le site confirme, la liste affiche l'ancien | Q-38 |
| Serge, ordinateur | Il ouvre les fichiers d'une ressource achetée : « Cette page n'existe pas ». Puis un code promo faux le fait sortir du paiement | Q-37, Q-10 |
| Fatou, ordinateur | Depuis Paris, elle veut acheter : quatre pays de facturation, pas la France | Piste 1 |

Les scènes se connectent avec les comptes des personas. Leurs adresses et mots de passe se mettent dans `qa/demo/.comptes`, à créer sur son poste et à ne jamais publier : le fichier n'est pas dans le dépôt.

**Écrire sa propre scène.** Une scène est un petit fichier de gestes Playwright, joué dans la session d'un persona. `h.dire("…")` écrit la légende sous son écran. On l'envoie avec `node qa/c.mjs <persona> < ma-scene.js`. Plusieurs envois lancés ensemble se jouent en parallèle, chacun dans son écran.

**Ce que la régie montre, et ce qu'elle ne montre pas**

- Les navigateurs des personas gardent leur vraie taille d'écran, leur langue et leur fuseau. La régie ne fait que réduire l'image pour qu'elle tienne : ce qu'on regarde est exactement ce qui est mesuré.
- Environ trois images par seconde. Le doigt et le curseur ne se voient pas : ce sont les légendes qui disent quel bouton est touché.
- Les scènes prennent leur temps exprès (frappe lettre par lettre, pauses) pour qu'on puisse suivre. Une scène de régie ne mesure donc pas une durée.

**Comment on y est arrivé, mesuré le 14/11/2026.** Trois essais ont précédé cette version. Quatre vraies fenêtres de navigateur : Chromium refuse une fenêtre de moins de 516 pixels de large, et quatre ne tiennent pas sur un écran de 1 366 pixels. Le « screencast » de Chromium : sans fenêtre, il ne filmait qu'un écran sur quatre. Un flux d'images continu : le navigateur n'affiche une image qu'à l'arrivée de la suivante, donc jamais pour une page immobile. La régie actuelle prend une capture toutes les 300 millisecondes, et la page vient la chercher.

### Les outils

| Fichier | Ce qu'il fait | Piste |
| --- | --- | --- |
| `pilote.mjs` | Le navigateur piloté : une session par persona, et la régie | Toutes |
| `c.mjs` | Envoie un geste au pilote et affiche ce qu'il rend | Toutes |
| `demo/` | Les quatre scènes de la régie, et `jouer.sh` qui les lance ensemble | Régie |
| `lire.sh` | Lit le texte utile d'une liste de pages, pour un persona | 1, 3 |
| `classe.mjs` | La salle de classe : trente élèves, scénario fixé d'avance | 2 |
| `horloge.cjs` | Fait croire au serveur qu'il est plus tard, sans toucher aux données | 3 |
| `serveur-a.ps1` | Redémarre le serveur de test avec l'horloge avancée de N jours | 3 |
| `etape.sh` | Appelle les tâches planifiées dans l'ordre d'une nuit | 3 |
| `cron.sh` | Appelle une tâche planifiée avec son secret, lu dans `.env` et jamais affiché | 3 |
| `traducteur.js` | Reproduit le mécanisme de la traduction de Chrome, sans rien envoyer | 5 |
| `vrai-traducteur.mjs` | Lance le vrai Chrome, traduction automatique activée | 5 |
| `boite.mjs` | Lit la boîte de réception de test (Mailpit) | 1, 3 |
| `e2e/qa-personas.spec.ts` | Les onze tests de navigateur, à la racine du dépôt | 4 |

### Les commandes, piste par piste

```sh
# Piste 2 — la classe, sous une série d'adresses neuve (« c », « d »…)
node qa/classe.mjs 1 30 c

# Piste 3 — avancer de 8 jours, puis jouer une nuit
powershell -File qa/serveur-a.ps1 -Jours 8
sh qa/etape.sh
powershell -File qa/serveur-a.ps1 -Jours 0     # revenir à l'heure vraie

# Piste 4 — les tests, sur une base et un port à soi
DATABASE_URL_E2E="postgresql://baobart:baobart@localhost:5433/baobart_e2e_<prenom>_tests?schema=public" \
E2E_PORT=3410 E2E_COMMAND="node node_modules/next/dist/bin/next start -p 3410" \
  pnpm exec playwright test qa-personas            # verts : les défauts sont là
QA_DEFAUTS_STRICTS=1 pnpm exec playwright test qa-personas   # rouges : on voit chaque défaut

# Piste 5 — le vrai Chrome traduit (le texte des pages part chez Google : données fictives seulement)
node qa/vrai-traducteur.mjs <dossier de profil neuf>
```
