"""Client minimal de l'API App Store Connect.

Signature ES256 par `openssl` : ni PyJWT ni `cryptography` ne sont installés d'office sur macOS,
et une dépendance de plus pour trois lignes de crypto ne se justifiait pas.

Les identifiants viennent de l'environnement — ils n'ont rien à faire dans un dépôt public :

    export ASC_KEY_ID=...          # les 10 caractères du nom du fichier AuthKey_<KEY_ID>.p8
    export ASC_ISSUER_ID=...       # l'UUID en haut de Users and Access > Integrations
    export ASC_KEY_PATH=credentials/asc-api-key.p8   # optionnel, c'est la valeur par défaut
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import pathlib
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

RACINE = "https://api.appstoreconnect.apple.com"
KEY_ID = os.environ.get("ASC_KEY_ID", "")
ISSUER_ID = os.environ.get("ASC_ISSUER_ID", "")
KEY_PATH = os.environ.get("ASC_KEY_PATH", "credentials/asc-api-key.p8")


def _b64(donnees: bytes) -> bytes:
    return base64.urlsafe_b64encode(donnees).rstrip(b"=")


def _entier_der(brut: bytes, i: int) -> tuple[int, int]:
    longueur = brut[i + 1]
    return int.from_bytes(brut[i + 2 : i + 2 + longueur], "big"), i + 2 + longueur


def jeton() -> str:
    """JWT ES256 valable 15 minutes."""
    if not KEY_ID or not ISSUER_ID:
        raise SystemExit("ASC_KEY_ID et ASC_ISSUER_ID doivent être définis (voir l'en-tête).")
    if not pathlib.Path(KEY_PATH).exists():
        raise SystemExit(f"Clé introuvable : {KEY_PATH}")

    maintenant = int(time.time())
    entete = _b64(json.dumps({"alg": "ES256", "kid": KEY_ID, "typ": "JWT"}).encode())
    charge = _b64(
        json.dumps(
            {"iss": ISSUER_ID, "iat": maintenant, "exp": maintenant + 900,
             "aud": "appstoreconnect-v1"}
        ).encode()
    )
    signe = entete + b"." + charge

    with tempfile.NamedTemporaryFile(delete=False) as fichier:
        fichier.write(signe)
        chemin = fichier.name
    der = subprocess.run(
        ["openssl", "dgst", "-sha256", "-sign", KEY_PATH, "-binary", chemin],
        capture_output=True, check=True,
    ).stdout
    os.unlink(chemin)

    # DER (SEQUENCE de deux INTEGER) → r||s brut, ce qu'attend JOSE.
    i = 2 if der[1] < 0x80 else 3
    r, i = _entier_der(der, i)
    s, _ = _entier_der(der, i)
    return (signe + b"." + _b64(r.to_bytes(32, "big") + s.to_bytes(32, "big"))).decode()


def _appel(methode: str, chemin: str, charge: dict | None = None) -> dict:
    donnees = json.dumps(charge).encode() if charge is not None else None
    entetes = {"Authorization": f"Bearer {jeton()}"}
    if donnees is not None:
        entetes["Content-Type"] = "application/json"
    requete = urllib.request.Request(RACINE + chemin, data=donnees, headers=entetes, method=methode)
    try:
        corps = urllib.request.urlopen(requete, timeout=120).read()
        return json.loads(corps) if corps else {}
    except urllib.error.HTTPError as erreur:
        return {"erreur": erreur.code, "corps": erreur.read()[:800].decode(errors="replace")}


def get(chemin: str) -> dict:
    return _appel("GET", chemin)


def post(chemin: str, charge: dict) -> dict:
    return _appel("POST", chemin, charge)


def patch(chemin: str, charge: dict) -> dict:
    return _appel("PATCH", chemin, charge)


def supprime(chemin: str) -> tuple[bool, str]:
    resultat = _appel("DELETE", chemin)
    return ("erreur" not in resultat), resultat.get("corps", "supprimé")


def televerse(chemin_fichier: str, set_id: str, essais: int = 3) -> tuple[bool, str]:
    """Réserve, envoie et valide une capture d'écran.

    Un envoi interrompu laisserait une capture fantôme en `AWAITING_UPLOAD`, qui bloque la
    soumission sans rien dire : on la supprime plutôt que de la laisser traîner.
    """
    octets = pathlib.Path(chemin_fichier).read_bytes()
    reservation = post("/v1/appScreenshots", {"data": {
        "type": "appScreenshots",
        "attributes": {"fileSize": len(octets), "fileName": os.path.basename(chemin_fichier)},
        "relationships": {"appScreenshotSet": {
            "data": {"type": "appScreenshotSets", "id": set_id}}}}})
    if "erreur" in reservation:
        return False, f"réservation : {reservation['corps'][:200]}"

    identifiant = reservation["data"]["id"]
    for operation in reservation["data"]["attributes"]["uploadOperations"]:
        morceau = octets[operation["offset"] : operation["offset"] + operation["length"]]
        for tentative in range(essais):
            requete = urllib.request.Request(
                operation["url"], data=morceau, method=operation["method"]
            )
            for entete in operation.get("requestHeaders", []):
                requete.add_header(entete["name"], entete["value"])
            try:
                urllib.request.urlopen(requete, timeout=600)
                break
            except Exception as erreur:  # réseau : on retente avant d'abandonner
                if tentative == essais - 1:
                    supprime(f"/v1/appScreenshots/{identifiant}")
                    return False, f"envoi ({essais} essais) : {erreur}"
                time.sleep(3)

    validation = patch(f"/v1/appScreenshots/{identifiant}", {"data": {
        "type": "appScreenshots", "id": identifiant,
        "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(octets).hexdigest()}}})
    if "erreur" in validation:
        supprime(f"/v1/appScreenshots/{identifiant}")
        return False, f"validation : {validation['corps'][:200]}"
    return True, validation["data"]["attributes"].get("assetDeliveryState", {}).get("state", "?")
