import { z } from 'zod';

/**
 * Validacao do contrato na FRONTEIRA.
 *
 * Por que validar um JSON que nos mesmos produzimos: o produtor e um pipeline
 * Python que roda sozinho todo dia util e evolui em outro ritmo que o front.
 * Sem validacao, um campo renomeado la vira `undefined` aqui e vaza silencioso
 * ate um grafico vazio tres camadas adiante -- o modo de falha mais caro de
 * depurar. Com Zod a falha e imediata e diz qual campo, em qual item.
 *
 * As regras abaixo nao sao decorativas: cada uma corresponde a uma invariante
 * ja escrita no CLAUDE.md.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const varUnitSchema = z.enum(['bps', 'pct']);

export const quoteSchema = z
  .object({
    code: z.string().min(1),
    label: z.string().min(1),
    unit: z.string(),
    date: z.string().regex(ISO_DATE, 'data deve ser ISO (AAAA-MM-DD)'),
    value: z.number().finite(),
    prev: z.number().finite().nullable(),
    variation: z.number().finite().nullable(),
    var_unit: varUnitSchema,
    venc: z.string().nullable(),
  })
  .superRefine((q, ctx) => {
    // "Nao inventar numero" (invariante 2 do CLAUDE.md): sem ponto de
    // comparacao a variacao e null, nunca zero -- zero afirmaria "nao mudou".
    if (q.prev === null && q.variation !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${q.code}: variacao preenchida sem valor anterior`,
      });
    }
  });

export const frescorSchema = z.object({
  last_date: z.string().regex(ISO_DATE),
  dias: z.number().int().nonnegative(),
  nome: z.string(),
  limite: z.number().int().positive(),
});

export const summarySchema = z
  .object({
    generated_at: z.string(),
    generated_at_utc: z.string().optional(),
    last_date: z.string().regex(ISO_DATE),
    items: z.array(quoteSchema).min(1, 'summary sem itens'),
    frescor: z.record(z.string(), frescorSchema),
    analytics_status: z.object({ ok: z.boolean(), erro: z.string().nullable() }),
  })
  .superRefine((s, ctx) => {
    // Nenhuma cotacao pode ser mais NOVA que o ultimo pregao da B3: se for,
    // entrou barra intradiaria ou dado de fim de semana (invariante 1).
    for (const it of s.items) {
      if (it.date > s.last_date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${it.code}: data ${it.date} posterior ao ultimo pregao ${s.last_date}`,
        });
      }
    }
  });

const seriePontoSchema = z.object({
  date: z.string().regex(ISO_DATE),
  value: z.number().finite(),
  venc: z.string().optional(),
  contratos: z.number().int().optional(),
  volume: z.number().finite().optional(),
});

export const serieSchema = z.object({
  label: z.string(),
  unit: z.string(),
  serie: z.array(seriePontoSchema),
});

export const seriesSchema = z.record(z.string(), serieSchema);

const pontoCurvaSchema = z.object({
  venc: z.string(),
  mat: z.string().regex(ISO_DATE),
  // Faixa de plausibilidade: o pipeline ja descarta fora de (0, 60), e uma
  // taxa fora disso aqui significa PU corrompido virando taxa absurda.
  rate: z.number().gt(0).lt(60),
});

export const curvaDISchema = z.object({
  ref: z.string().regex(ISO_DATE),
  curve: z.array(pontoCurvaSchema),
  ref_old: z.string().regex(ISO_DATE).nullable(),
  curve_old: z.array(pontoCurvaSchema),
});

export type SummaryValidado = z.infer<typeof summarySchema>;
export type SeriesValidado = z.infer<typeof seriesSchema>;
export type CurvaDIValidado = z.infer<typeof curvaDISchema>;

/* ==========================================================================
   Demais payloads
   ========================================================================== */

const pontoSimplesSchema = z.object({
  date: z.string().regex(ISO_DATE),
  value: z.number().finite(),
});

/** Chaves variam (sp500, btc, brent, crack_diesel, cdi...): record aberto. */
const seriesPorChaveSchema = z.record(z.string(), z.array(pontoSimplesSchema));

