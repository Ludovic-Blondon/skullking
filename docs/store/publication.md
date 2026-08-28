# Publication

Distribution par **EAS Build** (le prebuild se fait sur le serveur : `/ios` et `/android` restent
ignorés) et **EAS Submit**. Les profils sont dans `eas.json` ; les textes et captures à recopier
dans les consoles sont dans [`README.md`](./README.md).

```bash
npm install --global eas-cli
eas login
eas init   # écrit extra.eas.projectId dans app.json — à committer
```

`eas init` est la seule étape qui manque au dépôt : elle demande un compte Expo, donc elle n'a pas
pu être faite d'avance. Tant qu'elle n'est pas passée, `appVersionSource: "remote"` n'a pas de
projet où stocker les numéros de build.

## Profils de build

| Profil       | Sortie                      | Sert à                                    |
| ------------ | --------------------------- | ----------------------------------------- |
| `preview`    | APK Android, IPA ad hoc iOS | dépanner un testeur hors des pistes store |
| `production` | AAB Android, IPA App Store  | tout ce qui part en console               |

Il n'y a pas de profil `development` : le quotidien passe par `expo run:ios` / `expo run:android`,
et un build EAS de développement exigerait `expo-dev-client`, qui n'est pas une dépendance.

`production` fixe `ios.image: "latest"` pour builder avec Xcode 26 (exigence Apple depuis avril 2026) et `autoIncrement` pour que le `buildNumber` / `versionCode` monte tout seul — la `version`
lisible, elle, reste tenue à la main dans `app.json`.

## À remplir avant la première soumission

Trois valeurs sont des marqueurs `REMPLACER_...` dans `eas.json` :

| Champ         | Où le trouver                                                        |
| ------------- | -------------------------------------------------------------------- |
| `appleId`     | l'e-mail du compte Apple Developer                                   |
| `ascAppId`    | App Store Connect → l'app → General → App Information → **Apple ID** |
| `appleTeamId` | developer.apple.com → Membership                                     |

L'app doit donc exister dans App Store Connect (bundle `com.lblondon.skullscores`) **avant** le
premier `eas submit`.

Côté Google, le fichier de compte de service se dépose en `credentials/play-service-account.json`
(dossier gitignoré, la clé ne doit jamais être commitée) — procédure :
https://expo.fyi/creating-google-service-account

## L'ordre, et pourquoi

Le compte Play est un compte **personnel créé après le 13/11/2023** : il faut **12 testeurs
inscrits pendant 14 jours continus** sur une piste de **test fermé** avant de pouvoir demander
l'accès production. La piste _interne_ ne compte pas, Google vérifie que les testeurs ont
réellement ouvert l'app, et un désistement en cours de route remet le compteur à zéro. C'est le
chemin critique : Google d'abord, Apple en parallèle.

```bash
eas build --platform all --profile production
eas submit --platform android          # piste interne, release en brouillon
eas submit --platform ios              # → TestFlight
```

La release interne se promeut ensuite en test fermé depuis la Play Console, sans rebuild : c'est
ce passage qui démarre les 14 jours.

## Conformité

- **Confidentialité** : « Data Not Collected » (Apple), formulaire Data Safety vide (Google).
  Politique en ligne : https://ludovic-blondon.github.io/skullking/privacy/
- **Statut de commerçant DSA** : à déclarer **non-commerçant** sur les deux consoles. Sans cette
  déclaration, Apple retire l'app des vitrines de l'Union européenne.
- **Classification d'âge** : questionnaire IARC (Google), 4+ (Apple).
- **Conformité export** : `ITSAppUsesNonExemptEncryption: false` est dans `app.json`, ce qui évite
  la question à chaque upload — l'app ne chiffre rien.

## Reste à produire

Le **bandeau de la fiche Play (« feature graphic »), 1024 × 500** : obligatoire, et absent du
dépôt. L'icône 1024 × 1024 (`assets/images/icon.png`) et les captures, elles, sont prêtes.
