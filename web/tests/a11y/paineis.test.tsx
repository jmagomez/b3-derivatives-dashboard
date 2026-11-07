import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PainelRisco } from '@/components/features/risco/painel-risco';
import { PainelOpcoes } from '@/components/features/opcoes/painel-opcoes';
import analyticsReal from '../fixtures/analytics.json';
import opcoesReal from '../fixtures/opcoes.json';

/**
 * As duas abas mais arriscadas em acessibilidade: elas sao feitas de TABELA,
 * e tabela de dados e onde cabecalho sem `scope`, celula sem associacao e
 * caption ausente passam despercebidos no olho.
 */
async function semViolacoes(container: HTMLElement) {
  const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  expect(r.violations.map((v) => `${v.id}: ${v.description}`).join('\n')).toBe('');
}

function envolve(children: React.ReactNode, payload: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(payload) } as Response)),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => vi.unstubAllGlobals());

describe('acessibilidade dos paineis de tabela', () => {
  it('risco & retorno nao tem violacoes', async () => {
    const { container } = render(envolve(<PainelRisco />, analyticsReal));
    await screen.findByRole('table', { name: /Retorno, volatilidade/ });
    await semViolacoes(container);
  });

  it('opcoes nao tem violacoes', async () => {
    const { container } = render(envolve(<PainelOpcoes />, opcoesReal));
    await screen.findByText(/Liquidez por mercadoria/);
    await semViolacoes(container);
  });

  it('cada tabela de risco tem caption para leitor de tela', async () => {
    render(envolve(<PainelRisco />, analyticsReal));
    const tabelas = await screen.findAllByRole('table');
    for (const t of tabelas) {
      expect(t.querySelector('caption')?.textContent?.trim()).toBeTruthy();
    }
  });
});
