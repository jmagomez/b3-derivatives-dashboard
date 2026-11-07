import { lazy, Suspense } from 'react';
import { useSummary } from '@/hooks/use-summary';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { StaleBanner } from '@/components/features/stale-banner';
import { PainelResumo } from '@/components/features/resumo/painel-resumo';
import { ErrorBoundary } from '@/app/providers';
import { Skeleton } from '@/components/ui/skeleton';
import { data as fmtData } from '@/lib/formatters';

/**
 * Os paineis com grafico entram por import DINAMICO.
 *
 * Recharts pesa ~430 KB nao comprimidos. Importado de forma estatica, ele ia
 * para o bundle de entrada e todo mundo que abrisse o Resumo baixava os
 * graficos das outras NOVE abas sem usar: 567 KB (159 KB gzip) contra os
 * 129 KB (36 KB gzip) de antes. Com lazy(), o Rollup o move para um chunk
 * assincrono (~400 KB, 110 KB gzip) buscado no primeiro clique em qualquer
 * aba de grafico; a entrada fica em ~49 KB gzip.
 *
 * Cada painel tambem vira um chunk proprio de 1 a 12 KB -- abrir Cambio nao
 * baixa o codigo de Risco & retorno.
 *
 * O Resumo NAO entra aqui, de proposito: ele e a primeira tela, e adiar o que
 * ja precisa ser mostrado so acrescentaria um salto de layout.
 */
const PainelJuros = lazy(() =>
  import('@/components/features/juros/painel-juros').then((m) => ({ default: m.PainelJuros })),
);
const PainelCommodities = lazy(() =>
  import('@/components/features/commodities/painel-commodities').then((m) => ({
    default: m.PainelCommodities,
  })),
);
const PainelCambio = lazy(() =>
  import('@/components/features/cambio/painel-cambio').then((m) => ({ default: m.PainelCambio })),
);
const PainelCupom = lazy(() =>
  import('@/components/features/cupom/painel-cupom').then((m) => ({ default: m.PainelCupom })),
);
const PainelIbovespa = lazy(() =>
  import('@/components/features/ibovespa/painel-ibovespa').then((m) => ({
    default: m.PainelIbovespa,
  })),
);
const PainelGlobal = lazy(() =>
  import('@/components/features/global/painel-global').then((m) => ({ default: m.PainelGlobal })),
);
const PainelPetroleo = lazy(() =>
  import('@/components/features/petroleo/painel-petroleo').then((m) => ({
    default: m.PainelPetroleo,
  })),
);
const PainelOpcoes = lazy(() =>
  import('@/components/features/opcoes/painel-opcoes').then((m) => ({ default: m.PainelOpcoes })),
);
const PainelRisco = lazy(() =>
  import('@/components/features/risco/painel-risco').then((m) => ({ default: m.PainelRisco })),
);

function CarregandoPainel() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="grid gap-4 lg:grid-cols-2">
      <span className="sr-only">Carregando gráficos…</span>
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-80 w-full" />
    </div>
  );
}

function Cabecalho() {
  const { data } = useSummary();
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Derivativos B3 — Dashboard Diário
        </h1>
        <p className="mt-1 text-sm text-muted">
          {data ? `Último pregdão: ${fmtData(data.last_date)}` : 'Carregando o último fechamento…'}
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
        diferença entre duas taxas, medida em pontos-base (bps). Os demais contratos são cotados em
        preço, e a variação é relativa, em %. Exibir a diferença de uma taxa como “%” diria que a
        taxa caiu uma fração do próprio valor — outro número.
      </p>
      <p className="mt-2">
        <b>Fontes assíncronas.</b> B3, BCB, EIA e Yahoo publicam em ritmos diferentes. Cada card
        mostra a data da própria série e compara com o dia útil anterior dela, não com o último
        pregdão da B3.
      </p>
      <p className="mt-2">
        <b>Gráficos.</b> Cada um tem tabela equivalente sob o botão “Ver dados em tabela” — mesma
        informação, navegável por teclado e por leitor de tela. Datas sem cotação são descartadas,
        nunca interpoladas: por isso a curva não liga pontos por cima de um vencimento sem negócio.
      </p>
      {data?.generated_at && <p className="mt-2">Gerado em {data.generated_at.replace('T', ' ')}.</p>}
      <p className="mt-2">Conteúdo informativo. Não constitui recomendação de investimento.</p>
    </footer>
  );
}

/**
 * Ordem deliberada: o que e cotado em TAXA primeiro (juros, cupom), depois
 * preco local, depois o que vem de fora. Agrupar por natureza do instrumento
 * e o que faz o leitor nao precisar reaprender a unidade a cada clique.
 */
const ABAS = [
  { id: 'resumo', rotulo: 'Resumo', painel: <PainelResumo /> },
  { id: 'juros', rotulo: 'Juros', painel: <PainelJuros /> },
  { id: 'cupom', rotulo: 'Cupom cambial', painel: <PainelCupom /> },
  { id: 'cambio', rotulo: 'Câmbio', painel: <PainelCambio /> },
  { id: 'ibovespa', rotulo: 'Ibovespa', painel: <PainelIbovespa /> },
  { id: 'global', rotulo: 'Global', painel: <PainelGlobal /> },
  { id: 'commodities', rotulo: 'Commodities', painel: <PainelCommodities /> },
  { id: 'petroleo', rotulo: 'Petróleo', painel: <PainelPetroleo /> },
  { id: 'opcoes', rotulo: 'Opções', painel: <PainelOpcoes /> },
  { id: 'risco', rotulo: 'Risco & retorno', painel: <PainelRisco /> },
] as const;

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
        {data?.frescor && (
          <div className="mt-4">
            <StaleBanner frescor={data.frescor} />
          </div>
        )}

        <main id="conteudo" className="mt-5">
          <Tabs defaultValue="resumo">
            <TabsList aria-label="Seções do dashboard">
              {ABAS.map((a) => (
                <TabsTrigger key={a.id} value={a.id}>
                  {a.rotulo}
                </TabsTrigger>
              ))}
            </TabsList>
            {ABAS.map((a) => (
              <TabsContent key={a.id} value={a.id}>
                {/* Uma fronteira de erro POR ABA: um payload inesperado em
                    commodities nao pode derrubar o resumo. */}
                <ErrorBoundary>
                  <Suspense fallback={<CarregandoPainel />}>{a.painel}</Suspense>
                </ErrorBoundary>
              </TabsContent>
            ))}
          </Tabs>
        </main>

        <Rodape />
      </div>
    </div>
  );
}
