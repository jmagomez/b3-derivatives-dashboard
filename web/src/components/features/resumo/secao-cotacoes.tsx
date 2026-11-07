import type { Quote } from '@/types/dashboard';
import { QuoteCard } from '@/components/features/summary-grid/quote-card';

interface Props {
  titulo: string;
  nota: string;
  itens: readonly Quote[];
  ancora: string;
}

/**
 * Uma classe de ativo por secao, com cabecalho discreto.
 *
 * O grid plano anterior misturava juros, cambio, bolsa, commodities e cripto
 * em ordem arbitraria: achar "cambio" exigia ler os quinze rotulos. O
 * cabecalho e um <h3> de verdade (nao um div estilizado) para que a navegacao
 * por cabecalhos do leitor de tela funcione.
 */
export function SecaoCotacoes({ titulo, nota, itens, ancora }: Props) {
  if (itens.length === 0) return null;
  return (
    <section className="mt-6">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-border pb-1.5">
        <h3 className="text-sm font-semibold tracking-tight">{titulo}</h3>
        <span className="text-xs text-muted">{nota}</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {itens.map((q) => (
          <QuoteCard key={q.code} quote={q} ancora={ancora} />
        ))}
      </div>
    </section>
  );
}
