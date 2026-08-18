/* eslint-env jest */

// Les écrans utilisent les safe area insets ; hors simulateur il n'y a pas de
// provider natif, ce mock officiel fournit des métriques déterministes.
jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock');
  return mock.default ?? mock;
});
