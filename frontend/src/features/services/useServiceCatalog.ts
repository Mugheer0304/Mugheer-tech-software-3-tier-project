import { useQuery } from '@tanstack/react-query';
import { get } from '../../lib/api';
import type { ServiceLine } from '../../components/ui/ServiceBox';

/**
 * Single data source for every Service Box render — marketing site, client
 * dashboard and admin console all consume the same service_lines endpoint
 * (spec Section 4.1: adding a service in admin instantly produces a new box,
 * zero frontend redeploy).
 */
export function useServiceCatalog() {
  return useQuery({
    queryKey: ['service-catalog'],
    queryFn: () => get<ServiceLine[]>('/service-catalog'),
    staleTime: 5 * 60 * 1000,
  });
}
