# Baobart — Analyse du Design System v1 (Sticker System)

**Analyse critique du fichier « Baobart Design System.dc.html »**
**Document K — v1.0 — août 2026**

> ⚠️ **Document d'analyse, pas document de référence.** Le design system officiel a été
> reçu le 5 octobre 2026 (planches 00 à 05) et est transcrit dans
> **[`DESIGN_SYSTEM_BAOBART.md`](DESIGN_SYSTEM_BAOBART.md)**. En cas de contradiction,
> **c'est ce dernier qui gagne**. Ce document garde sa valeur pour ce qu'il ajoute :
> les ratios de contraste WCAG calculés et la liste des points de vigilance
> d'accessibilité, absents des planches officielles.

---

## 1. Vue d'ensemble

Le design system Baobart v1 est un **« Sticker System »** : une direction visuelle assumée et singulière —

> *« Contours noirs épais, ombres dures, aplats lavande et jaune, orange Baobart en accent. Chaque élément est une vignette autonome, posée comme un sticker. »*

C'est un parti pris fort, **nettement différenciant** face aux marketplaces lisses (Gumroad dark, Envato, Creative Market) : le style « vignette découpée, posée sur un fond » évoque l'affiche, le wax, l'artisanat graphique ouest-africain — il **incarne** l'ADN du produit (« du vrai matériel local »). Ce n'est pas un thème, c'est une **identité**.

---

## 2. Inventaire des tokens (extraits du fichier)

### 2.1 Couleurs

| Token | Hex | Usage prescrit |
|---|---|---|
| Lavande fond | `#EADFF9` | Fond de page, socle de toutes les vues |
| Lavande clair | `#F4EEFC` | Survols, champs de saisie, zones internes |
| Lavande profond | `#C9A8F5` | Blocs d'accent, boutons tertiaires, avatars |
| Jaune signal | `#FFD84A` | Action principale, état actif, prix gratuits |
| Orange Baobart | `#E2622C` | Marque, likes, alertes. **Jamais en fond de texte long** |
| Encre | `#121212` | Contours, texte, blocs contrastés |
| Blanc | `#FFFFFF` | Surfaces, pastilles sur image |

**Règle d'or** : « Deux fonds, deux accents, un noir. **Jamais plus de deux accents sur un même écran.** »

### 2.2 Typographie (3 familles, rôles clairs)

| Token | Famille | Corps | Poids | Spéc. |
|---|---|---|---|---|
| `display/xl` | Archivo Black | `clamp(40px, 5vw, 76px)` | 400 | capitales, tracking −2,5 px, lh 0,93 |
| `display/l` | Archivo Black | 36 px | 400 | capitales, tracking −1,5 px, lh 1,0 |
| `titre/m` | Poppins | 18 px | 800 | lh 1,25 |
| `corps` | Poppins | 15 px | 500 | lh 1,5 |
| `meta` | Space Mono | 11,5 px | 400 | majuscules, tracking +0,1 em |

Le trio **Archivo Black (impact) / Poppins (lisibilité) / Space Mono (technique, formats de fichiers, compteurs)** est excellent : il distingue clairement le contenu, l'interface et les données.

### 2.3 Contours, rayons, ombres

- **Contours** : 2,5 px encre (2 px petits éléments, 3 px surfaces plein écran) — avec variante « contour fin » 1,5 px.
- **Rayons** : 10 / 16 / 24 px (999 px pour puces & pastilles ; cartes 20–28 px).
- **Ombres dures** : 4 / 6 / 9 px — **toujours à 45°, jamais floues** (`4px 4px 0 #121212`), ombre colorée réservée aux blocs noirs ; une ombre douce (`0 8px 20px rgba(18,18,18,.16)`) existe pour le traitement « contour fin ».
- **Visuels** : image plein cadre sinon **trame diagonale 135°** + libellé sur **pastille blanche contournée**.

### 2.4 Composants

- **Boutons** : Primaire (jaune), Secondaire (blanc), Contrasté (encre), Tertiaire (lavande profond), Puce/filtre, Désactivé. **Micro-interaction physique** : survol `translate(−2px,−2px)` + ombre +3 px · clic `translate(2px,2px)`, ombre à 0 · transition 130 ms. C'est le cœur du « sticker » : on a envie de les toucher.
- **Étiquettes & statuts** : GRATUIT, NOUVEAU, EN LIGNE, MODÉRATION, VERSÉE, URGENT (pillules).
- **Champs & sélecteur**, **Navigation** (état actif = fond jaune, un seul actif par zone, survol = lavande clair `#F4EEFC` **jamais jaune**).
- **Cartes ressource — 3 traitements** (très utile pour la hiérarchie du feed) :
  1. **Sticker** — contour 2,5 px + ombre 4 px (ex. Portrait Wax Éditorial, GRATUIT) ;
  2. **Contour fin** — 1,5 px + ombre douce (ex. Illu Femme au Foulard, 5 000 F) ;
  3. **Image pleine** — infos au survol (ex. Collage Lunettes, 10 000 F).

