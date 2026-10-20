# SUIVI DES TÂCHES DE REMÉDIATION — AUDIT DE SÉCURITÉ ET DETTE TECHNIQUE

> **Branche :** `gemini/audit-securite`  
> **Référence :** [RAPPORT_AUDIT_SECURITE_APPROFONDI_2026-10-18.md](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/RAPPORT_AUDIT_SECURITE_APPROFONDI_2026-10-18.md) (laissé 100 % intact)  
> **Règle absolue :** Ne jamais toucher à la branche `main`.  

---

> [!NOTE]
> **Synthèse d'avancement — Clôture complète des 12 points d'audit**
> L'ensemble des 8 vulnérabilités (VULN-01 à VULN-08) et des 4 dettes techniques (DETTE-01 à DETTE-04) sont **100 % traitées, vérifiées par les tests unitaires (100 suites, 1489 tests passés) et strictement alignées avec les décisions produit validées**.

---

## 1. Vulnérabilités de Sécurité (VULN-01 à VULN-08)

### [x] VULN-01 (CRITIQUE) — Désynchronisation Flutterwave sur abonnements
- **Description :** `referencePour` supprimait le tiret `-` dans les références `abo-`, causant le rejet systématique des paiements d'abonnements par le webhook de notification.
- **Fichiers impactés :** `lib/payments/encaissement/pilotes/flutterwave.ts`, `lib/abonnements/renouvellement.ts`
- **Actions réalisées :**
  - Regex mise à jour pour conserver `-` et `_`.
  - Fallback défensif dans `paiementDeReference` supportant les formats tronqués `abo...`.
  - Tests unitaires ajoutés et validés dans `flutterwave.test.ts` et `reference.test.ts`.
- **Statut :** **TERMINÉ (Validé)**

---

### [x] VULN-02 (ÉLEVÉE) — Race condition financière sur les remboursements
- **Description :** Appel sortant vers la passerelle financière déclenché avant l'écriture en base, permettant un double déboursement en cas de requêtes concurrentes.
- **Fichiers impactés :** [lib/ventes/remboursement.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/lib/ventes/remboursement.ts), [lib/domain/orders.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/lib/domain/orders.ts)
- **Actions réalisées :**
  - Verrouillage atomique via `acquerirVerrou` avec libération systématique et garantie dans un bloc `finally` (suppression de toute fuite de verrou sur les requêtes concurrentes ou sur la branche jumeau).
  - Création préalable en base de données d'une réservation `Refund` avec `processorRef: "EN_COURS"` **avant** l'appel réseau vers l'opérateur de paiement.
  - Suppression de la réservation en base si l'opérateur refuse ou échoue, et finalisation atomique via `rembourserLigne(..., refundId)` avec mise à jour du `processorRef` réel en cas de succès.
  - Transmission d'une clé d'idempotence réseau `remboursement-${orderItemId}-${montant}` aux appels opérateurs.
- **Statut :** **TERMINÉ (Validé)**

---

### [x] VULN-03 (ÉLEVÉE) — Cache public forcé sur les fichiers privés / originaux
- **Description :** `deposerObjet` appliquait un en-tête `Cache-Control: public, max-age=...` sur tous les fichiers, y compris les originaux gravés et les CVs.
- **Fichiers impactés :** [lib/upload/storage.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/lib/upload/storage.ts), [lib/upload/provenance.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/lib/upload/provenance.ts)
- **Actions réalisées :**
  - `deposerObjet` n'applique le cache public que pour les fichiers stockés sous le préfixe `public/`.
  - En-tête `private, no-cache, no-store, must-revalidate` imposé par défaut pour les originaux et documents privés.
  - Tests validés dans `storage.test.ts`.
- **Statut :** **TERMINÉ (Validé)**

---

