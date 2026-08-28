# Audit complet — Baobart vs référent Gumroad, état au 28 août 2026

**Version applicative réelle : 1.26.0** (54 commits) — contre **1.17.0** documentée par le §0-bis
du plan directeur (`Doc/PLAN_REFONTE_BAOBART_GUMROAD.md`, daté du 4 août 2026).
**Le plan a donc 9 versions de retard sur le code.** Ce document met à jour l'état réel et
croise le catalogue de fonctionnalités Gumroad (§3 du plan) avec ce qui existe vraiment
aujourd'hui dans le dépôt.

Méthode : deux passes indépendantes — (1) lecture directe du code, du schéma Prisma, du
`package.json`, des tests et des 10 derniers commits ; (2) synthèse des cinq documents d'audit
déjà existants dans `Doc/` (`AUDIT_COMPLET_PROJET_BAOBART.md`, `CONFRONTATION_GUMROAD.md`,
`VERIFICATION_GUMROAD.md`, `VERIFICATION_GUMROAD_APPROFONDIE_2026-08-21.md`,
`SUIVI_MODIFICATIONS_MANUELLES.md`) et du reste du plan (§3.8 à §13). Les deux passes ont été
recoupées ; les affirmations les plus sensibles (checkout simulé, cron, mot de passe oublié) ont
été revérifiées directement dans le code avant publication.

---

## 1. Ce que le plan ne documente pas encore

Le §0-bis (« journal de ce qui existe réellement ») s'arrête à v1.17.0. Neuf versions plus tard :

| Version | Commit | Contenu |
|---|---|---|
| 1.18.0 | `3ae443d` | Déployable sur Vercel + CI |
| 1.19.0 | `f2d26bb` | Point de santé, journal structuré, interrupteurs d'exploitation |
| 1.20.0 | `1675258` | Rôle plateforme + écran de configuration admin |
| 1.21.0 | `288f3c8` | File d'attente des courriels et ses pilotes |
| 1.22.0 | `71c94a3` | Pilote SMTP, écran système |
| 1.23.0 | `1780756` | Écran de supervision de la file des courriels |
| 1.24.0 | `f02f5cf` | **Passage en caisse, en simulation** |
| 1.25.0 | `e05a4f5` | **Remboursement déclenchable, litiges câblés, onglet Versements** |
| 1.26.0 | `dd9d662` | **Huit états des versements et suspension de compte, côté administration** |

Fait notable : `Doc/CONFRONTATION_GUMROAD.md` (rédigé à v1.24.0, commit `9c61380`) avait identifié
trois manques précis — remboursement non déclenchable, litiges sans chemin d'écriture, machine à
versements figée — et **les deux commits suivants (1.25.0, 1.26.0) les corrigent dans l'ordre où
le document les listait**. Ce document de confrontation est donc lui-même déjà daté.

**Recommandation immédiate** : mettre à jour le §0-bis du plan avant toute nouvelle phase — c'est
explicitement son rôle, et repartir sur un état de référence faux fausse toute priorisation en
aval.

---

## 2. État des 5 points bloquants annoncés par le plan (§0-bis)

