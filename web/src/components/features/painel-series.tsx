import type { PontoSimples, SeriePonto } from '@/types/dashboard';
import { TimeSeriesChart } from '@/components/charts/time-series-chart';
import { Skeleton } from '@/components/ui/skeleton';

export interface EspecSerie {
  chave: string;
  titulo: string;
  unidade: string;
  nota?: string | undefined;
}

interface Props {
  specs: readonly EspecSerie[];
  dados: Record<string, readonly (PontoSimples | SeriePonto)[]> | undefined;
  carregando: boolean;
  erro?: Error | null | undefined;
  rotuloCarregando: string;
}

/**
 * Quatro abas (Cambio, Global, Petroleo, Cupom) sao a mesma coisa: N series
 * temporais num grid. Em vez de quatro componentes quase iguais, uma lista de
 * especificacoes e um painel so -- o que cada aba tem de proprio fica na sua
 * lista, nao numa copia do layout.
 *
 * Uma serie ausente no payload e PULADA, nao vira grafico vazio: fonte que
 * nao publicou e diferente de fonte que publicou zero.
 */
export function PainelSeries({ specs, dados, carregando, erro, rotuloCarregando }: Props) {
  if (carregando) {
    return (
      <div role="status" aria-live="polite" aria-busy="true" className="grid gap-4 lg:grid-cols-2">
        <span className="sr-only">{rotuloCarregando}</span>
        {specs.map((s) => (
          <Skeleton key={s.chave} className="h-80 w-full" />
        ))}
      </div>
    );
  }

  if (erro) {
    return (
      <div role="alert" className="rounded-xl border border-down/40 bg-down/10 p-4 text-sm">
        <strong className="font-semibold">Não foi possível carregar os dados.</strong>
        <p className="mt-1 text-muted">{erro.message}</p>
      </div>
    );
  }

  const presentes = specs.filter((s) => (dados?.[s.chave]?.length ?? 0) >= 2);

  if (presentes.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        Nenhuma série disponível nesta seção.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {presentes.map((s) => (
        <TimeSeriesChart
          key={s.chave}
          titulo={s.titulo}
          nota={s.nota}
          unidade={s.unidade}
          serie={dados?.[s.chave] ?? []}
        />
      ))}
    </div>
  );
}