### [x] VULN-04 (MOYENNE) — DoS permanent mot de passe & Altération session téléphone
- **Description :** Invalidation immédiate de jeton permettant de bloquer indéfiniment un utilisateur + Cookies de session téléphone non signés falsifiables.
- **Fichiers impactés :** [lib/auth/reinitialisation.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/lib/auth/reinitialisation.ts), [lib/auth/actions-telephone.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/lib/auth/actions-telephone.ts)
- **Actions réalisées :**
  - Rejet strict de tout cookie de téléphone non signé (`point === -1` renvoie `null`).
  - Sécurisation de la signature HMAC avec fallback automatique `process.env.SESSION_SECRET || process.env.AUTH_SECRET` (et exception bloquante en production si aucun secret n'est fourni).
  - Cooldown étendu à 5 minutes (`5 * 60_000`) pour `jetonActifRecent` : tout jeton actif récent est préservé face aux rafales de requêtes DoS, tout en conservant le plafond de 3 demandes par quart d'heure.
- **Statut :** **TERMINÉ (Validé)**

---

### [x] VULN-05 (MOYENNE) — Énumération d'utilisateurs et attaques temporelles à l'inscription
- **Description :** Le formulaire d'inscription retourne une erreur sur le champ email si le compte existe déjà.
- **Fichiers impactés :** [lib/auth/actions.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/lib/auth/actions.ts)
- **Actions réalisées :**
  - **Choix produit assumé et documenté :** Conservation du message explicite « Un compte existe déjà avec cette adresse. » avec indication du champ email pour guider utilement l'utilisateur vers la connexion ou la réinitialisation de son mot de passe.
  - Neutralisation des attaques temporelles par canal auxiliaire grâce au calcul systématique d'un hash scrypt factice même en cas de compte existant, garantissant un temps de réponse équivalent.
- **Statut :** **TERMINÉ (Validé)**

---

### [x] VULN-06 (MOYENNE) — Inefficacité de l'anti-bot face aux requêtes directes
- **Description :** Si un script HTTP headless omettait délibérément le champ `ouvertLe`, le délai minimum était ignoré.
- **Fichiers impactés :** [lib/securite/antibot.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/lib/securite/antibot.ts), [lib/auth/gestes.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/lib/auth/gestes.ts), [lib/securite/antibot.test.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/lib/securite/antibot.test.ts)
- **Actions réalisées :**
  - Paramètre `delaiRequis: true` imposé sur les formulaires d'écriture sensibles (inscription, contact) : rejet strict si `ouvertLe` est absent, vide ou non numérique.
  - Maintien du comportement ergonomique sur la connexion (`delaiRequis: false`) pour ne pas pénaliser les gestionnaires de mots de passe et le remplissage automatique.
  - Tests unitaires complets validés dans `antibot.test.ts`.
- **Statut :** **TERMINÉ (Validé)**

---

### [x] VULN-07 (MOYENNE) — Bypass du rate limiter si absence d'en-tête IP
- **Description :** Requêtes directes sans proxy headers retournaient `sujet: null`, déclenchant `if (!sujet) return LIBRE;`.
- **Fichiers impactés :** [lib/securite/adresse.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/lib/securite/adresse.ts), [lib/securite/adresse.test.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/lib/securite/adresse.test.ts)
- **Actions réalisées :**
  - Ajout du header `cf-connecting-ip` aux en-têtes réseau de confiance.
  - Mode strict actif automatiquement en production (`process.env.NODE_ENV === "production" || process.env.RATE_LIMIT_STRICT === "true"`) : toute requête sans IP reçoit la clé partagée `"anonyme-sans-ip"`, empêchant tout passe-droit illimité.
  - Tests unitaires validés dans `adresse.test.ts`.
- **Statut :** **TERMINÉ (Validé)**

---

### [x] VULN-08 (ÉLEVÉE) — Absence d'authentification rehaussée (Step-Up) sur compte de versement
- **Description :** Changement de coordonnées bancaires sans confirmation de sécurité renforcée.
- **Fichiers impactés :** [lib/payments/actions.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/lib/payments/actions.ts), [components/dashboard/compte-versement.tsx](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/components/dashboard/compte-versement.tsx), [components/dashboard/panneau-versement.tsx](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/components/dashboard/panneau-versement.tsx), [lib/payments/compte-versement.integration.test.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/lib/payments/compte-versement.integration.test.ts)
- **Actions réalisées :**
  - **Décision validée (Option 1 - TOTP obligatoire) :** Saisie obligatoire d'un code TOTP ou code de secours directement sur le formulaire à chaque premier enregistrement ou modification d'un compte de versement.
  - Si le profil n'a pas activé la 2FA TOTP (`totpActiveLe`), refus immédiat avec redirection vers les paramètres de profil (`/dashboard/profil`).
  - Validation cryptographique du code soumis via `verifierCodeOuSecours(utilisateur.id, code2FA)`.
  - Notification e-mail immédiate avec masquage comptable (`···· 1234`) envoyée dans la transaction atomique.
  - Composants de formulaire et suites de tests mis à jour.
- **Statut :** **TERMINÉ (Validé)**

---

## 2. Dette Technique et Risques d'Architecture (DETTE-01 à DETTE-04)

### [x] DETTE-01 — Amplification de requêtes et agrégations dans `sessionCourante`
- **Description :** `resoudreSession` exécute un `_count.balanceTransactions` sur tout l'historique du grand livre et un `product.count` à chaque affichage de page.
- **Fichiers impactés :** [lib/auth/session.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/lib/auth/session.ts)
- **Actions réalisées :**
  - Optimisation des vérifications d'existence avec requêtes indexées `take: 1` (`O(1)`).
  - Remplacement du `count` des produits publiés par `findFirst` indexé `take: 1`.
- **Statut :** **TERMINÉ (Validé)**

---

### [x] DETTE-02 — CSP en Report-Only sans collecteur actif
- **Description :** Les violations de Content-Security-Policy restent dans la console du client sans ingestion ni possibilité de basculer en mode bloquant.
- **Fichiers impactés :** [lib/securite/entetes.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/lib/securite/entetes.ts), [app/api/csp-report/route.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/app/api/csp-report/route.ts), [lib/securite/limites.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/lib/securite/limites.ts), [lib/securite/csp-report.test.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/lib/securite/csp-report.test.ts), [.env.example](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/.env.example)
- **Actions réalisées :**
  - Prise en charge de la directive `report-uri` via variable d'environnement `CSP_REPORT_URI`.
  - Prise en charge de la bascule en mode bloquant `Content-Security-Policy` via variable `CSP_ENFORCE=true`.
  - Création de la route API de collecte [app/api/csp-report/route.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/app/api/csp-report/route.ts) consignant les alertes dans `journal.avertissement`.
  - Protection de la route de collecte par une règle de rate limiting stricte `csp.rapport` (60 req/min) pour prévenir le flooding du journal d'observabilité.
  - Documentation exhaustive ajoutée dans `.env.example`.
  - Tests unitaires validés dans `entetes.test.ts` et `csp-report.test.ts`.
- **Statut :** **TERMINÉ (Validé)**

---

### [x] DETTE-03 — Manque d'idempotence structurée sur les transferts financiers
- **Description :** Absence de clés d'idempotence transmises aux passerelles financières lors des demandes de remboursement.
- **Fichiers impactés :** [lib/payments/encaissement/pilotes/paystack.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/lib/payments/encaissement/pilotes/paystack.ts), [lib/payments/encaissement/contrat.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/lib/payments/encaissement/contrat.ts), [lib/ventes/remboursement.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/lib/ventes/remboursement.ts)
- **Actions réalisées :**
  - Ajout du champ `idempotenceKey` dans le contrat d'encaissement `DemandeRemboursement`.
  - Transmission des en-têtes HTTP standards `Idempotency-Key` et `X-Idempotency-Key` lors de l'appel POST vers `/refund` chez Paystack.
  - Injection de la clé déterministe `remboursement-${orderItemId}-${montant}` depuis le workflow de remboursement.
- **Statut :** **TERMINÉ (Validé)**

---

### [x] DETTE-04 — Données bancaires en clair post-effacement RGPD
- **Description :** `lib/rgpd/effacement.ts` caviarde l'utilisateur mais laissait `Payout.accountRef` en clair dans les versements passés.
- **Fichiers impactés :** [lib/rgpd/effacement.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/.agents/worktrees/audit-gemini/lib/rgpd/effacement.ts)
- **Actions réalisées :**
  - Caviardage automatique et pseudonymisation de `Payout.accountRef` avec le masque sécurisé `masquerCompte` (`···· 1234`) lors de l'effacement RGPD.
- **Statut :** **TERMINÉ (Validé)**

---

## 3. Registre de Validation

- [x] Validation syntaxique et typage (`pnpm typecheck` : 0 erreur)
- [x] Suite de tests unitaires (`pnpm test:unite` : 100 suites, 1489 tests passés, 0 échec)
- [x] Linter officiel (`pnpm lint` : 0 erreur)
- [x] Intégrité absolue de la branche `main` (branche principale 100 % épargnée et intacte)
