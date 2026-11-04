# Inventaire des fonctionnalités — 4 novembre 2026

> **Commit audité** : `328f701` (`v1.103.3`, après fusion des PR #36, #37 et #38).
> **Rédigé par** : Claude, le 04/11/2026, à la demande de l'utilisateur.
> **Complète** `Doc/ETAT_DU_PROJET_2026-10.md` (audit du 31/10). Il ne le remplace pas : les constats vérifiés là-bas restent valables, ce document en reprend certains à l'échelle de la fonctionnalité.

---

## 0. Pourquoi un second audit, et ce qui change dans la méthode

Le 04/11, l'utilisateur a constaté lui-même que **toute la gamification manquait** : 25 badges dessinés, aucun calculé, aucun affiché. L'audit du 31/10 ne l'avait pas vu. Le symptôme y figurait pourtant (Q4-2 : « `Badge`/`UserBadge` écrits seulement par le seed »), classé 🟠 sous « admin-catalogue », comme s'il ne manquait qu'un écran d'administration.

Quatre causes, et la correction appliquée ici :

| Cause du 31/10 | Correction appliquée le 04/11 |
| --- | --- |
| Le guide d'audit donnait une **liste fermée** de manques « connus » (Shield, rôles, découverte, SEO), sans la gamification. | **Aucune liste** : chaque document de `Doc/` et chaque maquette de `Baobart Design/` est parcouru. |
| La méthode raisonnait **par table** (« ce modèle n'est jamais écrit »), pas par fonctionnalité. | Une ligne par **fonctionnalité**, avec trois questions : **écrite ?** (le code métier existe), **affichée ?** (un écran la montre), **branchée ?** (elle fonctionne de bout en bout, déclenchée par un utilisateur, une tâche ou un rappel). |
| La comparaison maquettes / routes ne voyait pas une planche **sans adresse** (`Baobart Badges.dc.html`). | Chaque maquette est lue **écran par écran et bloc par bloc**, y compris les planches de système. |
| La relecture n'a revérifié que les 🔴. | Chaque constat est lu à l'échelle du produit : « qu'est-ce que l'utilisateur ne peut pas faire ? ». |

**Légende** — ✅ oui · ⚠️ partiel · ❌ non · — sans objet.
**Niveau de preuve** — *Mesuré* : recherche dans le code ou requête en base lancée le 04/11, citée. *Lu* : lu dans un document ou un commentaire, non exécuté.

### Les sources

**Parcourues (15 documents fonctionnels, 8 maquettes)**
- `Doc/PLAN_REFONTE_BAOBART_GUMROAD.md`, `BLUEPRINT_NEXTJS_BAOBART.md`, `VERIFICATION_GUMROAD.md`, `AUDIT_GUMROAD_2026-08-28.md`, `MAQUETTES_A_FAIRE.md`, `MATRICE_IMPLEMENTATION.md` (figée au 24/09 : lue, jamais crue), `MARKETING/01-AUDIT-TECHNIQUE-PRODUIT.md` ;
- les dix `SPEC_*.md` : admin & CMS, écrans d'administration, gamification, licences, Shield, auth & intégrations, livraison & aperçus, produits physiques, déploiement auto-hébergé, et `DEPLOIEMENT_VERCEL.md` ;
- `Baobart Design/` : Accueil (15 écrans et 10 pages documentaires), Dashboard (46 entrées de menu, 45 pages), Parcours Achat (8 écrans), Auth (5 écrans), Badges (25 badges, 4 emplacements, 5 décisions).

**Écartées, et pourquoi** : `DESIGN_SYSTEM_BAOBART.md`, `ANALYSE_DESIGN_SYSTEM_BAOBART.md`, `CHARTE_EDITORIALE_BAOBART.md`, `Baobart Design System.dc.html`, `Baobart Logo.dc.html` et `Baobart LinkedIn.dc.html` décrivent un style, une marque ou des publications, pas des fonctionnalités. `MESURES_PERFORMANCE_2026-10.md` et `ETAT_DU_PROJET_2026-10.md` sont des rapports.

**Non consultées** : les maquettes du projet « Halo system » dans Claude Design, plus récentes que `Baobart Design/` d'après la mémoire de travail, ne sont pas accessibles depuis cette session. **Un écran qu'elles dessinent et qui manque ici n'apparaît donc pas dans cet inventaire.**

---

## 1. En une page

- **18 fonctionnalités entières n'existent pas** (§2) : ni code métier, ni écran. La plus visible est la **gamification**. Sept d'entre elles sont prévues pour plus tard par le plan lui-même (affiliation, assistant IA, produits physiques…). Les autres sont dessinées dans les maquettes sans avoir été construites, en particulier **les écrans de pilotage de l'administration** et **la progression « Devenir vendeur »**.
- **12 fonctionnalités sont branchées mais ne peuvent pas fonctionner** (§3) : le code et l'écran existent, mais une donnée que rien n'écrit les bloque. La plus grave est nouvelle par rapport au 31/10 : **personne ne peut publier un service en production**, faute de badge Freelance ou Agence attribuable.
- **10 fonctionnalités sont partielles** (§4).
- **6 absences sont des décisions écrites** (§5), et non des oublis : le forum à sujets, la PPP, le panier, le délai de réponse, le journal de modération, les pages de labo. Elles sont listées pour que personne ne les « corrige ».
- **Le socle tient** (§6) : l'achat, l'argent, le grand livre, les remboursements, les contestations Paystack, les versements, la confiance, les abonnements, l'authentification, le catalogue, la vitrine, les jobs, les événements, le CMS, les notifications et la bibliothèque acheteur sont écrits, affichés et branchés.

**Ce que cela change pour la suite** : la priorité n'est plus seulement de corriger des défauts. Il reste **deux droits que personne ne peut ouvrir** (publier un service, choisir la sélection éditoriale) et **toute la boucle d'engagement** (badges, progression vendeur, avis notés) à construire.

---

## 2. Fonctionnalités absentes en entier

| # | Fonctionnalité | Source | Écrite | Affichée | Branchée | Preuve (mesurée le 04/11) | Prévue pour plus tard ? |
| --- | --- | --- | :---: | :---: | :---: | --- | --- |
| **A1** | **Gamification** : 5 statuts accordés par l'administration, 20 mérites calculés, progression « les trois plus proches », annonce discrète d'une perte | `SPEC_GAMIFICATION`, `Baobart Badges.dc.html`, `MAQUETTES_A_FAIRE` §E | ❌ | ❌ | ❌ | `BadgeCode` ne connaît que 7 codes sur 25. `git grep "userBadge\."` hors tests ne trouve qu'une lecture (`lib/services/qualifications.ts:58`) et une écriture, dans `scripts/comptes-de-test.ts:224`. En base : 1 `UserBadge` (le compte de test `agence@`). | Non : la maquette est dessinée |
| **A2** | **Progression « Devenir vendeur »** : trois étapes (profil, moyen de versement, 3 ressources) avec leur avancement | Dashboard, page `vendeur` | ❌ | ❌ | ❌ | Aucune occurrence de « Complète ton profil » ni de « Publie 3 » dans `app/`, `components/` ou `lib/dashboard`. Un acheteur reçoit une seule porte vers `/dashboard/produits/nouveau`, et une phrase (`messageProgression`). | Non |
| **A3** | **Avis notés** (1 à 5 étoiles) sur les ressources, les services et les profils | Plan §3, blueprint §4.2, badges « Bien noté » et « Bon public » | ❌ | ⚠️ | ❌ | `ratingAvg` et `ratingCount` ne sont jamais écrits (Q4-5 du 31/10). `/dashboard/avis` n'affiche que des commentaires texte. La vitrine masque la note tant qu'il n'y a aucun avis (`app/createurs/[username]/page.tsx:345`), c'est-à-dire toujours : le cas est bien géré, mais il ne sort jamais. | Non |
| **A4** | **Écrans de pilotage de l'administration** : vue d'ensemble, boutiques, catalogue, finances, abonnements, taxonomie, journal d'activité, réglages | Dashboard, pages `a_apercu`, `a_boutiques`, `a_catalogue`, `a_finances`, `a_abonnements`, `a_taxonomie`, `a_journal`, `a_reglages` ; `SPEC_ADMIN_CMS` §3, §12, §13 | ❌ | ❌ | ❌ | Aucune de ces 8 pages n'a de route sous `app/dashboard`. Aucune écriture de `Tag`, `ServiceCategory` ou `BlogCategory` dans le code. `auditLog.findMany` n'apparaît que dans `lib/admin/audit.ts` et le forum, sans écran de journal. | Non |
| **A5** | **Abonnés du créateur** : liste de ceux qui le suivent, et fil « Suivre les détails » | Dashboard, pages `c_abonnes` et `c_suivre` | ❌ | ❌ | ❌ | Seul `lib/dashboard/statistiques.ts` compte les abonnés. Aucune liste, aucun fil. | Non |
| **A6** | **Pass All Access** : un catalogue entier pour une durée fixe | Dashboard, page `c_allaccess` | ❌ | ⚠️ | ❌ | Aucun modèle ni code « pass ». `/dashboard/forfait` annonce « tes pass d'accès ponctuels » dans sa description. | Non |
| **A7** | **Certificat de licence** (PDF à chaque achat) | `SPEC_LICENCES` §3 | ❌ | ❌ | ❌ | Aucune occurrence de `certificat`, `LicenseCertificate` ni d'une bibliothèque PDF. | Non |
| **A8** | **Connexion sociale** (Google et autres) | `SPEC_AUTH` partie 1 | ❌ | ⚠️ | ❌ | `Account` n'est ni lu ni écrit. Les boutons affichent « bientôt disponible » (`components/auth/auth-form.tsx`). | Non |
| **A9** | **Import depuis Figma, Canva, Framer** | `SPEC_AUTH` partie 2 | ❌ | ❌ | ❌ | Les seules occurrences sont des noms de composants du labo (confettis, explorations). | Non |
| **A10** | **Shield, couches 1, 3 et 4** : filigrane invisible, C2PA, empreinte perceptuelle, perturbation anti-IA, veille | `SPEC_BAOBART_SHIELD` §2, §4, §5.3 | ❌ | ❌ | ❌ | Lu et confirmé le 31/10 (Q1-2). La couche 2 (aperçus filigranés) et la procédure de retrait existent, voir §6. | En partie |
| **A11** | **Affiliation** (lien affilié, crédit, demandes) | Plan §10.1, `VERIFICATION_GUMROAD` §6.1–6.3 | ⚠️ | ❌ | ❌ | Les modèles `Affiliate*` ne sont jamais utilisés. `computeFees` sait calculer une part d'affilié, mais rien ne la lui fournit (`affiliateBasisPoints = 0` partout). | Oui (M3–M4) |
| **A12** | **Infolettre du créateur à ses clients** | Plan §10.6 | ❌ | ❌ | ❌ | `Post` et `PostDelivery` ne sont jamais utilisés. L'infolettre qui existe est celle de la **plateforme**, envoyée par l'administration. | Oui (M5–M6) |
| **A13** | **Soutien récurrent** (memberships) | Plan §10.7 | ❌ | ❌ | ❌ | `ProductType.MEMBERSHIP` n'est jamais écrit. | Oui (M6) |
| **A14** | **Paiement en plusieurs fois** | Plan §10.4, `VERIFICATION_GUMROAD` §6.6 | ❌ | ❌ | ❌ | Aucune occurrence d'échelonnement dans le code. | Oui (M2–M3) |
| **A15** | **Appels, café, commandes sur mesure** | Blueprint §4.3 (`ProductType` CALL, COFFEE, COMMISSION) | ❌ | ⚠️ | ❌ | Aucune écriture de `Commission` ni de `Call`. Le panneau « Commandes sur mesure » n'apparaît jamais (Q2-11). | Non indiqué |
| **A16** | **Équipes de créateurs** (plusieurs sièges sur une boutique) | Blueprint (`TeamMembership`, `TeamRole`), Aperçu de la maquette (« ce que ton équipe a ajouté ») | ❌ | ❌ | ❌ | `TeamMembership` n'est jamais utilisé. Les « espaces d'équipe » de l'accueil sont devenus les communautés (v1.55.0). | Oui (M7–M8) |
| **A17** | **Assistant IA du créateur** | Plan §6.5, §9 | ❌ | ❌ | ❌ | Aucun kit de développement IA dans `package.json`. | Oui (M7) |
| **A18** | **Produits physiques et impression à la demande** | `SPEC_PRODUITS_PHYSIQUES` | ❌ | ❌ | ❌ | `Variant` n'est jamais utilisé. `PHYSICAL` n'apparaît que dans les types. | Oui (phase 2) |

---

## 3. Branché, mais ne peut pas fonctionner

Le code et l'écran existent. Une donnée que **rien n'écrit**, ou un réglage que **rien ne règle**, empêche la fonctionnalité de marcher. C'est ce que l'audit par table voyait sans pouvoir le nommer.

| # | Fonctionnalité | Écrite | Affichée | Branchée | Ce qui bloque | Preuve | Gravité |
| --- | --- | :---: | :---: | :---: | --- | --- | :---: |
| **B1** | **Publier un service** | ✅ | ✅ | ❌ | `lib/cms/droits.ts:155` exige un badge Freelance ou Agence. Seul le script des comptes de test en pose un. **Aucun écran ne l'accorde**, et le refus répond « écris-nous ». | *Mesuré* : `git grep "userBadge\."` hors tests et seed : aucune écriture. En base, `FREELANCE` = 0 détenteur, `AGENCE` = 1 (le compte de test). | 🔴 **Nouveau** : un pan entier de la place de marché est fermé en production |
| **B2** | **Sélection éditoriale** (« à la une », pastille sur les cartes) | ✅ | ✅ | ❌ | `isStaffPicked` est lu par le feed et les cartes, mais aucun code applicatif ne l'écrit. | *Mesuré* : 14 ressources sélectionnées en base de développement, toutes posées par le seed. Aucune écriture dans `lib/` ni dans `app/`. | 🟠 **Nouveau** : figée pour toujours sur ce que le seed a mis |
| **B3** | **Forfaits payants** (Découverte, Explorer, Studio), avec leurs quotas et leur licence | ✅ | ✅ | ❌ | `souscrire` refuse tout ce qui n'est pas `LIBRE` (Q1-2). | Lu le 31/10, `lib/abonnements/souscription.ts:45-62`. | 🟠 |
| **B4** | **Licence étendue** : une option payante, de ×2 à ×5 le prix | ✅ | ✅ | ❌ | Le vendeur peut choisir « Étendue » (`product-form.tsx:38`), mais l'achat n'applique aucun supplément : `pricePremium` n'est lu nulle part dans `lib/checkout`. | *Mesuré* : aucune occurrence de `pricePremium` ni de `EXTENDED` dans `lib/checkout`, `components/checkout` ou `app/acheter`. | 🟠 **Nouveau** : un libellé sans effet |
| **B5** | **Niveau de protection Shield** choisi par le créateur | ✅ | ⚠️ | ❌ | `shieldLevel` n'est lu ni par `produireApercu`, ni par les forfaits (Q1-2). | Lu le 31/10. | 🟠 |
| **B6** | **Catégories du blog** | ✅ | ✅ | ❌ | `BlogCategory` est toujours vide, et aucun écran ne la remplit (Q2-11). | Lu le 31/10. | 🟢 |
| **B7** | **Vues des fiches produit**, dans les statistiques | ✅ | ✅ | ❌ | `ConsumptionType.VIEW` n'est jamais écrit, et la carte affiche « — » (Q2-12). | Lu le 31/10. | 🟠 |
| **B8** | **Nombre d'abonnés sur la vitrine** | ✅ | ✅ | ❌ | Le suivi écrit `User.followersCount`, mais la vitrine lit `Profile.followerCount` (Q2-6). | Lu et revérifié le 31/10. | 🟠 |
| **B9** | **Réponses aux champs personnalisés** | ✅ | ❌ | ⚠️ | Elles sont demandées et enregistrées, mais le vendeur ne les voit nulle part (Q2-10). | Lu le 31/10. | 🟠 |
| **B10** | **Concours** | ⚠️ | ✅ | ⚠️ | `EventKind.CONTEST` existe, avec une dotation et un jury, et l'inscription fonctionne. Mais on ne peut **déposer aucune œuvre**, et aucun gagnant n'est désigné. | *Mesuré* : les champs de `Event` (`prizeAmount`, `jury`, `registrations`) ; aucune table de participation. | 🟢 |
| **B11** | **Menu de compte** : « Règles de publication » et « Support » | ✅ | ⚠️ | ❌ | Ces deux entrées sont affichées « bientôt » (`href: null`, `components/shell/header.tsx`), alors que **les deux pages existent** (`/regles-de-publication`, `/support`). | *Mesuré* : `liensCompte` dans l'en-tête, et `ls app`. | 🟢 **Nouveau** |
| **B12** | **Notifications push**, et l'annonce « téléchargement prêt » | ✅ | ✅ | ⚠️ | Les clés VAPID sont absentes, et `TELECHARGEMENT_PRET` est proposé dans les réglages sans jamais être émis (Q4-6, Q4-7). | Lu le 31/10. | 🟢 |

---

## 4. Partielles

| # | Fonctionnalité | Ce qui marche | Ce qui manque | Source |
| --- | --- | --- | --- | --- |
| **C1** | Aperçus des ressources | Images (filigrane, deux tailles) et vidéo | Audio, PDF, 3D, polices, archives. *Mesuré* : en base, `previewKind` vaut `video` sur 4 ressources et est vide sur 127. | `SPEC_LIVRAISON` §4 |
| **C2** | Pages légales et SEO | Pages écrites, plan du site, consignes aux robots, image d'aperçu | Modifiables par l'administration ; mentions légales incomplètes ; `openGraph` et `canonical` sur les pages publiques (Q1-1, mission 3) | Plan, maquette `a_editorial` |
| **C3** | Facturation | Nom et prénom saisis à l'inscription | Adresse et fiscalité modifiables ; reçu ou facture téléchargeable (Q1-3) | Maquette Profil, « Facturation » |
| **C4** | Contestations bancaires | Paystack, depuis v1.103.2 | Flutterwave ; un écran d'administration des litiges (`FraudWarning`, `SPEC_ADMIN_CMS` §3.2) | `SPEC_ADMIN_CMS` §8 |
| **C5** | Mobile Money avec Flutterwave | Orange Money, MTN, Moov, depuis v1.103.1 | Wave (absent de `RESEAUX`, part encore en carte) | — |
| **C6** | Pages catégorie | `/explore?filtre=…` filtre la grille | Une page par catégorie avec son titre et son décompte, comme l'écran `categorie` de la maquette, utile au référencement | Accueil, écran `categorie` |
| **C7** | Devises | XOF, et les autres devises de `PAYS` à l'encaissement | Conversion entre devises : `ExchangeRate` n'est jamais écrit, et le `tauxChange` du grand livre n'est fourni par aucun appelant | Plan §6.1 |
| **C8** | Tâches de fond auto-hébergées | Tâches planifiées Vercel (8 routes `cron`), Dockerfile présent | `lib/jobs.ts` (BullMQ ou Inngest) annoncé par la spec, et `JOBS_DRIVER` déclaré dans `.env` sans lecteur (Q4-8) | `SPEC_DEPLOIEMENT_SELFHOSTING` §5 |
| **C9** | Statuts administratifs (Créateur vérifié, Freelance, Agence, Recruteur vérifié, Identité vérifiée) | La règle d'exclusion Freelance / Agence (`lib/services/badges.ts`) | L'écran d'attribution, avec retrait tracé ; le code `VERIFIED_RECRUITER` n'existe pas dans l'énumération. **Débloque B1.** | Badges, E.1 |
| **C10** | Sélection des ressources mises en avant | Affichage | Choix par l'administration. **Même cause que B2.** | Dashboard, `a_catalogue` |

---

## 5. Décisions écrites, à ne pas « corriger »

Les **six** absences suivantes ont une raison écrite dans le code ou dans l'historique. Les signaler comme des manques reviendrait à contredire leur auteur sans l'avoir lu.

| Absence apparente | Raison, et où elle est écrite |
| --- | --- |
| Le forum à rubriques et sujets n'a pas d'écran | La maquette dessine un **fil plat**, celui d'un groupe WhatsApp. Le forum est gardé sans écran depuis v1.55.0 (`b89143c`, 18/09). |
| La PPP ne s'applique nulle part | Les coefficients sont des données mesurées, et la table est livrée vide exprès (`lib/commerce/ppp.ts`, en-tête). |
| Pas de panier | L'achat se fait ressource par ressource ; le bouton « PANIER » a été retiré le 09/10 (`components/shell/header.tsx`). |
| Pas de délai de réponse sur le profil | Abandonné (`MAQUETTES_A_FAIRE` §F.1). ⚠️ **Conflit à trancher** : le mérite « Répond vite » de la maquette des badges en dépend. |
| `ModerationLog` n'est jamais écrit | Un seul journal d'audit, `AuditLog` (`SPEC_ADMIN_CMS` §17.2). |
| `/labo/*` répond 404 en production | Garde volontaire, `NODE_ENV === "production"` (Q3-5). |

---

## 6. Écrites, affichées et branchées

Ces fonctionnalités ont été lues dans le code, et mesurées dans la mesure du possible par l'audit du 31/10 :
- 400 requêtes sans erreur 500 ;
- 12 écrans sans erreur dans la console ;
- 19 parcours au navigateur sur 19 ;
- ou par les tests et vérifications des PR #27 à #38.

| Domaine | Fonctionnalités |
| --- | --- |
| Compte | Inscription, connexion par courriel et mot de passe, par téléphone, par code reçu par courriel, clés d'accès (passkeys), double authentification, mot de passe oublié, effacement RGPD |
| Catalogue | Accueil, explorateur, fiche produit, vitrine du créateur (vues, onglets), recherche, « du même créateur », collections, mentions j'aime, commentaires, abonnements aux créateurs |
| Achat | Choix du moyen de paiement, codes promo, prix libre, pourboire, montée en gamme au paiement (upsell), champs personnalisés (voir B9), retour de l'opérateur, relance des paiements oubliés, bibliothèque acheteur (v1.103.0) |
| Argent | Grand livre, frais, remboursements (par le vendeur, par demande de l'acheteur, par le support), contestations Paystack, versements par moyen de paiement et par fréquence, rétention |
| Confiance | Machine à états du risque, suspension, liste de blocage, signalement selon la loi ivoirienne n° 2013-546, réserve d'exploration de données (TDM) |
| Abonnements | Forfait gratuit, renouvellement, rappels par courriel et par SMS (voir B3 pour les forfaits payants) |
| Contenus | Blog, événements (voir B10 pour les concours), jobs (dépôt, candidatures, purge des CV), services (voir B1), communautés (fil), témoignages, infolettre de la plateforme, publicités et sponsoring |
| Administration | Modération, signalements, remboursements à trancher, membres et décisions de risque, versements, configuration, courriels, paiements |
| Plateforme | Notifications dans l'application, par courriel et par SMS ; plan du site, consignes aux robots, image d'aperçu ; consentement aux cookies |

---

## 7. Lots proposés

Classés par ce que l'utilisateur ne peut pas faire aujourd'hui, en commençant par ce qui coûte le plus.

| Ordre | Lot | Contenu | Constats | Charge |
| :---: | --- | --- | --- | :---: |
| 1 | **Statuts et sélection éditoriale** | Un écran d'administration pour accorder et retirer les statuts : Freelance et Agence en choix unique, Créateur vérifié, Recruteur vérifié, chacun avec sa trace d'audit. Puis un écran pour choisir les ressources mises en avant. **Rouvre la publication de services.** | B1, B2, C9, C10 | Moyen |
| 2 | **Gamification : les mérites et la progression** | Les mérites calculables aujourd'hui (ancienneté, production, ventes, sans litige) ; « Mes badges » dans les deux espaces, avec les trois plus proches ; les deux rangées du profil public ; l'écusson sur les vignettes. | A1, B8 (le compteur d'abonnés doit être juste avant le badge « Pilier ») | Gros |
| 3 | **Devenir vendeur** | Les trois étapes de la maquette, avec leur avancement réel (profil, moyen de versement, ressources publiées). | A2 | Petit |
| 4 | **Avis notés** | Une note de 1 à 5 sur un achat vérifié ; alimente `ratingAvg` ; débloque « Bien noté » et « Bon public ». | A3 | Moyen |
| 5 | **Conformité** (mission 3) | Déjà planifiée. | C2 | Gros |
| 6 | **Pilotage de l'administration** | Vue d'ensemble, journal d'activité, réglages, taxonomie ; puis boutiques, catalogue, finances, abonnements. | A4 | Gros |
| 7 | **Petits raccords** | Menu de compte (B11), réponses aux champs personnalisés (B9), vues des fiches (B7), supplément de la licence étendue (B4), catégories du blog (B6). | B4, B6, B7, B9, B11 | Petit |

Les fonctionnalités prévues pour plus tard par le plan (A10 à A18) restent à leur place dans la feuille de route. Elles sont listées pour qu'on ne les croie pas livrées, pas pour être faites maintenant.

---

## 8. Ce qui n'a pas été vérifié

1. **Les maquettes de Claude Design** (projet « Halo system ») : non consultées, comme dit au §0.
2. **Le comportement en production** : rien n'est déployé. Les opérateurs réels (Paystack, Flutterwave) n'ont pas été appelés ; leurs pilotes sont vérifiés par leurs tests.
3. **Chaque bloc de chaque écran de la maquette de l'accueil.** Les 15 écrans ont été rapprochés des routes, pas comparés bloc par bloc. Une section absente d'un écran qui existe peut donc avoir échappé à l'inventaire. Les écarts du parcours d'achat ont été relevés à part le 28/10 (quatre écrans).
4. **Les sections techniques des specs** (choix de bibliothèques, coûts, indicateurs à suivre) : lues, mais non transformées en lignes, faute d'être des fonctionnalités qu'un utilisateur voit.
5. **Les absences de ce document reposent sur des recherches dans `lib/`, `app/` et `components/`**, hors tests, citées à chaque ligne. Un code écrit sous un autre nom que ceux cherchés leur aurait échappé. C'est la limite de toute affirmation négative, et la raison pour laquelle chaque ligne dit ce qu'elle a cherché.
