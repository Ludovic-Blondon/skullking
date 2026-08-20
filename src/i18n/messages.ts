/**
 * Catalogue de traductions (PLAN.md §11, P6 : « zéro chaîne hors i18n »).
 *
 * Clés plates et typées : `en` est un `Record<MessageKey, string>`, donc une
 * traduction oubliée casse la compilation plutôt que de s'afficher en français
 * chez un anglophone.
 *
 * Pluriel : une clé peut exister en `#one` et `#other`. C'est `t()` qui choisit
 * selon la langue — le français met 0 au singulier, l'anglais non.
 *
 * Le vocabulaire du jeu reste anglais dans les deux langues (Skull King, Kraken,
 * Harry the Giant…) : c'est ainsi que les joueurs le nomment, y compris en
 * français, où l'édition garde les noms d'origine.
 */

export const fr = {
  'common.cancel': 'Annuler',
  'common.delete': 'Supprimer',
  'common.ok': 'OK',
  'common.back': 'Retour à l’accueil',

  'tabs.home': 'Accueil',
  'tabs.history': 'Historique',
  'tabs.players': 'Joueurs',
  'tabs.stats': 'Stats',

  'route.settings': 'Réglages',
  'route.rules': 'Aide-mémoire du barème',
  'route.newGame': 'Nouvelle partie',
  'route.scoresheet': 'Feuille de score',
  'route.gameEnd': 'Fin de partie',
  'route.gameDetail': 'Détail de la partie',

  'home.title': 'Skull King',
  'home.pitch':
    'Comptage de points, historique et statistiques. 100 % hors ligne, sans pub ni compte.',
  'home.ongoing': 'Partie en cours',
  'home.resume': 'Reprendre — manche {round}',
  'home.phaseBidding': 'Annonces',
  'home.phaseResults': 'Résultats',
  'home.newGame': '+ Nouvelle partie',
  'home.rules': 'Aide-mémoire du barème',

  'db.failed': 'La base de données n’a pas pu être préparée',

  'settings.data': 'Données',
  'settings.inventory#one': '{players} joueur · {games} partie en mémoire.',
  'settings.inventory#other': '{players} joueurs · {games} parties en mémoire.',
  'settings.storage': 'Tout est stocké sur cet appareil, sans compte ni serveur.',
  'settings.export': 'Exporter',
  'settings.exportHint': 'Un fichier JSON à envoyer où vous voulez',
  'settings.import': 'Importer',
  'settings.importHint': 'Remplace les données par celles d’une sauvegarde',
  'settings.erase': 'Tout effacer',
  'settings.eraseHint': 'Repartir d’une app vide',
  'settings.eraseTitle': 'Tout effacer ?',
  'settings.eraseBody':
    'Toutes les parties et tous les joueurs disparaissent définitivement. Exportez d’abord si vous tenez à cet historique.',
  'settings.exportFailed': 'Export impossible',
  'settings.importFailed': 'Import impossible',
  'settings.importUnreadable': 'Sauvegarde illisible',
  'settings.importTitle': 'Remplacer toutes les données ?',
  'settings.importBody':
    'Cette sauvegarde contient {summary}. Les parties et les joueurs actuellement dans l’app seront remplacés.',
  'settings.importDone': 'Sauvegarde restaurée',
  'settings.importDoneBody': '{summary} rechargés.',
  'settings.replace': 'Remplacer',
  'settings.saved': 'Sauvegarde enregistrée',
  'settings.savedAt': 'Fichier : {uri}',
  'settings.preferences': 'Préférences',
  'settings.language': 'Langue',
  'settings.languageHint': 'Le vocabulaire du jeu reste en anglais dans les deux langues',
  'settings.system': 'Système',
  'settings.theme': 'Thème',
  'settings.themeHint': 'Le mode sombre est pensé pour une table le soir',
  'settings.light': 'Clair',
  'settings.dark': 'Sombre',
  'settings.keepAwake': 'Écran maintenu allumé',
  'settings.keepAwakeHint': 'Pendant une partie : une manche dure plus que la veille',
  'settings.on': 'Oui',
  'settings.off': 'Non',
  'settings.about': 'À propos',
  'settings.aboutBody':
    'Skull Scores compte les points de vos parties de Skull King : hors ligne, sans publicité, sans compte et sans traceur.',
  'settings.disclaimer':
    'Application non affiliée à Grandpa Beck’s Games. « Skull King » est une marque de son éditeur ; l’iconographie de cette app est originale.',

  'summary.playersAndGames#one': '{players} joueur et {games} partie',
  'summary.playersAndGames#other': '{players} joueurs et {games} parties',
} as const;

