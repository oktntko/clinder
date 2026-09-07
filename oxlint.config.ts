import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['eslint', 'import', 'oxc', 'react', 'typescript', 'unicorn'],
  jsPlugins: ['@cspell/eslint-plugin'],
  rules: {
    '@cspell/spellchecker': ['warn', {}],
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        args: 'all',
        argsIgnorePattern: '^_',
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
    '@typescript-eslint/switch-exhaustiveness-check': 'error',
    'react/rules-of-hooks': 'error',
    'react/only-export-components': ['warn', { allowConstantExport: true }],
  },
  ignorePatterns: ['script/'],
});
