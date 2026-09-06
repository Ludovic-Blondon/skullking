# Notes de vérification — App Store

Apple attache ces notes **à une version**, pas à l'application : chaque nouvelle version repart
avec un champ vide. C'est ce qui a coûté un rejet _Guideline 2.1 — Information Needed_ sur la 1.0,
faute de notes utiles. Elles vivent donc ici, et `publish-listing.py` les pousse à chaque version.

Le bloc ci-dessous est envoyé **tel quel** dans `appStoreReviewDetails.notes` (4 000 caractères au
maximum). Il est en anglais : le rejet de la 1.0 portait aussi là-dessus. Le mettre à jour quand
une version change ce qu'un vérificateur doit savoir ou tester.

## Notes

Skull Scores is an offline score keeper for the card game Skull King. It replaces the pencil and
paper a table uses to count points: players type in what they bid and how many tricks they won,
and the app applies the official scoring rules and keeps the running totals.

WHAT THIS APP IS NOT

The app does not contain, reproduce or simulate the card game itself. There are no cards, no
gameplay, no rulebook text and no artwork from the publisher. It only adds up numbers that the
players enter by hand while they play with their own physical deck.

THIRD-PARTY RIGHTS

This app is not affiliated with, endorsed by or sponsored by Grandpa Beck's Games. "Skull King" is
their trademark, and it is used here only to state which game these scores are for — the app would
be meaningless without naming it. Every illustration, icon and screen in the app is original work.
A disclaimer to that effect appears in the app itself (Settings > About) and in the store listing.

NO ACCOUNT, NO SERVER, NO NETWORK

The app is fully offline. There is no sign-up, no login, no demo account to provide: every feature
is available at first launch. Nothing is sent anywhere — no analytics, no ads, no tracking, no
third-party SDK. All data stays in a local database on the device, and the user can export it to a
JSON file and re-import it at will. Privacy policy: https://ludovic-blondon.github.io/skullking/privacy/

HOW TO EXERCISE THE APP IN TWO MINUTES

1. Home > "New game". Type two names in the field and add them, then start the game.
2. Bidding phase: set each player's bid with the +/- steppers, then "Launch the round".
3. Results phase: set how many tricks each player won. The +NN badge on a player's row opens the
   bonus sheet (captures, alliances, pirate powers, manual adjustment). Then validate the round.
4. Repeat once or twice, then open the score sheet (list icon, top right) and tap a past round to
   correct it — every later total is recomputed.
5. Reduce the number of rounds from the settings icon (top left, during the bidding phase) to reach
   the end of the game and see the podium, the awards and the full standings.
6. The Home tabs hold the game history, the player roster and the statistics; Settings holds the
   language, the theme, the JSON export/import and the scoring cheat sheet.

WHAT IS NEW IN THIS VERSION

Version 1.1.0 adds scoring for the game's official expansion (four new bonus counters, a third
"leviathan" that can destroy a trick, and tables of up to nine players), and a settings screen that
lets a table change the number of rounds or add and remove a player between two rounds. Both are
optional: a game created with the default rules behaves exactly as in 1.0.

CONTACT

Questions or a build that misbehaves: https://github.com/Ludovic-Blondon/skullking/issues
