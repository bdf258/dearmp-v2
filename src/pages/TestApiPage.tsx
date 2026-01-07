/**
 * Test API Page
 *
 * A developer tool for testing the Caseworker API endpoints.
 * Allows testing authentication, case search, and case updates.
 *
 * API endpoints (based on caseworker repo):
 * - POST /api/ajax/auth - Authenticate with email, password, OTP
 * - POST /api/ajax/cases/search - Search for cases
 * - PATCH /api/ajax/cases/{id} - Update a case
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  Key,
  Search,
  Edit,
  Server,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';

// Types for API responses
interface AuthResponse {
  token?: string;
  error?: string;
}

interface CaseSearchResult {
  id: number;
  summary?: string;
  status?: string;
  caseType?: string;
  createdAt?: string;
  modifiedAt?: string;
}

interface CaseSearchResponse {
  results: CaseSearchResult[];
  totalCount: number;
  page: number;
  error?: string;
}

interface CasePatchResponse {
  id: number;
  summary?: string;
  error?: string;
}

export default function TestApiPage() {
  // API URL configuration
  const [apiSubdomain, setApiSubdomain] = useState('alphonsomanila');

  // Auth state
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authOtp, setAuthOtp] = useState('');
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authResponse, setAuthResponse] = useState<string | null>(null);

  // Cases search state
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<CaseSearchResult[]>([]);
  const [searchResponse, setSearchResponse] = useState<string | null>(null);

  // Cases patch state
  const [patchCaseId, setPatchCaseId] = useState('');
  const [patchLoading, setPatchLoading] = useState(false);
  const [patchError, setPatchError] = useState<string | null>(null);
  const [patchResponse, setPatchResponse] = useState<string | null>(null);

  // Build API URL
  const buildApiUrl = useCallback((path: string) => {
    const cleanSubdomain = apiSubdomain.trim().replace(/\.$/, '');
    return `https://${cleanSubdomain}.farier.com/api/ajax${path}`;
  }, [apiSubdomain]);

  // Handle authentication
  const handleAuth = useCallback(async () => {
    if (!authEmail || !authPassword) {
      setAuthError('Email and password are required');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    setAuthResponse(null);

    try {
      const url = buildApiUrl('/auth');
      const body = {
        email: authEmail,
        password: authPassword,
        otp: authOtp || undefined,
        locale: 'en-GB',
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();
      setAuthResponse(responseText);

      if (!response.ok) {
        setAuthError(`HTTP ${response.status}: ${response.statusText}`);
        return;
      }

      // The response is typically the token as a string
      // Try to parse as JSON first, fall back to raw text
      let token: string;
      try {
        const data: AuthResponse = JSON.parse(responseText);
        if (data.error) {
          setAuthError(data.error);
          return;
        }
        token = data.token || responseText;
      } catch {
        // Response is likely the raw token string
        token = responseText;
      }

      setAuthToken(token);
      toast.success('Authentication successful');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  }, [authEmail, authPassword, authOtp, buildApiUrl]);

  // Handle cases search
  const handleCasesSearch = useCallback(async () => {
    if (!authToken) {
      setSearchError('Please authenticate first');
      return;
    }

    setSearchLoading(true);
    setSearchError(null);
    setSearchResponse(null);
    setSearchResults([]);

    try {
      const url = buildApiUrl('/cases/search');

      // Search for cases modified in the last 30 days
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const body = {
        dateRange: {
          type: 'modified',
          from: thirtyDaysAgo.toISOString(),
          to: now.toISOString(),
        },
        pageNo: 1,
        resultsPerPage: 20,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken,
        },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();
      setSearchResponse(responseText);

      if (!response.ok) {
        setSearchError(`HTTP ${response.status}: ${response.statusText}`);
        return;
      }

      const data: CaseSearchResponse = JSON.parse(responseText);
      if (data.error) {
        setSearchError(data.error);
        return;
      }

      setSearchResults(data.results || []);
      toast.success(`Found ${data.results?.length || 0} cases`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Search failed';
      setSearchError(message);
    } finally {
      setSearchLoading(false);
    }
  }, [authToken, buildApiUrl]);

  // Handle cases patch
  const handleCasesPatch = useCallback(async () => {
    if (!authToken) {
      setPatchError('Please authenticate first');
      return;
    }

    if (!patchCaseId) {
      setPatchError('Case ID is required');
      return;
    }

    setPatchLoading(true);
    setPatchError(null);
    setPatchResponse(null);

    try {
      // First, get the current case to get its existing title
      const getUrl = buildApiUrl(`/cases/${patchCaseId}`);
      const getResponse = await fetch(getUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken,
        },
      });

      if (!getResponse.ok) {
        setPatchError(`Failed to get case: HTTP ${getResponse.status}`);
        return;
      }

      const currentCase = await getResponse.json();
      const currentSummary = currentCase.summary || '';

      // Now patch the case with the modified title
      const patchUrl = buildApiUrl(`/cases/${patchCaseId}`);
      const newSummary = currentSummary.includes('[edited by dearmp]')
        ? currentSummary
        : `${currentSummary} [edited by dearmp]`;

      const body = {
        summary: newSummary,
      };

      const response = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken,
        },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();
      setPatchResponse(responseText);

      if (!response.ok) {
        setPatchError(`HTTP ${response.status}: ${response.statusText}`);
        return;
      }

      const data: CasePatchResponse = JSON.parse(responseText);
      if (data.error) {
        setPatchError(data.error);
        return;
      }

      toast.success(`Case ${patchCaseId} updated successfully`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Patch failed';
      setPatchError(message);
    } finally {
      setPatchLoading(false);
    }
  }, [authToken, patchCaseId, buildApiUrl]);

  // Copy token to clipboard
  const copyToken = useCallback(() => {
    if (authToken) {
      navigator.clipboard.writeText(authToken);
      toast.success('Token copied to clipboard');
    }
  }, [authToken]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Test Caseworker API</h1>
        <p className="text-muted-foreground">
          Test the Caseworker API endpoints for authentication, case search, and case updates.
        </p>
      </div>

      {/* API URL Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            API Configuration
          </CardTitle>
          <CardDescription>
            Configure the API endpoint subdomain
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Label htmlFor="api-subdomain" className="shrink-0">
              https://
            </Label>
            <Input
              id="api-subdomain"
              value={apiSubdomain}
              onChange={(e) => setApiSubdomain(e.target.value)}
              placeholder="alphonsomanila"
              className="max-w-xs"
            />
            <Label className="shrink-0 text-muted-foreground">
              .farier.com/api/ajax
            </Label>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Auth Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Authentication
            </CardTitle>
            <CardDescription>
              Authenticate with the Caseworker API using email, password, and optional OTP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-password">Password</Label>
              <Input
                id="auth-password"
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="********"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-otp">OTP (optional)</Label>
              <Input
                id="auth-otp"
                value={authOtp}
                onChange={(e) => setAuthOtp(e.target.value)}
                placeholder="123456"
              />
            </div>
            <Button
              onClick={handleAuth}
              disabled={authLoading}
              className="w-full"
            >
              {authLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Authenticate'
              )}
            </Button>

            {authError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            )}

            {authToken && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Authenticated
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={copyToken}>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy Token
                  </Button>
                </div>
                <div className="p-2 bg-muted rounded text-xs font-mono break-all max-h-20 overflow-auto">
                  {authToken.substring(0, 50)}...
                </div>
              </div>
            )}

            {authResponse && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Raw Response
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded overflow-auto max-h-32">
                  {authResponse}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>

        {/* Cases Search Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Cases Search
            </CardTitle>
            <CardDescription>
              Search for recent cases (modified in last 30 days)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={handleCasesSearch}
              disabled={searchLoading || !authToken}
              className="w-full"
            >
              {searchLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                'Search Recent Cases'
              )}
            </Button>

            {!authToken && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please authenticate first to search cases.
                </AlertDescription>
              </Alert>
            )}

            {searchError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{searchError}</AlertDescription>
              </Alert>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">
                  Found {searchResults.length} cases:
                </h4>
                <ScrollArea className="h-64 border rounded-md">
                  <div className="p-2 space-y-2">
                    {searchResults.map((result) => (
                      <div
                        key={result.id}
                        className="p-2 bg-muted rounded text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">#{result.id}</span>
                          <Badge variant="secondary">
                            {result.status || 'N/A'}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground truncate">
                          {result.summary || '(No summary)'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Type: {result.caseType || 'N/A'}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {searchResponse && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Raw Response
                </summary>
                <pre className="mt-2 p-2 bg-muted rounded overflow-auto max-h-32">
                  {searchResponse}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cases Patch Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Cases Patch
          </CardTitle>
          <CardDescription>
            Update a case by ID - adds "[edited by dearmp]" to the case summary
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="patch-case-id">Case ID</Label>
              <Input
                id="patch-case-id"
                value={patchCaseId}
                onChange={(e) => setPatchCaseId(e.target.value)}
                placeholder="Enter case ID (e.g., 12345)"
              />
            </div>
            <Button
              onClick={handleCasesPatch}
              disabled={patchLoading || !authToken}
            >
              {patchLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Case'
              )}
            </Button>
          </div>

          {!authToken && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please authenticate first to update cases.
              </AlertDescription>
            </Alert>
          )}

          {patchError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{patchError}</AlertDescription>
            </Alert>
          )}

          {patchResponse && !patchError && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>
                Case {patchCaseId} has been updated with "[edited by dearmp]"
              </AlertDescription>
            </Alert>
          )}

          {patchResponse && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">
                Raw Response
              </summary>
              <pre className="mt-2 p-2 bg-muted rounded overflow-auto max-h-32">
                {patchResponse}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>

      {/* API Info Section */}
      <Card>
        <CardHeader>
          <CardTitle>API Endpoints Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-muted rounded">
              <h4 className="font-medium mb-1">Authentication</h4>
              <p className="text-xs text-muted-foreground font-mono">
                POST /api/ajax/auth
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Body: {`{ email, password, otp?, locale }`}
              </p>
              <p className="text-xs text-muted-foreground">
                Returns: auth token string
              </p>
            </div>
            <div className="p-3 bg-muted rounded">
              <h4 className="font-medium mb-1">Cases Search</h4>
              <p className="text-xs text-muted-foreground font-mono">
                POST /api/ajax/cases/search
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Header: Authorization: {`<token>`}
              </p>
              <p className="text-xs text-muted-foreground">
                Body: {`{ dateRange, pageNo, resultsPerPage }`}
              </p>
            </div>
            <div className="p-3 bg-muted rounded">
              <h4 className="font-medium mb-1">Cases Patch</h4>
              <p className="text-xs text-muted-foreground font-mono">
                PATCH /api/ajax/cases/:id
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Header: Authorization: {`<token>`}
              </p>
              <p className="text-xs text-muted-foreground">
                Body: {`{ summary, statusID?, ... }`}
              </p>
            </div>
          </div>

          <Separator className="my-4" />

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Note</AlertTitle>
            <AlertDescription>
              This page makes direct API calls to the Caseworker API. Ensure you have valid credentials
              and the API is accessible from your network. CORS may block requests from the browser;
              if so, consider using a proxy or testing from a server-side context.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
