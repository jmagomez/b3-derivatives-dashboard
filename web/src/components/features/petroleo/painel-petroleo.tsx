import { useEia } from '@/hooks/use-series';
import { PainelSeries, type EspecSerie } from '@/components/features/painel-series';

const SPECS: readonly EspecSerie[] = [
  { chave: 'brent', titulo: 'Brent Dated', unidade: 'US$/barril', nota: 'preço à vista (EIA)' },
  { chave: 'wti', titulo: 'WTI Spot', unidade: 'US$/barril', nota: 'preço à vista (EIA)' },
  {
    chave: 'crack_gasoline',
    titulo: 'Crack spread — gasolina',
    unidade: 'US$/barril',
    nota: 'produto (US$/gal) × 42 − Brent',
  },
  {
    chave: 'crack_diesel',
    titulo: 'Crack spread — diesel',
    unidade: 'US$/barril',
    nota: 'produto (US$/gal) × 42 − Brent',
  },
  {
    chave: 'crack_jet',
    titulo: 'Crack spread — querosene de aviação',
    unidade: 'US$/barril',
    nota: 'produto (US$/gal) × 42 − Brent',
  },
];

export function PainelPetroleo() {
  const { data, isPending, error } = useEia();
  return (
    <div className="grid gap-4">
      <p className="rounded-lg border border-border bg-surface p-3 text-xs text-muted">
        Só preços <b>à vista</b>. Não há fonte gratuita para a curva de futuros (ICE Brent, CME
        WTI), então não há estrutura a termo aqui — e a EIA publica com alguns dias de defasagem em
        relação à B3.
      </p>
      <PainelSeries
        specs={SPECS}
        dados={data}
        carregando={isPending}
        erro={error}
        rotuloCarregando="Carregando petróleo…"
      />
    </div>
  );
}
