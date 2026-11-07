import { useCurvaDI, useSeries } from '@/hooks/use-series';
import { YieldCurveChart } from '@/components/charts/yield-curve-chart';
import { TimeSeriesChart } from '@/components/charts/time-series-chart';
import { Skeleton } from '@/components/ui/skeleton';

function Erro({ mensagem }: { mensagem: string }) {
  return (
    <div role="alert" className="rounded-xl border border-down/40 bg-down/10 p-4 text-sm">
      <strong className="font-semibold">Não foi possível carregar os dados de juros.</strong>
      <p className="mt-1 text-muted">{mensagem}</p>
    </div>
  );
}

export function PainelJuros() {
  const curva = useCurvaDI();
  const series = useSeries();

  if (curva.isPending || series.isPending) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className="grid gap-4 lg:grid-cols-2">
        <span className="sr-only">Carregando gráficos de juros…</span>
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }
  if (curva.error) return <Erro mensagem={curva.error.message} />;
  if (series.error) return <Erro mensagem={series.error.message} />;

  const di = series.data['DI1'];
  const frc = series.data['FRC'];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <YieldCurveChart curva={curva.data} />
      {di && (
        <TimeSeriesChart
          titulo="DI de ~1 ano"
          nota="taxa do vencimento mais próximo de 252 dias úteis"
          unidade="% a.a."
          serie={di.serie}
        />
      )}
      {frc && (
        <TimeSeriesChart
          titulo="FRA de Cupom (FRC)"
          nota="taxa do primeiro vencimento"
          unidade="% a.a."
          serie={frc.serie}
        />
      )}
    </div>
  );
}