export const marketsSchema = seriesPorChaveSchema;
export const eiaSchema = seriesPorChaveSchema;
export const bcbSchema = seriesPorChaveSchema;

export const opcoesSchema = z.array(
  z.object({
    date: z.string().regex(ISO_DATE),
    mercadoria: z.string().min(1),
    contratos_negociados: z.number().finite(),
    volume: z.number().finite(),
    negocios: z.number().finite(),
  }),
);

const janelaSchema = z.record(z.string(), z.number().finite().nullable());

const linhaAnalyticsSchema = z
  .object({
    codigo: z.string().min(1),
    rotulo: z.string().min(1),
    moeda: z.string(),
    ref: z.string().regex(ISO_DATE).nullable(),
    ret: janelaSchema,
    vol: janelaSchema,
    dd12m: z
      .object({
        max: z.number().finite().nullable(),
        vale: z.string().nullable(),
        atual: z.number().finite().nullable(),
      })
      .nullable(),
    sharpe_12m: z.number().finite().nullable(),
    excesso_arit_12m: z.number().finite().nullable(),
    vol_excesso_12m: z.number().finite().nullable(),
    extremos_12m: z
      .record(
        z.string(),
        z.object({ pct: z.number().finite().nullable(), data: z.string().nullable() }),
      )
      .nullable(),
    excesso_cdi: janelaSchema.optional(),
  })
  .superRefine((l, ctx) => {
    // Sharpe so existe onde ha taxa livre de risco na moeda do ativo: os dados
    // do repositorio nao tem risk-free em US$. Um Sharpe em ativo de US$
    // significaria que alguem comparou com o CDI, o que seria errado.
    if (l.moeda === 'US$' && l.sharpe_12m !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${l.codigo}: Sharpe em ativo de US$ — nao ha risk-free em US$ nos dados`,
      });
    }
    // O numerador tem de vir junto com o indice, e vice-versa.
    if ((l.sharpe_12m === null) !== (l.excesso_arit_12m === null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${l.codigo}: sharpe_12m e excesso_arit_12m precisam existir juntos`,
      });
    }
  });

export const analyticsSchema = z.object({
  as_of: z.string().regex(ISO_DATE),
  linhas: z.array(linhaAnalyticsSchema).min(1),
  cdi: z.object({
    ret: janelaSchema,
    ate: z.string().nullable(),
    anualizado_atual: z
      .object({ pct: z.number().finite().nullable(), data: z.string().nullable() })
      .nullable(),
  }),
  correlacao: z.record(
    z.string(),
    z.object({
      ativos: z.array(z.string()),
      matriz: z.array(z.array(z.number().finite())),
      n: z.number().int().positive(),
      inicio: z.string().regex(ISO_DATE),
      fim: z.string().regex(ISO_DATE),
    }),
  ),
  juro_real: z
    .object({
      cdi_12m: z.number().finite().nullable(),
      ipca_12m: z.number().finite().nullable(),
      real_12m: z.number().finite().nullable(),
      janela_ini: z.string().nullable(),
      janela_fim: z.string().nullable(),
    })
    .nullable(),
  curva: z
    .object({
      ref: z.string().regex(ISO_DATE),
      ref_old: z.string().nullable(),
      prazos: z.array(
        z.object({
          anos: z.number().int().positive(),
          atual: z.number().finite().nullable(),
          antes: z.number().finite().nullable(),
          var_bp: z.number().finite().nullable(),
        }),
      ),
    })
    .nullable(),
  base_ind: z
    .object({
      ultimo: z
        .object({
          ind: z.number().finite(),
          ibov: z.number().finite(),
          pts: z.number().finite(),
          pct: z.number().finite(),
          venc: z.string().nullable(),
          date: z.string().regex(ISO_DATE),
        })
        .nullable(),
      serie: z.array(pontoSimplesSchema),
    })
    .nullable(),
  series: z.object({
    drawdown: z.record(z.string(), z.array(pontoSimplesSchema)).optional(),
    ibov_brl_usd: z.record(z.string(), z.array(pontoSimplesSchema)).optional(),
  }),
});
