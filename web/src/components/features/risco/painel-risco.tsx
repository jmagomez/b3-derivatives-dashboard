import { useAnalytics } from '@/hooks/use-series';
import { Card, CardNote, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TimeSeriesChart } from '@/components/charts/time-series-chart';
import { numero, data as fmtData } from '@/lib/formatters';
import { TabelaRisco } from './tabela-risco';
import { MatrizCorrelacao } from './matriz-correlacao';
import { Metodologia } from './metodologia';

const ROTULO_JANELA: Record<string, string> = {
  '63': '3 meses (63 dias úteis)',
  '252': '12 meses (252 dias úteis)',
};

export function PainelRisco() {
  const { data, isPending, error } = useAnalytics();

  if (isPending) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // analytics.json e a unica fonte opcional do pipeline: quando a coleta falha
  // o arquivo e REMOVIDO em vez de publicado velho. A aba precisa dizer isso,
  // nao mostrar uma tela vazia que parece bug.
  if (error || !data) {
    return (
      <Card className="p-4">
        <CardTitle>Risco &amp; retorno</CardTitle>
        <CardNote>
          O <code>analytics.json</code> não foi publicado nesta rodada. O pipeline remove o arquivo
          quando a coleta falha, em vez de republicar números velhos sem aviso — então aqui não há
          nada desatualizado se passando por atual.
        </CardNote>
      </Card>
    );
  }

  const jr = data.juro_real;
  const dd = data.series.drawdown ?? {};
  const brlUsd = data.series.ibov_brl_usd ?? {};

  return (
    <div className="grid gap-4">
      <Card className="p-4">
        <CardTitle>Retorno, volatilidade e excesso sobre o CDI</CardTitle>
        <CardNote className="mt-1">
          Apurado em {fmtData(data.as_of)}
          {data.cdi.ate ? ` · CDI acumulado até ${fmtData(data.cdi.ate)}` : ''}
          {data.cdi.anualizado_atual?.pct !== null && data.cdi.anualizado_atual?.pct !== undefined
            ? ` · CDI anualizado hoje ${numero(data.cdi.anualizado_atual.pct)}%`
            : ''}
        </CardNote>
        <div className="mt-3">
          <TabelaRisco linhas={data.linhas} cdiRet={data.cdi.ret} />
        </div>
        <CardNote className="mt-3">
          As duas colunas de excesso podem ter <b>sinais opostos</b> e ambas estarem certas — o
          bloco de metodologia abaixo explica por quê.
        </CardNote>
      </Card>

      <Card className="p-4">
        <CardTitle>Correlação entre os ativos</CardTitle>
        <div className="mt-3 grid gap-5 lg:grid-cols-2">
          {Object.entries(data.correlacao)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([janela, c]) => (
              <MatrizCorrelacao
                key={janela}
                rotulo={ROTULO_JANELA[janela] ?? `${janela} dias úteis`}
                ativos={c.ativos}
                matriz={c.matriz}
                n={c.n}
                inicio={c.inicio}
                fim={c.fim}
              />
            ))}
        </div>
        <CardNote className="mt-3">
          Comparar as duas janelas é o ponto: correlação de 3 meses que se afasta muito da de 12
          meses é regime recente, não propriedade estável do par.
        </CardNote>
      </Card>

      {jr !== null && (
        <Card className="p-4">
          <CardTitle>Juro real</CardTitle>
          <dl className="mt-3 grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-xs text-muted">CDI 12m</dt>
              <dd className="font-medium tabular-nums">
                {jr.cdi_12m === null ? '—' : `${numero(jr.cdi_12m)}%`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">IPCA 12m</dt>
              <dd className="font-medium tabular-nums">
                {jr.ipca_12m === null ? '—' : `${numero(jr.ipca_12m)}%`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Juro real</dt>
              <dd className="font-medium tabular-nums">
                {jr.real_12m === null ? '—' : `${numero(jr.real_12m)}%`}
              </dd>
            </div>
          </dl>
          <CardNote className="mt-3">
            Fisher exato, não subtração. Janela de {fmtData(jr.janela_ini)} a{' '}
            {fmtData(jr.janela_fim)} — é a do IPCA já fechado, que termina antes da janela das
            outras colunas desta aba.
          </CardNote>
        </Card>
      )}

      {Object.entries(dd).map(([chave, serie]) => (
        <TimeSeriesChart
          key={chave}
          titulo={`Drawdown — ${chave}`}
          unidade="%"
          serie={serie}
          nota="sobre o máximo acumulado dos últimos 12 meses, em fechamentos"
        />
      ))}

      {Object.entries(brlUsd).map(([chave, serie]) => (
        <TimeSeriesChart
          key={chave}
          titulo={`Ibovespa em ${chave}`}
          unidade={chave === 'US$' ? 'pontos (US$)' : 'pontos'}
          serie={serie}
          nota={
            chave === 'US$'
              ? 'índice convertido pela PTAX do dia — escala própria, não comparável ponto a ponto com a série em R$'
              : 'índice de fechamento'
          }
        />
      ))}

      <Metodologia />
    </div>
  );
}