| # | Bloquant (v1.17.0) | État réel (v1.26.0) | Preuve |
|---|---|---|---|
| 1 | **Le paiement** — rien n'encaisse | **Toujours vrai.** Un panier/passage en caisse existe (v1.24.0) mais reste un mode simulé — aucun agrégateur mobile money branché, aucun SDK de paiement dans `package.json`. | `lib/checkout/achat.ts` (marqueur de simulation explicite) |
| 2 | **Envoi effectif des versements** | **Partiellement résolu.** Les 5 transitions manuelles (marquer envoyé/échoué/annulé/retour) sont câblées à un écran admin (1.26.0). Mais le cron ne fait toujours que *préparer* (`CREATING`) — aucun appel à un opérateur réel. | commentaire explicite dans `app/api/cron/versements/route.ts` : « Elle n'envoie rien à un opérateur — cette intégration n'existe pas encore » |
| 3 | **Aucun ordonnanceur** | **Résolu.** Deux crons Vercel déclarés, protégés par `CRON_SECRET`. | `vercel.json` : `/api/cron/versements` (lun-ven 6h), `/api/cron/courriels` (5 min) — vérifié directement |
| 4 | **Les courriels** — aucun message transactionnel | **Partiellement résolu.** Infrastructure complète (file transactionnelle, 3 pilotes console/resend/smtp, reprise avec distinction erreurs définitives/transitoires, supervision admin) ; 5 modèles définis mais **seuls 2 sont réellement déposés** (bienvenue à l'inscription, reçu d'achat). Lien de téléchargement et avis de versement ne partent toujours pas. | `lib/email/outbox.ts`, appels `deposer()` limités à `lib/auth/actions.ts` et `lib/checkout/achat.ts` |
| 5 | **Le changement de mot de passe** | **Toujours une coquille**, malgré l'infrastructure disponible (modèle `REINITIALISATION_MOT_DE_PASSE` + pilotes existent). C'est un branchement manquant, pas un manque d'infrastructure. | `lib/auth/actions.ts:203` — message littéral : « La réinitialisation par e-mail arrive avec le service d'envoi. En attendant, écris-nous. » — vérifié directement |

**Sur 5 points bloquants, 1 est résolu, 2 sont partiels, 2 restent entiers.**

---

## 3. Ce qui est apparu sans être annoncé par le plan

- **Suspension de compte** (`lib/domain/trust.ts`) — jusqu'ici lue partout, écrite nulle part
  (constat de `CONFRONTATION_GUMROAD.md`) — est maintenant déclenchable depuis l'admin : fermeture
  des sessions, retrait des ressources en vente, levée qui exige une demande explicite. Deux effets
  que la machine réclame (réactivation produits, blocage IP) sont journalisés comme *non exécutés*
  plutôt que simulés en silence.
- **Litiges/chargebacks** (`lib/domain/litiges.ts`) — une vente contestée débite le vendeur du
  brut, suspend ses versements, écrit un mouvement de grand livre `CHARGEBACK` dédié, refuse le
  remboursement d'une vente déjà contestée.
- **Remboursement** — déclenchable depuis l'écran des ventes, montant pré-rempli, garde côté action
  serveur (pas seulement le bouton), fenêtre anti-double-clic.
- **Espace admin technique** (`app/dashboard/systeme/*`) — configuration, emails, membres,
  versements. C'est un espace d'*exploitation* pour l'équipe interne, **pas** le CMS multi-rôles
  (SUPER_ADMIN/CONTENT_MANAGER/MARKETING/MODERATOR/SUPPORT/ACCOUNTANT/COMPLIANCE) spécifié dans
  `Doc/SPEC_ADMIN_CMS_BAOBART.md` — celui-ci reste entièrement à construire.
- **Vulnérabilités dépendances** — les 5 failles « high » relevées par l'audit du 21 août
  (sharp, postcss, nanoid, deepmerge-ts) sont corrigées via des `overrides` pnpm, vérifié présent
  dans `package.json`.

---

## 4. Inventaire des domaines implémentés

