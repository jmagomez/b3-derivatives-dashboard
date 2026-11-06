import type { VarUnit } from '@/types/dashboard';
import { formataVariacao, direcao, descreveVariacao } from '@/lib/variation';
import { cn } from '@/lib/cn';

interface Props {
  valor: number | null;
  unidade: VarUnit;
  className?: string;
}

/**
 * A variacao diaria, na unidade que o PAYLOAD declara.
 *
 * Este componente e o motivo de o projeto existir nesta forma: ele nao sabe o
 * que e um DI nem um FRC, nao tem lista de codigos e nao decide nada. Recebe
 * (valor, unidade) e formata. A regra "contrato cotado em taxa varia em bps"
 * vive em scripts/unidades.py, num lugar so.
 *
 * A seta e decorativa (`aria-hidden`); quem usa leitor de tela ouve a frase de
 * `descreveVariacao` -- "queda de 11,6 pontos-base" --, nao "triangulo para
 * baixo onze virgula seis b p s".
 */
export function VariationBadge({ valor, unidade, className }: Props) {
  const dir = direcao(valor);
  const seta = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono text-sm tabular-nums',
        dir === 'up' && 'text-up',
        dir === 'down' && 'text-down',
        (dir === null || dir === 'flat') && 'text-muted',
        className,
      )}
    >
      {seta && <span aria-hidden>{seta}</span>}
      <span aria-hidden>{formataVariacao(valor, unidade)}</span>
      <span className="sr-only">{descreveVariacao(valor, unidade)}</span>
    </span>
  );
}
