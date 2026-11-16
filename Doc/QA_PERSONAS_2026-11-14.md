# QA par personas — 14 novembre 2026

> **Ce que c'est.** Le compte rendu complet d'une recette (« QA », pour *quality
> assurance* : on utilise l'application comme le ferait un client, pour trouver
> ce qui le gêne) menée le 14/11/2026 sur `main` à la v1.107.0 (commit
> `132c75e`). Quatre clients types et une administratrice ont parcouru
> l'application dans un vrai navigateur, geste par geste.
>
> **Ce que ça vaut comme preuve.** Tout ce qui est écrit « mesuré » a été
> observé ce jour-là et rejoué au moins deux fois, sauf mention contraire. Ce
> qui est écrit « lu » vient d'un écran ou d'un fichier et n'a pas été vérifié
> au-delà. **Personne d'autre que l'auteur n'a encore rejoué ces défauts** :
> au sens de la règle du dépôt, la tâche reste ouverte tant qu'un tiers ou un
> test automatique ne les a pas confirmés.
>
> **Auteur :** Claude (session du 14/11/2026), à la demande d'aucepsdev.
> **Aucun audit précédent n'a été lu** : c'était la consigne.
>
> Les chemins `outils/…` et `captures/…` cités plus bas sont relatifs au
> dossier `Doc/QA_PERSONAS_2026-11-14/`.

---

## 1. En une page

**Le cœur marche, l'entrée et le téléphone coincent.**

Publier une ressource, l'acheter, la télécharger, la rembourser, commenter,
noter, ouvrir une communauté, déposer une offre d'emploi, y postuler, écrire au
support : tout va au bout. Aucun doublon n'a été créé, même en tapotant les
boutons ou sur réseau lent.

Mais :

- un débutant peut se faire **bloquer plus d'une demi-heure dès l'inscription**,
  et bloquer avec lui tous ceux qui partagent sa connexion (§ 6, Q-01) ;
- sur téléphone, **les offres d'emploi, les services, les concours, le contact
  et le support sont introuvables** par le menu (Q-03) ;
- trois écrans **enregistrent autre chose que ce que la personne a saisi, ou
  rien du tout, sans le lui dire** (Q-05, Q-06, Q-07).

| Mesure | Valeur | Ce que ça dit |
| --- | --- | --- |
| Défauts relevés | 36, dont 10 majeurs | Les 10 majeurs touchent l'inscription, le téléphone, le paiement et l'argent du créateur. |
| Pages visitées | 86 | 81 répondent normalement ; les 5 autres sont des « introuvable » attendus (3 adresses fausses exprès, 2 pages de laboratoire absentes de la version compilée). |
| Accessibilité (outil axe) | 1 seule règle enfreinte en 20 passages | Le contraste des couleurs. 17 pages distinctes, dont 3 vues à l'ordinateur et au téléphone ; aucune autre infraction. |
| Poids d'une page | 400 à 620 Ko | Léger pour un forfait limité : le texte est lisible en 2 s sur réseau lent. |
| Courriels partis | 19 | Tous ceux attendus, sauf la confirmation d'inscription à un concours, qui n'existe pas. |
| Doublons créés par clics répétés | 0 sur 8 gestes essayés | Commande, commentaire, brouillon, candidature, communauté, inscription au concours, message, adhésion. |

---

## 2. Ce qui a été testé, et sur quoi

| | |
| --- | --- |
| **Version** | `main`, v1.107.0, commit `132c75e` |
| **Forme** | Version compilée (`next build` puis `next start`), comme en production. Le mode développement a été écarté : `playwright.config.ts` explique qu'il fait échouer des parcours justes. |
| **Paiement** | **Simulé** (`CHECKOUT_SIMULATION_ENABLED=1`, aucun opérateur branché). La page de l'opérateur — Wave, Orange Money, carte — n'a donc pas été vue. |
| **Données** | Base vide au départ, hors données de référence (`pnpm db:seed` : 4 forfaits, 3 licences, 7 badges, 5 catégories de service). Tout le reste a été créé par les personas. Le catalogue de démonstration n'a pas été semé : il demande un dossier de 985 Mo d'images que ce poste n'a pas. |
| **Navigateur** | Le Chromium livré avec Playwright 1.62, en fenêtres de 360, 390, 1280, 1366 et 1440 px de large. |

**Ce qui a été retiré du périmètre en cours de route, à la demande
d'aucepsdev :** tout test de sécurité et tout contournement d'une défense du
site. La fiche de départ prévoyait d'éprouver les droits entre comptes et les
fichiers qui mentent sur leur type ; ces deux points n'ont pas été joués. Les
fichiers piégés ont été fabriqués (`outils/fabriquer-fichiers.mjs`) mais seuls
trois, sans rapport avec la sécurité, ont servi : une image de 1 × 1 px, une
image de 20 000 × 20 000 px et une image envoyée à la place d'un CV.

Un essai antérieur à cette consigne a créé le compte de Serge pendant que
l'inscription était bloquée. Il n'a pas été poursuivi, et le compte a été gardé
tel quel.

---

## 3. La méthode

### 3.1 La fiche de départ, et ce qu'elle est devenue

| Question de la fiche | Réponse de départ | Appliqué ? |
| --- | --- | --- |
| Que ferait le meilleur expert ? | Attaquer les frontières : droits entre comptes, fichiers hostiles, doubles clics, états vides, téléphone, clavier seul, accessibilité par axe. | **En partie.** Doubles clics, états vides, téléphone, axe : appliqués. Droits entre comptes et fichiers hostiles : retirés (voir § 2). Clavier seul : la touche Échap uniquement. |
| Quelle matière brute ? | L'application qui tourne et les personas du dépôt, pas les audits. | **Appliqué.** Les personas viennent de `Doc/MARKETING/02-BILAN-MARKETING.md` § 5. |
| Quels outils ? | Playwright, axe, requêtes directes, vrais fichiers de création, base et port à part. | **Appliqué**, sauf les requêtes directes, abandonnées avec la sécurité. |
| Qu'est-ce qui prouverait le résultat ? | Chaque défaut rejouable par un script, avec capture ; axe comme tiers. | **Non atteint.** Les gestes ont été tapés dans la session, pas rangés en fichiers de test. Ce document donne les étapes à la main ; il faudrait les transcrire en tests (§ 13). |

