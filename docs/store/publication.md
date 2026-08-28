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

## Credentials

Le dossier `credentials/` est **gitignoré, donc absent d'un clone frais** : le recréer avec
`mkdir -p credentials`. Rien de ce qu'il contient ne doit être commité.

| Fichier                     | Quoi                                                        |
| --------------------------- | ----------------------------------------------------------- |
| `asc-api-key.p8`            | clé API App Store Connect, rôle **Admin**, onglet Team Keys |
| `play-service-account.json` | compte de service Google                                    |

La clé Apple se crée dans App Store Connect → Users and Access → Integrations → App Store Connect
API → **Team Keys**. Le rôle **Admin** est nécessaire : la clé ne sert pas qu'à `eas submit`, EAS
Build s'en sert pour créer et renouveler le certificat de distribution et le provisioning profile,
ce qu'App Manager ne permet pas. Le `.p8` ne se télécharge **qu'une fois** — perdu, il faut
révoquer la clé et en refaire une. Le compte de service Google se crée en suivant
https://expo.fyi/creating-google-service-account

## Authentification Apple

`eas.json` porte l'`ascApiKeyId`, l'`ascApiKeyIssuerId` et l'`ascAppId` : `eas submit -p ios` n'a
donc plus rien à demander. Pour un **build**, en revanche, EAS a besoin de la même clé par
l'environnement — sans quoi il réclame un identifiant Apple et un code 2FA :

```bash
export EXPO_ASC_API_KEY_PATH="$PWD/credentials/asc-api-key.p8"
export EXPO_ASC_KEY_ID=<KEY_ID>
export EXPO_ASC_ISSUER_ID=<ISSUER_ID>
export EXPO_APPLE_TEAM_ID=<TEAM_ID>
```

C'est avec ça qu'EAS crée et renouvelle le certificat de distribution et le provisioning profile,
qu'il garde ensuite côté serveur (`credentialsSource: remote`).

## Renouvellements

Rien à recopier des identifiants de credentials : ils vivent sur le serveur Expo et se relisent
à tout moment avec `eas credentials --platform ios`. **Seule la date d'expiration compte.**

| Échéance       | Quoi                                                           |
| -------------- | -------------------------------------------------------------- |
| **28/08/2027** | certificat de distribution iOS **et** provisioning profile     |
| **28/08/2027** | adhésion Apple Developer Program (99 $/an, à renouveler avant) |

À l'échéance, EAS refait le provisioning profile tout seul, mais le certificat de distribution
demande de repasser une fois en mode interactif — comme à la création. Une app déjà en ligne ne
tombe pas pour autant : un certificat expiré empêche de **signer de nouveaux builds**, il ne
désactive pas ce qui est déjà publié.

Apple n'accorde que **deux certificats de distribution** par compte. Ne pas en révoquer un à la
légère : les builds signés avec deviennent invalides.

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

Deux pièges d'`eas submit` rencontrés au premier envoi : `--what-to-test` (le changelog
TestFlight) est **réservé au plan Enterprise** et fait échouer la commande sur le plan gratuit ;
et `--auto-testflight-setup` ne fait rien tant que la clé App Store Connect n'est lue qu'en local
(« No complete App Store Connect credentials »), il faut alors créer le groupe de test interne à
la main dans App Store Connect.

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
