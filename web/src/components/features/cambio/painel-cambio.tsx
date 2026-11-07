import { useSeries, useBcb } from '@/hooks/use-series';
import { PainelSeries, type EspecSerie } from '@/components/features/painel-series';
import { somenteSeries } from '@/lib/grupos';

const DO_PIPELINE: readonly EspecSerie[] = [
  {
    chave: 'DOL',
    titulo: 'Dólar futuro',
    unidade: 'R$/US$ mil',
    nota: 'primeiro vencimento · ajuste diário da B3',
  },
];

const DO_BCB: readonly EspecSerie[] = [
  {
    chave: 'ptax_venda',
    titulo: 'PTAX venda',
    unidade: 'R$/US$',
    // A nao-sincronia importa: toda conversao de moeda do dashboard usa PTAX,
    // e ela nao e do mesmo instante do fechamento de NY.
    nota: 'média de janelas do BCB, ~13h BRT — não sincronizada com o fechamento de NY (~17h BRT)',
  },
];

export function PainelCambio() {
  const series = useSeries();
  const bcb = useBcb();

  return (
    <div className="grid gap-4">
      <PainelSeries
        specs={DO_PIPELINE}
        dados={somenteSeries(series.data)}
        carregando={series.isPending}
        erro={series.error}
        rotuloCarregando="Carregando dólar futuro…"
      />
      <PainelSeries
        specs={DO_BCB}
        dados={bcb.data}
        carregando={bcb.isPending}
        erro={bcb.error}
        rotuloCarregando="Carregando PTAX…"
      />
    </div>
  );
}
