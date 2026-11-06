import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SummaryGrid } from '@/components/features/summary-grid/summary-grid';
import summaryReal from '../fixtures/summary.json';

/**
 * Monta o painel com o summary.json REAL publicado pelo pipeline -- copia
 * congelada, nao o arquivo vivo. Assertar sobre o arquivo vivo faria a
 * atualizacao diaria do dado quebrar a suite (mesma razao da fixture do lado
 * Python).
 *
 * O ponto central: DI Futuro precisa aparecer em bps e Dolar em %. Este e o
 * unico teste que exercita a cadeia inteira -- payload -> Zod -> hook ->
 * componente -> texto na tela.
 */
function envolve(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function cardDe(rotulo: HTMLElement): HTMLElement {
  const card = rotulo.closest('div.rounded-xl');
  if (!card) throw new Error('card nao encontrado');
  return card as HTMLElement;
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(summaryReal) } as Response),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SummaryGrid com o payload real', () => {
  it('mostra o DI em bps e o dolar em %, cada um na sua unidade', async () => {
    render(envolve(<SummaryGrid />));

    const di = await screen.findByText('DI Futuro');
    expect(within(cardDe(di)).getByText('-11,6 bps')).toBeInTheDocument();

    const dolar = screen.getByText('Dolar Futuro');
    expect(within(cardDe(dolar)).getByText('+0,54%')).toBeInTheDocument();
  });

  it('descreve a variacao por extenso para leitor de tela', async () => {
    render(envolve(<SummaryGrid />));
    expect(await screen.findByText('queda de 11,6 pontos-base')).toBeInTheDocument();
  });

  it('sinaliza defasagem quando a fonte publica atras da B3', async () => {
    // Brent (EIA) esta em 03/11 enquanto o ultimo pregao e 05/11.
    render(envolve(<SummaryGrid />));
    const brent = await screen.findByText('Brent Dated (EIA)');
    expect(within(cardDe(brent)).getByText(/de defasagem/)).toBeInTheDocument();
  });

  it('anuncia carregamento antes do dado chegar', () => {
    render(envolve(<SummaryGrid />));
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('mostra erro legivel quando o payload esta fora do contrato', async () => {
    const quebrado = {
      ...summaryReal,
      items: [{ ...summaryReal.items[0], var_unit: 'xx' }],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve(quebrado) } as Response),
      ),
    );
    render(envolve(<SummaryGrid />));
    expect(await screen.findByRole('alert')).toHaveTextContent(/fora do contrato/i);
  });
});
