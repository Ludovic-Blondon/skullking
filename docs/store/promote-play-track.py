#!/usr/bin/env python3
"""Promeut une build d'une piste Play à une autre, et attache ses testeurs.

Le compte Play est un compte personnel créé après le 13/11/2023 : l'accès production demande
**12 testeurs inscrits pendant 14 jours continus** sur une piste de **test fermé**. La piste
interne ne compte pas — c'est le sens de ce script, qui fait passer en `alpha` (le nom d'API du
test fermé) une build déjà envoyée en `internal`, sans rebuild ni nouvel `eas submit`.

    python3 docs/store/promote-play-track.py --vers alpha --dry-run
    python3 docs/store/promote-play-track.py --vers alpha
    python3 docs/store/promote-play-track.py --vers alpha --groupe testeurs@googlegroups.com

Sans `--version-code`, c'est la build la plus récente de la piste d'origine qui part.

`--groupe` inscrit un **groupe Google** comme liste de testeurs de la piste : c'est la seule
forme de liste que l'API accepte (`edits.testers` ne connaît que `googleGroups`), et c'est aussi
la plus maniable — on ajoute et retire les gens dans le groupe sans repasser par la console. Les
adresses saisies une à une, elles, restent réservées à la console.

Ce que le script ne fait pas, parce que Google ne l'expose pas : dire **combien de testeurs sont
inscrits** ni **depuis quand**. Ce compteur ne se lit que dans la console, page Test fermé.
"""

from __future__ import annotations

import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import play  # noqa: E402

# Noms d'API des pistes, du moins ouvert au plus ouvert.
PISTES = ("internal", "alpha", "beta", "production")


def pistes(edit: str) -> dict[str, dict]:
    reponse = play.get(f"/applications/{play.PACKAGE}/edits/{edit}/tracks")
    if "erreur" in reponse:
        raise SystemExit(f"lecture des pistes : {reponse['corps'][:300]}")
    return {piste["track"]: piste for piste in reponse.get("tracks", [])}


def decrire(piste: dict) -> str:
    sorties = piste.get("releases", [])
    if not sorties:
        return "vide"
    return " · ".join(
        f"{sortie.get('name', '?')} (code {', '.join(sortie.get('versionCodes', []))}"
        f", {sortie.get('status', '?')})"
        for sortie in sorties
    )


def main() -> None:
    analyse = argparse.ArgumentParser(description=__doc__)
    analyse.add_argument("--depuis", default="internal", choices=PISTES, help="piste d'origine")
    analyse.add_argument("--vers", default="alpha", choices=PISTES, help="piste de destination")
    analyse.add_argument("--version-code", help="build à promouvoir (défaut : la plus récente)")
    analyse.add_argument("--groupe", help="groupe Google à inscrire comme testeurs de la piste")
    analyse.add_argument("--dry-run", action="store_true", help="montre, puis abandonne l'édition")
    analyse.add_argument("--oui", action="store_true", help="ne pas demander confirmation")
    options = analyse.parse_args()

    if PISTES.index(options.vers) <= PISTES.index(options.depuis):
        raise SystemExit(f"{options.vers} n'est pas plus ouverte que {options.depuis}")

    edit = play.ouvrir()
    etat = pistes(edit)
    for nom in PISTES:
        print(f"  {nom:11} {decrire(etat.get(nom, {}))}")

    sorties = etat.get(options.depuis, {}).get("releases", [])
    if not sorties:
        play.abandonner(edit)
        raise SystemExit(f"la piste {options.depuis} est vide : rien à promouvoir.")

    codes = sorted(
        (code for sortie in sorties for code in sortie.get("versionCodes", [])), key=int
    )
    code = options.version_code or codes[-1]
    if code not in codes:
        play.abandonner(edit)
        raise SystemExit(f"code {code} absent de {options.depuis} — présents : {', '.join(codes)}")
    nom_sortie = next(
        (s.get("name") or code for s in sorties if code in s.get("versionCodes", [])), code
    )

    deja = {
        code_present
        for sortie in etat.get(options.vers, {}).get("releases", [])
        for code_present in sortie.get("versionCodes", [])
    }
    if code in deja and not options.groupe:
        play.abandonner(edit)
        print(f"code {code} déjà en {options.vers} — rien à faire.")
        return

    print(f"\npromotion : {options.depuis} → {options.vers}, build {code} « {nom_sortie} »")
    if options.groupe:
        print(f"testeurs {options.vers} : {options.groupe}")

    if not options.dry_run and not options.oui:
        reponse = input(f"écrire dans la console Play ({options.vers}) ? [oui/n] ")
        if reponse.strip().lower() not in ("oui", "o"):
            play.abandonner(edit)
            raise SystemExit("annulé.")

    if code not in deja:
        # `completed` : la release est servie aux testeurs de la piste, sans déploiement progressif.
        ecriture = play.put(
            f"/applications/{play.PACKAGE}/edits/{edit}/tracks/{options.vers}",
            {
                "track": options.vers,
                "releases": [
                    {"name": nom_sortie, "versionCodes": [code], "status": "completed"}
                ],
            },
        )
        if "erreur" in ecriture:
            play.abandonner(edit)
            raise SystemExit(f"promotion refusée : {ecriture['corps'][:600]}")

    if options.groupe:
        testeurs = play.put(
            f"/applications/{play.PACKAGE}/edits/{edit}/testers/{options.vers}",
            {"googleGroups": [options.groupe]},
        )
        if "erreur" in testeurs:
            play.abandonner(edit)
            raise SystemExit(f"testeurs refusés : {testeurs['corps'][:600]}")

    if options.dry_run:
        play.abandonner(edit)
        print("essai à blanc : édition abandonnée, la console n'a pas bougé")
        return

    print(play.commit(edit))

    # Relire hors de l'édition : c'est la seule preuve que le commit a pris.
    controle = play.ouvrir()
    apres = pistes(controle)
    presents = {
        code_present
        for sortie in apres.get(options.vers, {}).get("releases", [])
        for code_present in sortie.get("versionCodes", [])
    }
    liste = play.get(f"/applications/{play.PACKAGE}/edits/{controle}/testers/{options.vers}")
    play.abandonner(controle)

    print(f"  {options.vers:11} {decrire(apres.get(options.vers, {}))}")
    print(f"  testeurs    {', '.join(liste.get('googleGroups', [])) or 'aucun'}")
    if code not in presents:
        raise SystemExit(f"la build {code} n'est pas en {options.vers} — le commit n'a pas pris.")
    if options.vers == "alpha" and not liste.get("googleGroups"):
        print(
            "\nLa piste est servie, mais personne ne peut s'y inscrire : attacher un\n"
            "groupe Google (--groupe) ou coller les adresses dans la console. Le lien\n"
            "d'inscription est ensuite\n"
            f"https://play.google.com/apps/testing/{play.PACKAGE}"
        )


if __name__ == "__main__":
    main()
