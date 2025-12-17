import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/lib/SupabaseContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Loader2, AlertTriangle, LogOut } from 'lucide-react';

interface TwoFAVerificationPageProps {
  onVerified: () => void;
  onSignOut: () => void;
}

export default function TwoFAVerificationPage({ onVerified, onSignOut }: TwoFAVerificationPageProps) {
  const { supabase } = useSupabase();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);

  // Fetch the verified TOTP factor
  const fetchFactor = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase.auth.mfa.listFactors();

      if (fetchError) throw fetchError;

      const verifiedFactor = data?.totp?.find(f => f.status === 'verified');
      if (verifiedFactor) {
        setFactorId(verifiedFactor.id);
      }
    } catch (err) {
      console.error('Error fetching MFA factors:', err);
      setError('Unable to load 2FA settings. Please try signing in again.');
    }
  }, [supabase]);

  useEffect(() => {
    fetchFactor();
  }, [fetchFactor]);

  const handleVerify = async () => {
    if (!factorId || code.length !== 6) return;

    setLoading(true);
    setError(null);

    try {
      // Create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) throw verifyError;

      // Success - call the callback
      onVerified();
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('invalid')) {
          setError('Invalid code. Please try again.');
        } else if (err.message.includes('expired')) {
          setError('Code has expired. Please enter a new code.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Verification failed. Please try again.');
      }
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && code.length === 6 && !loading) {
      handleVerify();
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onSignOut();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Two-Factor Authentication</CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app to continue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
              <span className="text-sm text-red-600">{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="code">Verification Code</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              onKeyDown={handleKeyDown}
              className="text-center text-2xl font-mono tracking-[0.5em]"
              autoFocus
              disabled={loading || !factorId}
            />
            <p className="text-xs text-muted-foreground text-center">
              Open your authenticator app and enter the code shown
            </p>
          </div>

          <Button
            type="button"
            className="w-full"
            onClick={handleVerify}
            disabled={loading || code.length !== 6 || !factorId}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Verifying...
              </>
            ) : (
              'Verify'
            )}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                or
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleSignOut}
            disabled={loading}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out and use a different account
          </Button>

          <div className="rounded-lg bg-muted p-3 text-center">
            <p className="text-xs text-muted-foreground">
              Having trouble? Make sure your authenticator app is showing the correct code for this account.
              Codes refresh every 30 seconds.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
