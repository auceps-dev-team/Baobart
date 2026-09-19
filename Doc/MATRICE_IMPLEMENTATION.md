# Matrice d'implémentation — Baobart

> **Document vivant.** Contrairement à un audit daté (`AUDIT_GUMROAD_2026-08-28.md`) ou au journal
> narratif du §0-bis (`PLAN_REFONTE_BAOBART_GUMROAD.md`), cette matrice n'a pas vocation à être
> réécrite en entier à chaque revue : **elle se met à jour ligne par ligne**, au fil des commits qui
> font avancer une fonctionnalité. Elle croise trois choses : ce que la spec demande, où ça vit dans
> le code, et si c'est prouvé par un test.
>
> **Règle d'entretien** : tout commit qui fait passer une ligne de ❌/⚠️ à ✅ (ou l'inverse) doit
> mettre à jour cette matrice dans le même commit. Une ligne sans route ni fichier connu se note `—`,
> pas de suppression de ligne tant que la spec existe.
>
> Dernière mise à jour : **17 septembre 2026** (v1.53.0).

**Légende** — Statut : ✅ fait et testé · ⚠️ partiel (infra sans usage, ou usage sans garde) ·
❌ absent · 🔜 planifié priorité proche.

---

## 1. Argent & commerce

| Fonctionnalité | Spec | Module | Statut | Preuve/tests | Dette |
|---|---|---|---|---|---|
| Frais & grand livre (2 régimes) | §2.4 | `lib/domain/fees.ts` | ✅ | 24 tests | Pas de compte plateforme — se reconstitue par requête, pas par lecture directe |
| Remboursement déclenchable | §3.1 | `lib/domain/orders.ts`, `lib/ventes/actions.ts` | ✅ | v1.36.0, 6 tests de plus | **L'argent repart vraiment** : appel `/refund` chez l'opérateur avant toute écriture. Jusqu'en v1.35.0 le grand livre était écrit sans que rien ne soit rendu à l'acheteur |
| Litiges / chargebacks | §3.6-A | `lib/domain/litiges.ts` | ✅ | testé, concurrence incluse | Pas de scoring de risque amont (type Stripe Radar) |
| Versements — calendrier/éligibilité | §3.9 | `lib/payments/*` | ✅ | v1.43.0, 30 tests | Retenue de 24 h sur un compte fraîchement enregistré : sans elle, un compte détourné voit ses versements repartir ailleurs au cycle suivant, sans qu'aucune autre garde ne le voie. Non levable à la main |
| Versements — 8 états pilotables | §3.9 | `lib/payments/*`, `app/dashboard/systeme/versements` | ✅ | v1.26.0 | `UNCLAIMED`/`REVERSED` réservés opérateur, pas de bouton |
| Versements — appel opérateur réel | §0-bis | `lib/payments/envoi.ts`, `app/api/cron/versements` | ⚠️ | v1.33.0, 11 tests | Écrit : inscription du bénéficiaire, virement, cas OTP. Jamais exercé contre le vrai service. La correspondance rail → opérateur est demandée à Paystack, jamais inventée |
| Versements — rappel entrant (`transfer.*`) | §0-bis | `lib/payments/encaissement/reception.ts` | ✅ | v1.33.0, 6 tests | Même adresse que les paiements ; le pilote trie par sens |
| **Passage en caisse / checkout** | §0-bis | `lib/checkout/achat.ts` | ✅ | v1.30.0, deux chemins | Ouvre et s'arrête : c'est le rappel qui conclut |
| **Paiement réel (mobile money)** | Bloquant n°1 | `lib/payments/encaissement/*`, `app/api/paiements/[fournisseur]/webhook` | ⚠️ | v1.32.0, 116 tests | Substrat + **trois pilotes écrits** (Paystack, Flutterwave, bac à sable). Reste à ouvrir un compte marchand : aucun n'a été exercé contre le vrai service |
| Route de rappel — codes de retour, signature, bornes | §6.1 | `app/api/paiements/[fournisseur]/webhook` | ✅ | v1.32.0, 14 tests | Le seul point d'entrée public. Éprouvé par lui, pas seulement par la couche en dessous |
| Péremption des commandes ouvertes | §6.1 | `lib/payments/encaissement/reglement.ts`, `app/api/cron/commandes` | ✅ | v1.32.0, 4 tests | 24 h. Écart assumé avec Gumroad (15 min, cf. `VERIFICATION_GUMROAD.md` §7.1) |
| Paystack — XOF, un appel, `authorization_url` | §6.1 | `lib/payments/encaissement/pilotes/paystack.ts` | ⚠️ | v1.32.0, 29 tests | Écrit et testé hors ligne, appels réseau compris (`fetch` remplacé). Conversion des montants ×100 y compris pour le XOF — et le test vérifie qu'elle traverse bien la requête, pas seulement qu'elle est juste |
| Flutterwave — API v4, OAuth + 3 appels | §6.1 | `lib/payments/encaissement/pilotes/flutterwave.ts` | ⚠️ | v1.31.0, 16 tests | Écrit et testé hors ligne. Réseaux mobile money en zone CFA non documentés publiquement |
| Stripe | §6.1 | — | ⛔ | — | **Sans objet en direct** : Stripe dessert l'Afrique de l'Ouest *via Paystack*. Le pilote Paystack EST le chemin Stripe |
| PayPal | — | — | ⛔ | — | Ne règle pas en XOF. Ne servirait qu'une diaspora payant en EUR/USD, et exigerait `ExchangeRate` qui n'existe pas |
| Codes promo | §3.4-B | — | ❌ | — | Schéma seul, non câblé |
| Upsell post-achat | §3.4-B | — | ❌ | — | — |
| Panier abandonné | §3.4-B | — | ❌ | — | — |
| Échelonnement de paiement | §3.4-B | — | ❌ | — | — |
| Cartes cadeaux | §3.4-B | — | ❌ | — | — |
| Pourboires | §3.4-B | — | ❌ | — | — |
| Parité pouvoir d'achat (PPP) | §3.4-B | — | ❌ | — | — |
| Memberships (abonnements récurrents) | §3.4-D | `lib/ndank/*`, `lib/abonnements/*` | ✅ | v1.40.0, 22 tests d'intégration | Le mobile money ne sait pas prélever : pas de mandat, l'abonné valide chaque débit. Ndank relance (courriel, SMS), suspend et clôt ; `lib/abonnements` encaisse le renouvellement. Table `SubscriptionPayment` à part de `Order` — un abonnement n'a pas de vendeur à créditer |
| PWA installable | — | `app/manifest.ts`, `public/sw.js`, `public/icones/` | ✅ | v1.42.0 | Le service worker ne met **rien** en cache, délibérément : sur une application où l'argent circule, un cache mal invalidé sert un prix d'hier, et un service worker fautif reste des semaines chez les visiteurs. Invitation à installer câblée (`beforeinstallprompt`, et la marche à suivre sur iOS où aucune API ne l'ouvre) |
| Notifications poussées (Web Push) | — | `lib/push/*`, `components/push/notifications.tsx` | ✅ | v1.41.0, 21 tests | VAPID via `pnpm push:cles`. Aux paliers J+2 et J+5 la notification passe **avant** le SMS : chaque abonné installé est un SMS qu'on n'envoie pas. Rechanger la paire rend tous les abonnements muets en silence — l'écran Système classe ce cas en panne |
| Produits « coffee » | §3.4-D | — | ❌ | — | — |
| Précommandes | §3.9 | — | ❌ | — | — |
| Champs personnalisés au checkout | §3.4-F | — | ❌ | — | — |
| Licences (clés, vérification) | §3.1 | `prisma/schema.prisma` (modèle `License`) | ⚠️ | émise, jamais vérifiée | Pas d'interface de vérification/activation exposée |

## 2. Fichiers, livraison, aperçus

| Fonctionnalité | Spec | Module | Statut | Preuve/tests | Dette |
|---|---|---|---|---|---|
| Envoi de fichiers (24 formats, URL signée, direct-to-storage) | §3.9 | `lib/upload/*` | ✅ | 13 tests + bout en bout MinIO | — |
| Aperçus (vignette publique, source privée) | `SPEC_LIVRAISON_PREVIEWS_ASSETS.md` | `lib/upload/*` | ✅ | 200/403 vérifiés | Formats non-image sans aperçu auto (PSD, AI, TTF, MP4, ZIP) — choix assumé |
| Livraison après achat (URL signée, journal de consommation) | §3.9 | `lib/ventes/*` | ✅ | 8 tests, octets vérifiés | Durée d'URL Gumroad dépend de la taille du fichier — non répliqué |
| `UploadReservation` orphelins | §0-bis | `lib/upload/*` | ⚠️ | balayage existe | Lignes « uploaded » s'accumulent comme journal |

## 3. Auth, confiance, sécurité

| Fonctionnalité | Spec | Module | Statut | Preuve/tests | Dette |
|---|---|---|---|---|---|
| Inscription/connexion/sessions | §0-bis | `lib/auth/*` | ✅ | 20 tests | — |
| Rôles progressifs (acheteur→atelier→boutique) | §0-bis | `lib/auth/*` | ✅ | 11 tests | — |
| **Mot de passe oublié** | §0-bis | `lib/auth/actions.ts` (`demanderReinitialisation`, `reinitialiserMotDePasse`), `app/mot-de-passe-oublie`, `app/reinitialiser/[jeton]` | ✅ | v1.48.5 — boucle vérifiée de bout en bout | La ligne annonçait ❌ « coquille littérale » : c'était périmé. Les deux actions, les deux écrans et le modèle de courriel existent. En développement, poser `SMTP_URL` sur un collecteur local (MailHog, Mailpit) — sans lui `EMAIL_DRIVER=smtp` échoue en silence et le lien n'arrive jamais |
| Trust & suspension de compte | §3.8 | `lib/domain/trust.ts` | ✅ | v1.26.0 | Réactivation produits à la levée et blocage IP non exécutés (journalisés) |
| Machine à états de risque vendeur | §3.8 | `lib/domain/trust.ts` | ⚠️ | états définis, câblage manuel seulement | Pas de détection automatique (LowBalanceFraudCheck) |
| 2FA (TOTP + WebAuthn) | §3.6-A | — | ❌ | — | — |
| Blocklist IP/objets | §3.6-A | — | ❌ | — | — |
| Anti-bot / reCAPTCHA | §3.7-D | — | ❌ | — | — |
| RGPD (effacement) | §3.7-C | — | ❌ | — | — |
| Modération de contenu | §3.6-A | `lib/social/*` | ⚠️ | signalement manuel | Pas d'automatisation (extraction, stratégies) |

## 4. Feed, social, produits

| Fonctionnalité | Spec | Module | Statut | Preuve/tests | Dette |
|---|---|---|---|---|---|
| Feed & découverte (curseur, filtres) | §0-bis | `lib/feed/*`, `app/explore` | ✅ | 13 tests | Pas de moteur de recommandations au-delà du feed de base |
| Fiche produit + modale interceptée | §0-bis | `app/products/[slug]`, `app/@modal` | ✅ | vérifié navigateur | — |
| Dépôt/gestion ressource | §0-bis | `app/dashboard/produits` | ✅ | vérifié navigateur | — |
| Social (likes, follows, commentaires 2 niveaux) | §0-bis | `lib/social/*` | ✅ | 20+27 tests | — |
| Édition du profil créateur | §0-bis | `lib/profil/*`, `components/dashboard/profil-form.tsx`, `app/dashboard/profil` | ✅ | v1.48.9, 19 tests | La vitrine `/createurs/[username]` existait depuis v1.45.0 **sans rien pour la remplir** : les colonnes du schéma étaient vides pour tout le monde et l'écran annonçait « Édition bientôt disponible ». Le nom d'utilisateur est modifiable — contrairement au slug d'un produit — parce qu'il désigne une personne, pas une chose ; l'écran prévient que l'ancienne adresse cessera de répondre. Avatar et bannière restent à faire (envoi de fichier) |
| Staff Picked (sélection éditoriale) | §3.10-A | — | ❌ | — | Porte d'entrée pour créateurs sans vente — pas encore de solution au démarrage à froid |
| Affiliation (peer 30j + ambassadeurs 7j) | §3.4-C | — | ❌ | — | — |
| Wishlists suivables | §3.4-D | — | ❌ | — | — |

## 5. Communication

| Fonctionnalité | Spec | Module | Statut | Preuve/tests | Dette |
|---|---|---|---|---|---|
| File d'e-mails transactionnels (infra) | §0-bis | `lib/email/outbox.ts` | ✅ | v1.21.0-1.23.0 | — |
| Pilotes (console/resend/smtp) | §0-bis | `lib/email/*` | ✅ | v1.22.0 | — |
| E-mail — bienvenue à l'inscription | §0-bis | `lib/auth/actions.ts` | ✅ | déposé | — |
| E-mail — reçu d'achat | §0-bis | `lib/payments/encaissement/reglement.ts` | ✅ | déposé au règlement, pas à l'ouverture | Porte un lien vers l'espace gardé |
| E-mail — lien de téléchargement | §0-bis | `lib/email/modeles.ts` | ⛔ | — | **Volontairement jamais déposé** : son texte promet une URL signée, donc un laissez-passer au porteur qui contournerait remboursement, litige, accès retiré et quota. Le reçu porte un lien vers l'espace gardé à la place |
| E-mail — avis de versement | §0-bis | `lib/payments/versements.ts` | ✅ | v1.30.0, déposé au passage en `PROCESSING` | — |
| E-mail — réinitialisation mot de passe | §0-bis | `lib/auth/reinitialisation.ts`, `app/reinitialiser/[jeton]` | ✅ | v1.30.0, 14 tests | Jeton haché, une heure, usage unique, ferme toutes les sessions |
| Ordonnanceur cron | §0-bis | `vercel.json`, `app/api/cron/*` | ✅ | v1.21.0-1.23.0 | Trois passages : versements, courriels, ménage des commandes |
| **Limitation du débit** | §3.7-D | `lib/securite/*` | ✅ | v1.34.0, 45 tests | Fenêtre glissante, pilotes mémoire/Redis, laisse passer en panne. Borne connexion, inscription, oubli, rappels d'opérateur |
| **Tests au navigateur (E2E)** | — | `e2e/*`, `playwright.config.ts` | ✅ | v1.35.0, 17 tests | Inscription → achat → espace acheteur, gardes des écrans d'exploitation, limitation par l'adresse. Tournent sur un **build**, pas sur `next dev` |
| Redis | §M0 | `lib/securite/pilotes.ts` | ⚠️ | v1.34.0 | Branché **pour la limitation seulement**. Ni cache, ni file, ni sessions |

## 6. Micro-services

> Cette section s'appelait « schéma prêt, zéro route ». Ce n'est plus vrai pour
> trois de ses quatre lignes, et elles ont menti pendant plusieurs versions :
> la règle d'entretien en tête de document demande de mettre la matrice à jour
> **dans le commit** qui change un statut, et ce sont les seules lignes où on
> ne l'a pas fait — parce que le sujet avait entre-temps gagné une seconde
> ligne dans une autre section. Un document vivant qui décrit deux fois la même
> chose finit par se contredire.

| Fonctionnalité | Spec | Module | Statut | Preuve/tests | Dette |
|---|---|---|---|---|---|
| Job board | §2.9 | voir « CMS — Jobs » plus bas | ✅ | v1.47.0 | **Ligne périmée corrigée le 17 septembre 2026** : elle annonçait « aucune route `app/` » alors que `app/jobs/*` existe depuis v1.47.0. Le doublon venait de deux sections décrivant le même sujet |
| Services listés | §3.2 | voir « CMS — Services » plus bas | ✅ | v1.48.0 | **Ligne périmée corrigée le 17 septembre 2026**, même cause |
| Événements / concours | §1 | voir « CMS — Événements » plus bas | ✅ | v1.52.2 | **Ligne périmée corrigée le 17 septembre 2026**, même cause |
| Communautés (fil + collections) | §3.2 | `lib/forum/*`, `components/forum/*`, `app/communautes/*`, `app/dashboard/signalements` | ✅ | v1.56.0, 138 tests | **La forme vient de la maquette**, vérifiée le 18 septembre 2026 : `Baobart Accueil.dc.html`, section `#collab` « Vos espaces d'équipe » empile une **collection partagée** (« Campagne Dakar 2026 — 4 membres · 38 ressources »), sa grille de ressources, puis un **fil plat** (`{{ c.who }}` / `{{ c.when }}` / `{{ c.text }}`, « Écrire un commentaire… »). Les trois sont livrés dans cet ordre. `Board.communityId` porte le partage : **seul le propriétaire attache**, et seulement là où il est membre — attacher rend une collection privée lisible par tous les membres, donc un administrateur ne peut pas exposer le rangement d'un autre ; il peut la détacher. `onDelete: SetNull` : supprimer une communauté rend la collection, ne l'emporte pas. `isPublic` et `communityId` restent distincts — les fusionner ouvrirait à tout Internet un partage entre douze personnes. **Toutes les communautés sont ouvertes** (le réglage privé/sur invitation menait à une porte close, faute de table de demandes). **Écrire exige l'appartenance.** Modération : `/dashboard/signalements` reprend le nom, la place et la forme de `a_signalements` — quatre tuiles, messages des deux origines, **filtres par origine et recherche** (corps + nom de communauté, jamais par auteur : ce serait un outil de surveillance), **historique des décisions** lu du journal d'audit avec son motif, et fermeture/réouverture d'une communauté à **motif obligatoire** (règle de `a_membres_risque`). Notifications : deux événements IN_APP seulement, dont un **limité à un avis par communauté et par jour** — la clé d'idempotence fait le limiteur. **Reste : `ForumCategory`/`ForumTopic`/`ForumPost` et leur code restent sans écran — aucune maquette ne les dessine, et leurs messages déjà écrits restent modérables ; pas d'écran d'administration de communauté côté créateur (renommer, nommer un modérateur) ; le bouton « Inviter » de la maquette n'est pas branché |
| Signalement & retrait juridique | `SPEC` — | `lib/juridique/*`, `components/juridique/*`, `app/signalement/*`, `app/dashboard/mes-dossiers`, `app/dashboard/signalements` | ✅ | v1.57.1, 61 tests | **Le droit applicable est ivoirien, et il n'est pas là où on le cherche.** Baobart est établie à Abidjan : le régime des hébergeurs est au **chapitre 6 de la loi n° 2013-451 du 19 juin 2013 sur la cybercriminalité**, articles 46 à 54 — et non dans la loi n° 2013-546 sur les transactions électroniques, celle qui transpose pourtant l'acte CEDEAO A/SA.2/01/10 et qui ne dit rien des hébergeurs. Lu le 19 septembre 2026 dans le Journal officiel (tresor.gouv.ci). `lib/juridique/article47.ts` est pur et porte les **six** exigences verbatim. Différences avec le DMCA américain et avec la loi sénégalaise, toutes trois vérifiées : la loi ivoirienne exige d'avoir **écrit à l'auteur avant** de saisir la plateforme (le DMCA non) ; elle ne demande à une personne morale que dénomination + siège social (le Sénégal en demande quatre) ; elle n'a pas d'élément « date de la notification » (le Sénégal si) ; elle fait des droits et des motifs **une seule** exigence. Une notification incomplète est **enregistrée avec sa date** et non refusée — la date de première tentative est celle qui compte devant un juge — et l'écran dit laquelle des six manque. **Article 49 affiché sur le formulaire** : notifier de mauvaise foi est puni de 1 à 5 ans et de 1 à 5 M FCFA ; c'est la meilleure protection du créateur du dispositif, et le DMCA n'a pas d'équivalent pénal. L'auteur visé est prévenu **par courriel** (modèle `RETRAIT_JURIDIQUE`, avis impératif) parce que le délai de réponse court : une cloche non ouverte rendrait le retrait définitif par silence. Sa page ne **charge pas** les colonnes du notifiant — un litige de droit d'auteur n'a pas à exposer un domicile. Aucun délai chiffré ne vient de la loi (« promptement », art. 46) : les 48 h et 10 jours sont des engagements Baobart, et la page publique sépare les deux en deux colonnes. Le dépôt public est borné par `juridique.depot` — **trois par heure et par adresse**, seule règle de `lib/securite/limites.ts` qui protège une écriture anonyme, et la seule sous le plancher de cinq : une offre d'emploi de trop ajoute une ligne dans une file, une notification de trop fait retirer le travail de quelqu'un. Un passage quotidien (`/api/cron/juridique`) clôt les dossiers dont l'échéance est passée sans réponse — sans lui, « tu as dix jours » n'aurait été qu'une phrase, et les deux parties auraient attendu une décision que personne n'allait prendre ; cette décision-là n'est attribuée à **personne** (`decidedById` nul) et son motif dit « sans examen humain ». **Reste : pas de rapprochement automatique d'un contenu à son compte, donc un dossier non rapproché retire sans prévenir ; **les mentions d'identification de l'article 54 sont incomplètes** (forme sociale, RCCM, capital, directeur de publication) et la page le dit ; la vérification de la loi 2023-593 (qui ne touche pas les art. 46-54) repose sur un résumé, pas sur le texte modificatif ; l'acte CEDEAO A/SA.2/01/10 n'a pas pu être lu, son PDF étant un scan sans couche texte |
| Admin — rôles fonctionnels (7) et matrice de pouvoirs | `SPEC_ADMIN_CMS_BAOBART.md` §2 | `lib/auth/administration.ts` | ✅ | v1.44.0, 18 tests | Une seule identité : pas de table `AdminUser` séparée — voir §17.1 de la spec. Aucun écran ne permet de s'élever, la promotion passe par la base |
| Admin — journal d'audit | `SPEC_ADMIN_CMS_BAOBART.md` §2 | `lib/admin/audit.ts` | ✅ | v1.44.0, 10 tests | La table `AuditLog` existait depuis le début **et n'était jamais écrite** : un écran d'audit aurait affiché une liste vide, ce qui se lit « rien ne s'est passé ». Consigner ne peut jamais faire échouer l'acte |
| Admin — shell `/admin` et écran d'audit | `SPEC_ADMIN_CMS_BAOBART.md` §2 | — | ❌ | — | `app/dashboard/systeme/` reste un espace d'exploitation technique. Les rôles fonctionnels n'ont pas encore d'écran à eux |
| CMS — cycle de vie et droits de publication | `SPEC_ADMIN_CMS_BAOBART.md` §18, §25, §26 | `lib/cms/cycle.ts`, `lib/cms/droits.ts`, `lib/cms/moderation.ts` | ✅ | v1.51.1, 38 tests | Une seule machine à états pour les quatre CMS. Le droit se **calcule**. `exigeUneRelecture` prend l'**auteur** en plus du type depuis que les événements s'ouvrent aux agences — c'est le test « aucun contenu ouvert ne paraît sans relecture » qui l'a signalé. `typesRelusPar` borne la file au pouvoir de chacun : Jobs et Services à `moderer_le_contenu`, les événements à `publier_du_contenu`, et l'écran s'ouvre à **au moins un** des deux |
| CMS — Jobs : dépôt, modération, lecture publique, candidature | `SPEC_ADMIN_CMS_BAOBART.md` §6, §22 | `lib/jobs/*`, `app/jobs/*`, `app/dashboard/jobs/[id]/candidatures`, `app/api/jobs/candidatures/[id]/cv`, `app/api/cron/commandes` | ✅ | v1.47.0, 72 tests | Dépôt authentifié, file de relecture, badge « Offre vérifiée », audit, `/jobs`, fiche, candidature avec CV PDF (magic-bytes), écran candidat `/jobs/mes-propositions`, écran recruteur `/dashboard/jobs/[id]/candidatures`, téléchargement CV par URL signée éphémère, purge du CV à la clôture de l'offre (branchée sur le cron `commandes`) |
| CMS — Services : dépôt, modération, lecture publique, contact | `SPEC_ADMIN_CMS_BAOBART.md` §7, §23 | `prisma/schema.prisma`, `lib/services/*`, `lib/cms/moderation.ts`, `components/moderation/carte.tsx`, `components/services/*`, `app/services/*` | ✅ | v1.48.0, 53 tests | S1-S5 complets : schéma+seed, exclusivité Freelance/Agence, dépôt (validation pure + `SOUMIS`), file de modération mixte Jobs+Services, audit `service:<id>`, `/services` et fiche `/services/[id]` avec filtre par catégorie, CTA « Commander » et « Poser une question » en `mailto:` (deux intentions, deux sujets préfilés — encodage manuel plutôt que URLSearchParams pour Outlook) |
| CMS — Événements (complet : E1-E5, ouvert aux agences, relu en file) | `SPEC_ADMIN_CMS_BAOBART.md` §5, §24, §25, §26 | `prisma/schema.prisma`, `lib/evenements/*`, `components/evenements/*`, `app/dashboard/evenements/*`, `app/evenements/*`, `app/api/evenements/[id]/inscrits` | ✅ | v1.51.1, 129 tests | Phase **calculée**, jamais rangée. Annuler ≠ retirer. Inscription à verrou de capacité atomique. Liste des inscrits + export CSV protégé contre l'injection de formule. Une **agence badgée et abonnée** gère les siens (§25) : une `Portee` borne chaque lecture et chaque écriture, elle soumet sans pouvoir publier. Depuis v1.51.1, sa fiche attend dans `/dashboard/moderation` et le refus porte un **motif** (§26) — seul canal vers l'organisateur, faute de messagerie. **Reste : prévenir l'organisateur par courriel, billets payants (encaissement non branché), avatar/bannière d'événement, concours (jury, résultats)** |
| Notifications — aiguilleur, centre in-app, préférences | `SPEC_ADMIN_CMS_BAOBART.md` §27 | `lib/notifications/*`, `components/notifications/*`, `app/dashboard/notifications/*`, `lib/email/modeles.ts`, `prisma/schema.prisma` (`Notification`, `NotificationPreference`) | ✅ | v1.52.2, 68 tests | Une **porte unique** remplace la collection d'oublis. Catalogue de 13 événements couvrant acheteur ET vendeur, préférences par **couple (événement × canal)** — repris de Gumroad, dont on refuse le stockage en bits. Six avis **impératifs** (argent, décision, déplacement) que la préférence ne coupe pas. L'aiguilleur **entre dans une transaction** : les reçus s'écrivent avec le paiement qui les justifie, jamais après. **12 des 13 événements sont déclenchés** ; les 8 modèles de courriel manquants sont écrits, et un test tient `MODELES` aligné sur l'enum Prisma. **Reste : `TELECHARGEMENT_PRET` sans déclencheur (question ouverte sur l'URL signée), push web déclaré mais non livré, aucune gestion des rebonds, et un abonné aux canaux tous fermés reste sans avis** |
| Ordonnanceur — routes périodiques | — | `vercel.json`, `app/api/cron/*`, `lib/systeme/ordonnanceur.test.ts` | ✅ | v1.57.1, 4 tests | **Un défaut silencieux corrigé, trouvé par hasard.** `/api/cron/blog` existait depuis v1.53.1 avec son code, son écran, sa colonne et ses tests — et **aucune ligne dans `vercel.json`**. La publication planifiée n'a donc jamais été déclenchée en production pendant six versions. Rien ne plantait : la route répondait, et attendait un appel que personne ne faisait. Un article planifié restait en brouillon pour toujours, et la seule façon de s'en apercevoir était qu'un auteur s'en plaigne. `ordonnanceur.test.ts` vérifie désormais la correspondance **dans les deux sens** — une route sans horaire est du code mort qu'on croit vivant ; un horaire sans route est un 404 périodique et une alerte qu'on apprend à ignorer. Aucun des deux ne se voit dans un diff, les fichiers étant dans des dossiers différents. Six passages planifiés : versements, courriels, commandes, abonnements, blog, juridique |
| CMS — Blog : rédaction, relecture offerte, lecture publique, SEO | `SPEC_ADMIN_CMS_BAOBART.md` §4, §28 | `lib/blog/*`, `components/blog/*`, `app/dashboard/blog/*`, `app/blog/*` | ✅ | v1.53.0, 55 tests | Le quatrième CMS, et le dernier. **Pas de TipTap ni d'HTML** : un sous-ensemble de Markdown analysé en blocs que React affiche — ce projet ne rend d'HTML nulle part, et un blog n'est pas une raison de commencer. `ContentState` partagé plutôt que le `status` de §4.1. La relecture de §4.3 est **offerte, pas imposée** (§18.1) : les deux boutons cohabitent sur un brouillon. L'adresse se fige à la première parution — un lien partagé ne meurt pas sur une correction de titre. SEO avec repli sur le contenu, JSON-LD échappé. **Reste : couverture par téléversement (adresse seulement), publication planifiée, rubriques sans écran de gestion** |
| Profil public d'un créateur | `Baobart Accueil.dc.html` | `app/createurs/*`, `lib/createurs/queries.ts` | ✅ | v1.45.0, 11 tests | Répare un lien mort : on pouvait suivre quelqu'un sans pouvoir le visiter. Deux indicateurs de la maquette — vues de page, délai de réponse — sont absents faute de donnée |

## 7. Infrastructure & exploitation

| Fonctionnalité | Spec | Module | Statut | Preuve/tests | Dette |
|---|---|---|---|---|---|
| Socle Next.js/Prisma/Tailwind/Docker | §0-bis | racine | ✅ | build de prod propre | — |
| Déploiement Vercel + CI | §0-bis | `vercel.json` | ✅ | v1.18.0 | — |
| Point de santé, journal structuré | §0-bis | — | ✅ | v1.19.0 | — |
| Rôle plateforme + écran de configuration | §0-bis | `app/dashboard/systeme/configuration` | ✅ | v1.20.0 | — |
| Vulnérabilités dépendances (sharp, postcss, nanoid, deepmerge-ts) | Audit 21/08 | `package.json` (`overrides`) | ✅ | corrigé | — |
| Tests bout en bout navigateur (Playwright) | §0-bis | — | ❌ | — | Vérifications faites à la main à chaque jalon |

---

*Sources croisées : `AUDIT_GUMROAD_2026-08-28.md`, §0-bis du plan directeur, lecture directe du
code au commit `dd9d662`. Pour la méthode de vérification section par section du référent Gumroad
lui-même, voir `VERIFICATION_GUMROAD.md`.*
