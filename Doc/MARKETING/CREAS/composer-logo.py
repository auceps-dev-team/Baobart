#!/usr/bin/env python3
"""
composer-logo.py — pose le logo officiel Baobart sur une affiche, à l'identique.

Pourquoi ce script existe
------------------------
Le logo est le seul symbole de la marque (Doc/DESIGN_SYSTEM_BAOBART.md §Logo).
Les maquettes générées par l'IA redessinent le baobab à chaque fois : l'arbre
change de silhouette d'une affiche à l'autre. Ce script remplace la pastille
dessinée par la vraie, vectorielle, celle du dépôt :

    Baobart Design/img/baobab-ink.svg

Résultat : le même arbre, au même endroit, à la même taille relative, sur
toutes les affiches de la campagne.

Ce que fait le script, dans l'ordre
-----------------------------------
1. Il rend le SVG officiel en PNG noir (ImageMagick dessine le chemin).
2. Il retrouve la pastille orange dans l'affiche (détection de la tache orange
   en haut à gauche, puis mesure de l'anneau noir qui l'entoure).
3. Il recompose la pastille selon les proportions officielles :
       cercle de diamètre D, anneau noir = 2,5 px pour 38 px de diamètre,
       arbre = 26 px de large dans 33 px de diamètre intérieur.
4. Il normalise l'affiche en 1080 x 1350 (format 4:5 des réseaux sociaux).

Dépendances : ImageMagick (`convert`, `identify`). Aucune bibliothèque Python.

Usage
-----
    python3 composer-logo.py affiche1.png [affiche2.png ...] [-o SORTIE.png]

Sans -o, chaque fichier est corrigé sur place (une copie .avant-logo est gardée).
"""

import os
import re
import subprocess
import sys

# --------------------------------------------------------------------------- #
# Constantes de marque — Doc/DESIGN_SYSTEM_BAOBART.md
# --------------------------------------------------------------------------- #
ORANGE = (226, 98, 44)        # #E2622C  Orange Baobart
NOIR = (18, 18, 18)           # #121212  Encre
RATIO_ANNEAU = 2.5 / 38.0     # épaisseur de contour / diamètre du cercle
RATIO_ARBRE = 26.0 / 33.0     # largeur de l'arbre / diamètre intérieur orange
SVG_BAOBAB = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..", "..", "..", "Baobart Design", "img", "baobab-ink.svg",
)
SORTIE = (1080, 1350)         # 4:5, format des publications sociales
SURECHANTILLONNAGE = 3        # anti-aliasing du lockup avant réduction


# --------------------------------------------------------------------------- #
# ImageMagick
# --------------------------------------------------------------------------- #
def convert(*args):
    """Lance convert ; lève une erreur lisible si ça rate."""
    cmd = ["convert"] + [str(a) for a in args]
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError(" ".join(cmd[:8]) + "\n" + p.stderr[:600])
    return p.stdout


def dimensions(chemin):
    w, h = subprocess.run(
        ["identify", "-format", "%w %h", chemin],
        capture_output=True, text=True, check=True,
    ).stdout.split()
    return int(w), int(h)


def pixels(chemin, x0, y0, x1, y1):
    """{(x, y): (r, g, b)} pour un rectangle de l'image, en pleine résolution."""
    w, h = x1 - x0 + 1, y1 - y0 + 1
    if w <= 0 or h <= 0:
        return {}
    out = {}
    for ligne in convert(chemin, "-colorspace", "sRGB", "-depth", "8",
                         "-crop", "%dx%d+%d+%d" % (w, h, x0, y0),
                         "txt:-").splitlines():
        m = re.match(r"^(\d+),(\d+): \((\d+),(\d+),(\d+)", ligne)
        if m:
            x, y, r, g, b = map(int, m.groups())
            out[(x + x0, y + y0)] = (r, g, b)
    return out


