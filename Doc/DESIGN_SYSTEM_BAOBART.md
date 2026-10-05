# Baobart — Sticker System, document de référence

> **Source :** planches du design system reçues le 5 octobre 2026 (planches 00 à 05),
> transmises en images par le commanditaire.
>
> **Statut :** document **canonique**. En cas de contradiction avec un autre document du
> dépôt (maquettes `.dc.html`, `Doc/ANALYSE_DESIGN_SYSTEM_BAOBART.md`, code), **c'est
> celui-ci qui gagne**.
>
> **Portée :** tout ce qui porte la marque — affiches, flyers, posts, vidéos, packaging,
> signature de footer, badges, certificats.

---

## 00 · Logo

> **Le baobab est le seul symbole de la marque.** Version principale validée :
> **pastille orange, contour noir, mot en Archivo Black avec point orange.**

### Le lockup principal

| Élément | Spécification |
|---|---|
| **Pastille** | Cercle orange `#E2622C`, **contour noir** `#121212`, contenant la silhouette du baobab |
| **Mot** | `Baobart.` en **Archivo Black**, encre `#121212` |
| **Point** | Le point final est **orange** `#E2622C` (c'est la signature : un point orange après le mot) |
| **Baseline** | `CREATE. SHARE. INSPIRE.` en **Space Mono 700**, letter-spacing **+0,2 em**, **jamais sous 9 px** |
| **Usage** | Principal · tous supports |

### Réductions

| Règle | Valeur |
|---|---|
| Sous **34 px** de large | **La pastille seule** remplace le lockup |
| Taille minimale absolue | **24 px** |

### Fond sombre

- Contour **blanc**, point **jaune**.
- **Le point orange n'est jamais utilisé sur fond noir.** (C'est le seul interdit de
  couleur du logo.)

### Variantes secondaires & badges

| Variante | Usage | Composition |
|---|---|---|
| **Tampon carré** | objets, stickers, emballage | Pavé jaune, pastille + `Baobart.` + `EST. 2026` |
| **Bloc contrasté** | signature de footer, campagnes | Pavé noir, pastille + `Baobart.` + baseline |
| **Écusson** | créateur vérifié, lauréats, certificats | Écusson lavande, arc `CREATE. SHARE. INSPIRE.` + `Baobart.` |
| **Badges plateforme** | dérivés du principal et de l'écusson | `CRÉATEUR VÉRIFIÉ`, `LAURÉAT 2026` |

### Zone de protection

**Une demi-largeur de pastille sur les quatre côtés.** Aucun élément ne s'y invite.

### Interdits

1. **Déformer** le lockup.
2. **Incliner** le lockup.
3. **Changer la couleur de l'arbre.**
4. **Poser la pastille sur une photo sans contour.**

---

## 01 · Couleurs

> **Deux fonds, deux accents, un noir. Jamais plus de deux accents sur un même écran.**

| Token | Hex | Usage prescrit |
|---|---|---|
| **Lavande fond** | `#EADFF9` | Fond de page, socle de toutes les vues |
| **Lavande clair** | `#F4EEFC` | Survols, champs de saisie, zones internes |
| **Lavande profond** | `#C9A8F5` | Blocs d'accent, boutons tertiaires, avatars |
| **Jaune signal** | `#FFD84A` | Action principale, état actif, prix gratuits |
| **Orange Baobart** | `#E2622C` | Marque, likes, alertes. **Jamais en fond de texte long** |
| **Encre** | `#121212` | Contours, texte, blocs contrastés |
| **Blanc** | `#FFFFFF` | Surfaces, pastilles sur image |

**Le décompte :** 2 fonds (lavande fond, lavande clair) + 2 accents (jaune, orange) +
1 noir. Le lavande profond est un **bloc d'accent**, pas un troisième accent — il compte
dans les deux quand il est utilisé.

---

## 02 · Typographie

### Les trois familles

| Rôle | Famille | Usage |
|---|---|---|
| **Display** | **Archivo Black** | Titres H1-H2, chiffres clés, prix. **Toujours en capitales**, letter-spacing **−1 à −2,5 px** |
| **Texte** | **Poppins** | **800** pour les libellés et boutons · **600** pour les métadonnées · **500** pour les paragraphes (interlignage 1,5) |
| **Utilitaire** | **Space Mono** | Étiquettes, compteurs, formats de fichier, URL. **10-12 px**, majuscules, letter-spacing **+0,1 em** |

### L'échelle

| Token | Valeurs |
|---|---|
| `display/x1` | −2,5 px · interlignage 0,93 |
| `display/l` | −1,5 px · interlignage 1,0 |
| `titre/m` | interlignage 1,25 |
| `corps` | interlignage 1,5 |
| `meta` | +0,1 em — ex. `12 JUIL. 2026 · 4 000 F` |

---

## 03 · Contours, rayons, ombres

| | Règle |
|---|---|
| **Contour 2,5 px** | 2 px pour les petits éléments (puces, pastilles), 3 px pour les surfaces plein écran |
| **Rayons 10 / 16 / 24** | Puces et pastilles en **999 px**. Les cartes montent à **20-28 px** |
| **Ombres dures 4 / 6 / 9** | **Toujours à 45°, jamais floues.** Ombre colorée réservée aux blocs noirs |
| **Visuels & placeholders** | Image plein cadre quand elle existe ; sinon **trame diagonale 135°** et libellé sur **pastille blanche contournée** |

