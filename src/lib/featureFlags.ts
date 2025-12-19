/**
 * Feature Flags
 *
 * Simple feature flag system for controlling feature rollout.
 * Can be extended to integrate with external services like LaunchDarkly or PostHog.
 */

export type FeatureFlag =
  | 'triage'
  | 'campaign_dashboard'
  | 'ai_suggestions'
  | 'bulk_triage'
  | 'address_request';

export interface FeatureFlagConfig {
  enabled: boolean;
  rolloutPercentage?: number;
  allowedOfficeIds?: string[];
  allowedUserRoles?: string[];
}

// Default feature flag configuration
// All flags disabled - set enabled: true to re-enable individual features
const defaultFlags: Record<FeatureFlag, FeatureFlagConfig> = {
  triage: {
    enabled: false,
    allowedUserRoles: ['admin', 'staff'],
  },
  campaign_dashboard: {
    enabled: false,
    allowedUserRoles: ['admin', 'staff'],
  },
  ai_suggestions: {
    enabled: false,
  },
  bulk_triage: {
    enabled: false,
    allowedUserRoles: ['admin', 'staff'],
  },
  address_request: {
    enabled: false,
    allowedUserRoles: ['admin', 'staff'],
  },
};

// Environment-based overrides
const getEnvOverrides = (): Partial<Record<FeatureFlag, Partial<FeatureFlagConfig>>> => {
  const overrides: Partial<Record<FeatureFlag, Partial<FeatureFlagConfig>>> = {};

  // Check for environment variable overrides
  // Format: VITE_FF_TRIAGE_ENABLED=true
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const env = import.meta.env;

    if (env.VITE_FF_TRIAGE_ENABLED !== undefined) {
      overrides.triage = {
        enabled: env.VITE_FF_TRIAGE_ENABLED === 'true',
      };
    }

    if (env.VITE_FF_TRIAGE_OFFICES) {
      overrides.triage = {
        ...overrides.triage,
        allowedOfficeIds: env.VITE_FF_TRIAGE_OFFICES.split(',').map((s: string) => s.trim()),
      };
    }
  }

  return overrides;
};

// Merge default flags with environment overrides
const getFlags = (): Record<FeatureFlag, FeatureFlagConfig> => {
  const overrides = getEnvOverrides();
  const flags = { ...defaultFlags };

  for (const [key, override] of Object.entries(overrides)) {
    flags[key as FeatureFlag] = {
      ...flags[key as FeatureFlag],
      ...override,
    };
  }

  return flags;
};

/**
 * Check if a feature is enabled for the given context
 */
export function isFeatureEnabled(
  flag: FeatureFlag,
  context?: {
    userId?: string;
    officeId?: string;
    userRole?: string;
  }
): boolean {
  const flags = getFlags();
  const config = flags[flag];

  if (!config) return false;
  if (!config.enabled) return false;

  // Check office allowlist
  if (config.allowedOfficeIds && config.allowedOfficeIds.length > 0) {
    if (!context?.officeId || !config.allowedOfficeIds.includes(context.officeId)) {
      return false;
    }
  }

  // Check role allowlist
  if (config.allowedUserRoles && config.allowedUserRoles.length > 0) {
    if (!context?.userRole || !config.allowedUserRoles.includes(context.userRole)) {
      return false;
    }
  }

  // Check rollout percentage
  if (config.rolloutPercentage !== undefined && config.rolloutPercentage < 100) {
    if (!context?.userId) return false;

    // Consistent hashing for rollout
    const hash = hashUserId(context.userId);
    if (hash >= config.rolloutPercentage) {
      return false;
    }
  }

  return true;
}

/**
 * Get all enabled features for a context
 */
export function getEnabledFeatures(context?: {
  userId?: string;
  officeId?: string;
  userRole?: string;
}): FeatureFlag[] {
  const allFlags: FeatureFlag[] = [
    'triage',
    'campaign_dashboard',
    'ai_suggestions',
    'bulk_triage',
    'address_request',
  ];

  return allFlags.filter(flag => isFeatureEnabled(flag, context));
}

/**
 * Get feature flag configuration (for debugging/admin)
 */
export function getFeatureFlagConfig(flag: FeatureFlag): FeatureFlagConfig | undefined {
  const flags = getFlags();
  return flags[flag];
}

// Simple hash function for consistent rollout
function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % 100;
}
