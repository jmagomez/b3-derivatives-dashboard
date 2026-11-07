import { data as fmtData } from '@/lib/formatters';

interface Props {
  rotulo: string;
  ativos: readonly string[];
  matriz: readonly (readonly number[])[];
  n: number;
  inicio: string;
  fim: string;
}

/**
 * O numero fica sempre escrito. Mapear correlacao so em cor falharia WCAG
 * 1.4.1 e, pior, perderia precisao justo na faixa que decide diversificacao
 * (0,3 e 0,6 viram dois tons de azul parecidos).
 */
function fundo(v: number): string {
  const a = Math.min(Math.abs(v), 1) * 0.28;
  return v >= 0 ? `hsl(var(--accent) / ${a})` : `hsl(var(--warn) / ${a})`;
}

export function MatrizCorrelacao({ rotulo, ativos, matriz, n, inicio, fim }: Props) {
  return (
    <div>
      <h4 className="text-sm font-medium">{rotulo}</h4>
      <p className="mt-0.5 text-xs text-muted">
        {n} dias úteis em comum · {fmtData(inicio)} a {fmtData(fim)}
      </p>
      <div className="mt-2 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <caption className="sr-only">
            Matriz de correlação de {rotulo}, {n} observações, de {fmtData(inicio)} a {fmtData(fim)}
          </caption>
          <thead>
            <tr>
              <td />
              {ativos.map((a) => (
                <th key={a} scope="col" className="px-2 py-1.5 text-right font-medium text-muted">
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ativos.map((a, i) => (
              <tr key={a} className="border-t border-border">
                <th scope="row" className="px-2 py-1.5 text-left font-medium">
                  {a}
                </th>
                {ativos.map((b, j) => {
                  const v = matriz[i]?.[j];
                  return (
                    <td
                      key={b}
                      className="px-2 py-1.5 text-right tabular-nums"
                      style={v === undefined ? undefined : { background: fundo(v) }}
                    >
                      {v === undefined ? '—' : v.toFixed(2).replace('.', ',')}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
