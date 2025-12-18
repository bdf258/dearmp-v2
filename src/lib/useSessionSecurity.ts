import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';

interface SessionAnomaly {
  type: string;
  expected: string;
  actual: string;
}

interface SessionSecurityState {
  riskScore: number;
  anomalies: SessionAnomaly[];
  actionRequired: boolean;
  isLoading: boolean;
  error: string | null;
}

interface UnresolvedAnomaly {
  id: string;
  anomaly_type: string;
  severity: string;
  expected_value: string;
  actual_value: string;
  created_at: string;
}

interface UseSessionSecurityReturn {
  riskScore: number;
  anomalies: SessionAnomaly[];
  unresolvedAnomalies: UnresolvedAnomaly[];
  actionRequired: boolean;
  isLoading: boolean;
  error: string | null;
  trustCurrentContext: () => Promise<boolean>;
  recordContext: () => Promise<void>;
  dismissAnomaly: () => void;
}

// Cache for IP address to avoid excessive API calls
let cachedIp: string | null = null;
let ipCacheTime: number = 0;
const IP_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getClientIp(): Promise<string> {
  // Return cached IP if still valid
  if (cachedIp && Date.now() - ipCacheTime < IP_CACHE_DURATION) {
    return cachedIp;
  }

  try {
    // Try multiple IP lookup services for reliability
    const services = [
      'https://api.ipify.org?format=json',
      'https://api.my-ip.io/v2/ip.json',
    ];

    for (const service of services) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(service, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const ip = data.ip || data.origin || '0.0.0.0';
          cachedIp = ip;
          ipCacheTime = Date.now();
          return ip;
        }
      } catch {
        // Try next service
        continue;
      }
    }

    // Fallback if all services fail
    return '0.0.0.0';
  } catch {
    return '0.0.0.0';
  }
}

export function useSessionSecurity(userId: string | null): UseSessionSecurityReturn {
  const [state, setState] = useState<SessionSecurityState>({
    riskScore: 0,
    anomalies: [],
    actionRequired: false,
    isLoading: false,
    error: null,
  });

  const [unresolvedAnomalies, setUnresolvedAnomalies] = useState<UnresolvedAnomaly[]>([]);
  const hasRecordedRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Record session context
  const recordContext = useCallback(async () => {
    if (!userId) {
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const ip = await getClientIp();
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

      const { data, error } = await supabase.rpc('record_session_context', {
        p_ip_address: ip,
        p_user_agent: userAgent,
        p_country_code: null, // Could integrate a GeoIP service here
      });

      if (error) {
        console.error('Error recording session context:', error);
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error.message,
        }));
        return;
      }

      if (data) {
        const result = data as unknown as {
          risk_score?: number;
          anomalies?: SessionAnomaly[];
          action_required?: boolean;
          error?: string;
        };

        if (result.error) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: result.error || null,
          }));
          return;
        }

        setState({
          riskScore: result.risk_score || 0,
          anomalies: result.anomalies || [],
          actionRequired: result.action_required || false,
          isLoading: false,
          error: null,
        });
      }
    } catch (err) {
      console.error('Error recording session context:', err);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to record session context',
      }));
    }
  }, [userId]);

  // Fetch unresolved anomalies
  const fetchUnresolvedAnomalies = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase.rpc('get_unresolved_anomalies');

      if (error) {
        console.error('Error fetching unresolved anomalies:', error);
        return;
      }

      if (data) {
        setUnresolvedAnomalies(data as UnresolvedAnomaly[]);
      }
    } catch (err) {
      console.error('Error fetching unresolved anomalies:', err);
    }
  }, [userId]);

  // Trust current context
  const trustCurrentContext = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;

    try {
      const { data, error } = await supabase.rpc('trust_current_context');

      if (error) {
        console.error('Error trusting current context:', error);
        return false;
      }

      const result = data as { success?: boolean; error?: string };

      if (result.success) {
        // Reset state after trusting
        setState({
          riskScore: 0,
          anomalies: [],
          actionRequired: false,
          isLoading: false,
          error: null,
        });
        setUnresolvedAnomalies([]);
        return true;
      }

      return false;
    } catch (err) {
      console.error('Error trusting current context:', err);
      return false;
    }
  }, [userId]);

  // Dismiss anomaly (local only, for temporary dismissal)
  const dismissAnomaly = useCallback(() => {
    setState(prev => ({
      ...prev,
      actionRequired: false,
    }));
  }, []);

  // Record context on mount and periodically
  useEffect(() => {
    if (!userId) {
      // Clear state when user logs out
      setState({
        riskScore: 0,
        anomalies: [],
        actionRequired: false,
        isLoading: false,
        error: null,
      });
      setUnresolvedAnomalies([]);
      hasRecordedRef.current = false;
      return;
    }

    // Record context on initial login (only once per session)
    if (!hasRecordedRef.current) {
      hasRecordedRef.current = true;
      recordContext();
      fetchUnresolvedAnomalies();
    }

    // Set up periodic context recording (every 5 minutes)
    intervalRef.current = setInterval(() => {
      recordContext();
    }, 5 * 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [userId, recordContext, fetchUnresolvedAnomalies]);

  return {
    ...state,
    unresolvedAnomalies,
    trustCurrentContext,
    recordContext,
    dismissAnomaly,
  };
}
