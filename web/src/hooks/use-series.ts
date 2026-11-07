import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/services/dashboard-api';

/**
 * series.json tem ~300 KB e so e necessario fora do resumo (sparklines e
 * graficos). Fica num hook proprio, carregado sob demanda: a primeira tela
 * baixa so o summary (~3 KB).
 */
export function useSeries() {
  return useQuery({
    queryKey: ['series'],
    queryFn: dashboardApi.series,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useCurvaDI() {
  return useQuery({
    queryKey: ['curva-di'],
    queryFn: dashboardApi.curvaDI,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

/**
 * Os demais payloads. Cada um num hook proprio e com a mesma politica de
 * cache: o dado muda uma vez por dia util, as 20h BRT.
 *
 * markets (330 KB), eia (340 KB) e bcb (220 KB) so sao buscados quando a aba
 * que os usa e aberta -- os paineis que os consomem entram por lazy().
 */
export function useMarkets() {
  return useQuery({
    queryKey: ['markets'],
    queryFn: dashboardApi.markets,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useEia() {
  return useQuery({
    queryKey: ['eia'],
    queryFn: dashboardApi.eia,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useBcb() {
  return useQuery({
    queryKey: ['bcb'],
    queryFn: dashboardApi.bcb,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useOpcoes() {
  return useQuery({
    queryKey: ['opcoes'],
    queryFn: dashboardApi.opcoes,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useAnalytics() {
  return useQuery({
    queryKey: ['analytics'],
    queryFn: dashboardApi.analytics,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
