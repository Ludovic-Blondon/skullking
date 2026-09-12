"""Client minimal de l'API Google Play Developer.

Signature RS256 par `openssl`, comme `asc.py` le fait en ES256 pour Apple : ni PyJWT ni
`cryptography` ne sont installés d'office sur macOS.

Le compte de service est celui décrit dans `publication.md` — il vit dans un dossier gitignoré,
il n'a rien à faire dans un dépôt public :

    export PLAY_KEY_PATH=credentials/play-service-account.json   # optionnel, c'est le défaut

Tout passe par une **édition** : l'API Play ne lit ni n'écrit une fiche ou une piste en dehors
d'un brouillon qu'on ouvre, remplit, puis commite. Une édition abandonnée ne laisse aucune trace,
ce qui donne l'essai à blanc pour rien.
"""

from __future__ import annotations

import base64
import json
import os
import pathlib
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://androidpublisher.googleapis.com/androidpublisher/v3"
UPLOAD = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3"
PACKAGE = "com.lblondon.skullscores"
KEY_PATH = os.environ.get("PLAY_KEY_PATH", "credentials/play-service-account.json")

# Jeton et date d'expiration : une heure de validité, inutile d'en redemander un par appel.
_JETON: tuple[str, float] = ("", 0.0)


def _b64(donnees: bytes) -> bytes:
    return base64.urlsafe_b64encode(donnees).rstrip(b"=")


def jeton() -> str:
    """Jeton OAuth du compte de service, gardé jusqu'à une minute de son expiration."""
    global _JETON
    if _JETON[0] and time.time() < _JETON[1] - 60:
        return _JETON[0]

    chemin_cle = pathlib.Path(KEY_PATH)
    if not chemin_cle.exists():
        raise SystemExit(f"Compte de service introuvable : {KEY_PATH}")
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
        jeton_recu = json.load(reponse)
    _JETON = (jeton_recu["access_token"], time.time() + jeton_recu.get("expires_in", 3600))
    return _JETON[0]


def _appel(methode: str, chemin: str, charge: dict | None = None) -> dict:
    donnees = json.dumps(charge).encode() if charge is not None else None
    entetes = {"Authorization": f"Bearer {jeton()}"}
    if donnees is not None:
        entetes["Content-Type"] = "application/json"
    requete = urllib.request.Request(API + chemin, data=donnees, headers=entetes, method=methode)
    try:
        corps = urllib.request.urlopen(requete, timeout=120).read()
        return json.loads(corps) if corps else {}
    except urllib.error.HTTPError as erreur:
        return {"erreur": erreur.code, "corps": erreur.read()[:800].decode(errors="replace")}


def get(chemin: str) -> dict:
    return _appel("GET", chemin)


def post(chemin: str, charge: dict | None = None) -> dict:
    return _appel("POST", chemin, charge)


def put(chemin: str, charge: dict) -> dict:
    return _appel("PUT", chemin, charge)


def supprime(chemin: str) -> dict:
    return _appel("DELETE", chemin)


def televerse(chemin: str, fichier: pathlib.Path, type_mime: str = "image/png") -> dict:
    """Envoi d'un média — l'hôte d'upload diffère de celui de l'API."""
    requete = urllib.request.Request(
        f"{UPLOAD}{chemin}?uploadType=media",
        data=fichier.read_bytes(),
        method="POST",
        headers={"Authorization": f"Bearer {jeton()}", "Content-Type": type_mime},
    )
    try:
        with urllib.request.urlopen(requete, timeout=600) as reponse:
            return json.load(reponse)
    except urllib.error.HTTPError as erreur:
        return {"erreur": erreur.code, "corps": erreur.read()[:800].decode(errors="replace")}


# — Éditions ——————————————————————————————————————————————————————————————


def ouvrir() -> str:
    ouverture = post(f"/applications/{PACKAGE}/edits")
    if "erreur" in ouverture:
        raise SystemExit(f"édition impossible : {ouverture['corps'][:300]}")
    return ouverture["id"]


def abandonner(edit: str) -> None:
    supprime(f"/applications/{PACKAGE}/edits/{edit}")


def commit(edit: str) -> str:
    """Commite l'édition et dit ce qui s'est passé, ou meurt en expliquant pourquoi."""
    resultat = post(f"/applications/{PACKAGE}/edits/{edit}:commit")
    if "erreur" not in resultat:
        return "enregistré"
    # Une app qui n'a jamais été relue refuse l'envoi automatique en validation.
    if "changesNotSentForReview" in resultat["corps"]:
        resultat = post(f"/applications/{PACKAGE}/edits/{edit}:commit?changesNotSentForReview=true")
        if "erreur" not in resultat:
            return "enregistré (changements non envoyés en validation)"
    raise SystemExit(f"commit refusé : {resultat['corps'][:600]}")
