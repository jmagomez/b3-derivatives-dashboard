import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PainelResumo } from '@/components/features/resumo/painel-resumo';
import { YieldCurveChart } from '@/components/charts/yield-curve-chart';
import type { CurvaDI } from '@/types/dashboard';
import summaryReal from '../fixtures/summary.json';
import seriesReal from '../fixtures/series.json';
import curvaReal from '../fixtures/di_curve.json';

/**
 * Fixtures congeladas. summary e de 05/11; series e curva sao de uma data
 * vizinha -- aqui so a FORMA e a contagem importam, e nenhuma assercao cruza
 * valores entre os tres arquivos.
 */
function envolve(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(String(url).includes('series') ? seriesReal : summaryReal),
      } as Response),
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('PainelResumo', () => {
  it('poe DI, Dolar e Ibovespa futuro em destaque, fora das secoes', async () => {
    render(envolve(<PainelResumo />));
    const h = await screen.findByRole('heading', { name: 'Principais referências' });
    const secao = h.closest('section');
    if (!secao) throw new Error('secao de destaque nao encontrada');
    for (const r of ['DI Futuro', 'Dolar Futuro', 'Ibovespa Futuro']) {
      expect(within(secao).getByText(r)).toBeInTheDocument();
    }
  });

  it('agrupa o resto por classe, com cabecalho navegavel por leitor de tela', async () => {
    render(envolve(<PainelResumo />));
    await screen.findByRole('heading', { name: 'Principais referências' });
    for (const t of ['Juros', 'Renda variável', 'Commodities', 'Cripto']) {
      expect(screen.getByRole('heading', { name: t, level: 3 })).toBeInTheDocument();
    }
  });

  it('o DI em destaque continua em bps', async () => {
    render(envolve(<PainelResumo />));
    expect(await screen.findByText('-11,6 bps')).toBeInTheDocument();
  });

  it('nao mostra a secao "Outros" quando tudo esta classificado', async () => {
    render(envolve(<PainelResumo />));
    await screen.findByRole('heading', { name: 'Principais referências' });
    expect(screen.queryByRole('heading', { name: 'Outros' })).not.toBeInTheDocument();
  });
});

describe('YieldCurveChart', () => {
  const curva = curvaReal as CurvaDI;

  it('descreve a curva para leitor de tela, com o tamanho da curva de hoje', () => {
    render(envolve(<YieldCurveChart curva={curva} />));
    const img = screen.getByRole('img');
    expect(img).toHaveAccessibleName(/Curva de juros do DI em \d{2}\/\d{2}\/\d{4}/);
    expect(img).toHaveAccessibleName(new RegExp(`com ${curva.curve.length} vencimentos`));
  });

  it('a tabela equivalente abre e traz um vertice por linha', async () => {
    const user = userEvent.setup();
    render(envolve(<YieldCurveChart curva={curva} />));
    const botao = screen.getByRole('button', { name: /ver dados em tabela/i });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    await user.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    const vencs = new Set([...curva.curve, ...curva.curve_old].map((p) => p.venc));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(vencs.size + 1);
  });
});
