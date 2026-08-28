#!/usr/bin/env python3
"""Génère le bandeau de la fiche Play (« feature graphic »), 1024 x 500, une image par langue.

Obligatoire pour publier une fiche Play. Le bandeau reprend l'identité de l'app : la marque au
crâne d'`assets/images/icon.png`, la palette du mode sombre de `src/global.css` (PLAN.md §13.5)
et un fragment de la feuille de score, dont les nombres se lisent dans les quatre langues.

Dépendances : les fontes Outfit de `node_modules`, Google Chrome pour le rendu, Pillow pour
aplatir en PNG 24 bits — Play refuse la transparence.

    python3 docs/store/feature-graphic.py
"""

import base64
import pathlib
import subprocess
import tempfile

from PIL import Image

RACINE = pathlib.Path(__file__).resolve().parents[2]
SORTIE = RACINE / "docs/store/feature-graphic"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
FONTES = RACINE / "node_modules/@expo-google-fonts/outfit"

# Palette : mode sombre de src/global.css.
FOND, CARTE, CELLULE = "#0E1420", "#141B2A", "#1C2436"
BORDURE, BORDURE_FORTE = "#212B40", "#2E3A54"
CREME, CORAIL, OR = "#F4F1EA", "#E8785A", "#E8B84B"
VERT, ROSE = "#5FB88A", "#F5A8A6"

# Le crâne, relevé sur assets/images/icon.png.
CRANE = f"""<svg viewBox="0 0 1024 1024" class="skull">
  <g fill="{CREME}"><circle cx="512" cy="425" r="253"/>
    <rect x="253" y="620" width="518" height="172" rx="66"/></g>
  <g fill="{FOND}"><circle cx="406" cy="421" r="79"/><circle cx="618" cy="421" r="79"/>
    <path d="M512 518 L560 588 L464 588 Z"/>
    <rect x="394" y="628" width="52" height="156" rx="20"/>
    <rect x="578" y="628" width="52" height="156" rx="20"/></g></svg>"""

GRILLE = [["+10", "+20", "-10"], ["+40", "-10", "+20"],
          ["-10", "+40", "+30"], ["+50", "+20", "+40"]]

# Mêmes joueurs que les captures, pour que la fiche soit d'une pièce.
JOUEURS = [("Ravi", "#B58CF0"), ("Lou", CORAIL), ("Zo&eacute;", OR)]
TOTAUX = ["140", "120", "100"]

ARGUMENTS = {
    "fr": ["Hors ligne", "Sans pub", "4 langues"],
    "en": ["Offline", "No ads", "4 languages"],
    "es": ["Sin conexión", "Sin anuncios", "4 idiomas"],
    "de": ["Offline", "Keine Werbung", "4 Sprachen"],
}


def fonte(graisse: str) -> str:
    chemin = FONTES / graisse / f"Outfit_{graisse}.ttf"
    return base64.b64encode(chemin.read_bytes()).decode()


def page(arguments: list[str]) -> str:
    lignes = "".join(
        '<div class="row">'
        + "".join(
            f'<div class="cell {"neg" if v[0] == "-" else "pos"}">{v}</div>' for v in ligne
        )
        + "</div>"
        for ligne in GRILLE
    )
    tetes = "".join(
        f'<div class="head" style="color:{c}">{n}</div>' for n, c in JOUEURS
    )
    totaux = "".join(f'<div class="total">{t}</div>' for t in TOTAUX)
    puces = "".join(f'<div class="chip">{t}</div>' for t in arguments)
    return f"""<meta charset="utf-8"><style>
@font-face {{ font-family: Outfit; font-weight: 800; src: url(data:font/ttf;base64,{fonte("800ExtraBold")}); }}
@font-face {{ font-family: Outfit; font-weight: 700; src: url(data:font/ttf;base64,{fonte("700Bold")}); }}
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ width:1024px; height:500px; overflow:hidden; background:{FOND}; font-family:Outfit,sans-serif; }}
.canvas {{ position:relative; width:1024px; height:500px; display:flex; align-items:center;
           padding:0 68px; gap:52px; }}
.glow {{ position:absolute; left:-140px; top:-190px; width:740px; height:740px;
         background:radial-gradient(circle, rgba(232,120,90,.20) 0%, rgba(232,120,90,0) 68%); }}
.glow2 {{ position:absolute; right:-170px; bottom:-230px; width:660px; height:660px;
          background:radial-gradient(circle, rgba(232,184,75,.11) 0%, rgba(232,184,75,0) 68%); }}
.left {{ position:relative; flex:1; }}
.mark {{ display:flex; align-items:center; gap:22px; }}
.skull {{ width:92px; height:92px; flex:none; }}
.name {{ font-weight:800; font-size:70px; letter-spacing:-2px; color:{CREME}; line-height:1; }}
.rule {{ width:96px; height:5px; border-radius:3px; background:{CORAIL}; margin:30px 0 26px 2px; }}
.pitch {{ display:flex; gap:11px; }}
.chip {{ font-weight:700; font-size:20px; color:{CREME}; background:{CELLULE};
         border:1px solid {BORDURE_FORTE}; border-radius:999px; padding:11px 19px; white-space:nowrap; }}
.sheet {{ position:relative; flex:none; width:330px; background:{CARTE}; border:1px solid {BORDURE};
          border-radius:24px; padding:22px; }}
.heads {{ display:flex; gap:10px; margin-bottom:12px; }}
.head {{ flex:1; text-align:center; font-weight:700; font-size:17px; }}
.row {{ display:flex; gap:10px; margin-bottom:10px; }}
.cell {{ flex:1; text-align:center; font-weight:700; font-size:22px; background:{CELLULE};
         border-radius:10px; padding:11px 0; }}
.pos {{ color:{VERT}; }} .neg {{ color:{ROSE}; }}
.totals {{ display:flex; gap:10px; border-top:1px solid {BORDURE_FORTE}; margin-top:16px;
           padding-top:14px; }}
.total {{ flex:1; text-align:center; font-weight:800; font-size:28px; color:{CREME}; }}
</style>
<div class="canvas"><div class="glow"></div><div class="glow2"></div>
<div class="left"><div class="mark">{CRANE}<div class="name">Skull&nbsp;Scores</div></div>
<div class="rule"></div><div class="pitch">{puces}</div></div>
<div class="sheet"><div class="heads">{tetes}</div>{lignes}
<div class="totals">{totaux}</div></div></div>"""


def main() -> None:
    SORTIE.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        for langue, arguments in ARGUMENTS.items():
            html = tmp / f"{langue}.html"
            html.write_text(page(arguments), encoding="utf-8")
            brut = tmp / f"{langue}.png"
            subprocess.run(
                [CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
                 "--force-device-scale-factor=1", "--window-size=1024,500",
                 f"--screenshot={brut}", html.as_uri()],
                check=True, capture_output=True,
            )
            # Play veut du 24 bits : la capture Chrome sort en RGBA.
            image = Image.open(brut).convert("RGB")
            assert image.size == (1024, 500), image.size
            image.save(SORTIE / f"{langue}.png")
            print(f"{langue}.png")


if __name__ == "__main__":
    main()
