# Baobart — Spécification Gamification (Point D)

**Badges, formules, cycles, intégration UI**
**Document D — v1.0 — août 2026**

> Complète le plan directeur (§2.6). Ce document détaille : les **badges**, leurs **critères chiffrés** (formules publiées), les **cycles temporels**, le **moteur de calcul**, l'**intégration UI**, et les **règles anti-abus**.

---

## 1. Principes (à relire avant tout)

1. **Un badge se mérite, jamais il ne s'achète** — c'est la garantie de sa valeur (et de la confiance du marché).
2. **Critères transparents et publiés** — chaque badge a sa formule visible (page badges + tooltip sur le profil).
3. **Cycles glissants** — les badges « performance » expirent et se recalculent (pas de positions figées à vie).
4. **Effets réels mais mesurés** — visibilité, filtres, tri ; jamais d'avantage financier injuste.
5. **Anti-abus actif** — le moteur détecte l'engagement frauduleux (self-likes, achats croisés, bots).

---

## 2. Les badges Baobart

| Badge | Code | Critère principal | Cycle | Effet |
|---|---|---|---|---|
| **Créateur vérifié** | `VERIFIED_CREATOR` | KYC complet (identité, téléphone, portfolio, payout valide) | Permanent (révocable) | Filtre de recherche, confiance, badge profil |
| **Top créateur** | `TOP_CREATOR` | Score composite (ventes + engagement + note) top N % | 90 jours glissants | Mise en avant feed, badge, newsletter |
| **Nouveau talent** | `NEW_TALENT` | Compte < 6 mois + ascension rapide | 30 jours glissants | Découverte, boost de visibilité court |
| **Pilier de la communauté** | `COMMUNITY_PILLAR` | Contribution forum/entraide (réponses utiles, modération) | 90 jours glissants | Badge + accès modération |
| **VIP créateur** | `VIP_CREATOR` | Payouts cumulés ≥ seuil (FCFA) | Cumulatif | Badge prestige, priorité support (pattern Gumroad §3.10-C) |

---

## 3. Formules chiffrées (à publier telles quelles)

### 3.1 Score « Top créateur » — S_top

```
S_top = 0.50 × V_norm + 0.30 × E_norm + 0.20 × N_norm

où, sur 90 jours glissants :
  V_norm = ventes du créateur ÷ ventes max de la catégorie   (0..1)
  E_norm = (likes + 2×saves + 3×commentaires) ÷ max catégorie (0..1)
  N_norm = (note moyenne / 5) × (1 + log10(nb avis + 1) / 4)   (0..1, pondère le nb d'avis)

Attribution : S_top dans le top 5 % des créateurs actifs de la catégorie (min. 20 ventes/90 j).
Renouvellement : recalcul hebdo (job Inngest) ; badge valide 90 jours si le score tient.
```

**Pourquoi ces pondérations** : la vente reste le signal n°1 (0,50), l'engagement social distingue la communauté (0,30), la note avec volume d'avis évite les « 5,0 avec 2 avis » (0,20).

### 3.2 « Nouveau talent » — score d'ascension

```
Ascension = E_norm + 0.5 × V_norm  (comme ci-dessus, mais sur 30 jours)
Conditions : compte créé il y a < 6 mois  ET  ≥ 5 publications  ET
             ascension dans le top 15 % des comptes < 6 mois.
```

### 3.3 « Pilier de la communauté »

```
P = réponses acceptées ×3 + réponses utiles (likes reçus sur posts forum) ×1
  + actions de modération valides ×2 + ancienneté membre (mois) ×0.5
Seuil : P ≥ 50 sur 90 jours glissants. Max. 2 % des membres pour préserver l'exclusivité.
```

### 3.4 « VIP créateur »

```
VIP si payouts cumulés (versés) ≥ 5 000 000 FCFA  (≈ 7 600 € — équivalent du seuil
$5 000 de Gumroad, ajusté au marché). Cumulatif, non révocable sauf fraude.
```

### 3.5 « Créateur vérifié »

