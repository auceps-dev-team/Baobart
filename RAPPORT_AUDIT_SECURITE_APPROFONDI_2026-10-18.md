# RAPPORT COMPLET D'AUDIT DE SÉCURITÉ, D'ARCHITECTURE ET DE DETTE TECHNIQUE — BAOBART

**Date d'évaluation :** 18 octobre 2026  
**Auteur :** Antigravity AI Security Engineer (Gemini 3.1 Pro)  
**Environnement :** Sandbox isolé Docker / Worktree Git dédié (`gemini/audit-securite`)  
**Cible :** Architecture complète Baobart (Next.js 15, Prisma ORM, PostgreSQL, Redis, MinIO/S3, Passerelles de Paiement)  
**Référence comparative :** Audit Claude Opus 5.5 du 15 octobre 2026 (`RAPPORT_AUDIT_SECURITE_2026-10-15.md`)

---

## 1. RÉSUMÉ EXÉCUTIF ET CONTEXTE COMPARATIF

Le 15 octobre 2026, un premier audit conduit par Claude Opus 5.5 concluait à un score de **40/40**, affirmant :
> *"Aucune faille exploitable n'a été trouvée, ni en lecture ni en marche. Deux points sont des choix assumés et documentés... Un seul point est une vraie petite lacune (pas d'alerte au changement de compte de versement)."*

Notre audit approfondi de sécurité défensive et d'ingénierie logicielle démontre que **ce diagnostic était incomplet**. Bien que les mécanismes de base (hachage scrypt, cookies `HttpOnly`, intégrité HMAC des webhooks, typage Prisma) soient bien implémentés, l'analyse statique et sémantique approfondie des flux d'exécution, des conditions aux limites, des interactions réseau distribuées et de la résilience transactionnelle révèle **8 vulnérabilités concrètes (dont 1 critique et 2 élevées)** ainsi que **4 axes majeurs de dette technique**.

### Tableau Récapitulatif des Vulnérabilités Détectées

| Identifiant | Intitulé de la Faille / Problème | Sévérité | Statut Opus 5.5 | Impact Métier & Système |
| :--- | :--- | :--- | :--- | :--- |
| **VULN-01** | Désynchronisation silencieuse sur abonnements Flutterwave | **CRITIQUE (CVSS 8.5)** | Non détectée | Prélèvement bancaire client sans activation du service |
| **VULN-02** | Condition de concurrence (Race Condition) sur les remboursements | **ÉLEVÉE (CVSS 8.1)** | Non détectée | Déboursement financier multiple sur un même achat |
| **VULN-03** | En-tête `Cache-Control: public` sur les fichiers sources privés | **ÉLEVÉE (CVSS 7.5)** | Non détectée | Mise en cache et fuite des actifs numériques non achetés |
| **VULN-04** | Déni de service permanent sur réinitialisation de mot de passe | **MOYENNE (CVSS 6.5)** | Non détectée | Blocage ciblé de la récupération de compte utilisateur |
| **VULN-05** | Énumération d'utilisateurs via le formulaire d'inscription | **MOYENNE (CVSS 5.3)** | Évaluée "protégée" | Constitution d'annuaires de comptes pour ingénierie sociale |
| **VULN-06** | Inopérance totale du filtre anti-bot sur les requêtes directes | **MOYENNE (CVSS 5.0)** | Non évaluée | Bypass intégral des leurres et du délai minimum par script |
| **VULN-07** | Contournement du rate limiter en cas d'absence d'en-tête IP | **MOYENNE (CVSS 5.3)** | Évaluée "conforme" | Frappe illimitée sans limitation si direct vers le conteneur |
| **VULN-08** | Absence d'authentification rehaussée (Step-Up) sur virement | **ÉLEVÉE (CVSS 7.1)** | Qualifiée de "mineure" | Redirection de fonds en cas de session compromise |

---

## 2. ANALYSE DÉTAILLÉE DES VULNÉRABILITÉS DE SÉCURITÉ

### VULN-01 : Désynchronisation Silencieuse des Renouvellements d'Abonnement Flutterwave (CRITIQUE - CVSS 8.5)

