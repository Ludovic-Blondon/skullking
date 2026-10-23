#!/usr/bin/env python3
"""Remplit la fiche Play Store depuis le dépôt.

Le pendant Google de `publish-listing.py` : mêmes sources — `docs/store/*.md` pour les textes,
`docs/store/screenshots/` pour les captures, `docs/store/feature-graphic/` pour les bandeaux —,
recopiées dans les quatre fiches de langue au lieu d'être ressaisies dans la console.

Le client de l'API, jeton compris, est dans `play.py`.

    python3 docs/store/publish-play-listing.py --dry-run   # montre, ne commite pas
    python3 docs/store/publish-play-listing.py             # écrit la fiche

Le script est **idempotent** : les images d'un type sont effacées puis renvoyées, les textes sont
réécrits. On peut le relancer après un échec réseau.

Ce qu'il ne fait **pas** :

- **créer l'application** — l'API Play n'a pas d'appel pour ça, c'est la console qui la crée ;
- la **confidentialité** (formulaire Data Safety), la **classification d'âge** (questionnaire
  IARC), le **public cible** et le **statut de commerçant DSA** : déclarations dont le développeur
  répond devant Google, hors API ;
- les **pistes** et leurs **testeurs** : c'est `promote-play-track.py`.
"""

from __future__ import annotations

import argparse
import pathlib
import re
import subprocess
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import play  # noqa: E402

PACKAGE = play.PACKAGE
RACINE = pathlib.Path(__file__).resolve().parents[2]
LOCALES = {"fr": "fr-FR", "en": "en-US", "es": "es-ES", "de": "de-DE"}
# Les intitulés des fiches changent de langue, leur ordre non (voir publish-listing.py).
CHAMPS = ["nom", "sous_titre", "play_court", "promo", "description", "mots_cles", "nouveautes"]
# Dossier de captures → type d'image Play. Le 13" d'Apple n'a pas d'équivalent ici.
APPAREILS = {
    "phone": "phoneScreenshots",
    "tablet-7": "sevenInchScreenshots",
    "tablet-10": "tenInchScreenshots",
}


# — Sources du dépôt ——————————————————————————————————————————————————————


def fiche(langue: str) -> dict[str, str]:
    texte = (RACINE / f"docs/store/{langue}.md").read_text(encoding="utf-8")
    blocs = re.split(r"^## .*$", texte, flags=re.M)[1:]
    valeurs = {}
    for nom, bloc in zip(CHAMPS, blocs):
        corps = bloc.strip()
        valeurs[nom] = corps if nom == "description" else " ".join(corps.split())
    return valeurs


def icone_512() -> pathlib.Path:
    """L'icône du dépôt fait 1024 : Play en veut 512 exactement."""
    source = RACINE / "assets/images/icon.png"
    cible = pathlib.Path(tempfile.gettempdir()) / "skull-scores-icon-512.png"
    subprocess.run(
        ["sips", "-z", "512", "512", str(source), "--out", str(cible)],
        check=True,
        capture_output=True,
    )
    return cible


# — Écriture de la fiche ————————————————————————————————————————————————————


def textes(edit: str) -> None:
    for langue, locale in LOCALES.items():
        v = fiche(langue)
        reponse = play.put(
            f"/applications/{PACKAGE}/edits/{edit}/listings/{locale}",
            {
                "language": locale,
                "title": v["nom"],
                "shortDescription": v["play_court"],
                "fullDescription": v["description"],
            },
        )
        print(f"  texte {locale} :", "ERREUR " + reponse["corps"][:200]
              if "erreur" in reponse else "ok")


def images(edit: str) -> None:
    icone = icone_512()
    for langue, locale in LOCALES.items():
        base = f"/applications/{PACKAGE}/edits/{edit}/listings/{locale}"
        # L'icône et le bandeau sont uniques ; les captures se comptent par appareil.
        uniques = {
            "icon": icone,
            "featureGraphic": RACINE / f"docs/store/feature-graphic/{langue}.png",
        }
        for type_image, image in uniques.items():
            if not image.exists():
                print(f"  {type_image} {locale} : absent, ignoré")
                continue
            play.supprime(f"{base}/{type_image}")
            reponse = play.televerse(f"{base}/{type_image}", image)
            print(f"  {type_image} {locale} :", "ERREUR " + reponse["corps"][:200]
                  if "erreur" in reponse else "ok")

        for dossier, type_image in APPAREILS.items():
            captures = sorted((RACINE / f"docs/store/screenshots/{dossier}/{langue}").glob("*.png"))
            if not captures:
                print(f"  {type_image} {locale} : aucune capture, ignoré")
                continue
            # Effacer d'abord : sans ça, relancer le script empile les doublons.
            play.supprime(f"{base}/{type_image}")
            erreurs = []
            for capture in captures[:8]:  # Play en accepte huit au plus
                reponse = play.televerse(f"{base}/{type_image}", capture)
                if "erreur" in reponse:
                    erreurs.append(f"{capture.name} → {reponse['corps'][:120]}")
            print(f"  {type_image} {locale} :",
                  f"ERREUR {' | '.join(erreurs)}" if erreurs else f"{len(captures[:8])} envoyées")


def main() -> None:
    analyse = argparse.ArgumentParser(description=__doc__)
    analyse.add_argument("--dry-run", action="store_true",
                         help="écrit dans un brouillon d'édition, puis l'abandonne")
    options = analyse.parse_args()

    edit = play.ouvrir()
    print(f"édition {edit}")

    print("textes")
    textes(edit)
    print("images")
    images(edit)

    if options.dry_run:
        play.abandonner(edit)
        print("essai à blanc : édition abandonnée, la fiche n'a pas bougé")
        return

    print(play.commit(edit))


if __name__ == "__main__":
    sys.exit(main())
