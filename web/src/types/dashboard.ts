/**
 * Contrato de dados publicado pelo pipeline Python em docs/data/.
 *
 * Os nomes seguem o payload em snake_case de proposito. Converter para
 * camelCase exigiria uma camada de mapeamento entre a fronteira (Zod) e o
 * dominio -- mais um lugar para divergir do produtor, que e exatamente o tipo
 * de duplicacao que este projeto acabou de remover do lado Python.
 */

/**
 * Unidade da variacao diaria. Emitida por scripts/unidades.py; a UI NUNCA
 * infere a unidade a partir do codigo do contrato.
 *
 *  'bps'  contrato cotado em TAXA (DI1, FRC). O ajuste ja e um percentual,
 *         entao a variacao e a DIFERENCA entre duas taxas, em pontos-base.
 *  'pct'  contrato cotado em PRECO. A variacao e relativa.
 */
export type VarUnit = 'bps' | 'pct';

/** Um card do resumo: fechamento de um contrato e sua variacao diaria. */
export interface Quote {
  code: string;
  label: string;
  /** Unidade do NIVEL (nao da variacao): "% a.a.", "R$/@", "pontos". */
  unit: string;
  /**
   * Data da propria serie, em ISO. Pode ser ANTERIOR a `last_date`: as fontes
   * publicam em ritmos diferentes (EIA costuma ficar dias atras da B3). O card
   * compara com o dia util anterior DELE, nao com o ultimo pregao da B3.
   */
  date: string;
  value: number;
  prev: number | null;
  /** Ja na unidade que `var_unit` declara. `null` = sem comparacao, nao zero. */
  variation: number | null;
  var_unit: VarUnit;
  /** Vencimento do contrato ("X27"); `null` para indices e spot. */
  venc: string | null;
}

/** Ponto de uma serie historica. Liquidez so existe para contratos da B3. */
export interface SeriePonto {
  date: string;
  value: number;
  venc?: string;
  contratos?: number;
  volume?: number;
}

export interface Serie {
  label: string;
  unit: string;
  serie: SeriePonto[];
}

/** Defasagem de uma fonte. `limite` vem de scripts/fontes.py. */
export interface Frescor {
  last_date: string;
  dias: number;
  nome: string;
  limite: number;
}

export interface Summary {
  generated_at: string;
  generated_at_utc?: string;
  /** Ultimo pregao da B3 -- a ancora temporal do dashboard. */
  last_date: string;
  items: Quote[];
  frescor: Record<string, Frescor>;
  /**
   * Analytics falha isolada: quando `ok` e false o analytics.json foi REMOVIDO
   * pelo pipeline em vez de ficar exibindo numero velho como atual. A aba
   * mostra o aviso.
   */
  analytics_status: { ok: boolean; erro: string | null };
}

export interface PontoCurva {
  venc: string;
  mat: string;
  rate: number;
}

export interface CurvaDI {
  ref: string;
  curve: PontoCurva[];
  ref_old: string | null;
  curve_old: PontoCurva[];
}
