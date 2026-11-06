import { describe, expect, it } from 'vitest';
import { formataVariacao, direcao, descreveVariacao } from '@/lib/variation';

/**
 * Os casos sao os MESMOS de tests/test_unidades.py::test_formata, do lado
 * Python. Os dois conjuntos precisam bater: o numero aparece no e-mail
 * (Python) e no dashboard (TS). Divergencia entre copias dessa regra foi o
 * defeito que originou este trabalho -- e o separador de milhar abaixo foi
 * pego exatamente por esta paridade, nao por inspecao.
 */
describe('formataVariacao — paridade com scripts/unidades.py', () => {
  it.each([
    [-11.6, 'bps' as const, '-11,6 bps'],
    [1.0, 'bps' as const, '+1 bp'], // singular, e sem decimal inutil
    [-1.0, 'bps' as const, '-1 bp'],
    [12.0, 'bps' as const, '+12 bps'],
    [1234.5, 'bps' as const, '+1.234,5 bps'],
    [-12345.67, 'pct' as const, '-12.345,67%'],
    [0.54, 'pct' as const, '+0,54%'],
    [-5.55, 'pct' as const, '-5,55%'],
  ])('%s %s -> %s', (valor, unidade, esperado) => {
    expect(formataVariacao(valor, unidade)).toBe(esperado);
  });

  it('sem comparacao mostra travessao, nunca zero', () => {
    expect(formataVariacao(null, 'bps')).toBe('—');
    expect(formataVariacao(null, 'pct')).toBe('—');
  });
});

describe('direcao', () => {
  it('distingue zero de ausente', () => {
    expect(direcao(0)).toBe('flat');
    expect(direcao(null)).toBeNull();
    expect(direcao(1)).toBe('up');
    expect(direcao(-1)).toBe('down');
  });
});

describe('descreveVariacao — o que o leitor de tela ouve', () => {
  it('fala "pontos-base" por extenso, nao "bps"', () => {
    expect(descreveVariacao(-11.6, 'bps')).toBe('queda de 11,6 pontos-base');
    expect(descreveVariacao(1, 'bps')).toBe('alta de 1 ponto-base');
  });

  it('fala "por cento" para preco', () => {
    expect(descreveVariacao(0.54, 'pct')).toBe('alta de 0,54 por cento');
  });
});
