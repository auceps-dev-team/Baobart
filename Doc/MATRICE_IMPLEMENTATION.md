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
> Dernière mise à jour : **11 septembre 2026** (v1.48.5).

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

## 6. Micro-services (schéma prêt, zéro route)

| Fonctionnalité | Spec | Module | Statut | Preuve/tests | Dette |
|---|---|---|---|---|---|
| Job board | §2.9 | `prisma/schema.prisma` (`JobPosting`) | ❌ | table seule (FK scalaires) | Aucune route `app/` |
| Services listés | §3.2 | `prisma/schema.prisma` (`Commission`) | ❌ | table seule | Aucune route `app/` |
| Événements / concours | §1 | `prisma/schema.prisma` (`Event`) | ❌ | table seule | Aucune route `app/` |
| Forum / communautés | §3.2 | `prisma/schema.prisma` (`Community`, `ForumCategory`) | ❌ | table seule | Aucune route `app/` |
| Admin — rôles fonctionnels (7) et matrice de pouvoirs | `SPEC_ADMIN_CMS_BAOBART.md` §2 | `lib/auth/administration.ts` | ✅ | v1.44.0, 18 tests | Une seule identité : pas de table `AdminUser` séparée — voir §17.1 de la spec. Aucun écran ne permet de s'élever, la promotion passe par la base |
| Admin — journal d'audit | `SPEC_ADMIN_CMS_BAOBART.md` §2 | `lib/admin/audit.ts` | ✅ | v1.44.0, 10 tests | La table `AuditLog` existait depuis le début **et n'était jamais écrite** : un écran d'audit aurait affiché une liste vide, ce qui se lit « rien ne s'est passé ». Consigner ne peut jamais faire échouer l'acte |
| Admin — shell `/admin` et écran d'audit | `SPEC_ADMIN_CMS_BAOBART.md` §2 | — | ❌ | — | `app/dashboard/systeme/` reste un espace d'exploitation technique. Les rôles fonctionnels n'ont pas encore d'écran à eux |
| CMS — cycle de vie et droits de publication | `SPEC_ADMIN_CMS_BAOBART.md` §18 | `lib/cms/cycle.ts`, `lib/cms/droits.ts` | ✅ | v1.45.0, 24 tests | Une seule machine à états pour les quatre CMS. Le droit se **calcule** — une colonne `peutPublierDesServices` dériverait de l'abonnement réel |
| CMS — Jobs : dépôt, modération, lecture publique, candidature | `SPEC_ADMIN_CMS_BAOBART.md` §6, §22 | `lib/jobs/*`, `app/jobs/*`, `app/dashboard/jobs/[id]/candidatures`, `app/api/jobs/candidatures/[id]/cv`, `app/api/cron/commandes` | ✅ | v1.47.0, 72 tests | Dépôt authentifié, file de relecture, badge « Offre vérifiée », audit, `/jobs`, fiche, candidature avec CV PDF (magic-bytes), écran candidat `/jobs/mes-propositions`, écran recruteur `/dashboard/jobs/[id]/candidatures`, téléchargement CV par URL signée éphémère, purge du CV à la clôture de l'offre (branchée sur le cron `commandes`) |
| CMS — Services : dépôt, modération, lecture publique, contact | `SPEC_ADMIN_CMS_BAOBART.md` §7, §23 | `prisma/schema.prisma`, `lib/services/*`, `lib/cms/moderation.ts`, `components/moderation/carte.tsx`, `components/services/*`, `app/services/*` | ✅ | v1.48.0, 53 tests | S1-S5 complets : schéma+seed, exclusivité Freelance/Agence, dépôt (validation pure + `SOUMIS`), file de modération mixte Jobs+Services, audit `service:<id>`, `/services` et fiche `/services/[id]` avec filtre par catégorie, CTA « Commander » et « Poser une question » en `mailto:` (deux intentions, deux sujets préfilés — encodage manuel plutôt que URLSearchParams pour Outlook) |
| CMS — Événements : schéma, phases, rédaction, lecture publique, inscription | `SPEC_ADMIN_CMS_BAOBART.md` §5, §24 | `prisma/schema.prisma`, `lib/evenements/*`, `components/evenements/*`, `app/dashboard/evenements/*`, `app/evenements/*` | ⚠️ | v1.49.1, 73 tests | E1-E4. Phase **calculée**, jamais rangée. Annuler ≠ retirer. Inscription avec verrou de capacité atomique — la réservation est une instruction unique, prouvée par deux tests de concurrence (dix candidats, trois places). Pas de `$transaction` : elle retenait une connexion du pool sur un flux ordinaire. Billet payant refusé tant que l'encaissement n'est pas branché. **Manque E5 (liste des inscrits + export CSV)** |
| CMS — blog | `SPEC_ADMIN_CMS_BAOBART.md` §4 | — | ❌ | — | Rien n'est écrit. Le cycle de vie qu'il partagera l'est |
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
