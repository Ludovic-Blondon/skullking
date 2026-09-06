#!/usr/bin/env python3
"""Remplit la fiche App Store d'une version depuis le dépôt.

Reprend ce que les fichiers `docs/store/*.md` disent déjà, plutôt que de le recopier à la main
dans quatre formulaires : textes, nom, sous-titre, catégories, captures des trois formats
d'appareil, et rattachement du dernier build.

Le script est **idempotent** : il ne recrée pas ce qui existe et ne renvoie pas une capture déjà
présente. On peut le relancer après un échec réseau.

    export ASC_KEY_ID=... ASC_ISSUER_ID=...
    python3 docs/store/publish-listing.py            # version modifiable en cours
    python3 docs/store/publish-listing.py --version 1.1

Sur une mise à jour, il pousse en plus deux champs qui repartent vides à chaque version :
« Nouveautés » (section finale de `docs/store/*.md`) et les **notes de vérification**
(`docs/store/review-notes.md`). Les oublier, c'est le rejet *Guideline 2.1* de la 1.0.

Une version demandée par `--version` qui n'existe pas encore est créée.

Ce qu'il ne fait **pas**, volontairement : la confidentialité, la classification d'âge et le
statut de commerçant DSA. Ce sont des déclarations dont le développeur répond devant Apple, et
l'API ne les expose pas toutes.
"""

from __future__ import annotations

import argparse
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import asc  # noqa: E402

APP_ID = "6806288500"
SUPPORT_URL = "https://github.com/Ludovic-Blondon/skullking/issues"
PRIVACY_URL = "https://ludovic-blondon.github.io/skullking/privacy/"
COPYRIGHT = "2026 Ludovic Blondon"

RACINE = pathlib.Path(__file__).resolve().parents[2]
LOCALES = {"fr": "fr-FR", "en": "en-US", "es": "es-ES", "de": "de-DE"}
# Les intitulés des fiches changent de langue, leur ordre non.
CHAMPS = ["nom", "sous_titre", "play_court", "promo", "description", "mots_cles", "nouveautes"]
# Dossier de captures → type d'appareil App Store. Le 13" est exigé pour soumettre ; le
# 1668 × 2420 du 11" y est rejeté en IMAGE_INCORRECT_DIMENSIONS.
APPAREILS = {
    "phone": "APP_IPHONE_67",
    "tablet-10": "APP_IPAD_PRO_3GEN_11",
    "tablet-13": "APP_IPAD_PRO_3GEN_129",
}


def fiche(langue: str) -> dict[str, str]:
    texte = (RACINE / f"docs/store/{langue}.md").read_text(encoding="utf-8")
    blocs = re.split(r"^## .*$", texte, flags=re.M)[1:]
    valeurs = {}
    for nom, bloc in zip(CHAMPS, blocs):
        corps = bloc.strip()
        valeurs[nom] = corps if nom == "description" else " ".join(corps.split())
    return valeurs


def version_cible(demandee: str | None) -> str:
    reponse = asc.get(f"/v1/apps/{APP_ID}/appStoreVersions?limit=20")
    for entree in reponse.get("data", []):
        attributs = entree["attributes"]
        modifiable = attributs["appStoreState"] in (
            "PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED",
        )
        if demandee and attributs["versionString"] == demandee:
            return entree["id"]
        if not demandee and modifiable:
            print(f"version {attributs['versionString']} ({attributs['appStoreState']})")
            return entree["id"]

    if not demandee:
        raise SystemExit("aucune version modifiable trouvée")

    # Une version demandée qui n'existe pas encore se crée : c'est le premier geste
    # d'une mise à jour, et il n'y a rien à décider dedans.
    creee = asc.post("/v1/appStoreVersions", {"data": {
        "type": "appStoreVersions",
        "attributes": {"platform": "IOS", "versionString": demandee},
        "relationships": {"app": {"data": {"type": "apps", "id": APP_ID}}}}})
    if "erreur" in creee:
        raise SystemExit(f"création de la version {demandee} impossible : {creee['corps'][:300]}")
    print(f"version {demandee} créée")
    return creee["data"]["id"]


def deja_publiee() -> bool:
    """Vrai si l'app a déjà une version en ligne.

    Apple **refuse** `whatsNew` sur une première version — il n'y a rien de neuf à
    raconter — et l'**exige** sur une mise à jour. C'est ce test qui tranche.
    """
    versions = asc.get(f"/v1/apps/{APP_ID}/appStoreVersions?limit=50").get("data", [])
    return any(v["attributes"]["appStoreState"] in (
        "READY_FOR_SALE", "PENDING_DEVELOPER_RELEASE", "PROCESSING_FOR_APP_STORE",
        "REPLACED_WITH_NEW_INFO",
    ) for v in versions)


