import { useSeries } from '@/hooks/use-series';
import { TimeSeriesChart } from '@/components/charts/time-series-chart';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Agricolas da B3. O petroleo (Brent/WTI) vem do EIA e nao esta em
 * series.json -- entra num passo futuro, junto com os crack spreads.
 */
const AGRICOLAS = [
  { code: 'BGI', titulo: 'Boi Gordo', unidade: 'R$/@' },
  { code: 'CCM', titulo: 'Milho', unidade: 'R$/saca' },
  { code: 'ICF', titulo: 'Café Arábica', unidade: 'US$/saca' },
  { code: 'SJC', titulo: 'Soja', unidade: 'US$/saca' },
] as const;

export function PainelCommodities() {
  const { data, isPending, error } = useSeries();

  if (isPending) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className="grid gap-4 lg:grid-cols-2">
        <span className="sr-only">Carregando gráficos de commodities…</span>
        {AGRICOLAS.map((c) => (
          <Skeleton key={c.code} className="h-80 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-down/40 bg-down/10 p-4 text-sm">
        <strong className="font-semibold">Não foi possível carregar as commodities.</strong>
        <p className="mt-1 text-muted">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {AGRICOLAS.map(({ code, titulo, unidade }) => {
        const s = data[code];
        if (!s) return null;
        return (
          <TimeSeriesChart
            key={code}
            titulo={titulo}
            nota="primeiro vencimento · ajuste diário"
            unidade={unidade}
            serie={s.serie}
          />
        );
      })}
    </div>
  );
}
