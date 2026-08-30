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
> Dernière mise à jour : **28 août 2026**, au commit `dd9d662` (v1.26.0).

**Légende** — Statut : ✅ fait et testé · ⚠️ partiel (infra sans usage, ou usage sans garde) ·
❌ absent · 🔜 planifié priorité proche.

---

## 1. Argent & commerce

| Fonctionnalité | Spec | Module | Statut | Preuve/tests | Dette |
|---|---|---|---|---|---|
| Frais & grand livre (2 régimes) | §2.4 | `lib/domain/fees.ts` | ✅ | 24 tests | Pas de compte plateforme — se reconstitue par requête, pas par lecture directe |
| Remboursement déclenchable | §3.1 | `lib/domain/orders.ts` (`rembourserLigne`) | ✅ | testé, garde côté action serveur | — |
| Litiges / chargebacks | §3.6-A | `lib/domain/litiges.ts` | ✅ | testé, concurrence incluse | Pas de scoring de risque amont (type Stripe Radar) |
| Versements — calendrier/éligibilité | §3.9 | `lib/payments/*` | ✅ | 27 tests | — |
| Versements — 8 états pilotables | §3.9 | `lib/payments/*`, `app/dashboard/systeme/versements` | ✅ | v1.26.0 | `UNCLAIMED`/`REVERSED` réservés opérateur, pas de bouton |
| Versements — appel opérateur réel | §0-bis | `app/api/cron/versements/route.ts` | ❌ | — | Le cron ne fait que préparer (`CREATING`) |
| **Passage en caisse / checkout** | §0-bis | `lib/checkout/achat.ts` | ✅ | v1.30.0, deux chemins | Ouvre et s'arrête : c'est le rappel qui conclut |
| **Paiement réel (mobile money)** | Bloquant n°1 | `lib/payments/encaissement/*`, `app/api/paiements/[fournisseur]/webhook` | ⚠️ | v1.31.0, 84 tests | Substrat + **trois pilotes écrits** (Paystack, Flutterwave, bac à sable). Reste à ouvrir un compte marchand : aucun n'a été exercé contre le vrai service |
| Paystack — XOF, un appel, `authorization_url` | §6.1 | `lib/payments/encaissement/pilotes/paystack.ts` | ⚠️ | v1.31.0, 17 tests | Écrit et testé hors ligne. Conversion des montants ×100 y compris pour le XOF — le piège est testé |
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
| Memberships (abonnements récurrents) | §3.4-D | — | ❌ | — | — |
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
| **Mot de passe oublié** | §0-bis | `lib/auth/actions.ts:203` | ❌ | — | Coquille littérale malgré modèle d'e-mail + pilotes prêts |
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
| Profil public créateur | §0-bis | — | ❌ | — | Le bouton « Suivre » fonctionne, la page à visiter n'existe pas |
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
| Ordonnanceur cron | §0-bis | `vercel.json`, `app/api/cron/*` | ✅ | v1.21.0-1.23.0 | — |

## 6. Micro-services (schéma prêt, zéro route)

| Fonctionnalité | Spec | Module | Statut | Preuve/tests | Dette |
|---|---|---|---|---|---|
| Job board | §2.9 | `prisma/schema.prisma` (`JobPosting`) | ❌ | table seule (FK scalaires) | Aucune route `app/` |
| Services listés | §3.2 | `prisma/schema.prisma` (`Commission`) | ❌ | table seule | Aucune route `app/` |
| Événements / concours | §1 | `prisma/schema.prisma` (`Event`) | ❌ | table seule | Aucune route `app/` |
| Forum / communautés | §3.2 | `prisma/schema.prisma` (`Community`, `ForumCategory`) | ❌ | table seule | Aucune route `app/` |
| CMS Super Admin (7 rôles) | `SPEC_ADMIN_CMS_BAOBART.md` | — | ❌ | — | `app/dashboard/systeme/` existe mais n'est qu'un espace d'exploitation technique interne |

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