### 3.2 Les personas et leur équipement

Les quatre premiers viennent du bilan marketing, qui précise lui-même qu'ils
sont « construits, pas interviewés ».

| Persona | Qui | Écran simulé | Langue et fuseau du navigateur |
| --- | --- | --- | --- |
| **Awa** Diallo | Illustratrice, Dakar. Veut vendre et être payée en FCFA. | Téléphone Android, 360 × 740 | fr-SN, Africa/Dakar |
| **Serge** Nkosi | Lead designer d'agence, Abidjan. Achète pour son équipe. | Ordinateur, 1440 × 900 | fr-CI, Africa/Abidjan |
| **Yao** Mensah | Étudiant en design, Accra. Budget nul, veut des concours. | Téléphone Android, 390 × 780 | **en-GH**, Africa/Accra |
| **Fatou** Sow | Directrice artistique, Paris. Paie en euros. | Portable, 1280 × 800 | fr-FR, **Europe/Paris** |
| Mariam Koné | Équipe Baobart (ajoutée pour la modération). | Ordinateur, 1366 × 800 | fr-FR, Africa/Abidjan |

### 3.3 Les règles de comportement

Consigne d'aucepsdev : les comptes agissent « comme de vrais utilisateurs sans
expérience ». Concrètement, chaque formulaire a été :

1. envoyé **vide** d'abord ;
2. rempli avec la saisie **naturelle** d'un débutant (« 5 000 F » dans un prix,
   « Sénégal » dans un champ qui attend « SN », un numéro sans indicatif, un
   site sans « https:// ») ;
3. validé par **double appui**, ou par quatre appuis sur réseau lent.

Les comptes ont été **inscrits à la main, un par un**, par `/inscription` —
aucun script de comptes. Seule exception, annoncée d'avance : le rôle
d'administratrice, qu'aucun écran n'accorde, a été posé sur un compte déjà
inscrit (`pnpm comptes:test --qualifier <adresse> admin`, mot de passe
inchangé).

### 3.4 Ce qui compte comme un défaut

- **Défaut** : observé, puis rejoué au moins une seconde fois avec le même
  résultat.
- **Observé une fois** (§ 9) : vu, non reproduit. Noté, pas compté.
- **Innocenté** (§ 8) : soupçonné, vérifié, et finalement pas un défaut. Ces
  cas sont écrits parce qu'ils apprennent autant que les autres : trois fois,
  la première impression était fausse.

### 3.5 Le pilote de navigateur

`outils/pilote.mjs` garde un Chromium ouvert avec **une session par persona**
(cookies, écran, langue et fuseau séparés). On lui envoie un geste à la fois
par `outils/c.mjs` ; il rend l'adresse, le titre, l'arbre d'accessibilité de
l'écran (ce qu'un lecteur d'écran en dirait), les erreurs de console, les
réponses HTTP en échec et une capture. C'est ce qui permet de regarder l'écran
après chaque geste, comme un testeur, au lieu de dérouler un scénario écrit
d'avance.

---

## 4. L'environnement, pour refaire la recette

