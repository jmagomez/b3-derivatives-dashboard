import type { Quote, SeriePonto } from '@/types/dashboard';
import { Card } from '@/components/ui/card';
import { Sparkline } from '@/components/charts/sparkline';
import { VariationBadge } from '@/components/features/summary-grid/variation-badge';
import { numero, data as fmtData } from '@/lib/formatters';
import { direcao } from '@/lib/variation';

const JANELA = 20; // ~1 mes de pregoes

interface Props {
  quote: Quote;
  serie?: readonly SeriePonto[] | undefined;
}

/**
 * Card dos contratos-ancora: corpo maior, sparkline e faixa do periodo.
 *
 * A faixa (min-max de 20 pregoes) existe porque uma variacao isolada nao diz
 * se o movimento e grande: "-11,6 bps" so vira informacao ao lado de "a taxa
 * andou entre 14,19 e 14,68 no mes".
 *
 * A cor do sparkline segue a direcao do PERIODO INTEIRO, nao a do ultimo dia:
 * uma alta de 0,2 bp num mes de queda nao deve pintar o mini-grafico de verde.
 */
export function AnchorCard({ quote, serie }: Props) {
  const janela = serie?.slice(-JANELA) ?? [];
  const valores = janela.map((p) => p.value);
  const dir =
    valores.length >= 2
      ? direcao((valores.at(-1) ?? 0) - (valores[0] ?? 0))
      : direcao(quote.variation);

  const min = valores.length ? Math.min(...valores) : null;
  const max = valores.length ? Math.max(...valores) : null;

  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{quote.label}</span>
        {quote.venc && <span className="text-xs text-muted">{quote.venc}</span>}
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="font-mono text-3xl font-semibold tabular-nums leading-none">
            {numero(quote.value)}
          </div>
          <div className="mt-1 text-xs text-muted">{quote.unit}</div>
        </div>
        <VariationBadge valor={quote.variation} unidade={quote.var_unit} className="text-base" />
      </div>

      {valores.length >= 2 && (
        <>
          <Sparkline
            valores={valores}
            direcao={dir}
            rotulo={`${quote.label}: ${valores.length} pregões`}
          />
          <div className="flex justify-between text-[11px] text-muted">
            <span className="font-mono tabular-nums">mín. {numero(min)}</span>
            <span>{valores.length} pregões</span>
            <span className="font-mono tabular-nums">máx. {numero(max)}</span>
          </div>
        </>
      )}

      <div className="text-xs text-muted">Ref.: {fmtData(quote.date)}</div>
    </Card>
  );
}
