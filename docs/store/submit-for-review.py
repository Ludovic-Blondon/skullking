#!/usr/bin/env python3
"""Envoie une version en validation chez Apple.

Ce geste-là a coûté trois jours sur la 1.0 : dans la console, *Add for Review* fait passer
l'élément en `READY_FOR_REVIEW` et **n'envoie rien**. Il faut ensuite « Submit to App Review »
sur la page de soumission, pas sur celle de la version — deux boutons, deux pages, un seul qui
soumet. En API, la même chose s'écrit en trois appels, dont le dernier est celui qui compte :

1. une **soumission** pour l'app (`reviewSubmissions`) ;
2. un **élément** dedans, qui pointe la version (`reviewSubmissionItems`) ;
3. `submitted: true` sur la soumission — sans ça, rien ne part.

    export ASC_KEY_ID=... ASC_ISSUER_ID=...
    python3 docs/store/submit-for-review.py --version 1.1.0

Le script relit l'état après coup et le dit : une soumission qui reste sans `submittedDate`
n'est pas partie, quoi qu'affiche la console.
"""

from __future__ import annotations

import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import asc  # noqa: E402

APP_ID = "6806288500"
# Soumission en préparation : on peut la compléter, elle n'est encore jamais partie.
EN_PREPARATION = "READY_FOR_REVIEW"
# Soumission rejetée : elle porte déjà la `submittedDate` de son premier envoi, et c'est elle
# qu'Apple attend qu'on renvoie — en ouvrir une autre est refusé tant qu'elle reste ouverte.
REJETEE = "UNRESOLVED_ISSUES"
# Seuls états qui prouvent que la soumission est bien chez Apple.
PARTIES = ("WAITING_FOR_REVIEW", "IN_REVIEW")


def version_id(numero: str) -> str:
    for entree in asc.get(f"/v1/apps/{APP_ID}/appStoreVersions?limit=50").get("data", []):
        if entree["attributes"]["versionString"] == numero:
            print(f"version {numero} : {entree['attributes']['appStoreState']}")
            return entree["id"]
    raise SystemExit(f"version {numero} introuvable")


def soumission_ouverte() -> str | None:
    reponse = asc.get(
        f"/v1/apps/{APP_ID}/reviewSubmissions?filter%5Bplatform%5D=IOS&limit=20"
    ).get("data", [])
    for entree in reponse:
        attributs = entree["attributes"]
        etat = attributs.get("state")
        if etat == REJETEE or (etat == EN_PREPARATION and not attributs.get("submittedDate")):
            print(f"soumission déjà ouverte : {attributs.get('state')}")
            return entree["id"]
    return None


def main() -> None:
    analyseur = argparse.ArgumentParser(description=__doc__)
    analyseur.add_argument("--version", required=True, help="numéro de version à soumettre")
    arguments = analyseur.parse_args()

    version = version_id(arguments.version)

    soumission = soumission_ouverte()
    if soumission is None:
        creee = asc.post("/v1/reviewSubmissions", {"data": {
            "type": "reviewSubmissions",
            "attributes": {"platform": "IOS"},
            "relationships": {"app": {"data": {"type": "apps", "id": APP_ID}}}}})
        if "erreur" in creee:
            raise SystemExit(f"soumission impossible : {creee['corps'][:400]}")
        soumission = creee["data"]["id"]
        print(f"soumission créée : {soumission}")

    # Sans `include`, l'API ne renvoie pas la relation vers la version (vérifié le 03/10/2026) :
    # la version semblerait absente, et l'ajouter une seconde fois prendrait un 409.
    elements = asc.get(
        f"/v1/reviewSubmissions/{soumission}/items?include=appStoreVersion&limit=20"
    ).get("data", [])
    deja = any(
        (e.get("relationships", {}).get("appStoreVersion", {}).get("data") or {}).get("id")
        == version
        for e in elements
    )
    if deja:
        print("la version est déjà dans la soumission")
    else:
        ajout = asc.post("/v1/reviewSubmissionItems", {"data": {
            "type": "reviewSubmissionItems",
            "relationships": {
                "reviewSubmission": {"data": {"type": "reviewSubmissions", "id": soumission}},
                "appStoreVersion": {"data": {"type": "appStoreVersions", "id": version}}}}})
        if "erreur" in ajout:
            raise SystemExit(f"ajout de la version impossible : {ajout['corps'][:400]}")
        print("version ajoutée à la soumission")

    # Le seul appel qui envoie quoi que ce soit.
    envoi = asc.patch(f"/v1/reviewSubmissions/{soumission}", {"data": {
        "type": "reviewSubmissions", "id": soumission, "attributes": {"submitted": True}}})
    if "erreur" in envoi:
        raise SystemExit(f"envoi refusé : {envoi['corps'][:600]}")

    etat = asc.get(f"/v1/reviewSubmissions/{soumission}")["data"]["attributes"]
    print(f"état : {etat.get('state')} | envoyée le : {etat.get('submittedDate') or 'jamais'}")
    # La date seule ne prouve rien : une soumission rejetée garde celle de son premier envoi.
    if etat.get("state") not in PARTIES:
        raise SystemExit("la soumission n'est pas partie — c'est exactement le piège de la 1.0.")


if __name__ == "__main__":
    main()
