import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Component, type ErrorInfo, type ReactNode } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // O dado muda uma vez por dia util: revalidar a cada foco de janela so
      // gastaria rede para receber o mesmo JSON.
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

interface EstadoErro {
  erro: Error | null;
}

/**
 * Fronteira de erro: um payload inesperado derruba um painel, nao a pagina.
 * Mesmo principio do `analytics_status` do pipeline -- falha isolada.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, EstadoErro> {
  override state: EstadoErro = { erro: null };

  static getDerivedStateFromError(erro: Error): EstadoErro {
    return { erro };
  }

  override componentDidCatch(erro: Error, info: ErrorInfo): void {
    console.error('[dashboard] erro nao tratado', erro, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.erro) {
      return (
        <div role="alert" className="rounded-xl border border-down/40 bg-down/10 p-4 text-sm">
          <strong className="font-semibold">Algo quebrou nesta seção.</strong>
          <p className="mt-1 text-muted">{this.state.erro.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>{children}</ErrorBoundary>
    </QueryClientProvider>
  );
}
