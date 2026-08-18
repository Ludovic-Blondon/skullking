/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Seuls les fichiers `*.test.ts(x)` sont des suites : les utilitaires posés
  // dans `__tests__/` restent des modules d'appoint.
  testMatch: ['**/*.test.[jt]s?(x)'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css-interop)',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  coverageThreshold: {
    // Le moteur de règles est la seule pièce dont l'exactitude fait la
    // réputation de l'app (PLAN.md §9 et §12.2) : couverture intégrale exigée.
    './src/core/': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
};
