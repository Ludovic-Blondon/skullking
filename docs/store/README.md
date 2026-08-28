# Fiches stores

Un fichier par langue (`fr`, `en`, `es`, `de`), à recopier dans App Store Connect et dans la
Play Console. Chaque fiche donne les champs des deux plateformes, avec la limite de caractères
en regard — les textes sont écrits pour tenir dedans.

La chaîne de build et de soumission est décrite dans [`publication.md`](./publication.md).

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

Le JSON de démonstration est **commité** (`skull-scores-demo.json`) : le regénérer tire une
nouvelle graine, et le moteur refuse certaines combinaisons de bonus (une graine qui tire
« sirène capture le Skull King » _et_ « Skull King capture un pirate » dans la même manche
affiche une bannière rouge). Ne relancer `python3 docs/store/demo-data.py` que pour changer
volontairement le jeu de données.

L'import passe par le sélecteur de fichiers iOS, qui est l'étape pénible. **Ne la faire qu'une
fois** : la base obtenue se recopie ensuite dans les autres simulateurs.

1. Déposer le JSON dans le simulateur, sous le groupe `group.com.apple.FileProvider.LocalStorage`
   — il y a plusieurs dossiers `File Provider Storage`, c'est bien celui-là :

   ```bash
   DEV=~/Library/Developer/CoreSimulator/Devices/<UDID>
   for d in "$DEV/data/Containers/Shared/AppGroup"/*/; do
     id=$(/usr/libexec/PlistBuddy -c "Print :MCMMetadataIdentifier" \
       "$d/.com.apple.mobile_container_manager.metadata.plist" 2>/dev/null)
     [ "$id" = "group.com.apple.FileProvider.LocalStorage" ] && \
       cp docs/store/skull-scores-demo.json "$d/File Provider Storage/"
   done
   ```

2. Réglages → Importer → Explorer → « Sur mon iPhone » → le fichier → Remplacer. Le fichier
   n'est visible que sous « Explorer », jamais sous « Récents ». Son libellé n'est pas
   sélectionnable : c'est **l'icône** qu'il faut toucher.

3. Garder la base obtenue de côté — c'est la graine des deux autres appareils :

   ```bash
   cp "$(xcrun simctl get_app_container <UDID> com.lblondon.skullscores \
     data)/Documents/SQLite/skullking.db" /tmp/seed.db
   ```

Pour les deux iPad, ni rebuild ni import : le `.app` construit pour le simulateur s'installe tel
quel (`supportsTablet`), et la base se pose à la main. App éteinte pendant la copie, et supprimer
les `-wal` / `-shm` qui traînent.

```bash
xcrun simctl shutdown all && xcrun simctl boot <UDID>
xcrun simctl install <UDID> ~/Library/Developer/Xcode/DerivedData/SkullScores-*/Build/Products/Release-iphonesimulator/SkullScores.app
xcrun simctl launch <UDID> com.lblondon.skullscores && sleep 8
xcrun simctl terminate <UDID> com.lblondon.skullscores
cp /tmp/seed.db "$(xcrun simctl get_app_container <UDID> com.lblondon.skullscores data)/Documents/SQLite/skullking.db"
xcrun simctl ui <UDID> appearance dark
```

Un seul simulateur démarré à la fois : Maestro vise celui qui est _booted_. Puis, pour chaque
langue (`Français`, `English`, `Español`, `Deutsch`) :

```bash
export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"   # Maestro veut le JDK Homebrew, keg-only
maestro test -e LANGUE=Español .maestro/05-captures-stores.yaml
```

Les six PNG sortent sous des noms fixes dans
`~/.maestro/tests/<horodatage>/05-captures-stores/takeScreenshot/`, à ranger dans le dossier de
la langue. La langue est stockée en base : elle survit à la copie de la graine.

**Deux choses à savoir avant d'envoyer** :

- Sur iPad, la fin de partie et la feuille de score sont présentées en feuille modale : les
  captures `5-podium` et `4-feuille` laissent voir une bande de l'écran de partie en haut. Rien
  d'anormal — c'est ce que voit un joueur — mais si ça gêne, la fiche tablette peut se passer de
  ces images.
- La capture `3-annonces` montre la bannière ambre « table sous-annoncée ». C'est volontaire :
  elle donne à voir le contrôle de somme, qui est un argument de l'app.

**Reste à produire** : le format 6,5" si l'App Store le réclame encore pour les anciens iPhone.

## Bandeau Play

Le « feature graphic » **1024 × 500** est obligatoire sur une fiche Play — sans lui, impossible de
soumettre. Quatre images dans `feature-graphic/`, une par langue : seules les trois puces
d'arguments changent, le reste est identique.

Il reprend l'identité de l'app plutôt qu'un montage : la marque au crâne redessinée en SVG depuis
`assets/images/icon.png`, la palette du mode sombre de `src/global.css`, les fontes Outfit de
`node_modules`, et un fragment de feuille de score avec les joueurs des captures — les nombres se
lisent dans les quatre langues.

Pour les refaire :

```bash
python3 docs/store/feature-graphic.py
```

Le script rend la page dans Chrome en mode headless puis aplatit en **PNG 24 bits** : Play refuse
la transparence, et la capture Chrome sort en RGBA.

Deux choses à savoir : le centre de l'image tombe sur le mot « Scores », donc si une vidéo
promotionnelle est ajoutée un jour, le bouton de lecture que Play superpose se posera dessus — il
faudra décaler le bloc de gauche. Et l'allemand est la langue la plus large : c'est elle qui fixe
la limite avant que les puces ne touchent la carte.
