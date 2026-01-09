/**
 * Test API Page
 *
 * A developer tool for testing the Caseworker API endpoints.
 * Allows testing authentication, case search, and case updates.
 *
 * API endpoints (based on caseworker repo):
 * - POST /api/ajax/auth - Authenticate with email, password, secondFactor (OTP/Yubikey)
 * - POST /api/ajax/cases/search - Search for cases
 * - PATCH /api/ajax/cases/{id} - Update a case
 */

import { useState, useCallback, useRef, useEffect } from 'react';
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
  Trash2,
  FileText,
  Bookmark,
} from 'lucide-react';
import { toast } from 'sonner';

// Log entry interface
interface LogEntry {
  id: string;
  timestamp: Date;
  type: 'request' | 'response' | 'error';
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  status?: number;
  statusText?: string;
  responseBody?: string;
  duration?: number;
  error?: string;
}

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
  // API URL configuration - full base URL
  const [apiBaseUrl, setApiBaseUrl] = useState('https://alphonsomanila.farier.com/api/ajax');

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

  // Request/Response log state
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of log when new entries are added
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logEntries]);

  // Add a log entry
  const addLogEntry = useCallback((entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
    const newEntry: LogEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    setLogEntries(prev => [...prev, newEntry]);
    return newEntry.id;
  }, []);

  // Clear all log entries
  const clearLog = useCallback(() => {
    setLogEntries([]);
  }, []);

  // Helper to make logged fetch requests
  const loggedFetch = useCallback(async (
    url: string,
    options: RequestInit & { headers?: Record<string, string> }
  ): Promise<{ response: Response; responseText: string; duration: number }> => {
    const startTime = performance.now();

    // Log the request
    addLogEntry({
      type: 'request',
      method: options.method || 'GET',
      url,
      headers: options.headers,
      body: options.body ? JSON.parse(options.body as string) : undefined,
    });

    try {
      const response = await fetch(url, options);
      const responseText = await response.text();
      const duration = Math.round(performance.now() - startTime);

      // Log the response
      addLogEntry({
        type: 'response',
        method: options.method || 'GET',
        url,
        status: response.status,
        statusText: response.statusText,
        responseBody: responseText,
        duration,
        headers: Object.fromEntries(response.headers.entries()),
      });

      return { response, responseText, duration };
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log the error
      addLogEntry({
        type: 'error',
        method: options.method || 'GET',
        url,
        error: errorMessage,
        duration,
      });

      throw error;
    }
  }, [addLogEntry]);

  // Build API URL
  const buildApiUrl = useCallback((path: string) => {
    const baseUrl = apiBaseUrl.trim().replace(/\/$/, '');
    return `${baseUrl}${path}`;
  }, [apiBaseUrl]);

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
        secondFactor: authOtp || undefined,
        locale: 'en-GB',
      };

      const { response, responseText } = await loggedFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

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
  }, [authEmail, authPassword, authOtp, buildApiUrl, loggedFetch]);

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

      const { response, responseText } = await loggedFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken,
        },
        body: JSON.stringify(body),
      });

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
  }, [authToken, buildApiUrl, loggedFetch]);

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
      const { response: getResponse, responseText: getResponseText } = await loggedFetch(getUrl, {
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

      const currentCase = JSON.parse(getResponseText);
      const currentSummary = currentCase.summary || '';

      // Now patch the case with the modified title
      const patchUrl = buildApiUrl(`/cases/${patchCaseId}`);
      const newSummary = currentSummary.includes('[edited by dearmp]')
        ? currentSummary
        : `${currentSummary} [edited by dearmp]`;

      const body = {
        summary: newSummary,
      };

      const { response, responseText } = await loggedFetch(patchUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken,
        },
        body: JSON.stringify(body),
      });

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
  }, [authToken, patchCaseId, buildApiUrl, loggedFetch]);

  // Copy token to clipboard
  const copyToken = useCallback(() => {
    if (authToken) {
      navigator.clipboard.writeText(authToken);
      toast.success('Token copied to clipboard');
    }
  }, [authToken]);

  // Copy text to clipboard
  const copyToClipboard = useCallback((text: string, label: string = 'Command') => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  }, []);

  // Generate curl commands for each operation
  const generateAuthCurl = useCallback(() => {
    const url = buildApiUrl('/auth');
    const body = {
      email: authEmail || '<email>',
      password: authPassword || '<password>',
      ...(authOtp ? { secondFactor: authOtp } : {}),
      locale: 'en-GB',
    };
    return `curl -X POST '${url}' \\
  -H 'Content-Type: application/json' \\
  -d '${JSON.stringify(body, null, 2)}'`;
  }, [buildApiUrl, authEmail, authPassword, authOtp]);

  const generateSearchCurl = useCallback(() => {
    const url = buildApiUrl('/cases/search');
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
    return `curl -X POST '${url}' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: ${authToken || '<auth-token>'}' \\
  -d '${JSON.stringify(body, null, 2)}'`;
  }, [buildApiUrl, authToken]);

  const generateGetCaseCurl = useCallback(() => {
    const url = buildApiUrl(`/cases/${patchCaseId || '<case-id>'}`);
    return `curl -X GET '${url}' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: ${authToken || '<auth-token>'}'`;
  }, [buildApiUrl, patchCaseId, authToken]);

  const generatePatchCaseCurl = useCallback(() => {
    const url = buildApiUrl(`/cases/${patchCaseId || '<case-id>'}`);
    const body = {
      summary: '<new-summary> [edited by dearmp]',
    };
    return `curl -X PATCH '${url}' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: ${authToken || '<auth-token>'}' \\
  -d '${JSON.stringify(body, null, 2)}'`;
  }, [buildApiUrl, patchCaseId, authToken]);

  // Reusable CurlBox component
  const CurlBox = ({ curl, label }: { curl: string; label: string }) => (
    <div className="relative group">
      <pre className="p-3 bg-slate-900 text-slate-100 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
        {curl}
      </pre>
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 h-7 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => copyToClipboard(curl, label)}
      >
        <Copy className="h-3 w-3 mr-1" />
        Copy
      </Button>
    </div>
  );

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
            Configure the full API base URL
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-base-url">Base URL</Label>
            <Input
              id="api-base-url"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="https://alphonsomanila.farier.com/api/ajax"
              className="font-mono"
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-sm font-medium">API Calls That Will Be Made:</Label>
            <div className="space-y-2 font-mono text-xs bg-slate-100 dark:bg-slate-900 p-3 rounded-md">
              <div className="flex gap-2">
                <Badge variant="outline" className="shrink-0 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">POST</Badge>
                <span className="break-all">{buildApiUrl('/auth')}</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="shrink-0 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">POST</Badge>
                <span className="break-all">{buildApiUrl('/cases/search')}</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="shrink-0 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">GET</Badge>
                <span className="break-all">{buildApiUrl('/cases/{id}')}</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="shrink-0 bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">PATCH</Badge>
                <span className="break-all">{buildApiUrl('/cases/{id}')}</span>
              </div>
            </div>
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
              <Label htmlFor="auth-otp">Second Factor / OTP (optional)</Label>
              <Input
                id="auth-otp"
                value={authOtp}
                onChange={(e) => setAuthOtp(e.target.value)}
                placeholder="Yubikey or Google Authenticator code"
              />
            </div>

            {/* Curl Command */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">cURL Command:</Label>
              <CurlBox curl={generateAuthCurl()} label="Auth curl" />
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
            {/* Curl Command */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">cURL Command:</Label>
              <CurlBox curl={generateSearchCurl()} label="Search curl" />
            </div>

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

          {/* Curl Commands */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Step 1 - GET current case:</Label>
              <CurlBox curl={generateGetCaseCurl()} label="GET case curl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Step 2 - PATCH case:</Label>
              <CurlBox curl={generatePatchCaseCurl()} label="PATCH case curl" />
            </div>
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
                Body: {`{ email, password, secondFactor?, locale }`}
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

      {/* Bookmarklets Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5" />
            API Bookmarklets
          </CardTitle>
          <CardDescription>
            Drag these bookmarklets to your bookmarks bar to quickly test API endpoints from any page
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Instructions */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>How to Use</AlertTitle>
            <AlertDescription>
              <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                <li>Drag any blue button below to your browser's bookmarks bar</li>
                <li>Navigate to your Caseworker application</li>
                <li>Click the bookmarklet to execute the API call</li>
                <li>Results will be displayed in a popup window</li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Auth Request Bookmarklet */}
            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-medium">1. Auth Request</h4>
              <p className="text-xs text-muted-foreground">
                Authenticates with test credentials and saves JWT token to localStorage.
              </p>
              <a
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium text-sm cursor-move"
                href="javascript:(function(){const BASE_URL=window.location.protocol+'//'+window.location.host+'/api/ajax';const endpoint='/auth';const payload={email:'test@test.com',password:'test',locale:'en'};const reqInfo={method:'POST',url:BASE_URL+endpoint,headers:{'Content-Type':'application/json'},body:payload};fetch(BASE_URL+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}).then(r=>{const status=r.status;const statusText=r.statusText;const headers={};r.headers.forEach((v,k)=>headers[k]=v);return r.text().then(body=>({status,statusText,headers,body,ok:r.ok}));}).then(res=>{if(res.ok)window.localStorage.setItem('token',res.body);const w=window.open('','_blank','width=800,height=700');w.document.write('<html><head><title>Auth Result</title><style>body{font-family:sans-serif;padding:20px;background:%23f5f5f5}textarea{width:100%;height:150px;font-family:monospace;font-size:12px;padding:10px;border:1px solid %23ccc;border-radius:4px;resize:vertical}h2{color:%23333}h3{margin-top:20px;color:%23555}.success{color:%23198754}.error{color:%23dc3545}label{font-weight:bold;display:block;margin-bottom:5px}</style></head><body><h2>Auth Request Result</h2><p class=\"'+(res.ok?'success':'error')+'\">'+(res.ok?'Authentication successful!':'Authentication failed: '+res.status+' '+res.statusText)+'</p>'+(res.ok?'<p>JWT Token saved to localStorage</p>':'')+'<h3>Request Sent:</h3><label>URL:</label><textarea readonly>POST '+reqInfo.url+'</textarea><label>Headers:</label><textarea readonly>'+JSON.stringify(reqInfo.headers,null,2)+'</textarea><label>Body:</label><textarea readonly>'+JSON.stringify(reqInfo.body,null,2)+'</textarea><h3>Response Received:</h3><label>Status:</label><textarea readonly style=\"height:40px\">'+res.status+' '+res.statusText+'</textarea><label>Headers:</label><textarea readonly>'+JSON.stringify(res.headers,null,2)+'</textarea><label>Body:</label><textarea readonly style=\"height:200px\">'+res.body+'</textarea></body></html>');}).catch(e=>{alert('Auth Error: '+e.message);console.error(e);});})();"
              >
                Auth Request
              </a>
              <p className="text-xs text-muted-foreground">
                Credentials: <code className="bg-muted px-1 rounded">test@test.com</code> / <code className="bg-muted px-1 rounded">test</code>
              </p>
            </div>

            {/* Search Tags Bookmarklet */}
            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-medium">2. Search Tags (10)</h4>
              <p className="text-xs text-muted-foreground">
                Searches for tags via <code className="bg-muted px-1 rounded">/api/ajax/tags/search</code>. Requires authentication first.
              </p>
              <a
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium text-sm cursor-move"
                href="javascript:(function(){const BASE_URL=window.location.protocol+'//'+window.location.host+'/api/ajax';const endpoint='/tags/search';const token=window.localStorage.getItem('token')||'';const payload={term:'',pageNo:1,resultsPerPage:10};const reqHeaders={'Content-Type':'application/json','Authorization':token};const reqInfo={method:'POST',url:BASE_URL+endpoint,headers:reqHeaders,body:payload};fetch(BASE_URL+endpoint,{method:'POST',headers:reqHeaders,body:JSON.stringify(payload)}).then(r=>{const status=r.status;const statusText=r.statusText;const headers={};r.headers.forEach((v,k)=>headers[k]=v);if(r.headers.has('Authorization'))window.localStorage.setItem('token',r.headers.get('Authorization'));return r.text().then(body=>({status,statusText,headers,body,ok:r.ok}));}).then(res=>{let data=null;let parseError=null;try{data=JSON.parse(res.body);}catch(e){parseError=e.message;}const w=window.open('','_blank','width=900,height=800');const tableRows=data&&data.results?data.results.map(t=>'<tr><td>'+t.id+'</td><td>'+t.tag+'</td><td>'+(t.usageCount||0)+'</td></tr>').join(''):'<tr><td colspan=\"3\">No results</td></tr>';w.document.write('<html><head><title>Tags Search Result</title><style>body{font-family:sans-serif;padding:20px;background:%23f5f5f5}textarea{width:100%;height:120px;font-family:monospace;font-size:12px;padding:10px;border:1px solid %23ccc;border-radius:4px;resize:vertical}h2{color:%23333}h3{margin-top:20px;color:%23555}.success{color:%23198754}.error{color:%23dc3545}label{font-weight:bold;display:block;margin-bottom:5px}table{width:100%;border-collapse:collapse;background:white;margin:10px 0}th,td{border:1px solid %23ddd;padding:8px;text-align:left}th{background:%23007bff;color:white}</style></head><body><h2>Tags Search Result</h2><p class=\"'+(res.ok?'success':'error')+'\">'+(res.ok?'Request successful!':'Request failed: '+res.status+' '+res.statusText)+'</p>'+(data?'<p>Found <strong>'+((data.results&&data.results.length)||0)+'</strong> of <strong>'+(data.totalResults||0)+'</strong> total tags</p>':'')+'<h3>Results Table:</h3><table><tr><th>ID</th><th>Tag</th><th>Usage Count</th></tr>'+tableRows+'</table><h3>Request Sent:</h3><label>URL:</label><textarea readonly style=\"height:40px\">POST '+reqInfo.url+'</textarea><label>Headers:</label><textarea readonly>'+JSON.stringify(reqInfo.headers,null,2)+'</textarea><label>Body:</label><textarea readonly>'+JSON.stringify(reqInfo.body,null,2)+'</textarea><h3>Response Received:</h3><label>Status:</label><textarea readonly style=\"height:40px\">'+res.status+' '+res.statusText+'</textarea><label>Headers:</label><textarea readonly>'+JSON.stringify(res.headers,null,2)+'</textarea><label>Body:</label><textarea readonly style=\"height:200px\">'+res.body+'</textarea></body></html>');}).catch(e=>{alert('Tags Search Error: '+e.message+'\\n\\nMake sure you are authenticated first!');console.error(e);});})();"
              >
                Search Tags (10)
              </a>
            </div>

            {/* Search Constituents Bookmarklet */}
            <div className="p-4 border rounded-lg space-y-3">
              <h4 className="font-medium">3. Search Constituents (1000)</h4>
              <p className="text-xs text-muted-foreground">
                Searches for constituents via <code className="bg-muted px-1 rounded">/api/ajax/constituents/search</code>. Requires authentication first.
              </p>
              <a
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium text-sm cursor-move"
                href="javascript:(function(){const BASE_URL=window.location.protocol+'//'+window.location.host+'/api/ajax';const endpoint='/constituents/search';const token=window.localStorage.getItem('token')||'';const payload={term:'',pageNo:1,resultsPerPage:1000};const reqHeaders={'Content-Type':'application/json','Authorization':token};const reqInfo={method:'POST',url:BASE_URL+endpoint,headers:reqHeaders,body:payload};fetch(BASE_URL+endpoint,{method:'POST',headers:reqHeaders,body:JSON.stringify(payload)}).then(r=>{const status=r.status;const statusText=r.statusText;const headers={};r.headers.forEach((v,k)=>headers[k]=v);if(r.headers.has('Authorization'))window.localStorage.setItem('token',r.headers.get('Authorization'));return r.text().then(body=>({status,statusText,headers,body,ok:r.ok}));}).then(res=>{let data=null;try{data=JSON.parse(res.body);}catch(e){}const results=data&&data.results?data.results:[];const w=window.open('','_blank','width=900,height=800');const tableRows=results.slice(0,50).map(c=>'<tr><td>'+(c.id||'')+'</td><td>'+(c.firstName||'')+'</td><td>'+(c.lastName||'')+'</td><td>'+(c.fullName||'')+'</td></tr>').join('')||'<tr><td colspan=\"4\">No results</td></tr>';w.document.write('<html><head><title>Constituents Search Result</title><style>body{font-family:sans-serif;padding:20px;background:%23f5f5f5}textarea{width:100%;height:120px;font-family:monospace;font-size:12px;padding:10px;border:1px solid %23ccc;border-radius:4px;resize:vertical}h2{color:%23333}h3{margin-top:20px;color:%23555}.success{color:%23198754}.error{color:%23dc3545}label{font-weight:bold;display:block;margin-bottom:5px}table{width:100%;border-collapse:collapse;background:white;margin:10px 0}th,td{border:1px solid %23ddd;padding:8px;text-align:left}th{background:%23007bff;color:white}.note{background:%23fff3cd;padding:10px;border-radius:4px;margin:10px 0}</style></head><body><h2>Constituents Search Result</h2><p class=\"'+(res.ok?'success':'error')+'\">'+(res.ok?'Request successful!':'Request failed: '+res.status+' '+res.statusText)+'</p>'+(data?'<p>Found <strong>'+results.length+'</strong> of <strong>'+(data.totalResults||0)+'</strong> total constituents</p>':'')+(results.length>50?'<p class=\"note\">Showing first 50 results in table. See response body for all data.</p>':'')+'<h3>Results Table:</h3><table><tr><th>ID</th><th>First Name</th><th>Last Name</th><th>Full Name</th></tr>'+tableRows+'</table><h3>Request Sent:</h3><label>URL:</label><textarea readonly style=\"height:40px\">POST '+reqInfo.url+'</textarea><label>Headers:</label><textarea readonly>'+JSON.stringify(reqInfo.headers,null,2)+'</textarea><label>Body:</label><textarea readonly>'+JSON.stringify(reqInfo.body,null,2)+'</textarea><h3>Response Received:</h3><label>Status:</label><textarea readonly style=\"height:40px\">'+res.status+' '+res.statusText+'</textarea><label>Headers:</label><textarea readonly>'+JSON.stringify(res.headers,null,2)+'</textarea><label>Body:</label><textarea readonly style=\"height:250px\">'+res.body+'</textarea></body></html>');}).catch(e=>{alert('Constituents Search Error: '+e.message+'\\n\\nMake sure you are authenticated first!');console.error(e);});})();"
              >
                Search Constituents (1000)
              </a>
            </div>
          </div>

          {/* Bookmarklet API Reference */}
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-3">Bookmarklet API Endpoints</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="p-2 text-left border">Endpoint</th>
                    <th className="p-2 text-left border">Method</th>
                    <th className="p-2 text-left border">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 border"><code className="text-xs">/api/ajax/auth</code></td>
                    <td className="p-2 border">POST</td>
                    <td className="p-2 border">Authenticate user, returns JWT token</td>
                  </tr>
                  <tr>
                    <td className="p-2 border"><code className="text-xs">/api/ajax/tags/search</code></td>
                    <td className="p-2 border">POST</td>
                    <td className="p-2 border">Search tags with pagination</td>
                  </tr>
                  <tr>
                    <td className="p-2 border"><code className="text-xs">/api/ajax/constituents/search</code></td>
                    <td className="p-2 border">POST</td>
                    <td className="p-2 border">Search constituents with pagination</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              These bookmarklets use the current page's origin as the API base URL. Make sure you're on the Caseworker application before running them.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Request/Response Log */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Request/Response Log
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={clearLog}
              disabled={logEntries.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear Log
            </Button>
          </div>
          <CardDescription>
            Complete log of all API requests and responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96 border rounded-md bg-slate-950 text-slate-50">
            <div className="p-4 font-mono text-xs space-y-4">
              {logEntries.length === 0 ? (
                <p className="text-slate-500 italic">No requests logged yet. Make an API call to see the log.</p>
              ) : (
                logEntries.map((entry) => (
                  <div key={entry.id} className="border-b border-slate-800 pb-4 last:border-b-0">
                    {/* Timestamp and type badge */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-slate-500">
                        {entry.timestamp.toLocaleTimeString()}.{entry.timestamp.getMilliseconds().toString().padStart(3, '0')}
                      </span>
                      {entry.type === 'request' && (
                        <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0">REQUEST</Badge>
                      )}
                      {entry.type === 'response' && (
                        <Badge className={`text-white text-[10px] px-1.5 py-0 ${
                          entry.status && entry.status >= 200 && entry.status < 300
                            ? 'bg-green-600'
                            : 'bg-red-600'
                        }`}>
                          RESPONSE {entry.status}
                        </Badge>
                      )}
                      {entry.type === 'error' && (
                        <Badge className="bg-red-600 text-white text-[10px] px-1.5 py-0">ERROR</Badge>
                      )}
                      {entry.duration !== undefined && (
                        <span className="text-slate-500">{entry.duration}ms</span>
                      )}
                    </div>

                    {/* Method and URL */}
                    {entry.url && (
                      <div className="mb-2">
                        <span className="text-yellow-400 font-bold">{entry.method}</span>
                        <span className="text-slate-300 ml-2">{entry.url}</span>
                      </div>
                    )}

                    {/* Request headers */}
                    {entry.type === 'request' && entry.headers && Object.keys(entry.headers).length > 0 && (
                      <div className="mb-2">
                        <span className="text-slate-500">Headers:</span>
                        <pre className="text-slate-400 ml-2 whitespace-pre-wrap break-all">
                          {JSON.stringify(entry.headers, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Request body */}
                    {entry.type === 'request' && entry.body && (
                      <div className="mb-2">
                        <span className="text-slate-500">Body:</span>
                        <pre className="text-cyan-400 ml-2 whitespace-pre-wrap break-all">
                          {JSON.stringify(entry.body, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Response body */}
                    {entry.type === 'response' && entry.responseBody && (
                      <div>
                        <span className="text-slate-500">Response:</span>
                        <pre className="text-green-400 ml-2 whitespace-pre-wrap break-all max-h-48 overflow-auto">
                          {(() => {
                            try {
                              return JSON.stringify(JSON.parse(entry.responseBody), null, 2);
                            } catch {
                              return entry.responseBody;
                            }
                          })()}
                        </pre>
                      </div>
                    )}

                    {/* Error message */}
                    {entry.type === 'error' && entry.error && (
                      <div>
                        <span className="text-red-400">Error: {entry.error}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
