#!/usr/bin/env python3
"""Publie sur l'App Store une version déjà approuvée.

Avec `releaseType: MANUAL`, l'approbation d'Apple ne met rien en ligne : la version s'arrête en
`PENDING_DEVELOPER_RELEASE` et attend un geste. Dans la console, ce geste est un bouton
« Release This Version » posé dans le bandeau d'état de la page **Distribution**, une fois la
version sélectionnée dans la colonne de gauche — pas sur la vue d'ensemble de l'app, pas sur
TestFlight. Le mail d'Apple qui annonce la validation ne le mentionne pas, et on peut chercher
longtemps un bouton qu'on croit absent.

En API, c'est un seul appel :

    export ASC_KEY_ID=... ASC_ISSUER_ID=...
    python3 docs/store/release-version.py --version 1.1.0

**La publication ne s'annule pas** : une version en ligne ne se retire qu'en sortant l'app de la
vente. Le script demande donc confirmation, sauf `--oui`.

Comme `submit-for-review.py`, il relit l'état après coup : `READY_FOR_SALE` est la seule preuve
que la version est partie.
"""

from __future__ import annotations

import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import asc  # noqa: E402

APP_ID = "6806288500"
# Le seul état depuis lequel il y a quelque chose à publier.
PUBLIABLE = "PENDING_DEVELOPER_RELEASE"
# États d'une version déjà en ligne : rien à faire, ce n'est pas une erreur.
EN_LIGNE = ("READY_FOR_SALE", "READY_FOR_DISTRIBUTION")


def version(numero: str) -> tuple[str, str]:
    """Identifiant et état de la version demandée."""
    for entree in asc.get(f"/v1/apps/{APP_ID}/appStoreVersions?limit=50").get("data", []):
        if entree["attributes"]["versionString"] == numero:
            return entree["id"], entree["attributes"]["appStoreState"]
    raise SystemExit(f"version {numero} introuvable")


def main() -> None:
    analyseur = argparse.ArgumentParser(description=__doc__)
    analyseur.add_argument("--version", required=True, help="numéro de version à publier")
    analyseur.add_argument(
        "--oui", action="store_true", help="publier sans demander confirmation"
    )
    arguments = analyseur.parse_args()

    identifiant, etat = version(arguments.version)
    print(f"version {arguments.version} : {etat}")

    if etat in EN_LIGNE:
        print("déjà en ligne — rien à faire.")
        return
    if etat != PUBLIABLE:
        raise SystemExit(
            f"état {etat} : la publication n'est possible qu'en {PUBLIABLE}. "
            "Tant qu'Apple n'a pas approuvé la version, il n'y a rien à mettre en ligne."
        )

    if not arguments.oui:
        reponse = input(f"publier {arguments.version} sur l'App Store ? c'est définitif [oui/n] ")
        if reponse.strip().lower() not in ("oui", "o"):
            raise SystemExit("annulé.")

    publication = asc.post("/v1/appStoreVersionReleaseRequests", {"data": {
        "type": "appStoreVersionReleaseRequests",
        "relationships": {
            "appStoreVersion": {"data": {"type": "appStoreVersions", "id": identifiant}}}}})
    if "erreur" in publication:
        raise SystemExit(f"publication refusée : {publication['corps'][:600]}")

    _, apres = version(arguments.version)
    print(f"état : {apres}")
    if apres not in EN_LIGNE:
        raise SystemExit(
            f"la version est restée en {apres} — la publication n'a pas pris, "
            "quoi qu'affiche la console."
        )
    print("en ligne. Le référencement met quelques heures à se propager sur les vitrines.")


if __name__ == "__main__":
    main()
