import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/lib/SupabaseContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Shield, ShieldCheck, ShieldOff, Copy, Check, Loader2, AlertTriangle } from 'lucide-react';
import QRCode from 'qrcode';

interface MFAFactor {
  id: string;
  friendly_name: string | null;
  factor_type: 'totp';
  status: 'unverified' | 'verified';
  created_at: string;
  updated_at: string;
}

type SetupStep = 'idle' | 'generating' | 'verify' | 'success';

export function TwoFASettings() {
  const { supabase, user } = useSupabase();

  // State
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupStep, setSetupStep] = useState<SetupStep>('idle');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const hasVerifiedFactor = factors.some(f => f.status === 'verified');

  // Fetch existing MFA factors
  const fetchFactors = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error: fetchError } = await supabase.auth.mfa.listFactors();

      if (fetchError) throw fetchError;

      setFactors((data?.totp || []) as MFAFactor[]);
    } catch (err) {
      console.error('Error fetching MFA factors:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, user]);

  useEffect(() => {
    fetchFactors();
  }, [fetchFactors]);

  // Start 2FA enrollment
  const startEnrollment = async () => {
    setSetupStep('generating');
    setError(null);

    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App',
      });

      if (enrollError) throw enrollError;

      if (data?.totp?.qr_code && data?.totp?.secret) {
        // Generate QR code image
        const qrDataUrl = await QRCode.toDataURL(data.totp.qr_code);
        setQrCodeDataUrl(qrDataUrl);
        setTotpSecret(data.totp.secret);
        setPendingFactorId(data.id);
        setSetupStep('verify');
      } else {
        throw new Error('Failed to generate TOTP setup data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start 2FA setup');
      setSetupStep('idle');
    }
  };

  // Verify the TOTP code during enrollment
  const verifyEnrollment = async () => {
    if (!pendingFactorId || !verificationCode) return;

    setError(null);

    try {
      // First create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: pendingFactorId,
      });

      if (challengeError) throw challengeError;

      // Then verify with the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: pendingFactorId,
        challengeId: challengeData.id,
        code: verificationCode,
      });

      if (verifyError) throw verifyError;

      setSetupStep('success');

      // Refresh factors list
      await fetchFactors();

      // Reset state after a short delay
      setTimeout(() => {
        resetSetup();
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid verification code');
    }
  };

  // Cancel enrollment and clean up pending factor
  const cancelEnrollment = async () => {
    if (pendingFactorId) {
      try {
        await supabase.auth.mfa.unenroll({ factorId: pendingFactorId });
      } catch {
        // Ignore errors when cleaning up
      }
    }
    resetSetup();
  };

  // Disable 2FA
  const disable2FA = async () => {
    const verifiedFactor = factors.find(f => f.status === 'verified');
    if (!verifiedFactor) return;

    setDisabling(true);
    setError(null);

    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: verifiedFactor.id,
      });

      if (unenrollError) throw unenrollError;

      // Refresh factors list
      await fetchFactors();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable 2FA');
    } finally {
      setDisabling(false);
    }
  };

  // Reset setup state
  const resetSetup = () => {
    setSetupStep('idle');
    setQrCodeDataUrl(null);
    setTotpSecret(null);
    setPendingFactorId(null);
    setVerificationCode('');
    setError(null);
  };

  // Copy secret to clipboard
  const copySecret = async () => {
    if (!totpSecret) return;

    try {
      await navigator.clipboard.writeText(totpSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = totpSecret;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <AccordionItem value="two-factor-auth">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <div className="text-left">
              <div className="font-medium">Two-Factor Authentication</div>
              <div className="text-sm text-muted-foreground font-normal">Loading...</div>
            </div>
          </div>
        </AccordionTrigger>
      </AccordionItem>
    );
  }

  return (
    <AccordionItem value="two-factor-auth">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-3">
          {hasVerifiedFactor ? (
            <ShieldCheck className="h-5 w-5 text-green-600" />
          ) : (
            <Shield className="h-5 w-5 text-muted-foreground" />
          )}
          <div className="text-left">
            <div className="font-medium">Two-Factor Authentication</div>
            <div className="text-sm text-muted-foreground font-normal">
              {hasVerifiedFactor
                ? 'Enabled - Your account is protected'
                : 'Add an extra layer of security to your account'
              }
            </div>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="pl-8 pt-2 space-y-4">
          {/* Status Display */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Status</Label>
              <div className="flex items-center gap-2 mt-1">
                {hasVerifiedFactor ? (
                  <>
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-sm text-green-600 font-medium">Enabled</span>
                  </>
                ) : (
                  <>
                    <div className="h-2 w-2 rounded-full bg-yellow-500" />
                    <span className="text-sm text-yellow-600 font-medium">Not Enabled</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-600">{error}</span>
            </div>
          )}

          {/* Setup Flow */}
          {!hasVerifiedFactor && setupStep === 'idle' && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="rounded-lg bg-muted p-4">
                  <h4 className="font-medium mb-2">Why enable 2FA?</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>- Protects your account even if your password is compromised</li>
                    <li>- Uses time-based one-time codes from an authenticator app</li>
                    <li>- Works with Google Authenticator, Authy, Microsoft Authenticator, and more</li>
                  </ul>
                </div>
                <Button onClick={startEnrollment}>
                  <Shield className="h-4 w-4 mr-2" />
                  Enable Two-Factor Authentication
                </Button>
              </div>
            </>
          )}

          {/* Generating State */}
          {setupStep === 'generating' && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {/* Verification Step */}
          {setupStep === 'verify' && qrCodeDataUrl && totpSecret && (
            <>
              <Separator />
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Step 1: Scan QR Code</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                  </p>
                  <div className="flex justify-center p-4 bg-white rounded-lg border">
                    <img src={qrCodeDataUrl} alt="2FA QR Code" className="w-48 h-48" />
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Or enter the secret key manually:</h4>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
                      {totpSecret}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={copySecret}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Step 2: Enter Verification Code</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Enter the 6-digit code from your authenticator app to verify setup
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="000000"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                      className="max-w-[150px] text-center text-lg font-mono tracking-widest"
                    />
                    <Button
                      onClick={verifyEnrollment}
                      disabled={verificationCode.length !== 6}
                    >
                      Verify
                    </Button>
                    <Button
                      variant="outline"
                      onClick={cancelEnrollment}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Success State */}
          {setupStep === 'success' && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <ShieldCheck className="h-12 w-12 text-green-600 mx-auto mb-2" />
                <h4 className="font-medium text-green-600">2FA Enabled Successfully!</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Your account is now protected with two-factor authentication
                </p>
              </div>
            </div>
          )}

          {/* Already Enabled - Show Disable Option */}
          {hasVerifiedFactor && setupStep === 'idle' && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-700">Two-Factor Authentication is Active</span>
                  </div>
                  <p className="text-sm text-green-600 mt-1">
                    You will be asked for a verification code when signing in.
                  </p>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="text-red-600 hover:text-red-700">
                      <ShieldOff className="h-4 w-4 mr-2" />
                      Disable Two-Factor Authentication
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disable Two-Factor Authentication?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the extra layer of security from your account.
                        You can re-enable it at any time, but you will need to set it up again
                        with your authenticator app.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={disable2FA}
                        className="bg-red-600 hover:bg-red-700"
                        disabled={disabling}
                      >
                        {disabling ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <ShieldOff className="h-4 w-4 mr-2" />
                        )}
                        Disable 2FA
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
