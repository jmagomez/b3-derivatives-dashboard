import { cn } from '@/lib/cn';

/**
 * Placeholder de carregamento. `aria-hidden` + `role="status"` no container:
 * o leitor de tela anuncia "carregando" uma vez, em vez de ler N retangulos.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-border/60', className)} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-32" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  );
}
