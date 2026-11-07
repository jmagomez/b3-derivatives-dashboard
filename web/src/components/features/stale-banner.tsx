import { AlertTriangle } from 'lucide-react';
import type { Frescor } from '@/types/dashboard';
import { data as fmtData } from '@/lib/formatters';

/**
 * Aviso de fonte parada. Sem ele, uma quebra silenciosa na coleta faz o
 * dashboard exibir o ultimo fechamento bom como se fosse o de hoje, e isso
 * passa semanas sem ser notado.
 *
 * `nome` e `limite` vem do proprio payload (gravados por build_site.py a
 * partir de scripts/fontes.py): o front nao tem uma segunda tabela de fontes.
 */
export function StaleBanner({ frescor }: { frescor: Record<string, Frescor> }) {
  const atrasadas = Object.entries(frescor)
    .filter(([, f]) => f.dias > f.limite)
    .sort(([a], [b]) => a.localeCompare(b));

  if (atrasadas.length === 0) return null;

  return (
    <div
      role="alert"
      className="flex gap-2 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm"
    >
      <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
      <div>
        <strong className="font-semibold">Dados possivelmente defasados.</strong>{' '}
        {atrasadas.map(([chave, f], i) => (
          <span key={chave}>
            {i > 0 && ' · '}
            <b>{f.nome}</b> parado em {fmtData(f.last_date)} ({f.dias} dias)
          </span>
        ))}
        <p className="mt-1 text-muted">
          Os números abaixo são o último fechamento disponível de cada fonte, não o de hoje.
        </p>
      </div>
    </div>
  );
}
