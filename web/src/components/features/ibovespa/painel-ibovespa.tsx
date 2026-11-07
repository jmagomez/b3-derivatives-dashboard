import { useMemo } from 'react';
import { useSeries, useMarkets, useAnalytics } from '@/hooks/use-series';
import { PainelSeries, type EspecSerie } from '@/components/features/painel-series';
import { somenteSeries } from '@/lib/grupos';
import { TimeSeriesChart } from '@/components/charts/time-series-chart';
import { Card, CardNote, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { numero, data as fmtData } from '@/lib/formatters';

const PRECOS: readonly EspecSerie[] = [
  {
    chave: 'IND',
    titulo: 'Ibovespa futuro',
    unidade: 'pontos',
    nota: 'primeiro vencimento · ajuste diário da B3',
  },
];
const SPOT: readonly EspecSerie[] = [
  { chave: 'ibov', titulo: 'Ibovespa à vista', unidade: 'pontos', nota: 'fechamento' },
];

function Base() {
  const { data, isPending, error } = useAnalytics();

  const base = data?.base_ind;
  const serie = useMemo(() => base?.serie ?? [], [base]);

  if (isPending) return <Skeleton className="h-72 w-full" />;
  // analytics.json e a unica fonte que pode faltar sem derrubar o dashboard;
  // a base e informacao extra, nao motivo para esvaziar a aba.
  if (error || !base) {
    return (
      <Card className="p-4">
        <CardTitle>Base do futuro</CardTitle>
        <CardNote>
          Indisponível — o <code>analytics.json</code> não foi publicado nesta rodada.
        </CardNote>
      </Card>
    );
  }

  const u = base.ultimo;

  return (
    <div className="grid gap-4">
      {u !== null && (
        <Card className="p-4">
          <CardTitle>Base do futuro sobre o à vista</CardTitle>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted">IND {u.venc ?? '—'}</dt>
              <dd className="font-medium tabular-nums">{numero(u.ind)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Ibovespa à vista</dt>
              <dd className="font-medium tabular-nums">{numero(u.ibov)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Base</dt>
              <dd className="font-medium tabular-nums">{numero(u.pts)} pts</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Base relativa</dt>
              <dd className="font-medium tabular-nums">
                {u.pct === null ? '—' : `${numero(u.pct)}%`}
              </dd>
            </div>
          </dl>
          <CardNote className="mt-3">
            Base = futuro − à vista, em {fmtData(u.date)}. Positiva é o normal: o futuro embute o
            carrego até o vencimento (CDI menos dividendos esperados). Ela converge para zero no
            vencimento, então o nível isolado diz menos que o desvio em relação ao carrego teórico —
            e o salto a cada rolagem de vencimento é mudança de contrato, não de mercado.
          </CardNote>
        </Card>
      )}
      <TimeSeriesChart
        titulo="Base relativa (futuro/à vista − 1)"
        unidade="%"
        serie={serie}
        nota="descontinuidades nas rolagens de vencimento são do contrato, não do mercado"
      />
    </div>
  );
}

export function PainelIbovespa() {
  const series = useSeries();
  const markets = useMarkets();

  return (
    <div className="grid gap-4">
      <PainelSeries
        specs={PRECOS}
        dados={somenteSeries(series.data)}
        carregando={series.isPending}
        erro={series.error}
        rotuloCarregando="Carregando Ibovespa futuro…"
      />
      <PainelSeries
        specs={SPOT}
        dados={markets.data}
        carregando={markets.isPending}
        erro={markets.error}
        rotuloCarregando="Carregando Ibovespa à vista…"
      />
      <Base />
    </div>
  );
}
