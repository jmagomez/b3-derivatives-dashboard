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
