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
  venc?: string | undefined;
  contratos?: number | undefined;
  volume?: number | undefined;
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
  generated_at_utc?: string | undefined;
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

/* --------------------------------------------------------------------------
   Guard de divergencia, em tempo de COMPILACAO.

   As interfaces acima existem para serem lidas: carregam a documentacao do
   contrato. Os schemas Zod existem para validar. Nada impedia os dois de
   divergirem em silencio -- e divergencia entre duas descricoes da mesma
   coisa e o defeito que este repositorio passou a semana corrigindo.

   As linhas abaixo nao geram codigo. Se schema e interface deixarem de
   descrever a mesma forma, `tsc` falha e nomeia o campo.

   `import type`: nenhuma dependencia de runtime, e por isso a regra de
   arquitetura do ESLint (allowTypeImports) permite o import de services aqui.
   -------------------------------------------------------------------------- */
import type { z } from 'zod';
import type {
  summarySchema,
  serieSchema,
  curvaDISchema,
} from '@/services/schemas/dashboard.schema';

type Exatamente<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Afirma<T extends true> = T;

export type _SummaryBate = Afirma<Exatamente<z.infer<typeof summarySchema>, Summary>>;
export type _SerieBate = Afirma<Exatamente<z.infer<typeof serieSchema>, Serie>>;
export type _CurvaBate = Afirma<Exatamente<z.infer<typeof curvaDISchema>, CurvaDI>>;

/* ==========================================================================
   Demais payloads de docs/data/
   ========================================================================== */

/** Serie simples {date, value} -- markets, eia, bcb e as series de analytics. */
export interface PontoSimples {
  date: string;
  value: number;
}

/** markets.json: indices globais, bitcoin e Ibovespa a vista (Yahoo). */
export type Markets = Record<string, PontoSimples[]>;

/** eia.json: Brent, WTI e crack spreads dos produtos contra o Brent. */
export type Eia = Record<string, PontoSimples[]>;

/** bcb.json: CDI, Selic, IPCA e PTAX venda. */
export type Bcb = Record<string, PontoSimples[]>;

/** opcoes.json: liquidez diaria por mercadoria. */
export interface OpcaoDia {
  date: string;
  mercadoria: string;
  contratos_negociados: number;
  volume: number;
  negocios: number;
}

/* ----------------------------- analytics.json --------------------------- */

export type Janela = '1M' | '3M' | '6M' | '12M' | 'YTD';

export interface LinhaAnalytics {
  codigo: string;
  rotulo: string;
  /** "R$", "US$" ou "R$/US$". Decide se ha Sharpe: nao ha taxa livre de risco
      em US$ nos dados do repositorio. */
  moeda: string;
  ref: string | null;
  ret: Partial<Record<Janela, number | null>>;
  vol: Partial<Record<string, number | null>>;
  dd12m: { max: number | null; vale: string | null; atual: number | null } | null;
  /** Media aritmetica dos excessos diarios / desvio deles, anualizado. */
  sharpe_12m: number | null;
  /**
   * Numerador do Sharpe, em % a.a. Pode ter SINAL OPOSTO ao de `excesso_cdi`,
   * que e a diferenca entre retornos COMPOSTOS -- a distancia entre os dois e
   * o arrasto de volatilidade (-sigma^2/2). Os dois estao certos; a tela
   * precisa dos dois para nao parecer contraditoria.
   */
  excesso_arit_12m: number | null;
  vol_excesso_12m: number | null;
  extremos_12m: Record<string, { pct: number | null; data: string | null }> | null;
  /** Diferenca de retornos compostos, em p.p. So para ativos em R$. */
  excesso_cdi?: Partial<Record<Janela, number | null>> | undefined;
}

export interface Analytics {
  as_of: string;
  linhas: LinhaAnalytics[];
  cdi: {
    ret: Partial<Record<Janela, number | null>>;
    ate: string | null;
    anualizado_atual: { pct: number | null; data: string | null } | null;
  };
  correlacao: Record<
    string,
    { ativos: string[]; matriz: number[][]; n: number; inicio: string; fim: string }
  >;
  juro_real: {
    cdi_12m: number | null;
    ipca_12m: number | null;
    real_12m: number | null;
    janela_ini: string | null;
    janela_fim: string | null;
  } | null;
  curva: {
    ref: string;
    ref_old: string | null;
    prazos: { anos: number; atual: number | null; antes: number | null; var_bp: number | null }[];
  } | null;
  base_ind: {
    ultimo: {
      ind: number;
      ibov: number;
      pts: number;
      pct: number;
      venc: string | null;
      date: string;
    } | null;
    serie: PontoSimples[];
  } | null;
  series: {
    drawdown?: Record<string, PontoSimples[]> | undefined;
    ibov_brl_usd?: Record<string, PontoSimples[]> | undefined;
  };
}