# --------------------------------------------------------------------------- #
# 1. Le baobab officiel : SVG -> PNG
# --------------------------------------------------------------------------- #
def rend_le_baobab(png_sortie, largeur=1200):
    """Dessine le chemin du SVG officiel. Commandes utilisées : M, L, C, Z."""
    svg = open(SVG_BAOBAB, encoding="utf-8").read()
    d = re.search(r'<path[^>]*\sd="([^"]+)"', svg).group(1)
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
    echelle = largeur / vb[2]
    cw, ch = int(round(vb[2] * echelle)), int(round(vb[3] * echelle))

    jetons = re.findall(r"[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?", d)
    trace, i = [], 0
    while i < len(jetons):
        t = jetons[i]
        if t in "ML":
            x, y = float(jetons[i + 1]) * echelle, float(jetons[i + 2]) * echelle
            trace.append("%s %.2f,%.2f" % (t, x, y))
            i += 3
        elif t == "C":
            v = [float(jetons[i + 1 + k]) * echelle for k in range(6)]
            trace.append("C %.2f,%.2f %.2f,%.2f %.2f,%.2f" % tuple(v))
            i += 7
        elif t == "Z":
            trace.append("Z")
            i += 1
        else:
            raise RuntimeError("commande SVG inconnue : " + t)

    convert("-size", "%dx%d" % (cw, ch), "xc:none",
            "-fill", "rgb(%d,%d,%d)" % NOIR, "-stroke", "none",
            "-draw", "translate %.2f,%.2f path '%s'"
            % (-vb[0] * echelle, -vb[1] * echelle, " ".join(trace)),
            "-trim", "+repage", "-background", "none", png_sortie)
    return png_sortie


# --------------------------------------------------------------------------- #
# 2. Retrouver la pastille dans l'affiche
# --------------------------------------------------------------------------- #
def est_orange(c):
    r, g, b = c
    return r > 170 and 60 < g < 150 and b < 110 and (r - g) > 55 and (r - b) > 85


def tache_orange(chemin, grande_largeur=500):
    """Plus grande tache orange en haut à gauche = la pastille du logo."""
    w, h = dimensions(chemin)
    cible = min(grande_largeur, w)
    px = {}
    for ligne in convert(chemin, "-alpha", "remove", "-background", "white",
                         "-resize", "%dx" % cible, "-colorspace", "sRGB",
                         "-depth", "8", "txt:-").splitlines():
        m = re.match(r"^(\d+),(\d+): \((\d+),(\d+),(\d+)", ligne)
        if m:
            x, y, r, g, b = map(int, m.groups())
            px[(x, y)] = (r, g, b)
    L, H = cible, int(round(h * cible / float(w)))

    meilleure, vue = None, set()
    for y in range(H):
        for x in range(L):
            if (x, y) in vue or not est_orange(px[(x, y)]):
                continue
            pile, pts = [(x, y)], []
            vue.add((x, y))
            while pile:
                cx, cy = pile.pop()
                pts.append((cx, cy))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        n = (cx + dx, cy + dy)
                        if (0 <= n[0] < L and 0 <= n[1] < H
                                and n not in vue and est_orange(px.get(n, (0, 0, 0)))):
                            vue.add(n)
                            pile.append(n)
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            aire, lar, hau = len(pts), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
            cy_rel, cx_rel = (min(ys) + max(ys)) / 2.0 / H, (min(xs) + max(xs)) / 2.0 / L
            # la pastille : grosse, à peu près ronde, en haut à gauche de l'affiche
            if not (cx_rel < 0.35 and cy_rel < 0.32 and 0.75 < lar / float(hau) < 1.33):
                continue
            if meilleure is None or aire > meilleure[0]:
                meilleure = (aire, min(xs), min(ys), max(xs), max(ys))

    if meilleure is None:
        raise RuntimeError("pastille orange introuvable dans " + chemin)
    echelle = w / float(cible)
    _, x0, y0, x1, y1 = meilleure
    return [int(round(v * echelle)) for v in (x0, y0, x1, y1)]