```
Étapes KYC :
  1. Identité : nom légal + pièce d'identité (document uploadé, vérifié manuellement/auto)
  2. Téléphone mobile money vérifié (OTP + numéro)
  3. Portfolio : ≥ 3 publications visibles
  4. Payout configuré (bank ou mobile money) valide
Révocation : fraude, arnaque, suspension (liaison avec UserRiskState §3.8 du plan).
```

---

## 4. Moteur de calcul (architecture)

```
jobs/gamification/
  score-evaluator.ts      # calcule S_top, Ascension, P (agrégats SQL/Redis)
  badge-issuer.ts         # attribue/retire les badges selon les formules
  anti-abuse.ts           # détecte engagement frauduleux avant calcul
data (Redis) :
  gamification:<userId>:<metric>   # compteurs dénormalisés (likes, saves…)
  gamification:top-creators:cat    # cache du classement (recalcul hebdo)
```

**Flux** :
1. **Événements** (like, save, vente, commentaire, post forum, modération) → compteurs Redis (dénormalisés, §8.2 du plan).
2. **Job hebdo** (Inngest, dimanche 3 h) : agrégats → scores → badges expirés/renouvelés → notifications + mails.
3. **Anti-abus** avant attribution : si un utilisateur a > 20 % d'engagement provenant de comptes liés (même IP, même device) → scores ignorés pour la période, compte examiné.

---

## 5. Intégration UI

| Surface | Élément |
|---|---|
| **Profil créateur** | Bandeau badges (icônes cliquables → tooltip avec la formule + date d'obtention), à côté de la note moyenne |
| **Filtres recherche** | Filtre « Créateurs vérifiés », « Top créateurs » |
| **Feed** | Badge affiché sur les shots des détenteurs (petit pastille) |
| **Dashboard** | Section « Vos badges » : acquis, en cours (progression vers le prochain : « encore 3 ventes pour le top 5 % ») |
| **Page badges** | `/badges` publique : liste des badges + formules + classement Top créateurs (optionnel) |
| **Notifications** | Email + notification in-app « 🎉 Félicitations, vous êtes Top créateur ! » (pattern Year-in-Review de Gumroad, §3.6) |
| **Accueil** | Section « Top créateurs du mois » (mise en avant — alimente aussi les collections éditoriales §3.10-A) |

---

## 6. Anti-abus (non négociable)

- **Jamais de badge acheté** (ni via les plans, ni via le boost de visibilité — les deux restent strictement séparés).
- **Détection d'engagement frauduleux** : likes croisés, achats de complaisance (même device/IP), bots.
- **Vérification de la fraude à l'achat** : ventes annulées/remboursées **ne comptent pas** dans `V_norm` (on s'appuie sur les ventes réussies non remboursées, comme Gumroad le fait pour ses stats).
- **Réclamation** : un créateur qui estime son score faux peut demander un recalcul (audit).

---

## 7. Données (complément au blueprint — §4.5)

Le schéma Prisma du blueprint a déjà `Badge`, `UserBadge`. Compléments :

```prisma
model Badge { ... criteria Json /* formule publiée en clair */ }

model UserBadge {
  id         String   @id @default(cuid())
  userId     String
  badgeId    String
  awardedAt  DateTime @default(now())
  validUntil DateTime?                      // cycles glissants
  source     String?                        // "auto" | "manual" (ex. vérifié après KYC)
  @@unique([userId, badgeId])
}

model BadgeProgress {                       // progression visible « prochain badge »
  id       String  @id @default(cuid())
  userId   String
  badgeId  String
  progress Json    @default("{}")            // { ventes: 17, cible: 20, note: 4.8 }
  updatedAt DateTime @updatedAt
  @@unique([userId, badgeId])
}
```

---

## 8. Roadmap

| Phase | Contenu | Statut |
|---|---|---|
| **M1** | Badge « Créateur vérifié » (lié au KYC en cours) + affichage profil | Minimal |
| **M6** | Moteur complet : formules, cycles, anti-abus, notifications, page badges, filtres, Top créateurs | Livraison principale |
| **M7+** | Classement public, progression temps réel, intégration Assistant IA (« comment obtenir le badge Top créateur ? ») | Itératif |
