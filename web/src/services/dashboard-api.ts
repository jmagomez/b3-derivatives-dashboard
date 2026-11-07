import type { ZodTypeAny, z } from 'zod';
import { buscaJson, ErroDeDados } from './http-client';
import {
  summarySchema,
  seriesSchema,
  curvaDISchema,
  marketsSchema,
  eiaSchema,
  bcbSchema,
  opcoesSchema,
  analyticsSchema,
} from './schemas/dashboard.schema';

/**
 * Um metodo por arquivo publicado. Cada um valida com Zod ANTES de devolver:
 * payload fora do contrato falha aqui, nomeando o campo, em vez de virar
 * `undefined` num grafico vazio tres camadas adiante (invariante 9).
 */
async function carrega<T extends ZodTypeAny>(arquivo: string, schema: T): Promise<z.infer<T>> {
  const bruto = await buscaJson(arquivo);
  const resultado = schema.safeParse(bruto);
  if (!resultado.success) {
    const primeiro = resultado.error.issues[0];
    const onde = primeiro ? `${primeiro.path.join('.') || '(raiz)'}: ${primeiro.message}` : '';
    throw new ErroDeDados(`${arquivo} fora do contrato — ${onde}`, arquivo, resultado.error);
  }
  return resultado.data as z.infer<T>;
}

export const dashboardApi = {
  summary: () => carrega('summary.json', summarySchema),
  series: () => carrega('series.json', seriesSchema),
  curvaDI: () => carrega('di_curve.json', curvaDISchema),
  markets: () => carrega('markets.json', marketsSchema),
  eia: () => carrega('eia.json', eiaSchema),
  bcb: () => carrega('bcb.json', bcbSchema),
  opcoes: () => carrega('opcoes.json', opcoesSchema),
  analytics: () => carrega('analytics.json', analyticsSchema),
};