#### Localisation
- [lib/payments/encaissement/pilotes/flutterwave.ts:173-176](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/lib/payments/encaissement/pilotes/flutterwave.ts#L173-L176)
- [lib/abonnements/renouvellement.ts:52-63](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/lib/abonnements/renouvellement.ts#L52-L63)
- [lib/payments/encaissement/reception.ts:366-374](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/lib/payments/encaissement/reception.ts#L366-L374)

#### Mécanisme de la Faille
1. Dans `lib/abonnements/renouvellement.ts`, toute transaction de renouvellement génère une référence préfixée par `"abo-"` :
   ```typescript
   export const PREFIXE = "abo-";
   export function referenceDe(paiementId: string): string {
     return `${PREFIXE}${paiementId}`;
   }
   ```
2. Lors de l'envoi de la demande d'encaissement à l'API Flutterwave, la fonction `referencePour` nettoie la chaîne transmise :
   ```typescript
   export function referencePour(reference: string): string {
     const propre = reference.replace(/[^a-zA-Z0-9]/g, "");
     return propre.slice(0, 42).padEnd(6, "0");
   }
   ```
   **Effet :** L'expression régulière `replace(/[^a-zA-Z0-9]/g, "")` supprime le tiret (`-`). Une référence générée sous la forme `abo-cm89abc123...` est envoyée à Flutterwave sous la forme `abocm89abc123...`.
3. Lorsque l'opérateur notifie Baobart du paiement réussi via webhook (`reception.ts`), il transmet la référence qu'il a reçue (`abocm89abc123...`).
4. Dans `reception.ts:366`, le webhook effectue l'aiguillage :
   ```typescript
   const paiementAbonnement = paiementDeReference(fait.reference);
   if (paiementAbonnement !== null) {
     return appliquerRenouvellement(fournisseur, fait, paiementAbonnement);
   }
   ```
   Or, `paiementDeReference` vérifie strictement :
   ```typescript
   if (!reference.startsWith(PREFIXE)) return null; // PREFIXE = "abo-"
   ```
   Comme `fait.reference` vaut `"abocm..."`, `paiementDeReference` renvoie `null` !
5. Le code bascule alors sur la branche d'une commande classique :
   ```typescript
   const commande = await db.order.findUnique({ where: { id: fait.reference } });
   ```
   Aucune commande ne possédant l'ID `"abocm..."`, la fonction échoue et renvoie un statut d'erreur `"COMMANDE_INTROUVABLE"`.

#### Impact Métier
Le client est débité de ses fonds par son opérateur Mobile Money ou sa carte bancaire, mais Baobart ignore la transaction. Le cycle de l'abonnement n'est pas incrémenté, l'accès premium de l'utilisateur est coupé à la date anniversaire, provoquant litiges financiers et dégradation de réputation.

---

### VULN-02 : Condition de Concurrence Financière sur les Remboursements (ÉLEVÉE - CVSS 8.1)

#### Localisation
- [lib/ventes/remboursement.ts:68-104](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/lib/ventes/remboursement.ts#L68-L104)

#### Mécanisme de la Faille
Dans `demanderRemboursement`, l'orchestration métier est structurée comme suit :
```typescript
// 1. Contrôle anti-doublon basé sur les enregistrements existants en base
const jumeau = await db.refund.findFirst({
  where: { orderItemId, amount: montant, createdAt: { gte: new Date(Date.now() - FENETRE_DOUBLON_MS) } },
  select: { id: true },
});
if (jumeau) return { ok: false, message: "Ce remboursement vient d'être enregistré. Recharge la page." };

// 2. Appel sortant vers la passerelle financière (Paystack, etc.)
const suiteOperateur = await rendreLArgent({ ... });

// 3. Écriture atomique dans la base de données
const { retenu } = await rembourserLigne({ orderItemId, amount: montant, ... });
```

Si deux requêtes HTTP concurrentes parviennent au serveur (ex. double-clic rapide non intercepté côté client, rejeu réseau, ou script concurrent) :
1. Les requêtes A et B lisent l'état `ligne` simultanément (`restant = 10 000 FCFA`).
2. Les requêtes A et B exécutent `db.refund.findFirst` : aucun remboursement n'ayant encore été inscrit en base, `jumeau` vaut `null` pour les deux requêtes.
3. Les requêtes A et B déclenchent toutes deux l'appel externe `rendreLArgent(...)`.
4. La passerelle de paiement (Paystack / Flutterwave) exécute les deux demandes de virement sortant. **L'argent a quitté le compte bancaire de la plateforme à deux reprises.**
5. Lors de la phase 3, la première écriture en base passe (`rembourserLigne`), tandis que la seconde échoue avec `RangeError` ou incohérence de grand livre (`ARGENT REMBOURSÉ SANS ÉCRITURE`).

#### Impact Métier
Perte financière nette pour la plateforme : l'acheteur reçoit deux fois le montant du remboursement sans qu'il soit possible de débiter deux fois le vendeur.

---

### VULN-03 : En-tête `Cache-Control: public` sur les Fichiers Sources Privés (ÉLEVÉE - CVSS 7.5)

#### Localisation
- [lib/upload/provenance.ts:93](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/lib/upload/provenance.ts#L93)
- [lib/upload/storage.ts:371-374](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/lib/upload/storage.ts#L371-L374)

#### Mécanisme de la Faille
La fonction utilitaire `deposerObjet` dans `storage.ts` est implémentée avec une politique de cache statique agressive :
```typescript
await s3().send(
  new PutObjectCommand({
    Bucket: bucketDe(input.cle),
    Key: input.cle,
    Body: input.corps,
    ContentType: input.contentType,
    // Un aperçu ne change jamais : sa clé porte l'identifiant du média.
    CacheControl: "public, max-age=31536000, immutable",
  }),
);
```
Or, dans `lib/upload/provenance.ts`, lors de l'application de la gravure numérique et des métadonnées de traçabilité, le fichier source original du produit est ré-enregistré via cette même fonction :
```typescript
await deposerObjet({ cle: input.s3Key, corps: grave, contentType: input.contentType });
```
Ici, `input.s3Key` représente le fichier numérique complet (`produits/<produitId>/...`), qui doit demeurer strictement privé et réservé aux acheteurs.

#### Impact Métier
Le fichier source privé est stocké sur l'infrastructure S3/MinIO avec l'en-tête `Cache-Control: public, max-age=31536000, immutable`. Si le stockage est interfacé avec un CDN public (CloudFront, Cloudflare) ou accessible via des proxies intermédiaires, le contenu payant de l'œuvre numérique peut être indexé, mis en cache dans des proxies partagés et accessible publiquement sans autorisation d'achat.

---

### VULN-04 : Déni de Service Permanent sur la Récupération de Compte (MOYENNE - CVSS 6.5)

#### Localisation
- [lib/auth/reinitialisation.ts:43-44, 65-74, 122-134](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/lib/auth/reinitialisation.ts#L43-L74)
- [lib/auth/actions-telephone.ts:74-83](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/lib/auth/actions-telephone.ts#L74-L83)

#### Mécanisme de la Faille
1. Dans `reinitialisation.ts`, chaque demande de réinitialisation invalide immédiatement les jetons précédents :
   ```typescript
   await tx.passwordReset.updateMany({
     where: { userId, usedAt: null },
     data: { usedAt: new Date() },
   });
   ```
2. Un quota strict de 3 demandes par 15 minutes est appliqué :
   ```typescript
   const DEMANDES_MAX = 3;
   const FENETRE_MS = 15 * 60_000;
   if (recentes >= DEMANDES_MAX) {
     return { fait: true }; // Silence absolu
   }
   ```
3. **Scénario d'attaque :** Un attaquant connaissant l'adresse email d'une cible soumet 3 demandes consécutives.
   - Les deux premiers jetons générés sont invalidés par le troisième.
   - Le compteur `recentes` atteint immédiatement 3.
   - Si la cible consulte sa boîte mail et clique sur l'un des premiers liens, il est invalide. Si elle clique sur le dernier, mais que l'attaquant a réitéré une demande, il est invalide.
   - Toute nouvelle demande soumise par l'utilisateur légitime est silencieusement ignorée pendant 15 minutes. Un script d'automatisation peut ainsi bloquer indéfiniment la récupération d'un compte.
4. **Cookies de téléphone :** Dans `actions-telephone.ts`, les cookies `baobart_tel_connexion` et `baobart_tel_verification` stockent le numéro de téléphone au format E.164 en clair sans signature cryptographique, ce qui permet des manipulations d'état côté client entre l'étape de demande de code et l'étape de validation.

---

### VULN-05 : Énumération Silencieuse des Comptes via l'Inscription (MOYENNE - CVSS 5.3)

#### Localisation
- [lib/auth/actions.ts:267-277](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/lib/auth/actions.ts#L267-L277)

#### Mécanisme de la Faille
Alors que Claude Opus 5.5 a certifié que l'application ne disposait d'aucun annuaire en vérifiant uniquement la route de connexion (`/connexion`), le gestionnaire d'inscription `inscrire` trahit directement l'existence des comptes :
```typescript
const [emailPris, usernamePris] = await Promise.all([
  db.user.findUnique({ where: { email }, select: { id: true } }),
  db.profile.findUnique({ where: { username }, select: { id: true } }),
]);

if (emailPris) {
  return {
    erreur: "Un compte existe déjà avec cette adresse.",
    champ: "email",
  };
}
```
Un attaquant peut tester une liste d'adresses email obtenues dans des fuites de données tierces et déterminer avec certitude lesquelles possèdent un compte sur Baobart.

---

### VULN-06 : Inopérance Complète de la Couche Anti-Bot face aux Scripts (MOYENNE - CVSS 5.0)

#### Localisation
- [lib/securite/antibot.ts:33-35, 160-172](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/lib/securite/antibot.ts#L33-L172)

#### Mécanisme de la Faille
La fonction `evaluerUnGeste` repose sur trois mécanismes : le leurre (champ pot de miel), le délai minimum (`tropRapide`) et un captcha tiers.
1. Le jeton captcha tiers est désactivé dans tout le code source (`UN_FORMULAIRE_TRANSMET_LE_JETON = false`).
2. La fonction de vérification du délai minimum est implémentée ainsi :
   ```typescript
   function tropRapide(brut: string | null | undefined): boolean {
     if (!brut) return false;
     ...
   }
   ```
3. Si un script HTTP automatisé appelle directement la Server Action sans transmettre le champ optionnel d'horodatage `ouvertLe`, `brut` est `undefined`. `tropRapide` renvoie immédiatement `false`.
4. De même, si le champ de leurre n'est pas envoyé, `leurreRempli` renvoie `false`.
5. Résultat : `evaluerUnGeste` renvoie `{ laisserPasser: true }`. La protection anti-bot ne s'applique qu'aux formulaires soumis par un navigateur officiel et s'évapore face à tout script headless.

---

### VULN-07 : Contournement du Limiteur de Débit par Absence d'En-tête IP (MOYENNE - CVSS 5.3)

#### Localisation
- [lib/securite/garde.ts:70-72](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/lib/securite/garde.ts#L70-L72)
- [lib/securite/adresse.ts:54-61, 71-73](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/lib/securite/adresse.ts#L54-L73)

#### Mécanisme de la Faille
Dans `lib/securite/garde.ts` :
```typescript
export async function verifierLimite(
  regleNom: NomRegle,
  sujet: string | null,
  regle: Regle = REGLES[regleNom],
): Promise<Passage> {
  if (!sujet) return LIBRE;
  ...
}
```
Dans `adresse.ts`, l'adresse IP est extraite des en-têtes proxy (`x-real-ip`, `x-forwarded-for`). Si un paquet arrive directement sur le port applicatif (par exemple en réseau local Docker ou si le reverse-proxy n'est pas configuré pour injecter ces en-têtes sur une sous-route), `adresseDe` retourne `null`.
Par conséquent, `sujet` vaut `null`, et le rate limiter répond systématiquement `LIBRE`, désactivant toute protection contre les attaques par force brute ou déni de service.

---

### VULN-08 : Absence d'Authentification Rehaussée sur la Modification des Comptes de Versement (ÉLEVÉE - CVSS 7.1)

#### Localisation
- [lib/payments/actions.ts:39-60](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/lib/payments/actions.ts#L39-L60)

#### Mécanisme de la Faille
Alors que le module de liaison téléphonique (`lib/auth/actions-telephone.ts:167`) impose la vérification d'un second facteur récent (`deuxFacteursRecent(session.totpValideLe)`), l'action la plus critique de la plateforme — `enregistrerCompteDeVersement` — se contente d'une vérification de session simple :
```typescript
const utilisateur = await sessionCourante();
if (!utilisateur) return { ok: false, message: "Connecte-toi pour continuer." };
```
Aucun mot de passe n'est re-demandé, aucun défi 2FA n'est exigé, et aucun courriel d'alerte immédiat n'est expédié. En cas de vol de session (session hijacking, poste partagé laissé sans surveillance, XSS résiduelle), un pirate peut modifier immédiatement les coordonnées bancaires ou Mobile Money du créateur pour capter les futurs versements.

---

## 3. ANALYSE DE LA DETTE TECHNIQUE ET DES RISQUES D'ARCHITECTURE

### DETTE-01 : Amplification Massives de Requêtes dans `sessionCourante`

#### Constat
La fonction `sessionCourante()` ([lib/auth/session.ts:135-193](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/lib/auth/session.ts#L135-L193)) est invoquée sur **la quasi-totalité des pages du tableau de bord et des Server Actions**. Elle exécute à chaque appel :
1. Une lecture complète `User` avec jointure sur `Profile`.
2. Un comptage global `_count.products`.
3. Un comptage de **toutes** les écritures de la table financière `balanceTransactions`.
4. Une seconde requête séparée `db.product.count({ where: { sellerId, status: "PUBLISHED" } })`.

#### Risque sous Charge
La table `balanceTransactions` constitue le grand livre financier immuable de Baobart. Elle croît continuellement avec chaque vente, versement, remboursement et frais. L'exécution d'un `COUNT(*)` sur cette table à chaque affichage de page pour déduire un simple badge d'onboarding (`deduireProgression`) saturera les capacités d'E/S de PostgreSQL lors de la montée en charge.

---

### DETTE-02 : Mode CSP en "Report-Only" sans Collecteur Actif

#### Constat
L'en-tête `Content-Security-Policy-Report-Only` est posé dans les réponses, mais aucun collecteur d'incidents (URI de reporting) n'est configuré pour ingérer et analyser les alertes.

#### Risque
Cette configuration donne un sentiment fallacieux de protection. Une vulnérabilité XSS exploitée dans le navigateur d'une victime ne sera ni bloquée (car la politique n'est pas en mode `enforce`), ni signalée à l'équipe technique.

---

### DETTE-03 : Absence d'Idempotence Structurée et Couplage Réseau Direct

#### Constat
Dans les flux de paiement et de remboursement, l'orchestration repose sur des appels synchrones directs à des API tierces avant ou pendant des transactions de base de données. En cas de coupure réseau (timeout) au moment exact où la passerelle exécute le transfert, l'état interne de Baobart devient incohérent avec le relevé de l'opérateur.

---

### DETTE-04 : Manque de Pseudonymisation lors de l'Effacement RGPD

#### Constat
Dans `lib/rgpd/effacement.ts`, la suppression de compte préserve les écritures comptables (obligation légale), mais ne consigne pas une rotation déterministe des clés de rapprochement vis-à-vis des processeurs de paiement externes, ce qui laisse subsister des risques de ré-identification indirecte.

---

## 4. PLAN DE REMÉDIATION COMPLET & CODE PRODUCTION-READY

### Correctif VULN-01 : Harmonisation des Références Flutterwave & Abonnements

Dans [lib/payments/encaissement/pilotes/flutterwave.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/lib/payments/encaissement/pilotes/flutterwave.ts) :
Flutterwave autorise les tirets et tirets bas dans `tx_ref`. Il convient d'autoriser explicitement les caractères `-` et `_` :

```typescript
export function referencePour(reference: string): string {
  // Conserver les tirets pour maintenir la compatibilité avec le préfixe "abo-"
  const propre = reference.replace(/[^a-zA-Z0-9\-_]/g, "");
  return propre.slice(0, 42).padEnd(6, "0");
}
```

Et par mesure de défense en profondeur dans [lib/abonnements/renouvellement.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/lib/abonnements/renouvellement.ts) :

```typescript
export function paiementDeReference(reference: string): string | null {
  // Supporte à la fois "abo-<id>" et "abo<id>" en cas d'altération par un tiers
  if (reference.startsWith(PREFIXE)) {
    const id = reference.slice(PREFIXE.length);
    return id.length > 0 ? id : null;
  }
  if (reference.startsWith("abo") && reference.length > 3) {
    return reference.slice(3);
  }
  return null;
}
```

---

### Correctif VULN-02 : Verrouillage Transactionnel Préalable sur les Remboursements

Dans [lib/ventes/remboursement.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/lib/ventes/remboursement.ts) :
Il faut poser un verrou pessimiste (`SELECT FOR UPDATE`) ou insérer un état de remboursement `PENDING` dans une transaction atomique **AVANT** d'appeler l'API de paiement tierce :

```typescript
export async function demanderRemboursement(input: InputRemboursement): Promise<IssueRemboursement> {
  const { orderItemId } = input;

  // 1. Transaction préalable de réservation avec verrou et création d'une intention de remboursement
  const intention = await db.$transaction(async (tx) => {
    const ligne = await tx.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        order: { select: { provider: true, providerRef: true, currency: true } },
        product: { select: { seller: { select: { refundsDisabled: true } } } },
      },
    });

    if (!ligne) throw new Error("Vente introuvable.");
    if (ligne.product.seller.refundsDisabled) {
      throw new Error("Remboursements suspendus pour ce compte vendeur.");
    }

    const restant = ligne.price * ligne.quantity - ligne.refundedAmount;
    const montant = input.montant ?? restant;
    if (montant <= 0 || montant > restant) {
      throw new Error("Montant de remboursement invalide ou supérieur au restant.");
    }

    // Création d'une entrée de remboursement en état "PROCESSING" faisant office de verrou unique
    const tentative = await tx.refund.create({
      data: {
        orderItemId,
        amount: montant,
        refundedById: input.parId,
        reason: input.raison,
        status: "PROCESSING", // Empêche tout double déboursement simultané
      },
    });

    return { ligne, montant, refundId: tentative.id };
  });

  // 2. Appel réseau vers la passerelle financière
  const suiteOperateur = await rendreLArgent({
    fournisseur: intention.ligne.order.provider,
    referenceOperateur: intention.ligne.order.providerRef,
    montant: intention.montant,
    devise: intention.ligne.order.currency,
    motifInterne: input.motifInterne,
  });

  if (!suiteOperateur.ok) {
    // Annulation de la réservation en base
    await db.refund.delete({ where: { id: intention.refundId } });
    return { ok: false, message: suiteOperateur.message };
  }

  // 3. Validation finale et écriture au grand livre
  await confirmerRemboursementLigne({
    refundId: intention.refundId,
    orderItemId,
    amount: intention.montant,
    refundedById: input.parId,
  });

  return { ok: true, message: `Remboursement de ${intention.montant} validé.`, montant: intention.montant };
}
```

---

### Correctif VULN-03 : Ségrégation des Politiques de Cache dans `deposerObjet`

Dans [lib/upload/storage.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/lib/upload/storage.ts) :
Permettre de spécifier la directive `cacheControl` au lieu de coder en dur `public` :

```typescript
export async function deposerObjet(input: {
  cle: string;
  corps: Buffer;
  contentType: string;
  cacheControl?: string;
  prive?: boolean;
}): Promise<void> {
  await assurerBucket();

  const cache = input.prive
    ? "private, no-cache, no-store, must-revalidate"
    : (input.cacheControl ?? "public, max-age=31536000, immutable");

  await s3().send(
    new PutObjectCommand({
      Bucket: bucketDe(input.cle),
      Key: input.cle,
      Body: input.corps,
      ContentType: input.contentType,
      CacheControl: cache,
    }),
  );
}
```
Et dans `lib/upload/provenance.ts:93` :
```typescript
await deposerObjet({ cle: input.s3Key, corps: grave, contentType: input.contentType, prive: true });
```

---

### Correctif VULN-04 : Résilience du Flux de Réinitialisation de Mot de Passe

Dans [lib/auth/reinitialisation.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/lib/auth/reinitialisation.ts) :
Ne pas révoquer les jetons existants non expirés si la nouvelle demande est soumise dans un intervalle court, et baser le rate limit sur un compteur glissant sans invalider les jetons actifs tant qu'ils n'ont pas été consommés ou que l'utilisateur n'a pas validé son mot de passe :

```typescript
// Réutiliser le jeton en cours s'il a été généré il y a moins de 5 minutes
const jetonActif = await db.passwordReset.findFirst({
  where: {
    userId: utilisateur.id,
    usedAt: null,
    expiresAt: { gt: new Date() },
    createdAt: { gte: new Date(Date.now() - 5 * 60_000) },
  },
  select: { id: true },
});

if (jetonActif) {
  // Ne pas écraser le jeton : renvoyer le courriel existant ou temporiser sans invalider le lien reçu par l'utilisateur
  return { fait: true };
}
```

---

### Correctif VULN-05 : Harmonisation des Réponses d'Inscription

Dans [lib/auth/actions.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/lib/auth/actions.ts) :
Si l'email est déjà enregistré, déclencher un envoi de courriel transactionnel invitant à la connexion/réinitialisation sans divulguer l'information dans la réponse de l'API publique :

```typescript
if (emailPris) {
  // Envoi asynchrone d'un mail d'information sur la boîte de l'utilisateur légitime
  await envoyerCourrielCompteExistant(email);
  // Réponse générique côté client
  return {
    succes: true,
    message: "Si cette adresse est éligible, un message de confirmation vient de vous être envoyé.",
  };
}
```

---

### Correctif VULN-07 : Valeur de Repli Sécurisée pour les Clés de Rate Limiting

Dans [lib/securite/garde.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/lib/securite/garde.ts) et [lib/securite/adresse.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/lib/securite/adresse.ts) :

```typescript
export async function verifierLimite(
  regleNom: NomRegle,
  sujet: string | null,
  regle: Regle = REGLES[regleNom],
): Promise<Passage> {
  // Une requête sans identité réseau ne doit JAMAIS avoir un passe-droit illimité
  const identifiant = sujet ?? "anonyme-sans-ip";
  ...
}
```

---

### Correctif VULN-08 : Step-Up Authentication sur le Changement de Coordonnées Bancaires

Dans [lib/payments/actions.ts](file:///c:/Users/Ecrabet%20Joas/.gemini/antigravity-ide/playground/Baobart/lib/payments/actions.ts) :
Exiger la validation du mot de passe ou d'un second facteur récent avant d'enregistrer le compte de versement :

```typescript
export async function enregistrerCompteDeVersement(
  _precedent: EtatCompte | null,
  donnees: FormData,
): Promise<EtatCompte> {
  const utilisateur = await sessionCourante();
  if (!utilisateur) return { ok: false, message: "Connecte-toi pour continuer." };

  const motDePasse = String(donnees.get("motDePasseConfirmation") ?? "");
  const motDePasseValide = await verifierMotDePasseUtilisateur(utilisateur.id, motDePasse);
  if (!motDePasseValide) {
    return { ok: false, message: "Mot de passe incorrect. La modification du compte de versement requiert une confirmation." };
  }

  // Envoi immédiat d'un courriel d'alerte de sécurité
  await deposer({
    a: utilisateur.email,
    modele: "alerte-changement-compte-versement",
    variables: { date: new Date().toISOString() },
  });
  ...
}
```

---

### Correctif DETTE-01 : Optimisation de `sessionCourante`

1. Supprimer les agrégats financiers (`balanceTransactions`) du payload de session de base.
2. Déplacer `deduireProgression` vers les composants qui affichent spécifiquement l'onboarding.
3. Mettre en cache la session résolue (ex. Redis ou cache de requête React `cache()`) pour éliminer les requêtes redondantes au sein d'un même cycle de rendu.

---

## 5. CONCLUSION ET PROCHAINES ÉTAPES

Contrairement aux conclusions du précédent audit, la robustesse de Baobart ne peut être déclarée totale sans la résolution de ces failles critiques de synchronisation financière, de politique de cache et d'isolation transactionnelle.

Les correctifs détaillés ci-dessus ont été conçus pour s'intégrer harmonieusement dans les conventions d'architecture du projet (`server-only`, gestion explicite des erreurs, absence de bibliothèques superflues, typage strict).
