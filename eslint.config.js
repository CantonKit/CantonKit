import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/*/src/**/*.{ts,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        globalThis: 'readonly',
        window: 'readonly',
        document: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        WebSocket: 'readonly',
        MessageEvent: 'readonly',
        CloseEvent: 'readonly',
      },
    },
    settings: { react: { version: '18.3.0' } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-empty-pattern': 'off', // allow `} = {}` destructuring defaults
    },
  },
  {
    ignores: [
      'packages/*/dist/**',
      'examples/*/dist/**',
      'node_modules/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      'packages/*/src/test/**',
    ],
  },
]
