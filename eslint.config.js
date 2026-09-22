import tseslint from 'typescript-eslint';
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import hooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/.wrangler/**',
      '**/test-results/**',
      '**/playwright-report/**',
      '.tmp/**',
      'apps/api/worker-configuration.d.ts',
    ],
  },
  js.configs.recommended,
  { files: ['apps/web/tests/browser/**/*.js'], languageOptions: { globals: globals.browser } },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: ['**/*.ts'] })),
  {
    files: ['apps/api/**/*.ts', 'packages/shared/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.worker,
        ...globals.browser,
        caches: 'readonly',
        WebSocketPair: 'readonly',
      },
    },
  },
  {
    files: ['apps/web/src/**/*.{js,jsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': hooks },
    rules: {
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/jsx-key': 'error',
      'react/jsx-no-duplicate-props': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: [
      '*.js',
      'apps/*/*.js',
      'apps/*/scripts/**/*.mjs',
      'apps/*/tests/**/*.mjs',
      'packages/shared/**/*.js',
      'apps/web/tests/browser/**/*.js',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
];
