// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', 'coverage/*', '.expo/*', 'ios/*', 'android/*'],
  },
  {
    rules: {
      // Règle pensée pour le HTML : en React Native rien n'est interprété, et
      // l'app est en français — les apostrophes sont partout.
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    // Le moteur de règles doit rester du TypeScript pur, testable sans
    // émulateur et réutilisable hors mobile (PLAN.md §3.1 et §6).
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-native',
                'react-native-*',
                'expo',
                'expo-*',
                '@/db/*',
                '@/ui/*',
                '@/features/*',
              ],
              message:
                'src/core doit rester du TypeScript pur (PLAN.md §3.1) : ni React, ni React Native, ni base de données, ni UI.',
            },
          ],
        },
      ],
    },
  },
]);