def textes(version: str, nouveautes: bool) -> None:
    existantes = {
        d["attributes"]["locale"]: d["id"]
        for d in asc.get(
            f"/v1/appStoreVersions/{version}/appStoreVersionLocalizations?limit=20"
        ).get("data", [])
    }
    for langue, locale in LOCALES.items():
        v = fiche(langue)
        attributs = {
            "description": v["description"], "keywords": v["mots_cles"],
            "promotionalText": v["promo"], "supportUrl": SUPPORT_URL,
        }
        if nouveautes:
            attributs["whatsNew"] = v["nouveautes"]
        if locale in existantes:
            reponse = asc.patch(f"/v1/appStoreVersionLocalizations/{existantes[locale]}", {
                "data": {"type": "appStoreVersionLocalizations", "id": existantes[locale],
                         "attributes": attributs}})
        else:
            reponse = asc.post("/v1/appStoreVersionLocalizations", {
                "data": {"type": "appStoreVersionLocalizations",
                         "attributes": {"locale": locale, **attributs},
                         "relationships": {"appStoreVersion": {
                             "data": {"type": "appStoreVersions", "id": version}}}}})
        print(f"  texte {locale} :", "ERREUR " + reponse["corps"][:160]
              if "erreur" in reponse else "ok")


def identite() -> None:
    """Nom, sous-titre, politique de confidentialité, catégories."""
    info = asc.get(f"/v1/apps/{APP_ID}/appInfos?limit=5")["data"][0]["id"]
    existantes = {
        d["attributes"]["locale"]: d["id"]
        for d in asc.get(f"/v1/appInfos/{info}/appInfoLocalizations?limit=20").get("data", [])
    }
    for langue, locale in LOCALES.items():
        v = fiche(langue)
        attributs = {"name": v["nom"], "subtitle": v["sous_titre"], "privacyPolicyUrl": PRIVACY_URL}
        if locale in existantes:
            reponse = asc.patch(f"/v1/appInfoLocalizations/{existantes[locale]}", {
                "data": {"type": "appInfoLocalizations", "id": existantes[locale],
                         "attributes": attributs}})
        else:
            reponse = asc.post("/v1/appInfoLocalizations", {
                "data": {"type": "appInfoLocalizations",
                         "attributes": {"locale": locale, **attributs},
                         "relationships": {"appInfo": {
                             "data": {"type": "appInfos", "id": info}}}}})
        print(f"  identité {locale} :", "ERREUR " + reponse["corps"][:160]
              if "erreur" in reponse else "ok")

    reponse = asc.patch(f"/v1/appInfos/{info}", {"data": {
        "type": "appInfos", "id": info, "relationships": {
            "primaryCategory": {"data": {"type": "appCategories", "id": "UTILITIES"}},
            "secondaryCategory": {"data": {"type": "appCategories", "id": "GAMES"}}}}})
    print("  catégories :", "ERREUR " + reponse["corps"][:160]
          if "erreur" in reponse else "Utilitaires + Jeux")


def captures(version: str) -> None:
    locales = {
        d["attributes"]["locale"]: d["id"]
        for d in asc.get(
            f"/v1/appStoreVersions/{version}/appStoreVersionLocalizations?limit=20"
        )["data"]
    }
    for langue, locale in LOCALES.items():
        jeux = asc.get(
            f"/v1/appStoreVersionLocalizations/{locales[locale]}/appScreenshotSets?limit=20"
        ).get("data", [])
        for dossier, appareil in APPAREILS.items():
            source = RACINE / f"docs/store/screenshots/{dossier}/{langue}"
            if not source.is_dir():
                continue
            jeu = next((j["id"] for j in jeux
                        if j["attributes"]["screenshotDisplayType"] == appareil), None)
            if jeu is None:
                jeu = asc.post("/v1/appScreenshotSets", {"data": {
                    "type": "appScreenshotSets",
                    "attributes": {"screenshotDisplayType": appareil},
                    "relationships": {"appStoreVersionLocalization": {
                        "data": {"type": "appStoreVersionLocalizations",
                                 "id": locales[locale]}}}}})["data"]["id"]

            presentes = asc.get(f"/v1/appScreenshotSets/{jeu}/appScreenshots?limit=20").get("data", [])
            # Une capture incomplète bloque la soumission en silence : on la refait.
            noms = set()
            for capture in presentes:
                etat = capture["attributes"].get("assetDeliveryState", {}).get("state")
                if etat == "COMPLETE":
                    noms.add(capture["attributes"]["fileName"])
                else:
                    asc.supprime(f"/v1/appScreenshots/{capture['id']}")

            for image in sorted(source.glob("*.png")):
                if image.name in noms:
                    continue
                ok, message = asc.televerse(str(image), jeu)
                if not ok:
                    print(f"    {locale} {dossier} {image.name} ÉCHEC — {message}")

            tout = asc.get(f"/v1/appScreenshotSets/{jeu}/appScreenshots?limit=20").get("data", [])
            ordre = sorted(tout, key=lambda c: c["attributes"]["fileName"])
            asc.patch(f"/v1/appScreenshotSets/{jeu}/relationships/appScreenshots",
                      {"data": [{"type": "appScreenshots", "id": c["id"]} for c in ordre]})
            print(f"  captures {locale} {dossier:9} : {len(ordre)}")