### 2.5 Règles d'usage (les 4 commandements)

1. **Un seul accent par bloc** : jaune OU orange OU lavande profond. Deux accents sur une même carte cassent la lecture.
2. **Tout est contouré** : aucune surface flottante sans trait noir (cartes, champs, pastilles, images, avatars).
3. **L'ombre indique le niveau** : 4 px carte de liste, 6 px bloc de page, 9–10 px panneau modal.
4. **Le texte reste sur fond plein** : sur une image ou une trame, le libellé se pose sur une pastille blanche contournée.

---

## 3. Ce qui est réussi (points forts)

| # | Force | Pourquoi |
|---|---|---|
| 1 | **Différenciation radicale** | Personne sur le marché des assets n'a ce style « sticker/affiche ». Mémorable en 1 seconde. |
| 2 | **Discipline du système** | Des règles claires (2 accents max, tout contouré, ombre = niveau). C'est un vrai système, pas une collection d'idées. |
| 3 | **Typographie à 3 voix** | Archivo Black (émotion) / Poppins (confort) / Space Mono (données) — parfaitement assignées. |
| 4 | **La micro-interaction des boutons** | Le « déplacement physique » des éléments est cohérent avec le concept de sticker : c'est tactile, ludique, unique. |
| 5 | **Les 3 traitements de cartes** | Donne une vraie grammaire visuelle au feed (hierarchie : vedette / standard / immersion). |
| 6 | **Pensé pour l'image** | Trame diagonale + pastille blanche = pas de placeholder moche ; l'image reste reine. |
| 7 | **Cohérent avec les maquettes** | On retrouve exactement la palette (lavande/ambre), les statuts (GRATUIT, VERSÉE, MODÉRATION) et les formats (FCFA, compteurs) des captures existantes. |

---

## 4. Accessibilité & contrastes (calculés, WCAG 2.1)

### 4.1 Ce qui est conforme ✅

| Combinaison | Ratio | Verdict |
|---|---|---|
| Encre `#121212` sur Lavande fond `#EADFF9` | **14,7:1** | ✅ AA (texte courant) |
| Encre sur Lavande clair `#F4EEFC` | **16,5:1** | ✅ AA |
| Encre sur Jaune `#FFD84A` | **13,5:1** | ✅ AA (bouton primaire) |
| Encre sur Lavande profond `#C9A8F5` | **9,3:1** | ✅ AA |
| Orange `#E2622C` sur Encre | **5,4:1** | ✅ AA (texte sur fond noir) |

### 4.2 Les 3 points de vigilance ❌ (à corriger)

| Combinaison | Ratio | Problème | Correctif |
|---|---|---|---|
| **Orange `#E2622C` en texte sur Lavande fond** | **2,7:1** | ❌ Le texte orange (likes, alertes, libellés) sur fond lavande est illisible pour beaucoup | Utiliser l'**orange sombre `#B34A1F`** pour le texte sur fonds clairs (4,2:1, OK en AA large) ; garder `#E2622C` pour les surfaces/icônes grandes |
| **Blanc sur Lavande profond `#C9A8F5`** | **2,0:1** | ❌ Si les boutons tertiaires sont lavande profond + texte blanc : c'est le pire cas du système | Texte **encre** sur lavande profond (9,3:1 ✅) — le système le fait déjà pour les avatars ; l'appliquer aux boutons |
| **Jaune `#FFD84A` en texte sur Lavande fond** | **1,1:1** | ❌ Le jaune ne doit **jamais** être du texte — seulement des surfaces | Règle à écrire noir sur blanc : jaune = fond/état, jamais texte (texte = encre ou orange sombre) |

**Règle simple à ajouter** : *« Le jaune et l'orange clair sont des fonds, jamais des textes. Le texte sur fond clair est toujours l'encre ; le texte orange est réservé à l'orange sombre `#B34A1F`. »*

---

## 5. Cohérence interne & limites du système (ce qui manque)

Le système couvre la **vitrine publique** (cartes, boutons, nav). Pour tenir dans toute l'app (dashboard, back-office, admin), il manque :

