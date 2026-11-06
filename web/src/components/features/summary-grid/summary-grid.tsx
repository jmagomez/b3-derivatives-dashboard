import { useSummary } from '@/hooks/use-summary';
import { SkeletonCard } from '@/components/ui/skeleton';
import { QuoteCard } from './quote-card';

const ESQUELETOS = 15;

export function SummaryGrid() {
  const { data, isPending, error } = useSummary();

  if (isPending) {
    return (
      <div role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">Carregando cotações…</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: ESQUELETOS }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-down/40 bg-down/10 p-4 text-sm">
        <strong className="font-semibold">Não foi possível carregar as cotações.</strong>
        <p className="mt-1 text-muted">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.items.map((q) => (
        <QuoteCard key={q.code} quote={q} ancora={data.last_date} />
      ))}
    </div>
  );
}
