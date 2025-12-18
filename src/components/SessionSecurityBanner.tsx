import { AlertTriangle, Shield, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface SessionAnomaly {
  type: string;
  expected: string;
  actual: string;
}

interface SessionSecurityBannerProps {
  riskScore: number;
  anomalies: SessionAnomaly[];
  onTrust: () => void;
  onLogout: () => void;
  onDismiss?: () => void;
}

function getAnomalyDescription(anomaly: SessionAnomaly): string {
  switch (anomaly.type) {
    case 'ip_change':
      return 'Your IP address changed during this session';
    case 'ua_change':
      return 'Your browser or device changed during this session';
    case 'country_change':
      return 'Access detected from a different country';
    default:
      return 'Unusual session activity detected';
  }
}

export function SessionSecurityBanner({
  riskScore,
  anomalies,
  onTrust,
  onLogout,
  onDismiss,
}: SessionSecurityBannerProps) {
  // Only show banner for high risk scores (50+)
  if (riskScore < 50) {
    return null;
  }

  const isCritical = riskScore >= 70;
  const hasCountryChange = anomalies.some(a => a.type === 'country_change');

  return (
    <Alert
      className={`mb-4 ${
        isCritical
          ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
          : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
      }`}
    >
      <AlertTriangle
        className={`h-5 w-5 ${isCritical ? 'text-red-600' : 'text-yellow-600'}`}
      />
      <AlertTitle
        className={`text-base font-semibold ${
          isCritical ? 'text-red-800 dark:text-red-200' : 'text-yellow-800 dark:text-yellow-200'
        }`}
      >
        {isCritical ? 'Critical Security Alert' : 'Unusual Session Activity Detected'}
      </AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-3">
          <p
            className={`text-sm ${
              isCritical ? 'text-red-700 dark:text-red-300' : 'text-yellow-700 dark:text-yellow-300'
            }`}
          >
            We detected changes in your session that may indicate unauthorized access:
          </p>

          <ul
            className={`list-disc pl-5 space-y-1 text-sm ${
              isCritical ? 'text-red-700 dark:text-red-300' : 'text-yellow-700 dark:text-yellow-300'
            }`}
          >
            {anomalies.map((anomaly, index) => (
              <li key={index}>{getAnomalyDescription(anomaly)}</li>
            ))}
          </ul>

          {hasCountryChange && (
            <p
              className={`text-sm font-medium ${
                isCritical ? 'text-red-800 dark:text-red-200' : 'text-yellow-800 dark:text-yellow-200'
              }`}
            >
              If you are traveling or using a VPN, you can verify this is you.
            </p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onTrust}
              className={`${
                isCritical
                  ? 'border-red-300 hover:bg-red-100 dark:hover:bg-red-900/30'
                  : 'border-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
              }`}
            >
              <Shield className="mr-2 h-4 w-4" />
              This was me
            </Button>

            <Button
              size="sm"
              variant="destructive"
              onClick={onLogout}
            >
              <X className="mr-2 h-4 w-4" />
              Secure my account
            </Button>

            {onDismiss && !isCritical && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                className="text-yellow-700 hover:text-yellow-800 dark:text-yellow-300"
              >
                Dismiss for now
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            Risk Score: {riskScore}/100
          </p>
        </div>
      </AlertDescription>
    </Alert>
  );
}
