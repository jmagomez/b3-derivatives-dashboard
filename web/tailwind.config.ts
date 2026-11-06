import type { Config } from 'tailwindcss';

/**
 * Tokens espelham as variaveis CSS definidas em src/styles/globals.css, o que
 * permite trocar tema no `<html class="dark">` sem recompilar classe nenhuma.
 * As cores de alta/baixa ficam aqui, e nao soltas nos componentes, porque o
 * verde/vermelho de mercado precisa de contraste AA nos DOIS temas -- e o par
 * que funciona no claro costuma falhar no escuro.
 */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'hsl(var(--bg) / <alpha-value>)',
        surface: 'hsl(var(--surface) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        fg: 'hsl(var(--fg) / <alpha-value>)',
        muted: 'hsl(var(--muted) / <alpha-value>)',
        accent: 'hsl(var(--accent) / <alpha-value>)',
        up: 'hsl(var(--up) / <alpha-value>)',
        down: 'hsl(var(--down) / <alpha-value>)',
        warn: 'hsl(var(--warn) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter var', 'Inter', 'system-ui', 'sans-serif'],
        // Tabular para numero: sem isso a coluna de variacao "danca" a cada
        // atualizacao, porque os digitos tem larguras diferentes.
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontVariantNumeric: { tabular: 'tabular-nums' },
      transitionDuration: { theme: '180ms' },
    },
  },
  plugins: [],
} satisfies Config;
