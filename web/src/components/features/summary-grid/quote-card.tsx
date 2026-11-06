import { Clock } from 'lucide-react';
import type { Quote } from '@/types/dashboard';
import { Card } from '@/components/ui/card';
import { numero, data as fmtData, diasUteisEntre } from '@/lib/formatters';
import { VariationBadge } from './variation-badge';

interface Props {
  quote: Quote;
  /** Ultimo pregao da B3 -- ancora para medir defasagem desta fonte. */
  ancora: string;
}

export function QuoteCard({ quote, ancora }: Props) {
  const defasagem = quote.date < ancora ? diasUteisEntre(quote.date, ancora) : 0;

  return (
    <Card className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-muted">
          {quote.label}
          {quote.venc ? <span className="ml-1 opacity-70">({quote.venc})</span> : null}
        </span>
      </div>

      <div className="font-mono text-2xl font-semibold tabular-nums">
        {numero(quote.value)}
        <span className="ml-1 text-xs font-normal text-muted">{quote.unit}</span>
      </div>

      <VariationBadge valor={quote.variation} unidade={quote.var_unit} />

      <div className="mt-1 text-xs text-muted">Ref.: {fmtData(quote.date)}</div>

      {defasagem > 0 && (
        // Fontes publicam em ritmos diferentes (EIA costuma ficar dias atras
        // da B3). Sem este selo o card parece desatualizado por engano -- e a
        // variacao compara com o dia util anterior DESTA serie, nao com o
        // ultimo pregao.
        <div
          className="mt-1 inline-flex items-center gap-1 rounded bg-warn/10 px-1.5 py-0.5 text-xs text-warn"
          title={`Última cotação desta fonte: ${fmtData(quote.date)}. Último pregão da B3: ${fmtData(ancora)}.`}
        >
          <Clock aria-hidden className="h-3 w-3" />
          {defasagem} {defasagem === 1 ? 'dia útil' : 'dias úteis'} de defasagem
        </div>
      )}
    </Card>
  );
}
