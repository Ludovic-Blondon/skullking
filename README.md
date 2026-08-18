# Skull Scores

Application mobile iOS + Android de comptage de points pour le jeu de cartes **Skull King** :
100 % hors ligne, gratuite, sans pub ni compte. Historique complet, statistiques par joueur,
saisie sémantique des bonus, barème exact par édition de règles.

Le cadrage complet (règles, modèle de données, écrans, phases) est dans [`PLAN.md`](./PLAN.md).

> Application non affiliée à Grandpa Beck's Games, éditeur de Skull King.

## Démarrer

```bash
npm install
npm run ios       # build de développement iOS (Xcode requis)
npm run android   # build de développement Android (Android Studio requis)
npm start         # serveur Metro seul
```

## Scripts

| Script              | Rôle                                     |
| ------------------- | ---------------------------------------- |
| `npm run typecheck` | TypeScript en mode strict, sans émission |
| `npm run lint`      | ESLint (config Expo)                     |
| `npm run format`    | Prettier en écriture                     |
| `npm test`          | Jest + Testing Library                   |
| `npm run test:ci`   | Jest avec couverture (utilisé par la CI) |

Ces trois vérifications (typecheck, lint, tests) tournent aussi en pre-commit via Husky, et sur
chaque pull request via `.github/workflows/ci.yml`.

## Structure

```
src/
  app/        routes expo-router (fines : elles délèguent aux features)
  core/       ⭐ moteur de règles — TypeScript pur, zéro import React Native (P1)
  db/         schéma Drizzle, migrations, repositories (P2)
  features/   écrans et logique par domaine : game, history, players, stats (P2+)
  ui/         design system : jetons, composants partagés
  i18n/       fr.json · en.json (P6)
```

Deux règles d'architecture, héritées du plan :

1. `src/core` ne connaît ni React, ni la base de données, ni l'UI — il est testable en Jest sans
   émulateur, et vérifié par une règle ESLint dédiée.
2. La saisie enregistre des **données brutes** (mises, plis, événements de bonus), jamais des
   points : corriger un barème et recalculer tout l'historique reste possible.

## Moteur de score

`src/core` est la pièce maîtresse : du TypeScript pur, sans React ni base de
données, couvert à 100 % (branches comprises) et vérifié par une règle ESLint.

```ts
import { computeGame, scoreRound, validateRound, cardsDealtFor, DEFAULT_RULESET } from '@/core';

cardsDealtFor(9, 8); // 8 — à 8 joueurs, les manches 9 et 10 tombent à 8 cartes
validateRound(round, ruleset); // codes d'anomalie typés, `error` ou `warning`
scoreRound(round, ruleset); // { base, bonus, lostBonus, rascalBet, custom, total } par joueur
computeGame(rounds, ruleset); // cumuls, classement, égalité en tête
```

Le `Ruleset` porte tout ce qui change d'une table à l'autre : édition
(`current` / `legacy`), cartes avancées, décompte (`classic` / `rascal` +
Boulet de canon) et pouvoirs des pirates. Aucune valeur de barème ne doit être
recopiée ailleurs : elles vivent toutes dans `src/core/rules/editions.ts`.

## Thème

Les couleurs vivent en double : variables CSS dans `src/global.css` (consommées par NativeWind) et
miroir JavaScript dans `src/ui/tokens.ts` (thème de navigation, graphiques). Un test garantit que
les deux ne divergent pas.

## Conventions

Commits conventionnels (`feat:`, `fix:`, `chore:`…), vérifiés par commitlint.
