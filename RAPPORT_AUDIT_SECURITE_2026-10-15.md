# Audit de sécurité Baobart — 15 octobre 2026

> Audit mené dans le worktree `security-audit-complete-c8664a`, sans toucher au
> travail des autres sessions. Une pile Docker **isolée** (`baobart-audit`,
> ports 55433/59000/3400/3480, réseau à part) a été montée, l'application y a
> réellement tourné, et **les tests dynamiques ont été exécutés : 40 vérifications,
> 40 réussites.** Détail à la fin.

---

### 🌱 Explication simplifiée

Une place de marché comme Baobart doit empêcher trois choses : qu'on entre dans
le compte d'un autre, qu'on lise ou télécharge ce qu'on n'a pas payé, et qu'on
fasse partir de l'argent au mauvais endroit. J'ai lu le code ligne à ligne pour
vérifier que chaque porte a bien un verrou, et que le verrou est au bon endroit.

Quelques termes qui reviennent, définis une fois :

- **IDOR** (*Insecure Direct Object Reference*) = deviner l'identifiant d'un
  objet (un fichier, une candidature) et y accéder parce que le serveur oublie
  de vérifier *à qui* il appartient.
- **Server action** = une fonction serveur appelable directement par le
  navigateur ; chaque export d'un fichier marqué `"use server"` est une porte
  d'entrée publique, donc chacun doit vérifier la session lui-même.
- **CSRF** = faire exécuter une action à un utilisateur connecté à son insu
  depuis un autre site.
- **Rate limiting** = limiter le nombre d'essais par minute pour qu'on ne puisse
  pas tester un million de mots de passe.

