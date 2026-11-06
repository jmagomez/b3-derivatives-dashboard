import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface p-4 shadow-sm',
        'transition-colors duration-theme',
        className,
      )}
      {...props}
    />
  );
}

/**
 * `children` e obrigatorio e explicito: um heading vazio e um defeito de
 * acessibilidade (o leitor de tela anuncia um nivel de titulo sem conteudo),
 * e com `{...props}` sozinho nem o lint nem o compilador conseguem garantir
 * que ele foi preenchido.
 */
export function CardTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & { children: ReactNode }) {
  return (
    <h3 className={cn('text-sm font-semibold', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardNote({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-xs text-muted', className)} {...props} />;
}
