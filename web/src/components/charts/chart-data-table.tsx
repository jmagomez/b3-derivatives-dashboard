import { useState } from 'react';
import { Table2 } from 'lucide-react';

export interface ColunaTabela {
  chave: string;
  rotulo: string;
}

interface Props {
  titulo: string;
  colunas: readonly ColunaTabela[];
  linhas: ReadonlyArray<Record<string, string | number | null>>;
}

/**
 * Tabela equivalente ao grafico.
 *
 * Mesmo em SVG, uma linha com 350 pontos nao e navegavel por leitor de tela.
 * A tabela e a forma acessivel do MESMO dado -- e, na pratica, tambem e o que
 * um analista usa para conferir um valor exato sem passar o mouse ponto a
 * ponto. Por isso ela e visivel sob demanda, e nao escondida em sr-only: um
 * recurso util para todos some quando so o leitor de tela o alcanca.
 */
export function ChartDataTable({ titulo, colunas, linhas }: Props) {
  const [aberta, setAberta] = useState(false);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted transition-colors hover:text-fg"
      >
        <Table2 aria-hidden className="h-3.5 w-3.5" />
        {aberta ? 'Ocultar' : 'Ver'} dados em tabela
      </button>

      {aberta && (
        <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <caption className="sr-only">{titulo}</caption>
            <thead className="sticky top-0 bg-surface">
              <tr>
                {colunas.map((c) => (
                  <th
                    key={c.chave}
                    scope="col"
                    className="border-b border-border px-2 py-1.5 text-right font-medium text-muted first:text-left"
                  >
                    {c.rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i} className="odd:bg-border/20">
                  {colunas.map((c) => (
                    <td
                      key={c.chave}
                      className="px-2 py-1 text-right font-mono tabular-nums first:text-left first:font-sans"
                    >
                      {l[c.chave] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
