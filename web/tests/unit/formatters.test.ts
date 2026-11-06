import { describe, expect, it } from 'vitest';
import { numero, data, diasUteisEntre } from '@/lib/formatters';

describe('data', () => {
  it('converte ISO para pt-BR sem passar por Date (evita fuso)', () => {
    expect(data('2026-11-05')).toBe('05/11/2026');
  });
  it('ausente vira travessao', () => {
    expect(data(null)).toBe('—');
  });
});

describe('numero', () => {
  it('usa separador pt-BR', () => {
    expect(numero(5519.234)).toBe('5.519,23');
  });
  it('null nao vira zero', () => {
    expect(numero(null)).toBe('—');
  });
});

describe('diasUteisEntre', () => {
  it('ignora fim de semana', () => {
    // 2026-11-03 (ter) -> 2026-11-05 (qui) = 2 dias uteis
    expect(diasUteisEntre('2026-11-03', '2026-11-05')).toBe(2);
    // sexta -> segunda = 1 dia util (sab/dom nao contam)
    expect(diasUteisEntre('2026-10-30', '2026-11-02')).toBe(1);
  });
  it('mesma data ou invertida devolve zero', () => {
    expect(diasUteisEntre('2026-11-05', '2026-11-05')).toBe(0);
    expect(diasUteisEntre('2026-11-05', '2026-11-03')).toBe(0);
  });
});
