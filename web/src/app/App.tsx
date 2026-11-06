import { useSummary } from '@/hooks/use-summary';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { SummaryGrid } from '@/components/features/summary-grid/summary-grid';
import { StaleBanner } from '@/components/features/stale-banner';
import { data as fmtData } from '@/lib/formatters';

function Cabecalho() {
  const { data } = useSummary();
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Derivativos B3 — Dashboard Diário
        </h1>
        <p className="mt-1 text-sm text-muted">
          {data
            ? `Último pregão: ${fmtData(data.last_date)}`
            : 'Carregando o último fechamento…'}
        </p>
      </div>
      <ThemeToggle />
    </header>
  );
}

function Rodape() {
  const { data } = useSummary();
  return (
    <footer className="mt-10 border-t border-border pt-4 text-xs text-muted">
      <p>
        <b>Unidades.</b> DI Futuro e FRA de Cupom são cotados em taxa (% a.a.): a variação é a
        diferença entre duas taxas, medida em pontos-base (bps). Os demais contratos são cotados
        em preço, e a variação é relativa, em %. Exibir a diferença de uma taxa como “%” diria que
        a taxa caiu uma fração do próprio valor — outro número.
      </p>
      <p className="mt-2">
        <b>Fontes assíncronas.</b> B3, BCB, EIA e Yahoo publicam em ritmos diferentes. Cada card
        mostra a data da própria série e compara com o dia útil anterior dela, não com o último
        pregão da B3.
      </p>
      {data?.generated_at && (
        <p className="mt-2">Gerado em {data.generated_at.replace('T', ' ')}.</p>
      )}
      <p className="mt-2">Conteúdo informativo. Não constitui recomendação de investimento.</p>
    </footer>
  );
}

export function App() {
  const { data } = useSummary();

  return (
    <div className="min-h-screen">
      <a
        href="#conteudo"
        className="sr-only-focusable absolute left-3 top-3 z-50 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-bg"
      >
        Pular para o conteúdo
      </a>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Cabecalho />
        {data?.frescor && <StaleBanner frescor={data.frescor} />}
        <main id="conteudo" className="mt-4">
          <h2 className="sr-only">Fechamento dos contratos</h2>
          <SummaryGrid />
        </main>
        <Rodape />
      </div>
    </div>
  );
}
