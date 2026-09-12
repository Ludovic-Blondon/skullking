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

## Variante « dev », pour tester à côté de l'app publiée

Un build de test porte par défaut l'identifiant de l'app publiée : sur un téléphone qui a déjà
l'app du store, il la **remplace**, base de données comprise. `app.config.js` lève ce conflit en
donnant à la variante son propre identifiant, son propre nom et son propre scheme — deux apps,
deux conteneurs, deux historiques.

```bash
APP_VARIANT=dev npx expo prebuild -p ios --clean
xcodebuild -workspace ios/SkullScoresdev.xcworkspace -scheme SkullScoresdev \
  -configuration Release -destination "id=<UDID de l'iPhone>" \
  -allowProvisioningUpdates CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=5TGLY9NLV5 build
xcrun devicectl device install app --device <identifiant devicectl> \
  ~/Library/Developer/Xcode/DerivedData/SkullScoresdev-*/Build/Products/Release-iphoneos/SkullScoresdev.app
```

Sans `APP_VARIANT`, `app.config.js` renvoie `app.json` mot pour mot : les builds de production ne
le voient pas passer. Le dossier `ios/`, lui, garde l'identité du dernier `prebuild` — repasser un
`prebuild` **sans** la variable avant de fabriquer un build destiné au store.

La base de la variante est vide au départ : pour tester sur de vraies parties, exporter la
sauvegarde JSON depuis les Réglages de l'app publiée et l'importer dans la variante.

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
export EXPO_ASC_KEY_ID=<KEY_ID>          # les 10 caractères de AuthKey_<KEY_ID>.p8
export EXPO_ASC_ISSUER_ID=<ISSUER_ID>    # l'UUID en haut de Users and Access > Integrations
export EXPO_APPLE_TEAM_ID=<TEAM_ID>      # developer.apple.com > Membership
```

**Ces valeurs ne sont pas dans le dépôt, et ne doivent pas y entrer** : il est public. Seul
l'`ascAppId` reste dans `eas.json`, il est de toute façon dans l'URL App Store de l'app. Le plus
simple est de garder un `credentials/asc.env` — le dossier est gitignoré — et de le sourcer :

```bash
source credentials/asc.env
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

## Remplir la fiche sans formulaire

Deux scripts évitent de recopier à la main, en quatre langues, ce que le dépôt sait déjà :

| Fichier              | Rôle                                                              |
| -------------------- | ----------------------------------------------------------------- |
| `asc.py`             | client de l'API App Store Connect (JWT ES256 signé par `openssl`) |
| `publish-listing.py` | remplit une version depuis `docs/store/`                          |

```bash
export ASC_KEY_ID=... ASC_ISSUER_ID=...
python3 docs/store/publish-listing.py          # la version en préparation
python3 docs/store/publish-listing.py --version 1.1
```

Il écrit les descriptions, mots-clés et textes promotionnels des quatre langues, le nom, le
sous-titre, la politique de confidentialité, les catégories, les **72 captures** des trois formats
d'appareil, le copyright, la publication en manuel, la déclaration de contenu tiers, et attache le
dernier build `VALID`. Il est **idempotent** : relançable après un échec réseau, il ne renvoie pas
ce qui est déjà en place et refait toute capture restée incomplète — une capture en
`AWAITING_UPLOAD` bloque la soumission sans le dire.

Les coordonnées de vérification s'ajoutent au premier passage :

```bash
python3 docs/store/publish-listing.py --prenom Ludovic --nom Blondon \
  --telephone +33XXXXXXXXX --email ...
```

### La fiche Play

```bash
python3 docs/store/publish-play-listing.py --dry-run   # montre, ne commite pas
python3 docs/store/publish-play-listing.py             # écrit la fiche
```

Le pendant Google du script ci-dessus : mêmes sources (`docs/store/*.md`, `screenshots/`,
`feature-graphic/`), recopiées dans les quatre fiches de langue. Il efface les images d'un type
avant de les renvoyer, donc il se relance sans empiler de doublons. L'icône du dépôt fait
1024 px, Play en veut 512 : le script la redimensionne à la volée (`sips`). Le client de l'API,
jeton RS256 compris, est dans `play.py` — le pendant Google d'`asc.py`, partagé avec
`promote-play-track.py`.

Ce qu'il ne fait pas, et qui n'est pas un oubli : **créer l'application** — l'API Play n'a aucun
appel pour ça, c'est la console qui la crée —, et les déclarations **Data Safety**,
**classification d'âge IARC**, **public cible** et **statut de commerçant DSA**.

### Promouvoir en test fermé

```bash
python3 docs/store/promote-play-track.py --vers alpha --dry-run
python3 docs/store/promote-play-track.py --vers alpha
python3 docs/store/promote-play-track.py --vers alpha --groupe <groupe>@googlegroups.com
```

`alpha` est le nom d'API du **test fermé**. Le script reprend la build la plus récente de la
piste interne et la sert en test fermé, sans rebuild ni nouvel `eas submit`, puis relit la piste
hors de l'édition — un commit qui n'a pas pris ne se voit pas autrement.

Sur les testeurs, la console et l'API ne couvrent pas la même chose : les adresses saisies **une à
une** sont réservées à la console, mais un **groupe Google** s'attache par l'API
(`edits.testers` ne connaît que `googleGroups`). Le groupe est de toute façon plus maniable —
on ajoute et retire les gens dans le groupe, sans repasser par Play. Une fois la piste servie et
la liste en place, le lien d'inscription est
`https://play.google.com/apps/testing/com.lblondon.skullscores`.

