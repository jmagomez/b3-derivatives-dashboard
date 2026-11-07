import * as RadixTabs from '@radix-ui/react-tabs';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/cn';

/**
 * Abas sobre Radix: navegacao por setas, Home/End, foco gerenciado e os
 * `aria-controls`/`aria-selected` corretos vem de graca. Reimplementar isso a
 * mao e onde a acessibilidade de dashboard costuma morrer.
 */
export const Tabs = RadixTabs.Root;

export function TabsList({ className, ...props }: ComponentPropsWithoutRef<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List className={cn('flex gap-1 border-b border-border', className)} {...props} />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={cn(
        'relative -mb-px px-3 py-2 text-sm font-medium text-muted transition-colors',
        'hover:text-fg',
        // A aba ativa e marcada por COR e por uma barra inferior: cor sozinha
        // nao serve a quem nao distingue matiz (WCAG 1.4.1).
        'data-[state=active]:text-fg',
        'data-[state=active]:after:absolute data-[state=active]:after:inset-x-0',
        'data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5',
        'data-[state=active]:after:bg-accent data-[state=active]:after:content-[""]',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadixTabs.Content>) {
  return (
    <RadixTabs.Content className={cn('mt-4 focus-visible:outline-none', className)} {...props} />
  );
}
