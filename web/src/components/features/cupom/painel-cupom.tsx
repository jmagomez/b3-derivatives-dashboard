import { useSeries } from '@/hooks/use-series';
import { PainelSeries, type EspecSerie } from '@/components/features/painel-series';
import { somenteSeries } from '@/lib/grupos';

const SPECS: readonly EspecSerie[] = [
  {
    chave: 'DDI',
    titulo: 'Cupom cambial (DDI)',
    unidade: 'PU',
    // A unidade explica por que este contrato varia em % e nao em bps, ao
    // contrario do FRC logo ao lado: a B3 o cota em PU, nao em taxa.
    nota: 'cotado em PU pela B3 — por isso a variação diária dele é relativa (%), não em bps',
  },
  {
    chave: 'FRC',
    titulo: 'FRA de Cupom (FRC)',
    unidade: '% a.a.',
    nota: 'cotado em taxa — variação diária em pontos-base',
  },
];

export function PainelCupom() {
  const { data, isPending, error } = useSeries();
  return (
    <PainelSeries
      specs={SPECS}
      dados={somenteSeries(data)}
      carregando={isPending}
      erro={error}
      rotuloCarregando="Carregando cupom cambial…"
    />
  );
}