def build_et_conformite(version: str, contact: dict[str, str] | None) -> None:
    reponse = asc.patch(f"/v1/appStoreVersions/{version}", {"data": {
        "type": "appStoreVersions", "id": version,
        # MANUEL : une première mise en ligne ne se déclenche pas à 3 h du matin.
        "attributes": {"copyright": COPYRIGHT, "releaseType": "MANUAL"}}})
    print("  copyright + publication manuelle :",
          "ERREUR " + reponse["corps"][:160] if "erreur" in reponse else "ok")

    reponse = asc.patch(f"/v1/apps/{APP_ID}", {"data": {
        "type": "apps", "id": APP_ID,
        "attributes": {"contentRightsDeclaration": "DOES_NOT_USE_THIRD_PARTY_CONTENT"}}})
    print("  droits contenu :", "ERREUR " + reponse["corps"][:160]
          if "erreur" in reponse else "aucun contenu tiers")

    # Trié explicitement : sans `sort`, l'ordre des builds n'est pas garanti, et attacher
    # celui de la version précédente à une mise à jour ne se verrait qu'au rejet.
    builds = asc.get(
        f"/v1/builds?filter%5Bapp%5D={APP_ID}&limit=1&sort=-uploadedDate"
    ).get("data", [])
    valides = [b for b in builds if b["attributes"].get("processingState") == "VALID"]
    if valides:
        reponse = asc.patch(f"/v1/appStoreVersions/{version}", {"data": {
            "type": "appStoreVersions", "id": version,
            "relationships": {"build": {"data": {"type": "builds", "id": valides[0]["id"]}}}}})
        print(f"  build {valides[0]['attributes']['version']} :",
              "ERREUR " + reponse["corps"][:160] if "erreur" in reponse else "attaché")
    else:
        print("  build : aucun build VALID à attacher")

    verification(version, contact)


def verification(version: str, contact: dict[str, str] | None) -> None:
    """Notes de vérification — attachées à la **version**, donc à réécrire à chaque fois.

    Les laisser vides, ou les réduire à deux phrases, c'est le rejet *Guideline 2.1* qui a
    coûté trois jours sur la 1.0. Elles vivent dans `docs/store/review-notes.md`.
    """
    source = RACINE / "docs/store/review-notes.md"
    notes = re.split(r"^## .*$", source.read_text(encoding="utf-8"), flags=re.M)[1].strip()

    attributs = {"notes": notes, "demoAccountRequired": False}
    if contact:
        attributs.update(contact)

    existant = asc.get(f"/v1/appStoreVersions/{version}/appStoreReviewDetail").get("data")
    if existant:
        reponse = asc.patch(f"/v1/appStoreReviewDetails/{existant['id']}", {"data": {
            "type": "appStoreReviewDetails", "id": existant["id"], "attributes": attributs}})
    else:
        reponse = asc.post("/v1/appStoreReviewDetails", {"data": {
            "type": "appStoreReviewDetails", "attributes": attributs,
            "relationships": {"appStoreVersion": {
                "data": {"type": "appStoreVersions", "id": version}}}}})
    print(f"  notes de vérification ({len(notes)} car.) :",
          "ERREUR " + reponse["corps"][:200] if "erreur" in reponse else "ok")


def main() -> None:
    analyseur = argparse.ArgumentParser(description=__doc__)
    analyseur.add_argument("--version", help="numéro de version ; par défaut, celle en préparation")
    analyseur.add_argument("--prenom"), analyseur.add_argument("--nom")
    analyseur.add_argument("--telephone"), analyseur.add_argument("--email")
    arguments = analyseur.parse_args()

    contact = None
    if all([arguments.prenom, arguments.nom, arguments.telephone, arguments.email]):
        contact = {"contactFirstName": arguments.prenom, "contactLastName": arguments.nom,
                   "contactPhone": arguments.telephone, "contactEmail": arguments.email}

    nouveautes = deja_publiee()
    version = version_cible(arguments.version)
    textes(version, nouveautes)
    identite()
    captures(version)
    build_et_conformite(version, contact)
    if not nouveautes:
        print("\nPremière version : « Nouveautés » non envoyé, Apple le refuse à ce stade.")
    print("\nRestent à la main dans App Store Connect : confidentialité, classification d'âge, "
          "statut de commerçant DSA.")


if __name__ == "__main__":
    main()
