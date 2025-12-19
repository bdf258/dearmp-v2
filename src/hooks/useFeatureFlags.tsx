/**
 * Feature Flags Hook
 *
 * React hook for checking feature flags with user context.
 */

import { useMemo } from 'react';
import { useSupabase } from '@/lib/SupabaseContext';
import {
  isFeatureEnabled,
  getEnabledFeatures,
  getFeatureFlagConfig,
  type FeatureFlag,
  type FeatureFlagConfig,
} from '@/lib/featureFlags';

export interface UseFeatureFlagsResult {
  /** Check if a specific feature is enabled */
  isEnabled: (flag: FeatureFlag) => boolean;
  /** Get all enabled features */
  enabledFeatures: FeatureFlag[];
  /** Get config for a specific flag (for debugging) */
  getConfig: (flag: FeatureFlag) => FeatureFlagConfig | undefined;
  /** Context used for evaluation */
  context: {
    userId: string | null;
    officeId: string | null;
    userRole: string | null;
  };
}

/**
 * Hook to check feature flags with current user context
 *
 * @example
 * ```tsx
 * function TriageRoute() {
 *   const { isEnabled } = useFeatureFlags();
 *
 *   if (!isEnabled('triage')) {
 *     return <Navigate to="/inbox" />;
 *   }
 *
 *   return <TriageWorkspace />;
 * }
 * ```
 */
export function useFeatureFlags(): UseFeatureFlagsResult {
  const { profile, getCurrentUserId, getMyOfficeId } = useSupabase();

  const context = useMemo(() => ({
    userId: getCurrentUserId(),
    officeId: getMyOfficeId(),
    userRole: profile?.role || null,
  }), [getCurrentUserId, getMyOfficeId, profile?.role]);

  const contextForFlags = useMemo(() => ({
    userId: context.userId || undefined,
    officeId: context.officeId || undefined,
    userRole: context.userRole || undefined,
  }), [context]);

  const isEnabled = useMemo(() => {
    return (flag: FeatureFlag) => isFeatureEnabled(flag, contextForFlags);
  }, [contextForFlags]);

  const enabledFeatures = useMemo(() => {
    return getEnabledFeatures(contextForFlags);
  }, [contextForFlags]);

  const getConfig = useMemo(() => {
    return (flag: FeatureFlag) => getFeatureFlagConfig(flag);
  }, []);

  return {
    isEnabled,
    enabledFeatures,
    getConfig,
    context,
  };
}

/**
 * Component that conditionally renders children based on feature flag
 *
 * @example
 * ```tsx
 * <FeatureGate flag="triage" fallback={<Navigate to="/inbox" />}>
 *   <TriageWorkspace />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({
  flag,
  children,
  fallback = null,
}: {
  flag: FeatureFlag;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { isEnabled } = useFeatureFlags();

  if (!isEnabled(flag)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

export { type FeatureFlag, type FeatureFlagConfig };