Ce que l'API ne dit pas : **combien** de testeurs sont inscrits, et **depuis quand**. Ce compteur
— celui des 12 × 14 jours — ne se lit que dans la console, page _Test fermé_. Le recrutement et
le message à leur envoyer sont dans [`testeurs.md`](./testeurs.md).

Trois choses restent à la main dans la console, et c'est volontaire — ce sont des déclarations
dont on répond devant Apple : **confidentialité** (penser au bouton _Publier_, séparé des
réponses), **classification d'âge**, et **statut de commerçant DSA**.

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

`eas submit -p ios` veut enregistrer la clé App Store Connect **sur les serveurs EAS**, ce qu'il
ne sait pas faire en `--non-interactive` (« App Store Connect API Keys cannot be set up in
--non-interactive mode »). Pour envoyer une build depuis le poste avec la clé locale :

```bash
set -a && . credentials/asc.env && set +a
curl -sL -o build.ipa "<Application Archive URL du build EAS>"
mkdir -p private_keys && cp credentials/asc-api-key.p8 "private_keys/AuthKey_${ASC_KEY_ID}.p8"
xcrun altool --upload-app -f build.ipa -t ios --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID"
```

La release interne se promeut ensuite en test fermé — `promote-play-track.py`, ou la Play
Console —, sans rebuild. Attention à ce qui démarre vraiment les 14 jours : ce n'est pas la
promotion, c'est l'inscription des testeurs. Une piste fermée servie mais sans liste ne compte
rien.

Deux profils de soumission, et la différence tient en un mot :

| Profil       | `releaseStatus` | Ce qui se passe                                                    |
| ------------ | --------------- | ------------------------------------------------------------------ |
| `production` | `draft`         | le binaire monte, la release attend un clic dans la console        |
| `internal`   | `completed`     | la release part **tout de suite** aux testeurs de la piste interne |

```bash
eas submit --platform android --profile internal --id <build>
```

Le défaut reste le brouillon : rien ne s'ouvre à des testeurs sans qu'on l'ait demandé. Le profil
`internal` est là pour les allers-retours de test, où le clic dans la console n'apporte rien.

### Envoyer en validation

```bash
python3 docs/store/submit-for-review.py --version 1.1.0
```

Dans la console, _Add for Review_ fait passer l'élément en `READY_FOR_REVIEW` et **n'envoie
rien** : il faut ensuite « Submit to App Review » sur la page de **soumission**, pas sur celle de
la version. Trois jours perdus sur la 1.0 à cause de ces deux boutons. Le script fait les trois
appels — soumission, élément, `submitted: true` — et **relit l'état** : une soumission sans
`submittedDate` n'est pas partie, quoi qu'affiche la console.

Deux pièges d'`eas submit` rencontrés au premier envoi : `--what-to-test` (le changelog
TestFlight) est **réservé au plan Enterprise** et fait échouer la commande sur le plan gratuit ;
et `--auto-testflight-setup` ne fait rien tant que la clé App Store Connect n'est lue qu'en local
(« No complete App Store Connect credentials »), il faut alors créer le groupe de test interne à
la main dans App Store Connect.

### Publier la version approuvée

```bash
python3 docs/store/release-version.py --version 1.1.0
```

L'approbation d'Apple ne met rien en ligne : avec `releaseType: MANUAL`, la version s'arrête en
`PENDING_DEVELOPER_RELEASE` et attend un geste de plus. Le mail « Ready for Distribution » ne le
dit pas, et le bouton est facile à ne pas trouver — il est dans le **bandeau d'état de la page
Distribution**, une fois la version sélectionnée dans la colonne de gauche : « Release This
Version ». Ni sur la vue d'ensemble de l'app, ni sur TestFlight.

C'est le troisième bouton caché de la chaîne, après les deux de la soumission. Le script fait
l'unique appel qui publie (`POST /v1/appStoreVersionReleaseRequests`) et **relit l'état** :
`READY_FOR_SALE` est la seule preuve que la version est partie. Il demande confirmation avant —
`--oui` la saute — parce qu'une publication **ne s'annule pas** : une version en ligne ne se
retire qu'en sortant l'app de la vente.

Les états qu'on croise, dans l'ordre : `PREPARE_FOR_SUBMISSION` → `WAITING_FOR_REVIEW` →
`IN_REVIEW` → `PENDING_DEVELOPER_RELEASE` → `READY_FOR_SALE`. Le seul qui demande une action est
l'avant-dernier ; c'est aussi celui qui ressemble le plus à « c'est bon, c'est fait ».

## Conformité

- **Confidentialité** : « Data Not Collected » (Apple), formulaire Data Safety vide (Google).
  Politique en ligne : https://ludovic-blondon.github.io/skullking/privacy/
- **Statut de commerçant DSA** : à déclarer **non-commerçant** sur les deux consoles. Sans cette
  déclaration, Apple retire l'app des vitrines de l'Union européenne.
- **Classification d'âge** : questionnaire IARC (Google), 4+ (Apple).
- **Conformité export** : `ITSAppUsesNonExemptEncryption: false` est dans `app.json`, ce qui évite
  la question à chaque upload — l'app ne chiffre rien.

## Visuels

Tout est dans le dépôt : icône 1024 × 1024 (`assets/images/icon.png`), 72 captures
(`screenshots/`) et les quatre bandeaux Play (`feature-graphic/`). Rien à produire avant de
remplir les fiches.