Le constat : **l'architecture de sécurité est solide et cohérente.** Les verrous
sont là, au bon niveau (dans l'action serveur, pas seulement dans la page qui
l'affiche), et la plupart sont accompagnés d'un test automatisé qui prouve
qu'ils mordent.

---

### 🛠️ Ce que ça implique

- La revue **statique** (lecture du code) couvre l'authentification, les
  autorisations, les paiements, les téléchargements, les en-têtes, les
  dépendances et la configuration. C'est fait et documenté ci-dessous.
- La revue **dynamique** (attaquer l'application en marche) a été **exécutée** :
  l'image a été construite, l'application a tourné derrière Caddy sur la pile
  isolée, et **40 vérifications sont passées sur 40**. Le comportement en marche
  confirme donc ce que la lecture du code promettait — ce n'est plus une attente.
- Aucune faille exploitable n'a été trouvée, ni en lecture ni en marche. Deux
  points sont des choix assumés et documentés (CSP en observation seule,
  limiteur qui laisse passer en cas de panne), pas des défauts — mais ils
  limitent ce que la défense arrête *aujourd'hui*. Un seul point est une vraie
  petite lacune (pas d'alerte au changement de compte de versement).

---

### 🚀 Ce qui a été fait

**1. Cartographie.** 20 routes API, 126 actions serveur dans 42 fichiers, 50
pages de tableau de bord, une matrice de rôles à 9 niveaux. Pas de middleware
global : chaque entrée garde sa propre porte (choix explicite du projet).

**2. Authentification — solide.**
- Sessions : jeton aléatoire de 32 octets, seule l'**empreinte SHA-256** est en
  base (une fuite de la table ne permet pas de se faire passer pour quelqu'un) ;
  cookie `httpOnly` + `secure` en production + `SameSite=Lax` ; une suspension
  coupe la session immédiatement, même avec un jeton encore frais.
- Mots de passe : **scrypt** (N=16384), comparaison à temps constant, longueur
  minimale, et réponse « faux » propre sur une empreinte illisible plutôt qu'une
  erreur.
- Connexion : limite AVANT de toucher la base (un essai refusé ne coûte pas un
  scrypt), vérification du mot de passe **même quand le compte n'existe pas**
  (sinon le temps de réponse trahirait les adresses connues), message
  **identique** pour « adresse inconnue » et « mot de passe faux » (pas
  d'annuaire).
- 2FA : secret TOTP **chiffré au repos**, défi dans un cookie distinct (aucune
  session n'est ouverte tant que le second facteur n'est pas franchi), 5 essais,
  codes de secours hachés. Une clé d'accès (WebAuthn) compte comme second
  facteur et vérifie l'origine et le compteur anti-clonage.

**3. Limitation de débit.** Fenêtre glissante (pas un compteur remis à zéro, qui
laisserait passer le double à la bascule), pilotes mémoire/Redis, clé par IP
tirée des en-têtes que la plateforme pose elle-même (le *dernier* élément de
`x-forwarded-for`, le moins usurpable). Treize règles calibrées par usage.

**4. Crons et webhooks.** Les 8 routes cron exigent un secret comparé à temps
constant et répondent **404** (pas 401 : ne pas confirmer qu'une route existe).
Le webhook de paiement vérifie la **signature HMAC** (base64 pour Flutterwave,
sha512 pour Paystack), borne la taille du corps, **rapproche montant ET devise**
de ce qui est attendu, et refuse un succès annoncé sans montant vérifiable.

**5. Autorisations / IDOR — le point le mieux tenu.**
- Téléchargement : la recherche de l'achat est filtrée par `buyerId: userId` —
  passer l'identifiant du fichier d'un autre rend « non payé », pas le fichier.
  Le débit de quota est un `updateMany` conditionnel atomique (pas de double
  dépense en cas de requêtes simultanées).
- CV de candidature filtré par `recruiterId`, inscrits d'événement filtrés par
  rôle, remboursement réservé au vendeur **ou** au pouvoir « traiter les
  litiges », réglage de prix filtré par `sellerId`.
- **Élévation de privilège impossible par le web** : aucune action serveur,
  aucune page n'écrit `platformRole`. Le rôle ne change que par un script en
  ligne de commande qui exige l'accès à la base. Vérifié par recherche sur tout
  `lib/app/scripts`.

**6. Injections / XSS.** Pas de SQL concaténé côté application (les `$queryRaw`
sont paramétrés ; le seul `queryRawUnsafe` est un script de nettoyage QA avec des
noms de table en dur). Un seul `dangerouslySetInnerHTML` (le JSON-LD du blog),
avec échappement `<` → `\u003c`. Export CSV protégé contre l'injection de
formule + guillemets RFC 4180. Redirections passées par `locationSure` (liste
blanche `/`, http, https) ; liens de profil/offre en https seul.

**7. En-têtes.** `X-Frame-Options: DENY`, `nosniff`, HSTS, `Referrer-Policy`,
`Permissions-Policy`, pas de `X-Powered-By`. CSP posée **en report-only**
(observation) — choix documenté.

**8. Dépendances et secrets.** `pnpm audit` : **1 seule alerte HIGH**, `braces`,
atteinte uniquement par le greffon eslint de Next (outil, pas production), sans
correctif publié — exactement l'exception documentée et ignorée nommément. La CI
refuse toute alerte en production et tout « high » ailleurs. **Aucun secret réel
dans les 247 commits** (recherche de motifs de clés Paystack/Flutterwave/AWS,
clés privées, jetons Twilio/VAPID) ; `.env` est bien ignoré par git.

**9. Téléversements.** Liste blanche de formats, type de contenu **figé dans la
signature** d'envoi, re-vérification côté serveur depuis l'objet réellement
déposé (jamais depuis ce que le navigateur annonce), SVG interdit comme média de
publicité (il peut contenir du script), clé liée au produit avant confirmation.

**10. Versements.** Un compte de versement neuf est bloqué **24 h** avant le
premier départ, et ce délai n'est **pas** levable par un administrateur — c'est
exactement ce qu'un attaquant demanderait au support.

**11. Tests de pénétration en direct — 40/40.** Pile `baobart-audit` montée
(Postgres 55433, MinIO 59000, Redis interne, app 3400, Caddy 3480), réseau
Docker séparé, base migrée et amorcée, application réellement démarrée (santé
`/api/health` = 200). Trois scénarios, tous verts :

- **Scénario 1 — en-têtes et gardes machine (28/28).** Les six en-têtes de
  sécurité présents *en direct ET derrière Caddy* (pas perdus par le mandataire),
  pas de `X-Powered-By` ; les 8 routes cron refusent sans secret (404, pas 401) ;
  le webhook de paiement sans signature → 401, opérateur inconnu → 404 ;
  l'injection SQL dans la recherche (`' OR 1=1;--`) rend un JSON propre, sans
  erreur 500.
- **Scénario 2 — authentification et IDOR (10/10).** Deux comptes jetables
  créés ; cookie de session bien `HttpOnly` + `SameSite=Lax` ; `/dashboard` sans
  session redirige vers `/connexion` ; **message identique** pour une adresse
  connue et une inconnue (pas d'énumération) ; un compte qui réclame le CV, les
  inscrits ou un téléchargement d'un autre reçoit **404**, jamais la donnée.
- **Scénario 3 — limiteur de débit (2/2).** En martelant la connexion derrière
  Caddy (qui pose l'en-tête d'adresse), le limiteur **borne dès le 9ᵉ essai**
  pour un quota de 10 — légèrement en avance, ce qui est exactement le
  comportement prudent que le code annonce près de la bascule. Mesuré avec le
  pilote Redis réel, pas en mémoire.

Scripts rejouables dans `C:\tmp\bba\tests` : `01-entetes-et-gardes.mjs`,
`02-auth-idor.mjs`, `03-limite-connexion.mjs`.

---

### ❓ Ce qui reste et les quelques points à décider

La pile d'audit a été **mise en pause** après les tests (`docker compose stop`,
données conservées) pour libérer la machine ; `docker compose start` la relance.

**Trois points, par ordre d'importance :**

1. **Pas d'alerte au changement de compte de versement** (vraie petite lacune,
   mesurée : aucun modèle de courriel ni appel de notification pour ce geste).
   Si un compte est détourné, le propriétaire ne reçoit rien ; seul le délai de
   24 h le protège. Un courriel « ton compte de versement a changé » le
   doublerait, pour un coût faible.
2. **CSP en report-only** (choix documenté) : le jour où une XSS passe, elle ne
   serait pas bloquée, seulement signalée — et dans la console de chaque
   visiteur, que personne ne collecte. Passer en mode bloquant demande d'abord
   une période d'observation et sans doute un *nonce* par requête.
3. **Limiteur qui laisse passer en cas de panne** (choix assumé) : si Redis
   tombe, plus rien n'est borné le temps de la panne. C'est un compromis
   raisonnable (un limiteur en panne ne doit pas fermer le service), mais il doit
   rester visible sur l'écran Système.

👉 **Pour t'entraîner :** pourquoi vérifier le mot de passe *même quand le compte
n'existe pas* protège-t-il mieux les utilisateurs que de répondre tout de suite
« compte inconnu » ? (Indice : ce n'est pas le message qui trahit, c'est le
*temps* de réponse.)