def mesurer_la_pastille(chemin):
    """Boîte de la pastille complète (orange + anneau noir) et son centre."""
    ox0, oy0, ox1, oy1 = tache_orange(chemin)
    cx, cy = (ox0 + ox1) // 2, (oy0 + oy1) // 2
    marge = 40
    ligne = pixels(chemin, ox0 - marge, cy, ox1 + marge, cy)
    colonne = pixels(chemin, cx, oy0 - marge, cx, oy1 + marge)

    def bord(cles, source):
        """L'anneau est contigu : on avance depuis l'orange tant que ce n'est pas clair."""
        dernier = None
        for cle in cles:
            c = (ligne if source == "ligne" else colonne).get(cle)
            if c and min(c) <= 170:
                dernier = cle
            else:
                break
        return dernier

    g = bord([(x, cy) for x in range(ox0 - 1, ox0 - marge - 1, -1)], "ligne")
    d = bord([(x, cy) for x in range(ox1 + 1, ox1 + marge + 1)], "ligne")
    h_ = bord([(cx, y) for y in range(oy0 - 1, oy0 - marge - 1, -1)], "colonne")
    b = bord([(cx, y) for y in range(oy1 + 1, oy1 + marge + 1)], "colonne")
    if not all([g, d, h_, b]):
        raise RuntimeError("anneau noir introuvable autour de la pastille de " + chemin)

    diametre = max(d[0] - g[0] + 1, b[1] - h_[1] + 1)
    centre = ((g[0] + d[0]) // 2, (h_[1] + b[1]) // 2)
    return diametre, centre


# --------------------------------------------------------------------------- #
# 3. Recomposer la pastille officielle
# --------------------------------------------------------------------------- #
def fabriquer_la_pastille(diametre, arbre_png, marge=6):
    """Disque orange + anneau noir + baobab officiel, aux proportions de la charte."""
    ss = SURECHANTILLONNAGE
    b = max(3, int(round(diametre * RATIO_ANNEAU))) * ss
    interieur = diametre * ss - 2 * b
    la = int(round(interieur * RATIO_ARBRE))
    ha = int(round(la * 1229.0 / 1185.0))       # rapport h/l de l'encre officielle

    cote = (diametre + 2 * marge) * ss
    c = cote // 2
    calque = "/tmp/baobart-lockup.png"
    convert("-size", "%dx%d" % (cote, cote), "xc:none",
            "-fill", "rgb(%d,%d,%d)" % NOIR, "-stroke", "none",
            "-draw", "circle %d,%d %d,%d" % (c, c, c, 0),
            "-fill", "rgb(%d,%d,%d)" % ORANGE, "-stroke", "none",
            "-draw", "circle %d,%d %d,%d" % (c, c, c, b // 2 + b % 2),
            calque)
    convert(arbre_png, "-resize", "%dx%d!" % (la, ha), "-colorspace", "sRGB",
            "/tmp/baobart-lockup-arbre.png")
    convert(calque, "/tmp/baobart-lockup-arbre.png",
            "-geometry", "+%d+%d" % (c - la // 2, c - ha // 2),
            "-composite", calque)

    cible = diametre + 2 * marge
    convert(calque, "-resize", "%dx%d!" % (cible, cible), calque)
    return calque, cible


# --------------------------------------------------------------------------- #
# 4. Assemblage
# --------------------------------------------------------------------------- #
def corrige(chemin, arbre_png, sauvegarde=True):
    diametre, (cx, cy) = mesurer_la_pastille(chemin)
    calque, cote = fabriquer_la_pastille(diametre, arbre_png)
    if sauvegarde and not os.path.exists(chemin + ".avant-logo"):
        with open(chemin, "rb") as f:
            donnees = f.read()
        with open(chemin + ".avant-logo", "wb") as f:
            f.write(donnees)
    convert(chemin, calque, "-geometry", "+%d+%d" % (cx - cote // 2, cy - cote // 2),
            "-composite", "-resize", "%dx%d!" % SORTIE, "-quality", "95", chemin)
    return diametre


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    if not args:
        print(__doc__)
        return 1
    arbre = rend_le_baobab("/tmp/baobart-baobab.png")
    for chemin in args:
        if not os.path.exists(chemin):
            print("introuvable : " + chemin)
            continue
        d = corrige(chemin, arbre)
        w, h = dimensions(chemin)
        print("%-58s pastille Ø%d px  ->  %dx%d" % (os.path.basename(chemin), d, w, h))
    return 0


if __name__ == "__main__":
    sys.exit(main())
