import { useId } from 'react';
import { cn } from '@/lib/cn';

interface Props {
  valores: readonly number[];
  /** Cor segue a direcao do periodo inteiro, nao a do ultimo dia. */
  direcao?: 'up' | 'down' | 'flat' | null | undefined;
  className?: string | undefined;
  rotulo: string;
}

/**
 * SVG a mao, de proposito -- nao Recharts.
 *
 * Um sparkline nao precisa de eixo, tooltip, legenda nem ResponsiveContainer.
 * Montar tres deles com Recharts significaria tres observadores de resize e
 * tres arvores de componentes para desenhar uma polyline. Aqui sao ~30 linhas
 * e zero dependencia -- e, decisivo neste projeto, nenhum byte de Recharts no
 * bundle de ENTRADA, que e onde o resumo vive.
 *
 * `aria-hidden`: o sparkline e redundante com o numero ao lado. Anunciar
 * "grafico" a quem usa leitor de tela sem oferecer os pontos so acrescenta
 * ruido -- a serie completa esta na aba Juros, com tabela equivalente.
 */
export function Sparkline({ valores, direcao, className, rotulo }: Props) {
  const id = useId();
  if (valores.length < 2) return null;

  const L = 100;
  const A = 28;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const span = max - min || 1;

  const pontos = valores.map((v, i) => {
    const x = (i / (valores.length - 1)) * L;
    const y = A - ((v - min) / span) * A;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const cor = direcao === 'up' ? 'text-up' : direcao === 'down' ? 'text-down' : 'text-muted';

  return (
    <svg
      viewBox={`0 0 ${L} ${A}`}
      preserveAspectRatio="none"
      aria-hidden
      focusable="false"
      className={cn('h-7 w-full', cor, className)}
    >
      <title>{rotulo}</title>
      <defs>
        <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${A} ${pontos.join(' ')} ${L},${A}`}
        fill={`url(#g${id})`}
        stroke="none"
      />
      <polyline
        points={pontos.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
