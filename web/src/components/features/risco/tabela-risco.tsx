import type { Janela, LinhaAnalytics } from '@/types/dashboard';
import { numero } from '@/lib/formatters';
import { cn } from '@/lib/cn';

const JANELAS: readonly Janela[] = ['1M', '3M', '6M', '12M', 'YTD'];

function pct(v: number | null | undefined, casas = 2): string {
  return v === null || v === undefined ? '—' : `${numero(Number(v.toFixed(casas)))}%`;
}

/** Cor NUNCA sozinha (WCAG 1.4.1): o sinal ja esta no proprio numero. */
function Sinalizado({ v, children }: { v: number | null | undefined; children: string }) {
  if (v === null || v === undefined) return <span className="text-muted">—</span>;
  return (
    <span className={cn('tabular-nums', v > 0 ? 'text-up' : v < 0 ? 'text-down' : undefined)}>
      {v > 0 ? '+' : ''}
      {children.replace(/^\+/, '')}
    </span>
  );
}

interface Props {
  linhas: readonly LinhaAnalytics[];
  cdiRet: Partial<Record<Janela, number | null>>;
}

export function TabelaRisco({ linhas, cdiRet }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[56rem] text-sm">
        <caption className="sr-only">
          Retorno, volatilidade, drawdown e excesso sobre o CDI por ativo, com Sharpe e o numerador
          aritmético que o compõe
        </caption>
        <thead className="bg-surface text-xs text-muted">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              Ativo
            </th>
            {JANELAS.map((j) => (
              <th key={j} scope="col" className="px-3 py-2 text-right font-medium">
                {j}
              </th>
            ))}
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Vol 12m
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              DD 12m
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Excesso CDI 12m
              <span className="block font-normal normal-case">composto, p.p.</span>
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Excesso anualizado
              <span className="block font-normal normal-case">aritmético, numerador</span>
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Sharpe 12m
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.codigo} className="border-t border-border">
              <th scope="row" className="px-3 py-2 text-left font-medium">
                {l.rotulo}
                <span className="ml-1.5 text-xs text-muted">{l.moeda}</span>
              </th>
              {JANELAS.map((j) => (
                <td key={j} className="px-3 py-2 text-right">
                  <Sinalizado v={l.ret[j]}>{pct(l.ret[j])}</Sinalizado>
                </td>
              ))}
              <td className="px-3 py-2 text-right tabular-nums">{pct(l.vol['12M'], 1)}</td>
              <td className="px-3 py-2 text-right">
                <Sinalizado v={l.dd12m?.atual}>{pct(l.dd12m?.atual, 1)}</Sinalizado>
              </td>
              <td className="px-3 py-2 text-right">
                {l.moeda === 'R$' ? (
                  <Sinalizado v={l.excesso_cdi?.['12M']}>
                    {l.excesso_cdi?.['12M'] === null || l.excesso_cdi?.['12M'] === undefined
                      ? '—'
                      : `${numero(Number(l.excesso_cdi['12M'].toFixed(2)))} p.p.`}
                  </Sinalizado>
                ) : (
                  // Nao e dado faltando: comparar ativo em US$ com o CDI
                  // misturaria premio de risco com cambio.
                  <span className="text-xs text-muted">n/a em {l.moeda}</span>
                )}
              </td>
              <td className="px-3 py-2 text-right">
                <Sinalizado v={l.excesso_arit_12m}>{pct(l.excesso_arit_12m)}</Sinalizado>
              </td>
              <td className="px-3 py-2 text-right">
                <Sinalizado v={l.sharpe_12m}>
                  {l.sharpe_12m === null ? '—' : l.sharpe_12m.toFixed(2).replace('.', ',')}
                </Sinalizado>
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-border bg-surface/60">
            <th scope="row" className="px-3 py-2 text-left font-medium">
              CDI
              <span className="ml-1.5 text-xs text-muted">referência</span>
            </th>
            {JANELAS.map((j) => (
              <td key={j} className="px-3 py-2 text-right tabular-nums">
                {pct(cdiRet[j])}
              </td>
            ))}
            <td className="px-3 py-2 text-right text-muted" colSpan={5}>
              taxa livre de risco local — base do excesso e do Sharpe
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
