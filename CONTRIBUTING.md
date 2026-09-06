# Contribuer à Skull Scores

Merci de l'intérêt porté au projet. Skull Scores est développé sur mon temps libre : les
contributions sont bienvenues, mais le périmètre reste volontairement resserré — une app de
comptage de points, hors ligne, sans compte ni publicité.

**Avant d'écrire du code pour une nouveauté, ouvre une issue.** Ça évite d'investir du temps sur
quelque chose qui ne rentrera pas dans le périmètre. Pour une correction de bug, une PR directe
est parfaitement bienvenue.

## Mise en route

```bash
npm install
npm run ios       # build de développement iOS (Xcode requis)
npm run android   # build de développement Android (Android Studio requis)
```

Le projet tourne sur **Expo SDK 57**. La documentation d'Expo évolue vite : réfère-toi à la
version correspondante, <https://docs.expo.dev/versions/v57.0.0/>, et non à `latest`.

## Vérifications

Ces trois commandes doivent passer avant tout commit — elles tournent en pre-commit via Husky,
puis sur chaque pull request :

```bash
npm run typecheck && npm run lint && npm test
```

## Invariants à ne pas casser

Quatre règles structurent le code. Une PR qui les enfreint sera refusée, même si elle fonctionne :

- **`src/core` reste du TypeScript pur** : ni React, ni React Native, ni accès base de données,
  ni UI. Une règle ESLint le vérifie.
- **Le barème n'est jamais codé en dur dans l'UI.** Il vient toujours du `Ruleset` passé au
  moteur ; les valeurs vivent dans `src/core/rules/editions.ts`.
- **La base stocke des données brutes** (mises, plis, bonus), jamais des points calculés ailleurs
  que dans les snapshots recalculables.
- **Toute édition d'une manche passée repasse par `computeGame`** — jamais de delta appliqué à la
  main.

## Le plan fait foi

Le code comporte des renvois du type `// PLAN.md §4.2`. Ils pointent vers
[`PLAN.md`](./PLAN.md), le document de cadrage validé : règles du jeu, barème par édition,
modèle de données, écrans, découpage en phases. Toute décision technique ou de périmètre s'y
réfère — c'est le premier endroit à lire avant de proposer un changement de comportement.

## Commits

Commits conventionnels (`feat:`, `fix:`, `chore:`, `docs:`, `test:`…), vérifiés par commitlint.
Les messages sont rédigés en français, à l'impératif, et décrivent l'intention plutôt que le
diff.

## Pull requests

Le dépôt suit un flux à deux niveaux :

```
branche de travail  →  develop  →  main
```

- **`develop`** est la branche d'intégration. Toutes les PR y vont : correctifs, nouveautés,
  documentation. Pars de `develop`, jamais de `main`.
- **`main`** ne reçoit que les PR de release. Chaque merge dans `main` correspond à une version
  publiée sur les stores, et porte un tag (`1.0.0`, `1.1.0`…).

Les deux branches sont protégées à l'identique : passage par pull request obligatoire, CI
(`Typecheck, lint et tests`) verte avant le merge, ni force-push ni suppression. Personne n'y
échappe, propriétaire compris.

Sans accès en écriture au dépôt, passe par un **fork** : pousse ta branche sur ton fork, puis
ouvre la pull request vers `develop`.

**L'intégration est faite par le mainteneur** — les merges dans `develop` comme les releases vers
`main`. Ouvre ta PR et laisse-la : elle sera relue puis intégrée.

Une PR par sujet. Décris ce que tu changes et pourquoi ; si le comportement visible bouge, une
capture aide.

## Licence des contributions

Le projet est distribué sous [licence MIT](./LICENSE). En proposant une contribution, tu la
places sous cette même licence — c'est le mécanisme prévu par les conditions d'utilisation de
GitHub (section D.6, « Contributions Under Repository License »), et tu confirmes détenir les
droits nécessaires pour le faire.