Tout est isolé de la base de développement et de la copie principale, comme le
demande `CLAUDE.md` (« Travailler en même temps qu'un autre »).

| Ressource | Valeur | Pourquoi |
| --- | --- | --- |
| Copie de travail | `..\Baobart-qa-claude`, branche `claude/qa-personas` | La copie principale était occupée par un autre chantier. |
| Dépendances | `corepack pnpm install` dans la copie | `pnpm` n'est pas dans le `PATH` de ce poste ; `corepack` (livré avec Node) le fournit. |
| Base | `baobart_e2e_claude`, écrite en clair dans `DATABASE_URL`, `DIRECT_URL` et `DATABASE_URL_E2E` | Les trois, pour qu'aucun script ne retombe sur la base de développement. |
| Port de l'application | 3400 | 3100, 3200 et 3300 étaient pris ou réservés. |
| Stockage de fichiers | Conteneur `baobart-minio-qa-claude`, port 9100, seau `baobart-qa-claude` | Voir « pièges » ci-dessous. |
| Courriels | Conteneur `baobart-mailpit-qa-claude` (SMTP 1125, lecture 8125) | Pour lire les codes et les liens reçus. |

```sh
git worktree add -b claude/qa-personas ../Baobart-qa-claude origin/main
cd ../Baobart-qa-claude && corepack pnpm install --frozen-lockfile
# .env de la copie : base, port, seau, SMTP et secret d'ordonnanceur à soi
node scripts/setup-test-db.mjs e2e
corepack pnpm exec prisma generate && corepack pnpm db:seed
NODE_ENV=production corepack pnpm exec next build
node node_modules/next/dist/bin/next start -p 3400
node Doc/QA_PERSONAS_2026-11-14/outils/pilote.mjs      # le pilote, port 3499
sh   Doc/QA_PERSONAS_2026-11-14/outils/cron.sh courriels   # vide la file des courriels

# Un geste, dans la session d'un persona (le code du geste arrive sur l'entrée) :
node Doc/QA_PERSONAS_2026-11-14/outils/c.mjs awa accueil <<'EOF'
await page.goto('/');
EOF
# Les trois relevés d'ensemble :
node Doc/QA_PERSONAS_2026-11-14/outils/c.mjs anonyme tour texte=0 < Doc/QA_PERSONAS_2026-11-14/outils/tour-des-pages.js
node Doc/QA_PERSONAS_2026-11-14/outils/c.mjs anonyme axe texte=0 < Doc/QA_PERSONAS_2026-11-14/outils/axe.js
node Doc/QA_PERSONAS_2026-11-14/outils/c.mjs anonyme liens texte=0 < Doc/QA_PERSONAS_2026-11-14/outils/liens.js
```

### Les pièges rencontrés (mesurés le 14/11/2026)

1. **MinIO et Redis n'existaient plus sur ce poste** : ni conteneur, ni image,
   ni volume. `minio/minio` et `quay.io/minio/minio` refusent le téléchargement
   anonyme (401). L'image `bitnamilegacy/minio:2025.7.23-debian-12-r5`, que le
   commentaire de `docker-compose.yml` cite comme remplaçante, se télécharge et
   fonctionne avec l'application sans réglage particulier. Redis n'a pas été
   nécessaire (`RATE_LIMIT_DRIVER=memoire`).
2. **`CRON_SECRET` est vide dans le `.env` de ce poste.** Les routes de tâches
   planifiées répondent alors « Not found », et **aucun courriel de la file ne
   part** : bienvenue, reçu, « vente réalisée » restent en attente. Il faut
   poser un secret et appeler `/api/cron/courriels` (c'est le rôle de
   `outils/cron.sh`).
3. **Le pilote de courriels « console » n'écrit que le sujet** dans le journal,
   pas le corps. Un code à six chiffres ou un lien de réinitialisation n'y est
   donc lisible nulle part. D'où Mailpit, branché par `EMAIL_DRIVER=smtp` et
   `SMTP_URL=smtp://127.0.0.1:1125`.
4. **La première construction a échoué sans message** (code de sortie 255),
   avec 0,6 Go de mémoire libre sur 7,7. Relancée seule, elle est passée.
   L'explication par la mémoire est probable, non démontrée.
5. **`git worktree add -b … origin/main` fait suivre `origin/main` à la
   nouvelle branche.** Selon le réglage de git, un `git push` nu peut alors
   viser `main`. Toujours pousser en nommant la branche :
   `git push <dépôt> claude/qa-personas:claude/qa-personas`.
6. **La simulation de réseau lent a bloqué la session du pilote** pendant
   plusieurs minutes. C'est un défaut de l'outillage, pas de l'application.

---

## 5. Les parcours joués

| Persona | Ce qu'il ou elle a fait |
| --- | --- |
| **Awa** | Accueil → inscription (formulaire vide, six appuis) → « Devenir vendeur » → brouillon d'une ressource (vide, puis champ par champ, prix « 5 000 F ») → dépôt d'une archive de 48 Mo et d'un aperçu → publication → notification et gains de la première vente → compte de versement Wave avec code reçu par courriel → profil de boutique (saisies naturelles) → ressource gratuite → ressource hébergée sur Drive → code promo → demande de remboursement reçue, refus tenté, remboursement → réponse à un commentaire sur réseau lent. |
| **Serge** | Inscription → recherche « wax » → fiche → J'aime en rafale, Suivre, Collection → achat avec un code promo faux, puis sans → téléchargement → adhésion à la communauté de Yao, réponse, partage d'une collection → dépôt d'une offre d'emploi (vide, trop courte, budget inversé, date passée) → candidature reçue → demande de remboursement → second achat avec le code d'Awa, par carte → avis à 4 étoiles → services et forfaits. |
| **Yao** | Accueil en navigateur anglais → inscription ratée puis réussie → déconnexion, mauvais mot de passe, reconnexion → mot de passe oublié de bout en bout → Explorer → téléchargement gratuit → commentaire → création d'une communauté → offres d'emploi, candidature (CV en image, puis en PDF) → inscription au concours → blog → photo de profil (trois images) → message au support. |
| **Fatou** | Cinq recherches → tarifs → inscription → page de paiement vue de France → message à Awa depuis sa vitrine → lettre d'information → heure du concours vue de Paris. |
| **Mariam** | Inscription, rôle accordé → file de modération, publication de l'offre de Serge → création et publication d'un concours → rédaction et publication d'un article → messages reçus. |

En plus : un tour de 86 pages (statut, titre, erreurs de script), axe sur 20
pages, quatre pages mesurées sur réseau lent.

---

## 6. Les défauts

Gravité : **Majeur** = fait perdre une inscription, une vente, de l'argent ou
une donnée. **Mineur** = gêne ou trompe sans rien faire perdre. **Texte** =
libellé seulement.

### 6.1 Les dix majeurs

#### Q-01 — L'inscription se ferme pour 30 minutes après cinq envois, formulaires vides compris

- **Qui :** Awa, puis Serge.
- **Rejouer :** ouvrir `/inscription`, toucher six fois « Créer mon compte
  gratuit » sans rien remplir. Puis, dans un autre navigateur sur la même
  connexion, remplir le formulaire correctement et l'envoyer.
- **Mesuré :** au sixième appui, « Trop de tentatives. Réessaie dans
  31 minutes. » Le second navigateur, avec un formulaire valide, reçoit
  « Réessaie dans 36 minutes » : l'attente **s'allonge** à chaque nouvel essai,
  et elle vaut pour tous les visiteurs de la même adresse.
- **Pourquoi c'est un défaut et pas un réglage :** le commentaire de la règle
  (`lib/securite/limites.ts`) dit vouloir permettre à « une famille derrière un
  même routeur » de créer plusieurs comptes, soit cinq *créations* par heure.
  Ce qui est compté, ce sont les *envois*, avant toute validation. Aucun champ
  n'étant marqué obligatoire côté navigateur, un formulaire vide part au
  serveur et consomme un essai.
- **Ce que ça coûte :** le bilan marketing vise « 200 étudiants d'un coup » par
  un partenariat d'école. Dans une salle sur le même Wi-Fi, le sixième envoi
  ferme l'inscription à toute la classe.
- **Capture :** `captures/004-awa-inscription-bloquee.png`.

#### Q-02 — Une seule erreur vide tout le formulaire d'inscription

- **Qui :** Yao.
- **Rejouer :** remplir les cinq champs avec un mot de passe de sept
  caractères, envoyer.
- **Mesuré :** message « Le mot de passe doit faire au moins 8 caractères »,
  et les **six champs sont vidés** (prénom, nom, nom d'utilisateur, courriel,
  mot de passe, case des conditions). L'indice « Encore 1 caractère » reste
  affiché sous un champ vide.
- **Aggravant :** combiné à Q-01, chaque erreur coûte un essai sur cinq et
  oblige à tout retaper sur un téléphone.
- **À noter :** le formulaire « Publier une ressource » conserve, lui, la
  saisie après un refus. La même perte existe à la connexion (le courriel est
  vidé après un mauvais mot de passe) et à la candidature (le mot
  d'accompagnement est vidé après le refus du CV).
- **Capture :** `captures/044-yao-inscription.png`.

#### Q-03 — Sur téléphone, les sous-menus ne s'ouvrent jamais

- **Qui :** Yao, Awa.
- **Rejouer :** sur un écran tactile, toucher « Créateurs ▼ », « Explorer ▼ »
  ou « Communauté & Blogs ▼ ».
- **Mesuré :** les trois emmènent directement sur leur page ; aucun sous-menu
  ne s'affiche (3 sur 3). Sur ordinateur, ces sous-menus s'ouvrent au survol
  de la souris et contiennent : Jobs, Services, Concours & Événements,
  Sponsoriser, Contact, Support, Documentation, À propos, Changelog,
  Signalement, Règles de publication.
- **Ce que ça coûte :** sur téléphone, ces onze rubriques ne sont atteignables
  qu'en tapant leur adresse. Les concours sont la première motivation de Yao.
- **Ce qui a été lu pour l'affirmer :** tous les liens de l'accueil, des quatre
  menus, du menu du compte et de sept pages (`outils/liens.js`). Le pied de
  page ne propose que Blog, Espaces, Vendre, Créatifs et les pages légales.

#### Q-04 — Sur téléphone, le contenu est sous le menu

- **Qui :** Awa, Yao.
- **Mesuré :**
  - tableau de bord : le contenu de chaque page commence à **942 px** pour un
    écran haut de 740 px. Après l'inscription, le premier écran est entièrement
    le menu, et « Devenir vendeur » est tout en bas ;
  - fiche d'une ressource : le bouton « Télécharger » (ou « Acheter ») est à
    **1 737 px** pour un écran de 780 px, après le partage, les avis et les
    commentaires ;
  - accueil à 360 px : l'en-tête et le bandeau de cookies couvrent tout le
    premier écran, le titre est coupé.
- **Lien avec la liste des tâches :** « Design — D2 mobile » est « À faire ».
  Ces trois mesures en sont des cas chiffrés.
- **Captures :** `captures/001-awa-accueil.png`,
  `captures/009-awa-inscription-remplie.png`.

#### Q-05 — Une offre d'emploi est enregistrée avec un autre contrat que celui choisi

- **Qui :** Serge, puis Yao qui en subit la conséquence.
- **Rejouer :** sur `/jobs/deposer`, choisir « Stage », « Hybride », « Côte
  d'Ivoire » ; saisir un budget minimum supérieur au maximum ; envoyer ;
  corriger le budget ; envoyer.
- **Mesuré :** après le refus (« Le minimum dépasse le maximum »), les champs
  de texte sont conservés mais **les trois listes reviennent à leur valeur par
  défaut**. L'offre enregistrée (lue en base, table `JobPosting`) est
  `FREELANCE` / `REMOTE` / pays vide.
- **La suite :** la carte de la file de modération ne montre ni le contrat, ni
  le mode, ni le pays, ni le budget : la relectrice ne peut pas voir l'erreur.
  Une fois l'offre publiée, le filtre « Stage » répond « Aucune mission de ce
  type ».

#### Q-06 — Une collection partagée dans une communauté ne s'ouvre pas

- **Qui :** Serge la partage, Yao veut l'ouvrir.
- **Rejouer :** créer une collection, y ranger une ressource, la partager dans
  une communauté ; l'ouvrir depuis un autre compte membre.
- **Mesuré :** le bloc affiche « Collection · Affiches & motifs — pitch
  télécom · 2 membres · 1 ressource · partagée par Serge Nkosi » et un bouton
  « Retirer ». **Aucun lien** dans le bloc (vérifié dans le code de la page
  rendue), un clic sur le titre ne fait rien, et la collection n'apparaît pas
  dans « Mes collections » du membre.
- **Ce que ça coûte :** les collections partagées sont l'argument central du
  forfait Studio dans le bilan marketing.

#### Q-07 — Le profil de boutique refuse sans que la personne le voie

- **Qui :** Awa.
- **Rejouer :** sur `/dashboard/boutique`, à 360 px de large, écrire
  « Sénégal » dans « Pays » et toucher « Enregistrer mon profil » en bas.
- **Mesuré :** le message « Le pays doit être un code à deux lettres » existe,
  mais il s'affiche en haut du formulaire, à **1 155 px**, alors que le bouton
  est à **4 055 px** — près de quatre écrans plus haut, sans défilement ni
  prise de focus. Rien ne bouge à l'écran. Après rechargement, les sept champs
  saisis sont vides.
- **Aggravant :** « Pays » est un champ libre qui attend un code. Les autres
  saisies naturelles sont, elles, bien tolérées (voir § 7).

#### Q-08 — « Rembourser » part au premier appui

- **Qui :** Awa.
- **Rejouer :** sur `/dashboard/ventes/remboursements`, toucher
  « Rembourser ».
- **Mesuré :** le remboursement est exécuté immédiatement, sans confirmation.
  Le bouton est collé à « Refuser », lequel ouvre, lui, un champ de motif.
- **Les textes qui suivent sont inexacts :** après une première vente
  remboursée, Awa lit « Solde à verser −575 F · part prochain versement » et
  « remboursé après ton dernier versement », alors qu'elle n'a jamais reçu de
  versement. Le compteur garde « Ventes 1 · +1 ce mois », et sa vitrine
  « 2 ventes à vie » dont une remboursée.
- **Ce qui est juste :** les montants. 5 000 F de vente, 4 425 F de part,
  −575 F après remboursement : c'est ce que la page Versements annonce.

#### Q-09 — La page de paiement affiche deux montants différents

- **Qui :** Serge.
- **Rejouer :** sur `/acheter/<ressource>`, saisir un code promo valide et
  toucher « Vérifier ».
- **Mesuré :** une ligne dit « − 700 F · tu paieras 2 800 F », le bouton dit
  encore « **Payer 3 500 F** » et le récapitulatif « Total 3 500 F ». Le
  montant réellement débité est le bon (2 800 F).

#### Q-10 — Un code promo faux fait sortir du paiement

- **Qui :** Serge.
- **Rejouer :** saisir un code inexistant, toucher « Vérifier », puis choisir
  un pays, un moyen de paiement et toucher « Payer ».
- **Mesuré :** « Ce code n'existe pas. » s'affiche bien sous le champ, mais le
  code y reste. Au paiement, retour sur la fiche avec « Ce code promo n'a pas
  pu être appliqué. Reprends sans lui, ou réessaie. » Le pays et le moyen de
  paiement sont perdus.

### 6.2 Les mineurs

| # | Défaut | Mesuré |
| --- | --- | --- |
| Q-11 | Un seul appui sur Échap ferme deux fenêtres | Fiche ouverte en fenêtre, « Ranger dans une collection » par-dessus : Échap ferme les deux et renvoie à la liste. 3 fois sur 3. |
| Q-12 | Recherche de l'en-tête | Entrée ne mène nulle part ; aucune mention « aucun résultat » ; « awa » ne trouve pas la créatrice Awa Diallo (seuls les titres sont lus) ; la vignette de la suggestion reste vide. |
| Q-13 | La page « introuvable » fait trois erreurs serveur | Sur une adresse inconnue, le préchargement de `/`, `/explore` et `/cookies` répond **500** (`TypeError: Cannot read properties of undefined (reading '0')` dans le journal). Le visiteur arrive quand même, par un rechargement complet. 2 fois sur 2. Une fiche inexistante (`/products/…`) ne le provoque pas. |
| Q-14 | Concours | Après « M'inscrire », aucun moyen de déposer une œuvre et aucune consigne (ligne B10 de `TACHES.md`). Aucun courriel de confirmation d'inscription. |
| Q-15 | Heure d'un événement sans fuseau | Saisie « heure d'Abidjan (GMT) » côté organisation ; la fiche publique affiche « à 09:00 » sans le dire. Vu de Paris, c'est 10:00. |
| Q-16 | Pas de déconnexion dans le tableau de bord acheteur | Le bouton n'existe que dans le menu du compte du site public, et sur l'accueil du tableau de bord créateur. |
| Q-17 | Case sans effet | « Je confirme que cette adresse est la mienne » (mot de passe oublié) : non cochée, le lien part quand même. |
| Q-18 | La page demandée est perdue après connexion | Renvoyé depuis `/dashboard/achats`, Yao atterrit sur l'aperçu. |
| Q-19 | Ressources gratuites | Qui a téléchargé une ressource gratuite ne peut pas la noter, alors que l'écran dit « les avis viennent de ceux qui ont obtenu la ressource ». « Ma bibliothèque » lui annonce « vide ». |
| Q-20 | « Proposer un service » | Annonce « trois choses » nécessaires, n'en affiche qu'une. |
| Q-21 | Délai de remboursement par défaut | « 30 jours » est posé sur chaque fiche sans être demandé à la publication. La créatrice ne le découvre que sur l'écran des demandes reçues. |
| Q-22 | Compte de versement | Un numéro Wave sans indicatif (« 77 123 45 67 ») est accepté sans demander le pays. L'ancien message d'erreur reste affiché après correction. Le champ n'ouvre pas le clavier numérique. |
| Q-23 | Publication | Le bloc « Fichier & aperçu » n'a aucun champ de fichier à la création (il vient après, sur le brouillon) ; on peut publier sans description ; la zone dit « glisse tes fichiers » sur un téléphone ; une seule erreur est annoncée par envoi. |
| Q-24 | Deux tolérances pour une adresse | Le lien externe d'un fichier refuse « drive.google.com/… » sans « https:// » ; le profil complète « www.… » tout seul. |
| Q-25 | Vignettes sans légende sur la fiche | Sous l'image, deux vignettes mènent à d'autres ressources du créateur ; elles se lisent comme d'autres vues de la même. |
| Q-26 | Le recruteur ne retrouve pas ses offres | Aucune entrée de menu : seul le lien de la notification y mène. |
| Q-27 | Candidature | « Un portfolio se met en lien » — le formulaire n'a pas de champ pour un lien. |
| Q-28 | Courriels | Texte brut, sans version mise en forme. Le courriel de bienvenue ne contient aucun lien vers le site. |
| Q-29 | Titres et repères | La page d'une communauté et une fiche ouverte en fenêtre gardent le titre général du site ; `/explore` et la fiche n'ont pas de titre de niveau 1 ni de repère « contenu principal ». |
| Q-30 | Contraste | axe : 11 éléments sur 4 pages à l'ordinateur (`/`, `/explore`, `/inscription`, `/connexion`), 14 sur 4 au téléphone (`/`, `/explore`, `/dashboard/gains`, `/dashboard/notifications`). |
| Q-31 | Deux écrans, deux discours sur le même argent | Tableau de bord : « Solde à verser 4 425 F · part prochain versement ». Gains : « Solde disponible 0 F · En attente de validation 4 425 F ». |
| Q-32 | Pays en champ libre | Le profil attend « CI, SN, ML… » dans un champ de texte ; l'offre d'emploi propose une liste. |
| Q-33 | Blog | Sous l'article à la une, « Rien pour l'instant — reviens bientôt », comme si le blog était vide. |

### 6.3 Les textes

| # | Où | Ce qui est écrit |
| --- | --- | --- |
| Q-34 | Accueil, Explorer, vitrine, cartes | « 1 ressources », « 1 créatifs », « 1 familles », « 1 ventes », « 1 abonnés » |
| Q-35 | Page de paiement | « Paiement traité par aucun. » ; « Tu seras redirigé vers Carte bancaire. » |
| Q-36 | Divers | « Administratrice » pour Yao ; « ✎ Créateur feedback » dans le menu ; « ENCAISSEE », « REMBOURSEE » sans accent ; « Règles de publication — bientôt » et « Support — bientôt » dans le menu du compte alors que les pages existent (ligne B11). |

---

## 7. Ce qui marche, mesuré

- **Achat et livraison.** Fichier reçu identique à l'original à l'octet près
  (50 014 424 octets, même nom). La bibliothèque passe de « À télécharger » à
  « Téléchargé · retiré 1 fois ».
- **Dépôt.** Une archive de 48 Mo passe ; la progression s'affiche en
  pourcentage ; les dimensions d'une image sont lues (« 1600 × 1600 »).
- **Aperçus.** Le pseudo du créateur est en filigrane sur chaque aperçu.
- **Clics répétés.** Aucun doublon sur huit gestes, dont deux sur réseau lent
  avec quatre appuis.
- **J'aime.** L'écran et le serveur restent d'accord après des clics en
  rafale, puis après rechargement.
- **Mot de passe oublié.** Lien à usage unique, messages précis (« Encore 3
  caractères », « Les deux mots de passe ne sont pas identiques »), ancien mot
  de passe refusé ensuite, nouveau accepté.
- **Connexion.** Page privée renvoyée vers la connexion ; adresse acceptée
  malgré majuscules et espace final.
- **Saisies tolérées.** « 5 000 F » dans un prix ; « Yao Mensah » converti en
  `yao-mensah` ; « sn » en « SN » ; « www.… » complété en https ; numéro
  WhatsApp converti en lien ; adresse Behance dans le champ Instagram refusée
  avec un message clair ; code promo accepté en minuscules.
- **Remboursement, côté acheteur.** Commande « Remboursée », total dépensé
  remis à 0 F, bibliothèque vidée, notification, formulaire d'avis retiré,
  bouton d'achat revenu.
- **Courriels.** 19 partis : bienvenue, reçu, vente, code de versement (qui
  rappelle le compte visé et met en garde), compte de versement modifié,
  réinitialisation, offre en ligne, candidature reçue, demande de
  remboursement, remboursement, nouvel avis, message d'un visiteur.
- **Communauté.** Création, annuaire, adhésion obligatoire pour écrire,
  message, réponse, bouton « Signaler », notifications au créateur de l'espace.
- **Emploi.** Dépôt, relecture, publication notifiée, candidature notifiée, CV
  téléchargeable, avertissement anti-arnaque sur la fiche.
- **Blog.** Titres, gras, liste, citation et lien rendus correctement.
- **Photo de profil.** Image trop petite refusée avec ses dimensions (« celle-ci
  fait 1×1 ») ; image de 20 000 px refusée proprement, serveur intact.
- **Pages.** 81 pages sur 81 attendues répondent en 200 avec leur titre, sans
  erreur de script. La plupart en 600 à 750 ms ; `/explore` et la fiche d'une
  ressource en 2,1 à 2,3 s. Les pages « introuvable » sont soignées et
  proposent deux liens de retour.
- **Poids.** Sur réseau lent simulé (400 ms de latence, environ 400 kbit/s,
  sans cache) :

| Page | Poids | Texte lisible | Chargement complet |
| --- | --- | --- | --- |
| `/` | 621 Ko | 2,1 s | 13,3 s |
| `/explore` | 602 Ko | 1,8 s | 12,9 s |
| Fiche d'une ressource | 556 Ko | 2,0 s | 12,2 s |
| `/dashboard` | 397 Ko | 1,9 s | 8,9 s |

---

## 8. Ce qui a été soupçonné, puis innocenté

Trois fois, la première observation était juste et la première conclusion
fausse. C'est exactement ce contre quoi `CLAUDE.md` met en garde.

1. **« Les rubriques Jobs, Services et Événements n'ont aucun lien. »** Faux :
   elles sont dans les sous-menus, que le premier relevé n'avait pas ouverts.
   Le vrai défaut est plus étroit (Q-03 : au toucher seulement).
2. **« L'image de la troisième carte est manquante. »** Faux : chargement
   différé. Elle apparaît dès qu'on fait défiler ; c'est la capture en pleine
   page qui ne déclenchait pas le chargement.
3. **« Le profil de boutique s'enregistre sans rien retenir, sans message. »**
   À moitié faux : le message existe, mais hors écran (Q-07). Le premier
   relevé ne regardait pas assez haut.

Et un quatrième, resté sans suite : le bouton J'aime semblait perdre un clic
sur trois ; rejoué clic par clic, il est cohérent.

---

## 9. Observé une seule fois

Notés, non comptés comme défauts.

- **Arrêt spontané du serveur** (code de sortie 127, rien dans le journal),
  une dizaine de minutes après son premier démarrage, avec 0,6 Go de mémoire
  libre. Jamais revu sur les trois démarrages suivants.
- **Erreur d'affichage React n° 418** (le rendu du serveur et celui du
  navigateur diffèrent) sur une des trois pages notifications, tableau de bord
  ou gains d'Awa, au premier passage. Non reproduite sur huit pages, pour deux
  personas. Le serveur et les trois personas africains sont sur le même
  fuseau ; **Fatou, à Paris, n'a pas été passée sur ces pages** : c'est là
  qu'il faudrait chercher.
- **Échec de la première construction** (§ 4, piège 4).

---

## 10. Ce qui n'a pas été testé

Écrit pour que personne ne lise « tout va bien » là où il faut lire « pas
regardé ».

- **Les opérateurs de paiement réels** : page Wave, Orange Money, MTN, Moov,
  carte ; échec, abandon, retour après délai.
- **Les versements qui partent** : rétention de 7 jours, délai de 24 h après
  l'enregistrement d'un compte, seuil de 1 000 F, cadence.
- **Tout ce qui dépend du temps** : fin du délai de remboursement, arbitrage
  par l'équipe au bout de sept jours, clôture d'une offre ou d'un événement,
  parution planifiée d'un article.
- **La sécurité** (retirée, § 2).
- Connexion par téléphone et SMS, connexion sociale (les neuf boutons sont
  grisés), double authentification, clés d'accès, notifications push.
- Publicités et sponsoring, témoignages, envoi de la lettre d'information,
  statuts et badges accordés par l'équipe, liste de blocage, signalements.
- Fichiers de 200 Mo, vidéo, audio, polices ; pourboire, prix libre, prix
  ajusté au pays, questions posées à l'achat, offres après achat.
- Firefox, Safari, un vrai téléphone ; lecteur d'écran ; navigation au clavier
  au-delà d'Échap ; zoom à 200 %.
- Un catalogue de taille réelle : la recherche, le tri et les listes n'ont vu
  que trois ressources.

**Les ressources Telegram proposées.** Sur les six canaux, quatre ne donnent
leurs fichiers que dans l'application Telegram, que cette session n'a pas.
Trois archives de maquettes ont été prises sur `mockup_curator`, dont chaque
publication renvoie à un site de gratuités nommé. `dsg_free`, qui se décrit
comme offrant des ressources « premium » sans dire d'où elles viennent, n'a pas
été utilisé. Ces archives n'ont servi que de matière de téléversement, en
local ; elles ne sont pas dans le dépôt.

---

## 11. L'avis de chaque persona

> **Ces avis sont rédigés par l'auteur de la recette**, à partir de ce que
> chaque session a rencontré. Ce ne sont pas des témoignages de vrais
> utilisateurs, et ils ne doivent pas être cités comme tels.

### Awa — vendeuse, téléphone

- **Ce que j'aime :** j'ai publié en dix minutes. Mon pseudo est en filigrane
  sur mes aperçus. Les 88,5 % sont calculés juste, au franc près.
- **Ce que je n'aime pas :** faire défiler un écran entier de menu à chaque
  page. Avoir rempli mon profil pour rien. Devoir 575 F à la plateforme après
  ma toute première vente, parce qu'elle a été remboursée.
- **Ce qui marche :** le dépôt de 48 Mo, le code par courriel pour mon compte
  Wave, la notification de vente.
- **Ce qui ne me sert pas :** douze champs de réseaux sociaux ; la cadence
  trimestrielle des versements.
- **Ce pour quoi je paierais :** être versée plus vite que sept jours. À une
  condition : que l'argent parte vraiment. L'écran des gains me dit que
  l'envoi vers l'opérateur n'est pas encore branché.
- **Pourquoi ici et pas ailleurs :** c'est la seule qui me parle en francs CFA
  et de Wave. Si le versement ne part pas, cette raison tombe.

### Serge — acheteur d'agence, ordinateur

- **Ce que j'aime :** la bibliothèque qui compte mes « licences commerciales
  utilisables pour mes clients ». Un remboursement obtenu dans l'heure.
- **Ce que je n'aime pas :** j'ai acheté une archive sans description, et ce
  n'était pas ce que le titre annonçait. Mon équipe ne peut pas ouvrir la
  collection que je partage. Mon offre de stage est parue en « freelance à
  distance ».
- **Ce qui marche :** l'achat en deux clics, le téléchargement, les avis.
- **Ce qui ne me sert pas :** un forfait Studio affiché « bientôt » ; une page
  « Licence » générale quand il me faut une preuve par fichier.
- **Ce pour quoi je paierais :** le forfait Studio à 7 500 F, le jour où les
  collections partagées s'ouvrent et où je peux télécharger une attestation de
  licence à remettre à mon client.
- **Pourquoi ici et pas ailleurs :** des visuels qui ressemblent à mes clients,
  payés en francs.

### Yao — étudiant, téléphone, anglophone

- **Ce que j'aime :** télécharger un fichier gratuit en un geste. Créer ma
  communauté en une minute. Voir quelqu'un d'une agence me répondre.
- **Ce que je n'aime pas :** tout retaper à l'inscription pour un caractère.
  Un site entièrement en français. Un concours que je ne trouve pas dans le
  menu et où je ne sais pas comment envoyer mon affiche.
- **Ce qui marche :** les commentaires, la candidature à une offre, le mot de
  passe oublié.
- **Ce qui ne me sert pas :** « Ma bibliothèque », toujours vide quand on ne
  prend que du gratuit.
- **Ce pour quoi je paierais :** rien aujourd'hui. Peut-être un droit d'entrée
  à un concours bien doté, si je voyais les œuvres des autres.
- **Pourquoi ici et pas ailleurs :** des références d'ici, et une offre de
  stage.

### Fatou — directrice artistique, Paris

- **Ce que j'aime :** écrire à une créatrice sans dévoiler mon adresse, et le
  courriel soigné qu'elle reçoit.
- **Ce que je n'aime pas :** quatre pays de facturation, pas le mien. Aucun
  prix en euros. Une heure de concours sans fuseau.
- **Ce qui marche :** la recherche par titre, la vitrine d'un créateur.
- **Ce qui ne me sert pas :** les moyens de paiement mobile, que je n'ai pas.
- **Ce pour quoi je paierais :** une commande sur mesure — six motifs, réglés
  en euros, avec une facture.
- **Pourquoi ici et pas ailleurs :** du matériel authentique, et le moyen de
  parler directement à qui l'a fait.

---

## 12. Les constats qui ne sont pas du code

Ce sont des choix de produit, que la recette rend visibles sans pouvoir les
trancher.

| Constat | Mesuré ou lu | La question à se poser |
| --- | --- | --- |
| Un remboursement coûte au créateur plus que la vente ne lui a rapporté (−575 F sur 5 000 F). | Mesuré. | Est-ce le premier souvenir qu'on veut laisser à une créatrice ? |
| Le délai de remboursement par défaut est de 30 jours, sur un fichier que l'acheteur garde. | Mesuré. | Qui doit le choisir, et à quel moment ? |
| Les forfaits payants sont « bientôt » ; seul l'accès libre existe. | Mesuré. Ligne B3 de `TACHES.md`. | Le bilan marketing vend le forfait Studio : que promet-on d'ici là ? |
| « L'envoi effectif chez l'opérateur n'est pas encore branché ». | **Lu** sur la page des gains, dans un environnement sans opérateur. Non vérifié en dehors. | La promesse « celle-ci te paie sur Wave » tient-elle le jour du lancement ? |
| Le site est en français seulement. | Mesuré (`lang="fr"`, aucun lien de langue). | Yao est à Accra, où l'on parle anglais. |
| Quatre pays de facturation, aucun prix en euros. | Mesuré. Ligne C7. | Conforme au plan, qui traite la diaspora comme marché secondaire. |
| Pour proposer un service, il faut d'abord vendre une ressource. | Lu sur la page. | Une agence qui n'a rien à vendre en fichier peut-elle proposer ses services ? |
| Le forum est un fil unique : ni sujets, ni réponse à un message, ni image. | Mesuré. | Suffisant pour un espace d'équipe ; l'est-ce pour une communauté d'école ? |
| Les vues de page restent à 0. | Mesuré. Ligne B7. | Le « taux de conversion » du tableau de bord ne peut rien afficher. |

---

## 13. Pour continuer

Par ordre d'utilité, selon l'auteur.

1. **Transcrire les dix majeurs en tests de navigateur qui échouent.** C'est ce
   qui manque pour fermer le critère de fin : chaque correction aurait sa
   preuve, et la CI empêcherait le retour du défaut.
2. **Jouer la salle de classe.** Trente inscriptions depuis une même adresse en
   une heure, avec le taux d'erreur d'un débutant, et compter combien
   aboutissent. C'est Q-01 chiffré, sur le scénario que le marketing veut
   vendre aux écoles.
3. **Faire avancer l'horloge.** Tout ce que le § 10 range sous « dépend du
   temps » : J+1, J+7, J+30, en appelant les tâches planifiées une à une.
4. **Remplir le catalogue.** La recherche, le tri et les listes n'ont vu que
   trois ressources. Il faut le dossier d'images de démonstration.
5. **Passer Firefox et Safari**, et les pages datées avec un navigateur à
   Paris, là où l'erreur 418 a le plus de chances de se montrer.
6. **Mesurer avec un outil tiers de performance** (Lighthouse) sur un profil
   de téléphone lent, processeur bridé compris : le réseau a été ralenti, pas
   le processeur.
7. **Préparer une vraie séance d'utilisateurs** : cinq personnes par persona,
   une liste de tâches, une grille d'observation. Aucun des avis du § 11 ne
   remplace cela.

---

## 14. Annexes

### Les fichiers joints

| Fichier | À quoi il sert |
| --- | --- |
| `QA_PERSONAS_2026-11-14/outils/pilote.mjs` | Le navigateur piloté, une session par persona. |
| `QA_PERSONAS_2026-11-14/outils/c.mjs` | Envoie un geste au pilote et affiche ce qu'il rend. |
| `QA_PERSONAS_2026-11-14/outils/boite.mjs` | Lit la boîte de réception Mailpit. |
| `QA_PERSONAS_2026-11-14/outils/cron.sh` | Joue l'ordonnanceur : appelle une tâche planifiée avec son secret, lu dans le `.env` et jamais affiché. |
| `QA_PERSONAS_2026-11-14/outils/fabriquer-fichiers.mjs` | Fabrique les fichiers de téléversement. |
| `QA_PERSONAS_2026-11-14/outils/tour-des-pages.js` | Le tour des 86 pages. |
| `QA_PERSONAS_2026-11-14/outils/axe.js` | Le passage d'axe sur une liste de pages. |
| `QA_PERSONAS_2026-11-14/outils/liens.js` | Le relevé des liens, menu par menu (Q-03). |
| `QA_PERSONAS_2026-11-14/captures/` | Quatre captures : accueil à 360 px (Q-04), inscription bloquée (Q-01), premier écran après inscription (Q-04), formulaire vidé (Q-02). |

Les 125 autres captures (24 Mo) sont restées sur le poste, dans
`qa/captures/` de la copie de travail : trop lourdes pour le dépôt.

### Les comptes créés

Dans `baobart_e2e_claude` uniquement. Aucun mot de passe n'est écrit ici.

| Compte | Adresse |
| --- | --- |
| Awa Diallo | `awa.diallo@studio-dakar.test` |
| Serge Nkosi | `serge.nkosi@agence-kivu.test` |
| Yao Mensah | `yao.mensah@campus-accra.test` |
| Fatou Sow | `fatou.sow@agence-paris.test` |
| Mariam Koné (équipe) | `mariam.kone@equipe-baobart.test` |

### Ce qui reste sur le poste

- la copie de travail `..\Baobart-qa-claude` et son `.env` (non suivi par git) ;
- la base `baobart_e2e_claude` ;
- deux conteneurs arrêtés, `baobart-minio-qa-claude` et
  `baobart-mailpit-qa-claude`, et leurs deux images ;
- rien dans la base de développement, rien dans la copie principale.

Pour tout retirer : `docker rm` des deux conteneurs,
`DROP DATABASE baobart_e2e_claude`, puis `git worktree remove`.
