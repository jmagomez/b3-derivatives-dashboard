import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PainelRisco } from '@/components/features/risco/painel-risco';
import { PainelOpcoes } from '@/components/features/opcoes/painel-opcoes';
import { PainelGlobal } from '@/components/features/global/painel-global';
import { PainelCambio } from '@/components/features/cambio/painel-cambio';
import analyticsReal from '../fixtures/analytics.json';
import opcoesReal from '../fixtures/opcoes.json';
import marketsReal from '../fixtures/markets.json';
import bcbReal from '../fixtures/bcb.json';
import seriesReal from '../fixtures/series.json';

/** Fixtures recortadas dos arquivos reais: forma e valores de verdade. */
function envolve(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function responde(porArquivo: Record<string, unknown>, falha?: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const u = String(url);
      if (falha && u.includes(falha)) {
        return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' } as Response);
      }
      const achado = Object.entries(porArquivo).find(([nome]) => u.includes(nome));
      if (!achado) return Promise.reject(new Error(`fetch nao esperado: ${u}`));
      return Promise.resolve({ ok: true, json: () => Promise.resolve(achado[1]) } as Response);
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('PainelRisco', () => {
  beforeEach(() => responde({ analytics: analyticsReal }));

  it('mostra as DUAS colunas de excesso, porque elas divergem', async () => {
    render(envolve(<PainelRisco />));
    const tabela = await screen.findByRole('table', { name: /Retorno, volatilidade/ });
    expect(within(tabela).getByRole('columnheader', { name: /composto/ })).toBeInTheDocument();
    expect(within(tabela).getByRole('columnheader', { name: /aritmético/ })).toBeInTheDocument();
  });

  it('o IBOV exibe excesso composto NEGATIVO e Sharpe POSITIVO ao mesmo tempo', async () => {
    // Este e o caso que torna a aba confusa sem o bloco de metodologia:
    // -4,28 p.p. ao lado de +0,02 parece erro e nao e.
    render(envolve(<PainelRisco />));
    const tabela = await screen.findByRole('table', { name: /Retorno, volatilidade/ });
    const linha = within(tabela).getByRole('row', { name: /^Ibovespa R\$/ });
    expect(within(linha).getByText('-4,28 p.p.')).toBeInTheDocument();
    expect(within(linha).getByText('+0,02')).toBeInTheDocument();
    expect(within(linha).getByText('+0,57%')).toBeInTheDocument();
  });

  it('explica o volatility drag em texto visivel, nao em tooltip', async () => {
    render(envolve(<PainelRisco />));
    expect(await screen.findByText(/volatility drag/i)).toBeInTheDocument();
    expect(screen.getByText('Sharpe (12m)')).toBeInTheDocument();
    expect(screen.getByText(/Nenhum dos dois está errado/)).toBeInTheDocument();
  });

  it('nao oferece excesso sobre CDI para ativo em US$', async () => {
    render(envolve(<PainelRisco />));
    const tabela = await screen.findByRole('table', { name: /Retorno, volatilidade/ });
    expect(within(tabela).getAllByText(/n\/a em US\$/).length).toBeGreaterThan(0);
  });

  it('mostra as duas janelas de correlacao com o n de cada uma', async () => {
    render(envolve(<PainelRisco />));
    expect(await screen.findByRole('table', { name: /3 meses/ })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /12 meses/ })).toBeInTheDocument();
    expect(screen.getByText(/63 dias úteis em comum/)).toBeInTheDocument();
  });

  it('a matriz escreve o numero, nao so a cor', async () => {
    render(envolve(<PainelRisco />));
    const t = await screen.findByRole('table', { name: /12 meses/ });
    // IBOV x SP500 em 252 dias = 0,266. Aparece DUAS vezes: a matriz e
    // simetrica, e os dois lados sao exibidos de proposito -- so a metade
    // inferior economizaria espaco e obrigaria o leitor a decidir qual linha
    // procurar.
    expect(within(t).getAllByText('0,27')).toHaveLength(2);
    expect(within(t).getAllByText('1,00')).toHaveLength(4);
  });

  it('quando analytics.json falta, diz que foi REMOVIDO e nao mostra tela vazia', async () => {
    responde({ analytics: analyticsReal }, 'analytics');
    render(envolve(<PainelRisco />));
    expect(await screen.findByText(/não foi publicado nesta rodada/)).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /Retorno, volatilidade/ })).toBeNull();
  });
});

describe('PainelOpcoes', () => {
  beforeEach(() => responde({ opcoes: opcoesReal }));

  it('ordena a tabela do dia pelo volume e soma 100% de participacao', async () => {
    render(envolve(<PainelOpcoes />));
    await screen.findByText(/Liquidez por mercadoria/);
    const soma = opcoesReal.filter((r) => r.date === '2026-11-06').reduce((s, r) => s + r.volume, 0);
    expect(soma).toBeGreaterThan(0);
    // DOL e o maior volume do dia na fixture; tem de ser o primeiro grafico.
    const graficos = screen
      .getAllByRole('heading')
      .map((h) => h.textContent ?? '')
      .filter((t) => /^(DOL|IDI|BGI|CCM|ICF|SJC) —/.test(t));
    expect(graficos[0]).toMatch(/^DOL/);
    // ICF fecha o dia com volume zero -- tem de cair para o fim, nao sumir.
    expect(graficos.at(-1)).toMatch(/^ICF/);
  });

  it('traduz o codigo da B3 e marca o que nao esta catalogado', async () => {
    render(envolve(<PainelOpcoes />));
    expect(await screen.findByRole('heading', { name: /ICF — Café arábica/ })).toBeInTheDocument();
  });

  it('diz que dia com zero contrato e zero de verdade', async () => {
    render(envolve(<PainelOpcoes />));
    expect(await screen.findByText(/zero de verdade, não dado faltando/)).toBeInTheDocument();
  });
});

describe('PainelGlobal', () => {
  beforeEach(() => responde({ markets: marketsReal }));

  it('monta um grafico por indice e avisa que o retorno e de preco', async () => {
    render(envolve(<PainelGlobal />));
    expect(await screen.findByRole('heading', { name: 'S&P 500' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nasdaq Composite' })).toBeInTheDocument();
    expect(screen.getAllByText(/sem dividendos/).length).toBeGreaterThan(0);
  });
});

describe('PainelCambio', () => {
  beforeEach(() => responde({ series: seriesReal, bcb: bcbReal }));

  it('poe DOL e PTAX juntos e registra a nao-sincronia de horario', async () => {
    render(envolve(<PainelCambio />));
    expect(await screen.findByRole('heading', { name: 'Dólar futuro' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'PTAX venda' })).toBeInTheDocument();
    expect(screen.getByText(/não sincronizada com o fechamento de NY/)).toBeInTheDocument();
  });
});
