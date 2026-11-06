import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { SummaryGrid } from '@/components/features/summary-grid/summary-grid';
import { StaleBanner } from '@/components/features/stale-banner';
import summaryReal from '../fixtures/summary.json';

/**
 * axe-core direto, sem matcher: queremos a LISTA de violacoes na mensagem de
 * falha, para quem for corrigir saber o que quebrou sem reproduzir.
 *
 * Limite conhecido: axe nao substitui teste com leitor de tela real. Ele pega
 * contraste, rotulo ausente, ordem de heading e ARIA invalido -- a maior parte
 * do que se erra sem perceber.
 */
async function semViolacoes(container: HTMLElement) {
  const r = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } }, // jsdom nao calcula cor
  });
  const resumo = r.violations.map((v) => `${v.id}: ${v.description}`).join('\n');
  expect(resumo).toBe('');
}

function envolve(children: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(summaryReal) } as Response),
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('acessibilidade', () => {
  it('o grid de cotacoes nao tem violacoes', async () => {
    const { container } = render(envolve(<SummaryGrid />));
    await screen.findByText('DI Futuro');
    await semViolacoes(container);
  });

  it('o aviso de defasagem nao tem violacoes', async () => {
    const { container } = render(
      <StaleBanner
        frescor={{
          eia: { last_date: '2026-10-01', dias: 30, nome: 'petróleo (EIA)', limite: 12 },
        }}
      />,
    );
    await semViolacoes(container);
  });

  it('o estado de carregamento anuncia-se uma vez, nao por card', () => {
    render(envolve(<SummaryGrid />));
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });
});
