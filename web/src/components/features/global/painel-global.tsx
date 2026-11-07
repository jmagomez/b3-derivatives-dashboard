import { useMarkets } from '@/hooks/use-series';
import { PainelSeries, type EspecSerie } from '@/components/features/painel-series';

const SPECS: readonly EspecSerie[] = [
  {
    chave: 'sp500',
    titulo: 'S&P 500',
    unidade: 'pontos',
    nota: 'fechamento · retorno de preço, sem dividendos',
  },
  {
    chave: 'nasdaq',
    titulo: 'Nasdaq Composite',
    unidade: 'pontos',
    nota: 'fechamento · retorno de preço, sem dividendos',
  },
  {
    chave: 'btc',
    titulo: 'Bitcoin',
    unidade: 'US$',
    // Aqui o fim de semana FICA, ao contrario do card de resumo: no grafico
    // ele e informacao; no card, criaria uma data que nenhum outro indicador
    // do dashboard tem.
    nota: 'negocia 7 dias — o gráfico mantém sábado e domingo, o card de resumo não',
  },
  { chave: 'ibov', titulo: 'Ibovespa à vista', unidade: 'pontos' },
];

export function PainelGlobal() {
  const { data, isPending, error } = useMarkets();
  return (
    <PainelSeries
      specs={SPECS}
      dados={data}
      carregando={isPending}
      erro={error}
      rotuloCarregando="Carregando índices globais…"
    />
  );
}
