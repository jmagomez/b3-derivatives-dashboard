/**
 * Valida os JSON publicados pelo pipeline Python contra os schemas Zod.
 *
 * Roda no deploy ANTES de publicar: se o pipeline renomeou um campo, a falha
 * acontece aqui e o site no ar continua sendo o ultimo bom. Sem isso o campo
 * ausente vira `undefined` e so aparece como grafico vazio em producao.
 *
 * Uso:  npx tsx scripts/validate-data-contract.ts [diretorio]
 *       (padrao: ../docs/data, que e onde o pipeline escreve)
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ZodTypeAny } from 'zod';
import {
  summarySchema,
  seriesSchema,
  curvaDISchema,
  marketsSchema,
  eiaSchema,
  bcbSchema,
  opcoesSchema,
  analyticsSchema,
} from '../src/services/schemas/dashboard.schema.js';

const DIR = resolve(process.argv[2] ?? join(import.meta.dirname, '..', '..', 'docs', 'data'));

/** Arquivo -> schema. `obrigatorio: false` para o que o pipeline pode remover. */
const CONTRATO: Array<{ arquivo: string; schema: ZodTypeAny; obrigatorio: boolean }> = [
  { arquivo: 'summary.json', schema: summarySchema, obrigatorio: true },
  { arquivo: 'series.json', schema: seriesSchema, obrigatorio: true },
  { arquivo: 'di_curve.json', schema: curvaDISchema, obrigatorio: true },
  { arquivo: 'markets.json', schema: marketsSchema, obrigatorio: true },
  { arquivo: 'eia.json', schema: eiaSchema, obrigatorio: true },
  { arquivo: 'bcb.json', schema: bcbSchema, obrigatorio: true },
  { arquivo: 'opcoes.json', schema: opcoesSchema, obrigatorio: true },
  // analytics.json e REMOVIDO pelo pipeline quando o calculo falha, de
  // proposito (ver analytics_status no summary). Ausencia nao e erro de
  // contrato; numero velho exibido como atual seria.
  { arquivo: 'analytics.json', schema: analyticsSchema, obrigatorio: false },
];

let falhas = 0;

for (const { arquivo, schema, obrigatorio } of CONTRATO) {
  const caminho = join(DIR, arquivo);

  if (!existsSync(caminho)) {
    if (obrigatorio) {
      console.error(`FALTA   ${arquivo}`);
      falhas++;
    } else {
      console.warn(`ausente ${arquivo} (opcional)`);
    }
    continue;
  }

  const resultado = schema.safeParse(JSON.parse(readFileSync(caminho, 'utf8')));
  if (resultado.success) {
    console.log(`OK      ${arquivo}`);
  } else {
    falhas++;
    console.error(`INVALIDO ${arquivo}`);
    for (const issue of resultado.error.issues.slice(0, 10)) {
      console.error(`   ${issue.path.join('.') || '(raiz)'}: ${issue.message}`);
    }
    if (resultado.error.issues.length > 10) {
      console.error(`   ... e mais ${resultado.error.issues.length - 10} problema(s)`);
    }
  }
}

if (falhas) {
  console.error(`\n${falhas} arquivo(s) fora do contrato. Deploy abortado.`);
  process.exit(1);
}
console.log('\nContrato de dados conferido.');
