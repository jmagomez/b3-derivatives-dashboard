import { useMemo } from 'react';
import { useSummary } from '@/hooks/use-summary';
import { useSeries } from '@/hooks/use-series';
import { SkeletonCard } from '@/components/ui/skeleton';
import { agrupa, ANCORAS } from '@/lib/grupos';
import { AnchorCard } from './anchor-card';
import { SecaoCotacoes } from './secao-cotacoes';

export function PainelResumo() {
  const { data, isPending, error } = useSummary();
  // As series alimentam so os sparklines dos ancoras: se demorarem ou
  // falharem, os cards aparecem sem o mini-grafico em vez de segurar a tela.
  const series = useSeries();

  const { ancoras, secoes, orfaos } = useMemo(() => {
    if (!data) return { ancoras: [], secoes: [], orfaos: [] };
    const porCodigo = new Map(data.items.map((i) => [i.code, i]));
    const destaque = ANCORAS.map((c) => porCodigo.get(c)).filter((q) => q !== undefined);
    const ehAncora = (c: string) => (ANCORAS as readonly string[]).includes(c);
    const { secoes, orfaos } = agrupa(data.items.filter((i) => !ehAncora(i.code)));
    return { ancoras: destaque, secoes, orfaos };
  }, [data]);

  if (isPending) {
    return (
      <div role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">Carregando cotações…</span>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
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
    <>
      <section>
        <h3 className="sr-only">Principais referências</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {ancoras.map((q) => (
            <AnchorCard key={q.code} quote={q} serie={series.data?.[q.code]?.serie} />
          ))}
        </div>
      </section>

      {secoes.map((s) => (
        <SecaoCotacoes
          key={s.id}
          titulo={s.titulo}
          nota={s.nota}
          itens={s.itens}
          ancora={data.last_date}
        />
      ))}

      {orfaos.length > 0 && (
        <SecaoCotacoes
          titulo="Outros"
          nota="contratos ainda não classificados em src/lib/grupos.ts"
          itens={orfaos}
          ancora={data.last_date}
        />
      )}
    </>
  );
}
