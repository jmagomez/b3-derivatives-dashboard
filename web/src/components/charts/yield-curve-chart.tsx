import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CurvaDI } from '@/types/dashboard';
import { ChartContainer } from './chart-container';
import { ChartDataTable } from './chart-data-table';
import { numero, data as fmtData } from '@/lib/formatters';

const EIXO = 'hsl(var(--muted))';
const GRADE = 'hsl(var(--border))';

export function YieldCurveChart({ curva }: { curva: CurvaDI }) {
  // Junta as duas curvas pelo vencimento: a de hoje e a de ~1 ano atras.
  // Vencimentos que so existem numa delas entram com null, e `connectNulls`
  // fica FALSO de proposito -- ligar os pontos por cima de um buraco
  // desenharia um trecho de curva que nao foi negociado.
  const porVenc = new Map<string, { venc: string; hoje: number | null; antes: number | null }>();
  for (const p of curva.curve) porVenc.set(p.venc, { venc: p.venc, hoje: p.rate, antes: null });
  for (const p of curva.curve_old) {
    const atual = porVenc.get(p.venc);
    if (atual) atual.antes = p.rate;
    else porVenc.set(p.venc, { venc: p.venc, hoje: null, antes: p.rate });
  }
  const dados = [...porVenc.values()];
  const temAntiga = curva.curve_old.length > 0;

  // Conta os vencimentos da curva DE HOJE, nao da uniao com a antiga: quem
  // ouve a descricao quer saber o tamanho da curva vigente. A uniao (`dados`)
  // existe so para alinhar as duas linhas no mesmo eixo.
  const descricao =
    `Curva de juros do DI em ${fmtData(curva.ref)}, com ${curva.curve.length} vencimentos, ` +
    `de ${curva.curve[0]?.venc ?? '—'} a ${curva.curve.at(-1)?.venc ?? '—'}. ` +
    (temAntiga
      ? `Comparada com a curva de ${fmtData(curva.ref_old)}, em linha tracejada.`
      : 'Sem curva de comparação disponível.');

  return (
    <ChartContainer
      titulo="Curva de juros (DI)"
      nota={
        temAntiga
          ? `taxa por vencimento · linha tracejada = ${fmtData(curva.ref_old)}`
          : 'taxa por vencimento'
      }
      descricao={descricao}
      tabela={
        <ChartDataTable
          titulo="Curva de juros do DI por vencimento"
          colunas={[
            { chave: 'venc', rotulo: 'Vencimento' },
            { chave: 'hoje', rotulo: `% a.a. (${fmtData(curva.ref)})` },
            { chave: 'antes', rotulo: temAntiga ? `% a.a. (${fmtData(curva.ref_old)})` : '—' },
          ]}
          linhas={dados.map((d) => ({
            venc: d.venc,
            hoje: d.hoje === null ? null : numero(d.hoje),
            antes: d.antes === null ? null : numero(d.antes),
          }))}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={GRADE} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="venc"
            tick={{ fill: EIXO, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: EIXO, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            domain={['dataMin - 0.3', 'dataMax + 0.3']}
            tickFormatter={(v: number) => v.toFixed(1)}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--surface))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: 'hsl(var(--fg))' }}
            // O tipo de `value` no Recharts e ValueType (number|string|array):
            // estreitar aqui, em vez de forcar cast, mantem o typecheck honesto.
            formatter={(v, nome) => [typeof v === 'number' ? `${numero(v)}% a.a.` : '—', nome]}
          />
          {temAntiga && (
            <Line
              type="monotone"
              dataKey="antes"
              name={fmtData(curva.ref_old)}
              stroke={EIXO}
              strokeDasharray="4 3"
              strokeWidth={1.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
          <Line
            type="monotone"
            dataKey="hoje"
            name={fmtData(curva.ref)}
            stroke="hsl(var(--accent))"
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
