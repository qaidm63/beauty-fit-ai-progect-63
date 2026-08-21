import { useCallback } from 'react';
import { useEntitlementQuery } from './useEntitlement';

interface UseProEntitlementReturn {
  checkEntitlement: (styleId: string, styleName: string, onSuccess: (hasAccess: boolean) => void) => Promise<void>;
  isChecking: boolean;
  error: Error | null;
  cachedStatus: ReturnType<typeof useEntitlementQuery>['data'] | null;
}

/**
 * Pro-access gate backed by react-query.
 *
 * `checkEntitlement` refetches the server-side entitlement (fresh enough for a
 * payment that just happened in another tab) and reports the result through
 * the callback — the UI navigates to the Pro report or the checkout page.
 */
export function useProEntitlement(): UseProEntitlementReturn {
  const { data: cachedStatus, isFetching: isChecking, error, refetch } = useEntitlementQuery();

  const checkEntitlement = useCallback(
    async (_styleId: string, _styleName: string, onSuccess: (hasAccess: boolean) => void) => {
      try {
        const fresh = await refetch();
        const status = fresh.data;
        const hasProAccess = !!status?.has_pro || !!status?.is_developer;
        onSuccess(hasProAccess);
      } catch (err) {
        onSuccess(false);
      }
    },
    [refetch]
  );

  return {
    checkEntitlement,
    isChecking,
    error: error ?? null,
    cachedStatus: cachedStatus ?? null,
  };
}