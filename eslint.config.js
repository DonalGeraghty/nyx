import js from '@eslint/js'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'

export default [
  { ignores: ['dist', 'artwork', 'coverage'] },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      'react/prop-types': 'off',
      ...reactHooks.configs.flat.recommended.rules,
      // New in eslint-plugin-react-hooks v7; flags existing loading-state
      // effect patterns across the app that are intentional, not bugs.
      'react-hooks/set-state-in-effect': 'off',
      // Also new in v7 (React Compiler diagnostics); too strict for
      // existing manually-memoized callbacks not written for the compiler.
      'react-hooks/preserve-manual-memoization': 'off',
      ...reactRefresh.configs.vite.rules,
      'react-refresh/only-export-components': 'off',
    },
    settings: { react: { version: 'detect' } },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: globals.node,
      sourceType: 'module',
    },
    rules: js.configs.recommended.rules,
  },
]
