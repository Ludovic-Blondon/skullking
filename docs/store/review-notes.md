# Notes de vérification — App Store

Apple attache ces notes **à une version**, pas à l'application : chaque nouvelle version repart
avec un champ vide. C'est ce qui a coûté un rejet _Guideline 2.1 — Information Needed_ sur la 1.0.
Elles vivent donc ici, et `publish-listing.py` les pousse à chaque version.

Le texte ci-dessous est **celui qui a fait approuver la 1.0**, relu de l'API et repris tel quel :
le réécrire de zéro, c'est reprendre le risque qu'il avait justement écarté. Seuls trois passages
bougent d'une version à l'autre — le parcours de test, les appareils réellement essayés, et la
section « WHAT IS NEW ». Le bloc est envoyé tel quel dans `appStoreReviewDetails.notes`
(4 000 caractères au maximum), en anglais.

## Notes

ABOUT THE APP

Skull Scores is an offline score pad for the card game "Skull King". Each round, players enter
their bid and the number of tricks they won; the app applies the game's scoring rules and keeps
the score sheet, the game history and per-player statistics.

There is no account, no login and no network connectivity of any kind: the app never makes a
network request. Data is stored locally in a SQLite database, exportable to and importable from a
JSON file.

TARGET AUDIENCE AND PROBLEM SOLVED

Board game players of all ages (rated 4+). Skull King has a scoring system with bonuses, pirate
abilities and rule variants that is tedious and error-prone on paper. The app does the arithmetic,
checks each round for consistency (tricks entered must match the cards dealt), and lets a
mis-entered round be corrected, recalculating every later total.

HOW TO SET UP AND USE THE MAIN FEATURES

No credentials, no sample file and no setup are required. Everything is available on first launch.

1. Launch the app.
2. Tap "New game", add 2 to 8 players by name, pick the rule set, start the game.
3. Bidding phase: set each player's bid with the steppers, then tap the primary button.
4. Results phase: set the tricks each player won, add bonuses if any, tap "Validate round".
5. Repeat for each round. The full score sheet is reachable at any time from the list icon in
   the header.
6. The sliders icon, top left during the bidding phase, opens the game settings: number of
   rounds, and adding or removing a player between two rounds.
7. After the final round, an end-of-game screen shows the podium, awards and standings.
8. "History", "Players" and "Stats" on the home screen show past games and all-time rankings.

DEVICE MODELS AND OPERATING SYSTEMS TESTED

- iPhone 17 Pro simulator, iOS 26.2 — automated UI tests play complete games end to end,
  including the two features new to this version.
- iPhone 15 Pro, physical device, iOS 26.6.1 — this version was installed and launched on it
  as a signed release build.

EXTERNAL SERVICES, TOOLS AND PLATFORMS

None: no data provider, no authentication service, no payment processor, no analytics, no
advertising SDK, no AI service. Built with Expo / React Native; everything is computed on device.

PERMISSIONS AND SENSITIVE DATA

The app requests no permissions at all: no location, contacts, camera, microphone, photos or
advertising identifier, and no App Tracking Transparency. No data is collected, which is what we
declared in App Privacy ("Data Not Collected").

NO ACCOUNTS, NO PAID CONTENT, NO USER-GENERATED CONTENT

There is no registration or login flow, because there is no account. The app is free: no in-app
purchases, no subscriptions, no advertising. Player names are typed by the user and never leave
the device, so there is no content to report or block.

REGIONAL DIFFERENCES

None. The app behaves identically everywhere. It is localized in French, English, Spanish and
German, following the device language, but no feature differs by country.

THIRD-PARTY MATERIAL AND REGULATED INDUSTRIES

The app operates in no regulated industry and contains no protected third-party material. All artwork
and iconography are original. "Skull King" is a trademark of Grandpa Beck's Games, used
descriptively to state which card game this score pad is for; the App Store description states
explicitly that the app is not affiliated with them. The app reproduces none of the game's artwork, components or rules text — it only computes
scores from numbers the user types in.

WHAT IS NEW IN THIS VERSION

Version 1.1.0 adds two optional features, both off by default, so a game created with the default
rules behaves exactly as in 1.0: scoring for the card game's official expansion (four more bonus
counters, a third sea monster, tables of up to nine players), switched on in the rule options; and
a game settings screen that changes the number of rounds and lets a player leave or join between
two rounds.
