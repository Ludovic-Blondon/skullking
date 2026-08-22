# Fiches stores

Un fichier par langue (`fr`, `en`, `es`, `de`), à recopier dans App Store Connect et dans la
Play Console. Chaque fiche donne les champs des deux plateformes, avec la limite de caractères
en regard — les textes sont écrits pour tenir dedans.

Communs aux quatre langues :

| Champ                        | Valeur                                                             |
| ---------------------------- | ------------------------------------------------------------------ |
| Nom                          | Skull Scores                                                       |
| Bundle / package             | `com.lblondon.skullscores`                                         |
| Catégorie App Store          | Utilitaires (secondaire : Jeux)                                    |
| Catégorie Play               | Outils                                                             |
| Classification d'âge         | 4+ / Tout public                                                   |
| Prix                         | Gratuit, sans achat intégré, sans publicité                        |
| Politique de confidentialité | https://ludovic-blondon.github.io/skullking/privacy/               |
| URL d'assistance             | https://github.com/Ludovic-Blondon/skullking/issues                |
| Collecte de données          | Aucune — « Data Not Collected » (Apple), Data Safety vide (Google) |

**Vérifié le 22/08/2026** : GitHub Pages est actif (branche `main`, dossier `/docs`) et l'URL de
la politique répond. Le dépôt étant passé public, le lien d'assistance vers les issues est
accessible à tous — une adresse e-mail dédiée n'est plus nécessaire.

## Captures d'écran

Trois jeux, quatre langues chacun, six écrans par langue — 72 images :

| Dossier                  | Appareil            | Taille      | Sert à                             |
| ------------------------ | ------------------- | ----------- | ---------------------------------- |
| `screenshots/phone/`     | iPhone 17 Pro Max   | 1320 × 2868 | App Store 6,9" · Play téléphone    |
| `screenshots/tablet-7/`  | iPad mini (A17 Pro) | 1488 × 2266 | Play tablette 7"                   |
| `screenshots/tablet-10/` | iPad Pro 11" (M5)   | 1668 × 2420 | Play tablette 10" · App Store iPad |

Les six écrans, dans l'ordre :

1. `1-accueil` — la partie en cours, reprenable d'un geste
2. `2-resultats` — saisie des plis, avec un bonus de capture sur la ligne de Lou
3. `3-annonces` — saisie des annonces, la somme contrôlée en bas
4. `4-feuille` — la feuille de score complète
5. `5-podium` — fin de partie : podium, palmarès, classement
6. `6-stats` — records et classement all-time

Le **mode sombre** est le mode de référence (PLAN.md §13.5).

### Les refaire

```bash
python3 docs/store/demo-data.py     # écrit skull-scores-demo.json
```

Déposer ce fichier dans le simulateur (`.../data/Containers/Shared/AppGroup/<groupe
group.com.apple.FileProvider.LocalStorage>/File Provider Storage/`), l'importer depuis
Réglages → Importer, puis, pour chaque langue :

```bash
maestro test -e LANGUE=Español .maestro/05-captures-stores.yaml
```

Les PNG sortent dans le dossier du run Maestro, sous des noms fixes. Sur iPad, le sélecteur de
fichiers a une barre latérale au lieu d'onglets : « Sur mon iPad » se touche par coordonnées.

**Deux choses à savoir avant d'envoyer** :

- Sur iPad, l'écran de fin de partie est présenté en feuille modale : la capture `5-podium`
  laisse voir une bande de l'écran de partie en haut. Rien d'anormal — c'est ce que voit un
  joueur — mais si ça gêne, la fiche tablette peut se passer de cette image.
- La capture `3-annonces` montre la bannière ambre « table sous-annoncée ». C'est volontaire :
  elle donne à voir le contrôle de somme, qui est un argument de l'app.

**Reste à produire** : le format 6,5" si l'App Store le réclame encore pour les anciens iPhone.
