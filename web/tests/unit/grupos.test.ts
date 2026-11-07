import { describe, expect, it } from 'vitest';
import { agrupa, GRUPOS, ANCORAS } from '@/lib/grupos';
import type { Quote } from '@/types/dashboard';
import summaryReal from '../fixtures/summary.json';

const itens = summaryReal.items as Quote[];
const ehAncora = (c: string) => (ANCORAS as readonly string[]).includes(c);

describe('agrupamento das cotacoes', () => {
  it('todo contrato do payload real cai em algum grupo', () => {
    // O guard que importa: um contrato novo no pipeline nao pode sumir da tela
    // porque ninguem atualizou a lista. Se este teste falhar, classifique o
    // codigo em src/lib/grupos.ts -- nao relaxe a assercao.
    expect(agrupa(itens).orfaos.map((o) => o.code)).toEqual([]);
  });

  it('nenhum contrato aparece em dois grupos', () => {
    const vistos = new Map<string, string>();
    for (const g of GRUPOS) {
      for (const c of g.codigos) {
        expect(vistos.has(c), `${c} duplicado em ${vistos.get(c)} e ${g.id}`).toBe(false);
        vistos.set(c, g.id);
      }
    }
  });

  it('as ancoras existem no payload e nao se repetem nas secoes', () => {
    const codigos = new Set(itens.map((i) => i.code));
    for (const a of ANCORAS) expect(codigos.has(a), `ancora ${a} ausente`).toBe(true);
    const { secoes } = agrupa(itens.filter((i) => !ehAncora(i.code)));
    const nasSecoes = secoes.flatMap((s) => s.itens.map((i) => i.code));
    for (const a of ANCORAS) expect(nasSecoes).not.toContain(a);
  });

  it('preserva a ordem declarada em GRUPOS', () => {
    const { secoes } = agrupa(itens);
    const esperada = GRUPOS.map((g) => g.id).filter((id) => secoes.some((s) => s.id === id));
    expect(secoes.map((s) => s.id)).toEqual(esperada);
  });

  it('contrato desconhecido vai para orfaos em vez de desaparecer', () => {
    const base = itens[0];
    if (!base) throw new Error('fixture vazia');
    const novo: Quote = { ...base, code: 'XYZ', label: 'Contrato Novo' };
    expect(agrupa([...itens, novo]).orfaos.map((o) => o.code)).toEqual(['XYZ']);
  });
});
