import type { VarUnit } from '@/types/dashboard';

/**
 * Formatacao da variacao diaria, em pt-BR.
 *
 * PORTE FIEL de `formata()` em scripts/unidades.py. As duas implementacoes
 * precisam concordar byte a byte porque o mesmo numero aparece no dashboard
 * (daqui) e no e-mail diario (de la) -- e foi divergencia entre copias dessa
 * regra que produziu o defeito original. Ha teste de paridade conferindo as
 * duas saidas contra o summary.json publicado; foi ele que pegou o separador
 * de milhar faltando no lado Python.
 *
 * Regras:
 *  - bps: o decimal so aparece quando existe ("+1 bp", nao "+1,0 bp");
 *    o singular "bp" vale so para exatamente 1 ponto-base.
 *  - pct: sempre 2 casas.
 *  - null -> travessao. Nunca "0", que afirmaria "nao mudou".
 */
const nfPct = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formataVariacao(valor: number | null, unidade: VarUnit): string {
  if (valor === null || Number.isNaN(valor)) return '—';

  const sinal = valor >= 0 ? '+' : '-';
  const abs = Math.abs(valor);

  if (unidade === 'bps') {
    const casas = Number.isInteger(valor) ? 0 : 1;
    const n = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: casas,
      maximumFractionDigits: casas,
    }).format(abs);
    return `${sinal}${n} ${abs === 1 ? 'bp' : 'bps'}`;
  }

  return `${sinal}${nfPct.format(abs)}%`;
}

/** Direcao do movimento, para cor e seta. `null` = neutro. */
export function direcao(valor: number | null): 'up' | 'down' | 'flat' | null {
  if (valor === null || Number.isNaN(valor)) return null;
  if (valor === 0) return 'flat';
  return valor > 0 ? 'up' : 'down';
}

/**
 * Rotulo acessivel para leitor de tela. "▼ 11,6 bps" sozinho e ruim: a seta
 * vira ruido e "bps" nao e lido como palavra.
 */
export function descreveVariacao(valor: number | null, unidade: VarUnit): string {
  if (valor === null || Number.isNaN(valor)) return 'variação indisponível';
  const verbo = valor > 0 ? 'alta de' : valor < 0 ? 'queda de' : 'estável em';
  const abs = Math.abs(valor);
  if (unidade === 'bps') {
    return `${verbo} ${abs.toLocaleString('pt-BR')} ${abs === 1 ? 'ponto-base' : 'pontos-base'}`;
  }
  return `${verbo} ${nfPct.format(abs)} por cento`;
}