---

## 04 · Composants

### Boutons

Six variantes : **Primaire** (jaune) · **Secondaire** (blanc) · **Contrasté** (encre) ·
**Tertiaire** (lavande profond) · **Puce / filtre** · **Désactivé**.

> **Micro-interaction physique :** survol `translate(−2px,−2px)` + ombre **+3 px** ·
> clic `translate(2px,2px)`, ombre à **0** · transition **130 ms**.

### Étiquettes & statuts

`GRATUIT` · `NOUVEAU` · `EN LIGNE` · `MODÉRATION` · `VERSÉE` · `URGENT`

### Champs

Champ par défaut (fond lavande clair) · sur fond blanc · sélecteur.

### Cartes ressource — les 3 traitements

| Traitement | Spécification | Exemple de la planche |
|---|---|---|
| **Sticker** | contour 2,5 px + ombre 4 px | *Portrait Wax Éditorial* — Awa Diallo — `GRATUIT` |
| **Contour fin** | contour 1,5 px + ombre douce | *Illu Femme au Foulard* — Awa Diallo — `5 000 F` |
| **Image pleine** | infos au survol | *Collage Lunettes* — Sarah Bakayoko — `10 000 F` |

### Navigation

- **État actif = fond jaune.** Un **seul** élément actif par zone.
- **Le survol utilise le lavande clair `#F4EEFC`, jamais le jaune.**

---

## 05 · Règles d'usage — les 4 commandements

| # | Règle | Détail |
|---|---|---|
| 1 | **Un seul accent par bloc** | Jaune **OU** orange **OU** lavande profond. Deux accents sur une même carte cassent la lecture |
| 2 | **Tout est contouré** | Aucune surface flottante sans trait noir : cartes, champs, pastilles, images, avatars |
| 3 | **L'ombre indique le niveau** | 4 px pour une carte de liste, 6 px pour un bloc de page, 9-10 px pour un panneau modal |
| 4 | **Le texte reste sur fond plein** | Sur une image ou une trame, poser le libellé sur une pastille blanche contournée |

---

## Le manifeste (planche de couverture)

> **BAOBART. STICKER SYSTEM** — DESIGN SYSTEM · V1
>
> *« Contours noirs épais, ombres dures, aplats lavande et jaune, orange Baobart en
> accent. Chaque élément est une vignette autonome, posée comme un sticker. »*

---

## Ce que ce document ajoute aux documents précédents

Par rapport à `Doc/ANALYSE_DESIGN_SYSTEM_BAOBART.md` (qui analysait la maquette), la
version officielle apporte six éléments qui n'existaient pas ailleurs :

1. **La baseline `CREATE. SHARE. INSPIRE.`** et ses règles (Space Mono 700, +0,2 em,
   jamais sous 9 px). La charte éditoriale, elle, porte le message marketing
   « Du premier croquis au premier encaissement » — **les deux cohabitent** : la baseline
   est la signature de marque, le message marketing est l'argument de vente.
2. **Les règles complètes du logo** : réductions (pastille seule sous 34 px, minimum
   24 px), fond sombre (contour blanc, point jaune), zone de protection, 4 interdits.
3. **Le point orange** après le mot `Baobart.` — détail de signature jusqu'ici absent.
4. **Les 4 variantes du logo** (tampon carré, bloc contrasté, écusson, badges plateforme)
   et leurs usages respectifs.
5. **Le survol de navigation** : lavande clair, jamais jaune.
6. **Le comptage exact des accents** : 2 fonds, 2 accents, 1 noir.

---

## Checklist de conformité (à coller dans chaque relecture de créa)

- [ ] Deux fonds, deux accents, un noir — **jamais plus de deux accents sur un même écran**
- [ ] Un seul accent par bloc / par carte
- [ ] Toute surface est contourée (trait encre 2 / 2,5 / 3 px selon la taille)
- [ ] Ombres dures à 45°, jamais floues — 4 px liste, 6 px bloc, 9-10 px modal
- [ ] Ombre colorée **uniquement** sur les blocs noirs
- [ ] Texte = encre ou orange **sombre** `#B34A1F` ; **jamais** de jaune en texte
- [ ] Boutons : survol −2/−2 + ombre +3, clic +2/+2, 130 ms
- [ ] Sur image ou trame : libellé sur **pastille blanche contournée**
- [ ] Titres en capitales, Archivo Black, letter-spacing négatif
- [ ] Compteurs et formats en Space Mono, majuscules, +0,1 em
- [ ] Logo : pastille orange + contour noir + `Baobart.` + **point orange**
- [ ] Sur fond sombre : contour blanc + **point jaune** (jamais orange)
- [ ] Sous 34 px : pastille seule. Jamais sous 24 px
- [ ] Zone de protection d'une demi-pastille respectée
- [ ] Baseline en Space Mono 700, +0,2 em, jamais sous 9 px
