import { useState, useEffect } from 'react';
import { useSupabase } from '@/lib/SupabaseContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

type SessionState = 'idle' | 'starting' | 'interactive' | 'capturing' | 'connected' | 'error';

interface OutlookConnectProps {
  officeId: string;
}

export function OutlookConnect({ officeId }: OutlookConnectProps) {
  const { supabase } = useSupabase();
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [vncUrl, setVncUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastUsed, setLastUsed] = useState<string | null>(null);

  const workerUrl = import.meta.env.VITE_OUTLOOK_WORKER_URL || 'https://sender.dearmp.uk';

  // Check if there's an existing Outlook session
  useEffect(() => {
    checkExistingSession();
  }, [officeId]);

  const checkExistingSession = async () => {
    try {
      const { data, error: sessionError } = await supabase
        .from('integration_outlook_sessions')
        .select('*')
        .eq('office_id', officeId)
        .eq('is_connected', true)
        .maybeSingle();

      if (data && !sessionError) {
        setIsConnected(true);
        setLastUsed(data.last_used_at);
        setSessionState('connected');
      } else {
        setIsConnected(false);
        setSessionState('idle');
      }
    } catch (err) {
      console.error('Error checking session:', err);
      setSessionState('idle');
    }
  };

  const startSession = async () => {
    setSessionState('starting');
    setError('');

    try {
      const response = await fetch(`${workerUrl}/api/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ office_id: officeId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start session');
      }

      const data = await response.json();

      if (data.status === 'ready' && data.vncUrl) {
        setVncUrl(data.vncUrl);
        setSessionState('interactive');
      } else {
        throw new Error('Invalid response from worker');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
      setSessionState('error');
    }
  };

  const captureSession = async () => {
    setSessionState('capturing');
    setError('');

    try {
      const response = await fetch(`${workerUrl}/api/session/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ office_id: officeId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to capture session');
      }

      const data = await response.json();

      if (data.success) {
        setIsConnected(true);
        setSessionState('connected');
        setVncUrl('');
        await checkExistingSession(); // Refresh session data
      } else {
        throw new Error('Failed to capture session cookies');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to capture session');
      setSessionState('error');
    }
  };

  const cancelSession = async () => {
    try {
      await fetch(`${workerUrl}/api/session/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ office_id: officeId }),
      });
    } catch (err) {
      console.error('Error canceling session:', err);
    } finally {
      setSessionState('idle');
      setVncUrl('');
      setError('');
    }
  };

  const disconnectOutlook = async () => {
    try {
      const { error: updateError } = await supabase
        .from('integration_outlook_sessions')
        .update({ is_connected: false })
        .eq('office_id', officeId);

      if (updateError) throw updateError;

      setIsConnected(false);
      setSessionState('idle');
      setLastUsed(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  };

  const renderContent = () => {
    switch (sessionState) {
      case 'idle':
        return (
          <>
            <CardDescription>
              Connect your Outlook account to enable automated email sending through the Outlook Worker Bot.
            </CardDescription>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-4">
                This will open a remote browser session where you can securely log in to your Outlook account.
                The session data will be stored securely for automated email sending.
              </p>
            </CardContent>
            <CardFooter>
              <Button onClick={startSession} className="w-full">
                Connect Outlook Account
              </Button>
            </CardFooter>
          </>
        );

      case 'starting':
        return (
          <>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Starting remote browser session...</span>
              </div>
            </CardContent>
          </>
        );

      case 'interactive':
        return (
          <>
            <CardDescription>
              Log in to your Outlook account in the browser window below.
            </CardDescription>
            <CardContent className="pt-6 space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Important:</strong> Complete the full login process including any 2FA verification.
                  Once you see your Outlook inbox, click "I have finished logging in" below.
                </AlertDescription>
              </Alert>

              {vncUrl && (
                <div className="border rounded-lg overflow-hidden bg-gray-100" style={{ height: '600px' }}>
                  <iframe
                    src={vncUrl}
                    className="w-full h-full"
                    title="Outlook Login Browser"
                    sandbox="allow-same-origin allow-scripts allow-forms"
                  />
                </div>
              )}
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button onClick={captureSession} className="flex-1">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                I have finished logging in
              </Button>
              <Button onClick={cancelSession} variant="outline" className="flex-1">
                Cancel
              </Button>
            </CardFooter>
          </>
        );

      case 'capturing':
        return (
          <>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Capturing session data...</span>
              </div>
            </CardContent>
          </>
        );

      case 'connected':
        return (
          <>
            <CardDescription>
              Your Outlook account is connected and ready to send emails.
            </CardDescription>
            <CardContent className="pt-6">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>Connected</strong>
                  {lastUsed && (
                    <div className="text-sm mt-1">
                      Last used: {new Date(lastUsed).toLocaleString()}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground mt-4">
                Emails will now be sent automatically through your Outlook account when queued.
              </p>
            </CardContent>
            <CardFooter>
              <Button onClick={disconnectOutlook} variant="destructive" className="w-full">
                Disconnect Outlook
              </Button>
            </CardFooter>
          </>
        );

      case 'error':
        return (
          <>
            <CardContent className="pt-6">
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Error:</strong> {error}
                </AlertDescription>
              </Alert>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button onClick={startSession} className="flex-1">
                Try Again
              </Button>
              <Button
                onClick={() => {
                  setSessionState('idle');
                  setError('');
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </CardFooter>
          </>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Outlook Integration
          {isConnected && <CheckCircle2 className="h-5 w-5 text-green-600" />}
        </CardTitle>
      </CardHeader>
      {renderContent()}
    </Card>
  );
}