export type MessageKey = keyof typeof fr;

type Suffixed = Extract<MessageKey, `${string}#one` | `${string}#other`>;
/** Clé à passer à `t()` pour une chaîne qui s'accorde : sans son suffixe. */
export type PluralKey = Suffixed extends `${infer Base}#${string}` ? Base : never;

export const en: Record<MessageKey, string> = {
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.ok': 'OK',
  'common.back': 'Back to home',

  'tabs.home': 'Home',
  'tabs.history': 'History',
  'tabs.players': 'Players',
  'tabs.stats': 'Stats',

  'route.settings': 'Settings',
  'route.rules': 'Scoring cheat sheet',
  'route.newGame': 'New game',
  'route.scoresheet': 'Score sheet',
  'route.gameEnd': 'Game over',
  'route.gameDetail': 'Game detail',

  'home.title': 'Skull King',
  'home.pitch': 'Scores, history and statistics. Fully offline, no ads, no account.',
  'home.ongoing': 'Game in progress',
  'home.resume': 'Resume — round {round}',
  'home.phaseBidding': 'Bids',
  'home.phaseResults': 'Results',
  'home.newGame': '+ New game',
  'home.rules': 'Scoring cheat sheet',

  'db.failed': 'The database could not be prepared',

  'settings.data': 'Data',
  'settings.inventory#one': '{players} player · {games} game stored.',
  'settings.inventory#other': '{players} players · {games} games stored.',
  'settings.storage': 'Everything stays on this device — no account, no server.',
  'settings.export': 'Export',
  'settings.exportHint': 'A JSON file to send wherever you like',
  'settings.import': 'Import',
  'settings.importHint': 'Replaces your data with a backup',
  'settings.erase': 'Erase everything',
  'settings.eraseHint': 'Start from an empty app',
  'settings.eraseTitle': 'Erase everything?',
  'settings.eraseBody':
    'Every game and every player disappears for good. Export first if this history matters to you.',
  'settings.exportFailed': 'Export failed',
  'settings.importFailed': 'Import failed',
  'settings.importUnreadable': 'Unreadable backup',
  'settings.importTitle': 'Replace all data?',
  'settings.importBody':
    'This backup holds {summary}. The games and players currently in the app will be replaced.',
  'settings.importDone': 'Backup restored',
  'settings.importDoneBody': '{summary} loaded.',
  'settings.replace': 'Replace',
  'settings.saved': 'Backup saved',
  'settings.savedAt': 'File: {uri}',
  'settings.preferences': 'Preferences',
  'settings.language': 'Language',
  'settings.languageHint': 'Game vocabulary stays in English in both languages',
  'settings.system': 'System',
  'settings.theme': 'Theme',
  'settings.themeHint': 'Dark mode is the one designed for a table at night',
  'settings.light': 'Light',
  'settings.dark': 'Dark',
  'settings.keepAwake': 'Keep the screen on',
  'settings.keepAwakeHint': 'During a game — a round outlasts the auto-lock',
  'settings.on': 'On',
  'settings.off': 'Off',
  'settings.about': 'About',
  'settings.aboutBody':
    'Skull Scores keeps score for your Skull King games: offline, ad-free, account-free and tracker-free.',
  'settings.disclaimer':
    'Not affiliated with Grandpa Beck’s Games. “Skull King” is their trademark; the artwork in this app is original.',

  'summary.playersAndGames#one': '{players} player and {games} game',
  'summary.playersAndGames#other': '{players} players and {games} games',
};

export const catalogs = { fr, en } as const;
export type Language = keyof typeof catalogs;
