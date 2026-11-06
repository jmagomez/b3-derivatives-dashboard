import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/services/dashboard-api';

/**
 * O summary e o unico arquivo que a primeira tela precisa (~3 KB). Os demais
 * (series 300 KB, analytics 200 KB) ficam para os hooks das abas, carregados
 * sob demanda.
 *
 * `staleTime` alto de proposito: o dado muda uma vez por dia util, as 20h BRT.
 * Revalidar a cada foco de janela so gastaria rede para receber o mesmo JSON.
 */
export function useSummary() {
  return useQuery({
    queryKey: ['summary'],
    queryFn: dashboardApi.summary,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