| Domaine | État |
|---|---|
| Socle Next.js 15 / Prisma 6 / Tailwind v4 / Docker | ✅ |
| Feed & découverte, fiche produit | ✅ |
| Auth (email/mdp, sessions, rôles progressifs) | ✅ |
| Dépôt/gestion produit, upload direct S3/MinIO, aperçus | ✅ |
| Argent (frais, grand livre immuable, remboursement, litiges) | ✅ |
| Versements (8 états, cadences, éligibilité) | ✅ |
| Social (likes, follows, commentaires, modération par signalement) | ✅ |
| Tableau de bord acheteur/vendeur (18 écrans en lecture) | ✅ (lecture seule — pas d'édition) |
| Ordonnanceur (cron) | ✅ nouveau depuis le plan |
| Trust & suspension de compte | ✅ nouveau depuis le plan |
| **Checkout / encaissement réel** | ❌ simulation uniquement |
| **E-mails transactionnels** | ⚠️ infrastructure oui, 2 modèles/5 réellement déposés |
| **Mot de passe oublié** | ❌ coquille |
| **Profil public créateur** | ❌ aucune route |
| Jobs / Services / Événements / Forum / Blog | ❌ tables Prisma prêtes (69 modèles, clés étrangères scalaires), **aucune route applicative** |
| CMS Super Admin (7 rôles, spec dédiée) | ❌ |

Tests : **346 unitaires + 221 d'intégration = 567**, contre 259+140 annoncés par le plan
(39 fichiers `*.test.ts`, dont 14 d'intégration) — croissance cohérente avec les 9 versions non
documentées.

---

## 5. Catalogue Gumroad (§3 du plan) — statut croisé avec le code réel

### 🔴 Priorité forte

| Élément | Statut Baobart |
|---|---|
| Mobile money réel + webhooks (bloquant n°1, hors catalogue Gumroad lui-même) | ❌ absent |
| Store Agent / Assistant IA (catalogue d'actions + exécuteur) | ❌ absent |
| Codes promo | ❌ absent (schéma seul, plus riche que ce qui est câblé) |
| Upsell/cross-sell post-achat | ❌ absent |
| Panier abandonné | ❌ absent |
| Échelonnement des paiements | ❌ absent |
| Affiliation (peer 30j + ambassadeurs 7j) | ❌ absent |
| Emails clients/newsletters intégrées | ❌ absent (l'outbox existe, pas l'usage marketing) |
| Memberships (abonnements récurrents) | ❌ absent |
| Champs personnalisés au checkout | ❌ absent |
| Modération de contenu automatisée | ⚠️ modération par signalement seulement, pas automatisée |
| Anti-fraude / chargebacks | ✅ partiel — chargeback câblé (1.25.0), pas de scoring amont |
| API publique | ❌ absent |
| RGPD (effacement) | ❌ absent |
| Anti-bot reCAPTCHA | ❌ absent |
| Recommandations / suggestions | ❌ absent au-delà du feed de base |
| Machine à états de risque vendeur + LowBalanceFraudCheck | ⚠️ `trust.ts` existe et est câblé pour la suspension manuelle ; pas de détection automatique de solde négatif |
| Fréquence/projection des payouts | ✅ cadences et éligibilité présentes ; projection « quand serai-je payé » non confirmée |
| Générateur IA de fiche produit | ❌ absent |
| Livraison sécurisée (URL signée) | ✅ présent |
| Staff Picked | ❌ absent |
| Équipes multi-rôles | ❌ absent |
| VIP Creator | ❌ absent |

### 🟠 Priorité moyenne

Cartes cadeaux, pourboires, PPP, wishlists suivables, coffee, types de produits
(bundle/physique/course), thumbnails, analytics avec cache, taxonomie, 2FA (TOTP+WebAuthn),
boost de découverte, intégrations Discord/Zoom/Circle/Calendar, checkout multi-devises,
onboarding vendeur par pays, file de revue vendeurs, scoring risque paiements, suivi de
consommation, précommandes, API mobile, profils créateurs modulaires, stats reviews
dénormalisées, devise par IP/pays, UTM links, expédition physique par pays — **aucun de ces
éléments n'est confirmé implémenté** dans le code actuel.

### 🟡 Priorité faible

Custom domains, taxes complexes, produits « chat » IA, rapports fiscaux lourds, suspension de
masse, feature flags par device — non prioritaires, non commencés, cohérent avec le plan.

---

## 6. État des documents d'audit déjà existants dans `Doc/`

| Document | Date/commit de référence | Rôle | Fraîcheur |
|---|---|---|---|
| `AUDIT_COMPLET_PROJET_BAOBART.md` | 2026-08-21 | Audit exhaustif du code à cette date (215 fichiers, 67 modèles, blocages P0/P1) | Périmé sur plusieurs points : `prisma generate` et les vulnérabilités qu'il signalait comme bloquantes sont corrigés depuis ; upload S3, téléchargement signé, emails et checkout (simulé) qu'il listait absents existent maintenant |
| `CONFRONTATION_GUMROAD.md` | v1.24.0 (commit `9c61380`) | Confrontation ligne de grand livre par ligne de grand livre entre le code Baobart et Gumroad | Sa liste de priorités (remboursement, litiges, machine à versements) est **déjà traitée** par 1.25.0/1.26.0 |
| `VERIFICATION_GUMROAD.md` | Gumroad commit `a475e3f` (1er août 2026) | Source de vérité des notes « Vérifié » du plan — confronte les affirmations du plan au code Gumroad réel | Toujours valide pour ce qu'il couvre ; ne parle pas de l'état Baobart |
| `VERIFICATION_GUMROAD_APPROFONDIE_2026-08-21.md` | Gumroad commit `182df6a8` | Repasse plus large et mécanique, même objectif que le précédent | Chiffres légèrement différents (264 workers vs 244, 24 mailers vs 21, 66 policies vs 69) — confirme que ces volumétries **dépendent du commit Gumroad cité** et ne doivent jamais être citées sans lui |
| `SUIVI_MODIFICATIONS_MANUELLES.md` | 2026-08-22 | Journal opérationnel de transition (accès Git distant coupé) | Ses « prochaines tâches » (upload, téléchargement signé, checkout) sont **résolues** ; paiement réel reste ouvert, comme il l'anticipait |

**Manque identifié par `AUDIT_COMPLET_PROJET_BAOBART.md` et toujours vrai** : aucun fichier
`Doc/MATRICE_IMPLEMENTATION.md` (spec → module → statut → route → tests → dette) n'existe. Ce
serait le seul document capable de rester à jour en continu plutôt que de se périmer à chaque
nouvelle version — contrairement au plan et aux audits ponctuels.

---

## 7. Synthèse et recommandations

1. **Le plan directeur a un problème de fraîcheur, pas de justesse.** Sur les micro-services
   (jobs, services, événements, CMS, forum) et le paiement réel, il reste exact : c'est
   entièrement à construire. Sur les 5 points bloquants qu'il liste comme totalement absents,
   3 ont bougé — 1 résolu (ordonnanceur), 2 partiels (emails, versements) — sans que le §0-bis
   ne le reflète.
2. **Mettre à jour le §0-bis du plan** avant de prioriser la suite — c'est son rôle déclaré, et
   les décisions de roadmap (§7, phases M0-M8) s'appuient dessus.
3. **Le paiement réel (mobile money) reste le vrai bloquant n°1** pour ouvrir au public — rien
   dans le catalogue Gumroad ne le couvre puisque Gumroad utilise Stripe ; c'est un développement
   propre à Baobart, non transposable depuis le référent.
4. **Deux branchements à faible coût, haute valeur** : le lien de téléchargement et l'avis de
   versement par e-mail (infrastructure déjà prête, juste pas appelée), et la réinitialisation de
   mot de passe (idem — modèle et pilotes existent, seul l'appel manque).
5. **Envisager `Doc/MATRICE_IMPLEMENTATION.md`** pour remplacer les audits ponctuels par un
   inventaire vivant, mis à jour à chaque commit plutôt que redécouvert à chaque revue.

---

*Sources : lecture directe du dépôt au commit `dd9d662` (54 commits), `package.json`,
`vercel.json`, `prisma/schema.prisma`, `lib/checkout/achat.ts`, `lib/auth/actions.ts`,
`app/api/cron/*`, `lib/domain/trust.ts`, `lib/domain/litiges.ts`, et synthèse croisée des cinq
documents d'audit existants dans `Doc/`.*
