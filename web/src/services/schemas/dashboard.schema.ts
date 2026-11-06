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
