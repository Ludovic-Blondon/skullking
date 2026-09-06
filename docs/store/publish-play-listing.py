#!/usr/bin/env python3
"""Remplit la fiche Play Store depuis le dépôt.

Le pendant Google de `publish-listing.py` : mêmes sources — `docs/store/*.md` pour les textes,
`docs/store/screenshots/` pour les captures, `docs/store/feature-graphic/` pour les bandeaux —,
recopiées dans les quatre fiches de langue au lieu d'être ressaisies dans la console.

Signature RS256 par `openssl`, comme `asc.py` le fait en ES256 pour Apple : ni PyJWT ni
`cryptography` ne sont installés d'office sur macOS.

    python3 docs/store/publish-play-listing.py --dry-run   # montre, ne commite pas
    python3 docs/store/publish-play-listing.py             # écrit la fiche

Le script est **idempotent** : les images d'un type sont effacées puis renvoyées, les textes sont
réécrits. On peut le relancer après un échec réseau.

Ce qu'il ne fait **pas** :

- **créer l'application** — l'API Play n'a pas d'appel pour ça, c'est la console qui la crée ;
- la **confidentialité** (formulaire Data Safety), la **classification d'âge** (questionnaire
  IARC), le **public cible** et le **statut de commerçant DSA** : déclarations dont le développeur
  répond devant Google, hors API ;
- la **liste des testeurs** d'une piste, elle aussi réservée à la console.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://androidpublisher.googleapis.com/androidpublisher/v3"
UPLOAD = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3"
PACKAGE = "com.lblondon.skullscores"
CLE = os.environ.get("PLAY_KEY_PATH", "credentials/play-service-account.json")

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


# — Client minimal ————————————————————————————————————————————————————————


def _b64(donnees: bytes) -> bytes:
    return base64.urlsafe_b64encode(donnees).rstrip(b"=")


def jeton() -> str:
    """Jeton OAuth du compte de service, valable une heure."""
    chemin_cle = pathlib.Path(CLE)
    if not chemin_cle.exists():
        raise SystemExit(f"Compte de service introuvable : {CLE}")
    compte = json.loads(chemin_cle.read_text(encoding="utf-8"))

    maintenant = int(time.time())
    entete = _b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    charge = _b64(
        json.dumps(
            {
                "iss": compte["client_email"],
                "scope": "https://www.googleapis.com/auth/androidpublisher",
                "aud": "https://oauth2.googleapis.com/token",
                "iat": maintenant,
                "exp": maintenant + 3600,
            }
        ).encode()
    )
    signe = entete + b"." + charge

    with tempfile.NamedTemporaryFile("w", suffix=".pem", delete=False) as fichier:
        fichier.write(compte["private_key"])
        chemin_pem = fichier.name
    try:
        signature = subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", chemin_pem],
            input=signe,
            capture_output=True,
            check=True,
        ).stdout
    finally:
        os.unlink(chemin_pem)

    assertion = (signe + b"." + _b64(signature)).decode()
    corps = urllib.parse.urlencode(
        {"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion}
    ).encode()
    with urllib.request.urlopen(
        urllib.request.Request("https://oauth2.googleapis.com/token", data=corps)
    ) as reponse:
        return json.load(reponse)["access_token"]


JETON = ""


def api(methode: str, chemin: str, corps: dict | None = None) -> dict:
    donnees = json.dumps(corps).encode() if corps is not None else None
    requete = urllib.request.Request(
        f"{API}{chemin}",
        data=donnees,
        method=methode,
        headers={"Authorization": f"Bearer {JETON}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(requete) as reponse:
            brut = reponse.read()
            return json.loads(brut) if brut else {}
    except urllib.error.HTTPError as erreur:
        return {"erreur": erreur.code, "corps": erreur.read().decode("utf-8", "replace")}


def televerser(edit: str, locale: str, type_image: str, image: pathlib.Path) -> dict:
    requete = urllib.request.Request(
        f"{UPLOAD}/applications/{PACKAGE}/edits/{edit}/listings/{locale}/{type_image}"
        "?uploadType=media",
        data=image.read_bytes(),
        method="POST",
        headers={"Authorization": f"Bearer {JETON}", "Content-Type": "image/png"},
    )
    try:
        with urllib.request.urlopen(requete) as reponse:
            return json.load(reponse)
    except urllib.error.HTTPError as erreur:
        return {"erreur": erreur.code, "corps": erreur.read().decode("utf-8", "replace")}


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
        reponse = api(
            "PUT",
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
        # L'icône et le bandeau sont uniques ; les captures se comptent par appareil.
        uniques = {
            "icon": icone,
            "featureGraphic": RACINE / f"docs/store/feature-graphic/{langue}.png",
        }
        for type_image, image in uniques.items():
            if not image.exists():
                print(f"  {type_image} {locale} : absent, ignoré")
                continue
            api("DELETE", f"/applications/{PACKAGE}/edits/{edit}/listings/{locale}/{type_image}")
            reponse = televerser(edit, locale, type_image, image)
            print(f"  {type_image} {locale} :", "ERREUR " + reponse["corps"][:200]
                  if "erreur" in reponse else "ok")

        for dossier, type_image in APPAREILS.items():
            captures = sorted((RACINE / f"docs/store/screenshots/{dossier}/{langue}").glob("*.png"))
            if not captures:
                print(f"  {type_image} {locale} : aucune capture, ignoré")
                continue
            # Effacer d'abord : sans ça, relancer le script empile les doublons.
            api("DELETE", f"/applications/{PACKAGE}/edits/{edit}/listings/{locale}/{type_image}")
            erreurs = []
            for capture in captures[:8]:  # Play en accepte huit au plus
                reponse = televerser(edit, locale, type_image, capture)
                if "erreur" in reponse:
                    erreurs.append(f"{capture.name} → {reponse['corps'][:120]}")
            print(f"  {type_image} {locale} :",
                  f"ERREUR {' | '.join(erreurs)}" if erreurs else f"{len(captures[:8])} envoyées")


def main() -> None:
    global JETON

    analyse = argparse.ArgumentParser(description=__doc__)
    analyse.add_argument("--dry-run", action="store_true",
                         help="écrit dans un brouillon d'édition, puis l'abandonne")
    options = analyse.parse_args()

    JETON = jeton()
    ouverture = api("POST", f"/applications/{PACKAGE}/edits")
    if "erreur" in ouverture:
        raise SystemExit(f"édition impossible : {ouverture['corps'][:300]}")
    edit = ouverture["id"]
    print(f"édition {edit}")

    print("textes")
    textes(edit)
    print("images")
    images(edit)

    if options.dry_run:
        api("DELETE", f"/applications/{PACKAGE}/edits/{edit}")
        print("essai à blanc : édition abandonnée, la fiche n'a pas bougé")
        return

    resultat = api("POST", f"/applications/{PACKAGE}/edits/{edit}:commit")
    if "erreur" in resultat:
        # Une app qui n'a jamais été relue refuse l'envoi automatique en validation.
        if "changesNotSentForReview" in resultat["corps"]:
            resultat = api(
                "POST",
                f"/applications/{PACKAGE}/edits/{edit}:commit?changesNotSentForReview=true",
            )
        if "erreur" in resultat:
            raise SystemExit(f"commit refusé : {resultat['corps'][:400]}")
        print("fiche enregistrée (changements non envoyés en validation)")
        return

    print("fiche enregistrée")


if __name__ == "__main__":
    sys.exit(main())