| Manque | Impact | Recommandation |
|---|---|---|
| **Échelles d'espacement** (spacing tokens) | Risque d'incohérence des marges | Définir `space 4/8/12/16/24/32/48` |
| **Breakpoints / grille** | Mobile non spécifié | Grille 12 col, breakpoints 640/768/1024/1280 |
| **Z-index & superposition** | Modales/tiroirs non cadrés | Tokens `z: nav 50, modal 100, toast 200` |
| **États de formulaires** (focus, erreur, succès) | Champs OK mais états non définis | Focus = contour jaune épais ; erreur = orange sombre + message |
| **Empty states & erreurs** | Pages vides / 404 non spécifiées | Trame diagonale + pastille blanche (déjà le pattern) |
| **Mouvement d'entrée** | Seul le bouton a une micro-interaction | Entrées de section (stagger léger, 130-200 ms), respect `prefers-reduced-motion` |
| **Icônes** | Utilise des glyphes (⌂ ✎ ▤) | Banque d'icônes contourées 2 px, style « stamp » |
| **Composants du back-office** | Tables, sidebar, files non définis | Étendre le système au densité admin (cf. maquette 06) |
| **Dark mode** | Non prévu | Optionnel ; le système est clair par nature — le prévoir comme « thème encre » réservé à l'admin éventuellement |
| **Accessibilité de base** | Contraste traité, mais pas focus clavier, aria | Checklist a11y à joindre (focus visible, labels, alt, contrastes §4) |
| **Tokens en code** | Le fichier est un document, pas du code | Exporter les tokens en **CSS variables / Tailwind config** (cf. §7) |

---

## 6. Verdict global

**C'est un excellent design system — mature, discipliné et parfaitement aligné avec l'ADN Baobart.** Il est suffisamment fort pour être LA signature visuelle du produit (et même un argument marketing : « reconnaissable au premier coup d'œil »).

**Les 3 axes d'amélioration prioritaires :**
1. **Contrastes** : corriger les 3 combinaisons faibles (§4.2) — c'est rapide et ça évite des problèmes de lisibilité réels.
2. **Compléter les tokens** (spacing, breakpoints, états forms, z-index) — nécessaire dès qu'on passe du marketing au produit complet (dashboard, admin).
3. **Traduire en code** : exporter les tokens en variables CSS/Tailwind pour que l'implémentation (Next.js + Tailwind du blueprint) soit à l'identique.

**Notes spécifiques positives à conserver telles quelles :**
- La règle « un seul accent par bloc » — c'est ce qui empêche le jaune+orange+lavande de devenir criard. À appliquer strictement.
- Le survol des boutons (translate + ombre) — signature tactile du système.
- Le pattern « pastille blanche sur trame/image » — la solution élégante pour le texte sur visuel.

---

## 7. Mapping vers le code (Tailwind config / CSS variables)

```css
/* tokens.css — à intégrer dans le blueprint (lib/i18n + globals) */
:root{
  --lavande-fond:#EADFF9;  --lavande-clair:#F4EEFC;  --lavande-profond:#C9A8F5;
  --jaune:#FFD84A;          --orange:#E2622C;        --orange-sombre:#B34A1F;
  --encre:#121212;          --blanc:#FFFFFF;
  --trait:2.5px solid var(--encre);   --trait-fin:1.5px solid var(--encre);
  --ombre-1:4px 4px 0 var(--encre);   --ombre-2:6px 6px 0 var(--encre);
  --ombre-3:9px 9px 0 var(--encre);   --ombre-douce:0 8px 20px rgba(18,18,18,.16);
  --radius-sm:10px; --radius-md:16px; --radius-lg:24px; --radius-pill:999px;
  --font-display:'Archivo Black'; --font-body:'Poppins'; --font-mono:'Space Mono';
  --transition:130ms;
}
```

```js
// tailwind.config.ts (extrait — à merger dans le blueprint)
colors: { lavande:{fond:'#EADFF9',clair:'#F4EEFC',profond:'#C9A8F5'}, jaune:'#FFD84A',
          orange:'#E2622C', 'orange-sombre':'#B34A1F', encre:'#121212', blanc:'#FFFFFF' },
fontFamily:{ display:['Archivo Black'], body:['Poppins'], mono:['Space Mono'] },
boxShadow:{ sticker:'4px 4px 0 #121212', 'sticker-lg':'9px 9px 0 #121212', soft:'0 8px 20px rgba(18,18,18,.16)' },
borderWidth:{ trait:'2.5px' },
borderRadius:{ sm:'10px', md:'16px', lg:'24px', pill:'999px' },
transitionDuration:{ sticker:'130ms' },
```

**Checklist de conformité** (à coller dans la CI / review) :
- [ ] Aucune surface flottante sans contour encre
- [ ] ≤ 2 accents par écran ; ≤ 1 accent par carte
- [ ] Texte = encre ou orange sombre ; jamais jaune en texte ; jamais blanc sur lavande profond
- [ ] Ombres dures à 45°, jamais floues (sauf traitement « contour fin »)
- [ ] Boutons : hover −2/−2 + ombre +3, active +2/+2, 130 ms
- [ ] Sur image/trame : libellé sur pastille blanche contournée
- [ ] Texte orange sur fond clair uniquement en `#B34A1F`

---

## 8. Conclusion

Le **Sticker System v1** est une base remarquable : singulière, cohérente, émotionnellement juste pour Baobart. Avec la correction des 3 contrastes, l'ajout des tokens manquants et l'export en code Tailwind, il devient un socle prêt pour l'implémentation complète — de l'accueil marketing au back-office — décrite dans les maquettes du point F (`MAQUETTES_BAOBART.html`) et le blueprint Next.js.
