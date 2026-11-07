import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SeriePonto } from '@/types/dashboard';
import { ChartContainer } from './chart-container';
import { ChartDataTable } from './chart-data-table';
import { numero, data as fmtData } from '@/lib/formatters';

const EIXO = 'hsl(var(--muted))';
const GRADE = 'hsl(var(--border))';

interface Props {
  titulo: string;
  nota?: string | undefined;
  unidade: string;
  serie: readonly SeriePonto[];
  /** Quantos pregoes mostrar; undefined = a serie inteira. */
  janela?: number | undefined;
}

export function TimeSeriesChart({ titulo, nota, unidade, serie, janela }: Props) {
  const dados = useMemo(() => (janela ? serie.slice(-janela) : [...serie]), [serie, janela]);

  if (dados.length < 2) {
    return (
      <ChartContainer titulo={titulo} nota={nota} descricao={`${titulo}: sem série suficiente.`}>
        <p className="flex h-full items-center justify-center text-sm text-muted">
          Série insuficiente para o gráfico.
        </p>
      </ChartContainer>
    );
  }

  const primeiro = dados[0];
  const ultimo = dados.at(-1);
  const valores = dados.map((d) => d.value);
  const descricao =
    `${titulo}, ${dados.length} pregões de ${fmtData(primeiro?.date)} a ${fmtData(ultimo?.date)}. ` +
    `Mínimo ${numero(Math.min(...valores))} ${unidade}, máximo ${numero(Math.max(...valores))} ${unidade}, ` +
    `último ${numero(ultimo?.value ?? null)} ${unidade}.`;

  return (
    <ChartContainer
      titulo={titulo}
      nota={nota}
      descricao={descricao}
      tabela={
        <ChartDataTable
          titulo={`${titulo} — série diária`}
          colunas={[
            { chave: 'date', rotulo: 'Data' },
            { chave: 'value', rotulo: unidade },
          ]}
          // Mais recente primeiro: e o que se procura ao abrir a tabela.
          linhas={[...dados].reverse().map((d) => ({
            date: fmtData(d.date),
            value: numero(d.value),
          }))}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={GRADE} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: EIXO, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={48}
            tickFormatter={(v: string) => fmtData(v).slice(0, 5)}
          />
          <YAxis
            tick={{ fill: EIXO, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            domain={['dataMin', 'dataMax']}
            width={56}
            tickFormatter={(v: number) => numero(v)}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--surface))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(v) => fmtData(String(v))}
            formatter={(v) => [typeof v === 'number' ? `${numero(v)} ${unidade}` : '—', titulo]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--accent))"
            strokeWidth={1.8}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
