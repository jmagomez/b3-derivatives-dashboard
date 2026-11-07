/**
 * Taxonomia de APRESENTACAO: em que secao da tela cada contrato aparece.
 *
 * Por que esta lista de codigos pode viver no front, enquanto a de unidade nao
 * podia: esta nao tem consequencia numerica. Um contrato no grupo errado fica
 * no lugar errado da tela -- feio, e corrigivel olhando. Um contrato na unidade
 * errada publica um NUMERO FALSO no dashboard e no e-mail. A segunda e regra de
 * negocio e mora no pipeline (scripts/unidades.py); esta e arranjo visual.
 *
 * Ainda assim mora num lugar so, e ha teste exigindo que todo codigo do payload
 * caia em exatamente um grupo -- sem isso um contrato novo some da tela em
 * silencio, que e o modo de falha caro aqui.
 */
import type { Quote } from '@/types/dashboard';

export type GrupoId = 'juros' | 'cambio' | 'bolsa' | 'commodities' | 'cripto';

interface Grupo {
  id: GrupoId;
  titulo: string;
  nota: string;
  codigos: readonly string[];
}

export const GRUPOS: readonly Grupo[] = [
  {
    id: 'juros',
    titulo: 'Juros',
    // DDI entra aqui por ser instrumento de juros, mas varia em % porque a B3
    // o cota em PU -- a unidade continua vindo do payload, nao do grupo.
    nota: 'DI e FRA variam em pontos-base; o DDI é cotado em PU e varia em %',
    codigos: ['DI1', 'FRC', 'DDI'],
  },
  { id: 'cambio', titulo: 'Câmbio', nota: 'dólar futuro, em R$ por US$ mil', codigos: ['DOL'] },
  {
    id: 'bolsa',
    titulo: 'Renda variável',
    nota: 'índices em pontos, retorno de preço (sem dividendos)',
    codigos: ['IND', 'IBOV', 'SP500', 'NASDAQ'],
  },
  {
    id: 'commodities',
    titulo: 'Commodities',
    nota: 'agrícolas da B3 e petróleo à vista (EIA)',
    codigos: ['BGI', 'CCM', 'ICF', 'SJC', 'BRENT', 'WTI'],
  },
  {
    id: 'cripto',
    titulo: 'Cripto',
    nota: 'negocia 7 dias; o card usa o último dia útil, como os demais',
    codigos: ['BTC'],
  },
] as const;

/**
 * Contratos em destaque, em corpo maior e com sparkline.
 *
 * Criterio: sao as tres referencias que ancoram as demais leituras do mercado
 * brasileiro -- a taxa de ~1 ano (que precifica a curva inteira), o dolar
 * futuro (que entra em todo hedge cambial) e o Ibovespa futuro (a referencia
 * de renda variavel local). Nao e "os tres mais negociados"; e os tres de que
 * os outros dependem.
 */
export const ANCORAS = ['DI1', 'DOL', 'IND'] as const;

export interface Secao {
  id: GrupoId | 'outros';
  titulo: string;
  nota: string;
  itens: Quote[];
}

/** Distribui as cotacoes nas secoes, preservando a ordem de GRUPOS. */
export function agrupa(itens: readonly Quote[]): { secoes: Secao[]; orfaos: Quote[] } {
  const porCodigo = new Map(itens.map((i) => [i.code, i]));
  const usados = new Set<string>();

  const secoes: Secao[] = GRUPOS.map((g) => {
    const doGrupo: Quote[] = [];
    for (const code of g.codigos) {
      const q = porCodigo.get(code);
      if (q) {
        doGrupo.push(q);
        usados.add(code);
      }
    }
    return { id: g.id, titulo: g.titulo, nota: g.nota, itens: doGrupo };
  }).filter((s) => s.itens.length > 0);

  // Contrato novo no payload que ninguem classificou: aparece numa secao
  // "Outros" em vez de sumir. O teste cobra a classificacao, mas a tela nao
  // pode esconder dado por causa de uma lista desatualizada.
  const orfaos = itens.filter((i) => !usados.has(i.code));
  return { secoes, orfaos };
}
