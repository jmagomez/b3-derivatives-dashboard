import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * O site e publicado em https://<user>.github.io/b3-derivatives-dashboard/,
 * ou seja, num SUBDIRETORIO. Sem `base` os assets sao pedidos em /assets/...
 * (raiz do dominio) e a pagina sobe em branco -- o modo de falha mais comum
 * de Vite no GitHub Pages. Em dev o base e '/' para o servidor local nao
 * exigir o prefixo.
 */
const BASE = process.env.VITE_BASE ?? '/b3-derivatives-dashboard/';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? BASE : '/',
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    /**
     * Em dev os JSON vem direto de ../docs/data, entao o app roda contra o
     * dado REAL do repositorio sem precisar rodar o pipeline Python. Em
     * producao o deploy copia docs/data/ para dist/data/ (ver deploy.yml):
     * o caminho `data/<arquivo>.json` e o mesmo nos dois ambientes.
     */
    proxy: {
      '/data': {
        target: 'http://localhost:5173',
        bypass: (req) => (req.url ?? '').replace('/data', '/../docs/data'),
      },
    },
    fs: { allow: ['..'] },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        /**
         * React muda muito menos que o codigo do dashboard; separa-lo deixa o
         * cache do navegador valer entre deploys -- uma mudanca de texto nao
         * invalida 140 KB de lib.
         */
        // Recharts NAO entra aqui: ele chega por import() dinamico nos
        // paineis de grafico, e o Rollup ja o isola num chunk assincrono.
        // Forca-lo para um chunk nomeado o traria de volta ao grafo de
        // entrada e desfaria o lazy (48,6 KB gzip de entrada viram 159 KB).
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
}));
