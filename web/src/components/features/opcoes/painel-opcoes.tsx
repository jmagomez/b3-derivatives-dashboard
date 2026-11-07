import { useMemo } from 'react';
import { useOpcoes } from '@/hooks/use-series';
import { PainelSeries, type EspecSerie } from '@/components/features/painel-series';
import { ChartDataTable } from '@/components/charts/chart-data-table';
import { Card, CardNote, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { numero, data as fmtData } from '@/lib/formatters';
import type { OpcaoDia, PontoSimples } from '@/types/dashboard';

/** Nomes da B3 nao dizem nada a quem nao convive com o arquivo diario. */
const NOMES: Record<string, string> = {
  DOL: 'Dólar',
  IDI: 'Índice DI (IDI)',
  IND: 'Ibovespa',
  BGI: 'Boi gordo',
  CCM: 'Milho',
  ICF: 'Café arábica',
  SJC: 'Soja',
};

interface Agregado {
  porMercadoria: Record<string, PontoSimples[]>;
  specs: EspecSerie[];
  ultimaData: string | null;
  linhas: Array<Record<string, string | number | null>>;
}

function agrega(rows: readonly OpcaoDia[]): Agregado {
  const porMercadoria: Record<string, PontoSimples[]> = {};
  for (const r of rows) {
    (porMercadoria[r.mercadoria] ??= []).push({ date: r.date, value: r.contratos_negociados });
  }
  for (const serie of Object.values(porMercadoria)) {
    serie.sort((a, b) => a.date.localeCompare(b.date));
  }

  const ultimaData = rows.length
    ? rows.reduce((max, r) => (r.date > max ? r.date : max), rows[0]!.date)
    : null;

  const doDia = rows.filter((r) => r.date === ultimaData);
  const volTotal = doDia.reduce((s, r) => s + r.volume, 0);
  const linhas = doDia
    .slice()
    .sort((a, b) => b.volume - a.volume)
    .map((r) => ({
      mercadoria: `${r.mercadoria} — ${NOMES[r.mercadoria] ?? 'não catalogado'}`,
      contratos: numero(r.contratos_negociados),
      volume: numero(Math.round(r.volume)),
      // Participacao e o que responde "isto e liquido?"; o numero absoluto nao.
      share: volTotal > 0 ? `${numero(Math.round((r.volume / volTotal) * 1000) / 10)}%` : '—',
      negocios: numero(r.negocios),
    }));

  // Ordena os graficos pela liquidez do dia, nao alfabeticamente: quem olha
  // esta aba quer ver primeiro onde ha mercado.
  const ordem = doDia
    .slice()
    .sort((a, b) => b.volume - a.volume)
    .map((r) => r.mercadoria);
  const resto = Object.keys(porMercadoria).filter((m) => !ordem.includes(m));
  const specs: EspecSerie[] = [...ordem, ...resto].map((m) => ({
    chave: m,
    titulo: `${m} — ${NOMES[m] ?? 'não catalogado'}`,
    unidade: 'contratos/dia',
  }));

  return { porMercadoria, specs, ultimaData, linhas };
}

const COLUNAS = [
  { chave: 'mercadoria', rotulo: 'Mercadoria' },
  { chave: 'contratos', rotulo: 'Contratos' },
  { chave: 'volume', rotulo: 'Volume (R$)' },
  { chave: 'share', rotulo: '% do volume' },
  { chave: 'negocios', rotulo: 'Negócios' },
] as const;

export function PainelOpcoes() {
  const { data, isPending, error } = useOpcoes();
  const ag = useMemo(() => (data ? agrega(data) : null), [data]);

  if (isPending) return <Skeleton className="h-96 w-full" />;
  if (error) {
    return (
      <Card className="p-4">
        <CardTitle>Opções</CardTitle>
        <CardNote>Não foi possível carregar: {error.message}</CardNote>
      </Card>
    );
  }
  if (!ag || ag.specs.length === 0) {
    return (
      <Card className="p-4">
        <CardTitle>Opções</CardTitle>
        <CardNote>Sem dados de opções nesta rodada.</CardNote>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <Card className="p-4">
        <CardTitle>Liquidez por mercadoria — {fmtData(ag.ultimaData)}</CardTitle>
        <div className="mt-3">
          <ChartDataTable
            titulo={`Opções negociadas em ${fmtData(ag.ultimaData)}`}
            colunas={COLUNAS}
            linhas={ag.linhas}
          />
        </div>
        <CardNote className="mt-3">
          Volume agregado do arquivo público diário da B3, só <b>opções</b> — não inclui o futuro do
          mesmo ativo. Um dia com zero contratos é zero de verdade, não dado faltando: nos
          vencimentos agrícolas isso é rotina, e a série é descontínua por construção. Sem abertura
          por strike nem por vencimento na fonte, daqui não sai superfície de volatilidade.
        </CardNote>
      </Card>
      <PainelSeries
        specs={ag.specs}
        dados={ag.porMercadoria}
        carregando={false}
        rotuloCarregando="Carregando opções…"
      />
    </div>
  );
}
