import { useQuery } from '@tanstack/react-query';
import { getProEntitlement, type EntitlementStatus } from '@/lib/proTutorial';

export const entitlementQueryKey = ['entitlement'] as const;

export const NO_ENTITLEMENT: EntitlementStatus = {
  has_pro: false,
  plan: '',
  expires_at: null,
  is_developer: false,
};

/**
 * Server-authoritative Pro entitlement status, cached via react-query.
 *
 * The query key is invalidated after a successful payment verification so the
 * checkout success page unlocks Pro access without a page reload.
 */
export function useEntitlementQuery() {
  return useQuery({
    queryKey: entitlementQueryKey,
    queryFn: async (): Promise<EntitlementStatus> => {
      const result = await getProEntitlement();
      if (result.error) throw result.error;
      return result.status ?? NO_ENTITLEMENT;
    },
    staleTime: 60_000,
    retry: 1,
  });
}