import { useState, useEffect } from 'react';
import { useSupabase } from '@/lib/SupabaseContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, AlertCircle, Building2 } from 'lucide-react';

interface SignUpPageProps {
  onNavigateToLogin: () => void;
}

export default function SignUpPage({ onNavigateToLogin }: SignUpPageProps) {
  const { signUp, validateInvitation, loading, error } = useSupabase();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [invitationStatus, setInvitationStatus] = useState<{
    checking: boolean;
    valid: boolean | null;
    officeName?: string;
    error?: string;
  }>({ checking: false, valid: null });

  // Debounced invitation validation
  useEffect(() => {
    if (!invitationCode || invitationCode.length < 10) {
      setInvitationStatus({ checking: false, valid: null });
      return;
    }

    const timeoutId = setTimeout(async () => {
      setInvitationStatus({ checking: true, valid: null });
      const result = await validateInvitation(invitationCode);
      setInvitationStatus({
        checking: false,
        valid: result.valid,
        officeName: result.officeName,
        error: result.error,
      });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [invitationCode, validateInvitation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSuccessMessage(null);

    // Validate form
    if (!fullName.trim()) {
      setLocalError('Please enter your full name');
      return;
    }

    if (!email.trim()) {
      setLocalError('Please enter your email address');
      return;
    }

    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    try {
      const result = await signUp(
        email,
        password,
        fullName,
        invitationCode.trim() || undefined
      );

      if (result.success) {
        setSuccessMessage(result.message);
      } else {
        setLocalError(result.message);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Sign up failed');
    }
  };

  if (successMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <CardTitle className="text-2xl font-bold">Account Created</CardTitle>
            </div>
            <CardDescription>{successMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onNavigateToLogin} className="w-full">
              Return to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
          <CardDescription>
            Enter your details to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invitationCode">
                Invitation Code <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="invitationCode"
                type="text"
                placeholder="Enter your invitation code"
                value={invitationCode}
                onChange={(e) => setInvitationCode(e.target.value)}
              />
              {invitationStatus.checking && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Validating invitation...
                </p>
              )}
              {invitationStatus.valid === true && invitationStatus.officeName && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  You will be added to: {invitationStatus.officeName}
                </p>
              )}
              {invitationStatus.valid === false && invitationStatus.error && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {invitationStatus.error}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                If you have an invitation code from your office administrator, enter it to be automatically added to your office.
              </p>
            </div>

            {(localError || error) && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertCircle className="h-4 w-4" />
                {localError || error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </Button>

            <div className="text-center text-sm">
              <span className="text-muted-foreground">Already have an account? </span>
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="text-primary hover:underline font-medium"
              >
                Sign in
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
