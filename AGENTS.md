# Skull Scores — notes pour les agents

## Expo

Expo évolue vite : lire la documentation **versionnée** correspondant au SDK du projet
(actuellement SDK 57) avant d'écrire du code — https://docs.expo.dev/versions/v57.0.0/

## Le plan fait foi

`PLAN.md` est le document de cadrage validé : règles du jeu, barème par édition, modèle de
données, écrans, découpage en phases P0→P7. Toute décision technique ou de périmètre s'y réfère
(les sections y sont citées en commentaire dans le code, ex. « PLAN.md §4.2 »).

## Invariants à ne pas casser

- `src/core` reste du TypeScript pur : ni React, ni React Native, ni accès base de données, ni
  UI. Une règle ESLint le vérifie.
- Le barème n'est jamais codé en dur dans l'UI : il vient toujours du `Ruleset` passé au moteur.
- La base stocke des données brutes (mises, plis, bonus), jamais des points calculés ailleurs que
  dans les snapshots recalculables.
- Toute édition d'une manche passée repasse par `computeGame` — jamais de delta appliqué à la main.

## Flux de branches

`branche de travail → develop → main`. Les PR de travail visent **`develop`** ; `main` ne reçoit
que les PR de release, taguées (`1.0.0`, `1.1.0`…). Il n'y a pas de branche `master`.

Concrètement : partir de `develop`, qui est la branche par défaut du dépôt — `gh pr create` la
cible donc sans avoir à passer `--base`. Les deux branches exigent une PR et la CI verte, sans
bypass : ne jamais tenter de pousser directement dessus. Le merge revient au mainteneur.

## Vérifications avant commit

```bash
npm run typecheck && npm run lint && npm test
```
