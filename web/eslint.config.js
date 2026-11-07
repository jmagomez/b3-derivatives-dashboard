import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  js.configs.recommended,

  {
    // As regras com informacao de tipo valem SO para .ts/.tsx dentro do
    // projeto -- aplicar globalmente faz o ESLint tentar tipar o proprio
    // eslint.config.js, que nao esta no tsconfig.
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // A arquitetura vira regra: dependencia so para baixo.
      // services -> hooks -> components. Um componente que importa de
      // services pula a camada de cache e de validacao, e reintroduz fetch
      // na UI -- ver CLAUDE.md, invariante 7.
      //
      // Versao TS-aware, com allowTypeImports: `import type` e apagado na
      // compilacao e nao cria dependencia de runtime. Foi a propria regra que
      // pegou o guard de divergencia em src/types/dashboard.ts, que importa
      // os schemas SO como tipo -- proibir aquilo seria a regra atrapalhando
      // o que ela existe para proteger.
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/services/*', '**/services/*'],
              message: 'Componente nao fala com services. Use um hook (src/hooks/).',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },

  {
    // Hooks e services SAO as camadas autorizadas a falar com services.
    files: ['src/hooks/**/*.ts', 'src/services/**/*.ts', 'scripts/**/*.ts'],
    rules: { '@typescript-eslint/no-restricted-imports': 'off' },
  },

  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: { '@typescript-eslint/no-restricted-imports': 'off' },
  },

  {
    // Arquivos .js de configuracao ficam fora do linting tipado.
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },

  prettier,
);
