/**
 * Variante « dev » : la même app, sous une autre identité.
 *
 * Sans elle, un build de test porte l'identifiant de l'app publiée et **remplace**
 * celle du store sur l'iPhone, base de données comprise. Avec elle, la version de
 * test s'installe **à côté** : son propre identifiant, donc son propre conteneur,
 * donc son propre historique de parties.
 *
 * Le scheme change aussi, sinon les deux apps se disputent les liens
 * `skullking://` — et c'est la dernière installée qui gagne, sans avertissement.
 *
 * Usage :
 *
 *   APP_VARIANT=dev npx expo prebuild -p ios --clean   # ios/ pour la variante
 *   APP_VARIANT=dev npx expo run:ios --device <UDID>
 *
 * Sans `APP_VARIANT`, la configuration est celle d'`app.json`, mot pour mot :
 * les builds de production ne voient pas ce fichier passer. Le dossier `ios/`
 * garde en revanche l'identité du dernier `prebuild` : repasser un `prebuild`
 * sans la variable avant de fabriquer un build destiné au store.
 */

const IS_DEV = process.env.APP_VARIANT === 'dev';

module.exports = ({ config }) => {
  if (!IS_DEV) return config;

  return {
    ...config,
    name: 'Skull Scores dev',
    scheme: 'skullkingdev',
    ios: {
      ...config.ios,
      bundleIdentifier: 'com.lblondon.skullscores.dev',
    },
    android: {
      ...config.android,
      package: 'com.lblondon.skullscores.dev',
    },
  };
};
