/**
 * API Health Page
 *
 * A developer tool for testing API endpoints via the server proxy.
 * All requests go through the server to bypass CORS restrictions.
 * Requests and responses are logged to server storage.
 *
 * Based on caseworker-api-routes.txt:
 * - POST /api/ajax/auth - Authenticate with email, password, secondFactor (OTP/Yubikey)
 * - POST /api/ajax/cases/search - Search for cases
 * - POST /api/ajax/tags/search - Search for tags
 */

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  Key,
  Search,
  Server,
  Copy,
  Trash2,
  FileText,
  Bookmark,
  Send,
  Tag,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface LogEntry {
  id: string;
  timestamp: string;
  endpoint: string;
  method: string;
  requestUrl: string;
  requestHeaders: Record<string, string>;
  requestBody: unknown;
  responseStatus: number;
  responseStatusText: string;
  responseHeaders: Record<string, string>;
  responseBody: string;
  duration: number;
  error?: string;
}

interface EndpointConfig {
  name: string;
  description: string;
  method: string;
  path: string;
  defaultBody: Record<string, unknown>;
  requiresAuth: boolean;
}

// ============================================================================
// Endpoint Configurations
// ============================================================================

const ENDPOINTS: Record<string, EndpointConfig> = {
  auth: {
    name: 'Authentication',
    description: 'Authenticate with email, password, and optional OTP. Returns a JWT token.',
    method: 'POST',
    path: '/auth',
    defaultBody: {
      email: '',
      password: '',
      secondFactor: '',
      locale: 'en-GB',
    },
    requiresAuth: false,
  },
  casesSearch: {
    name: 'Cases Search',
    description: 'Search for cases with various filters. Returns paginated case results.',
    method: 'POST',
    path: '/cases/search',
    defaultBody: {
      dateRange: {
        type: 'modified',
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        to: new Date().toISOString(),
      },
      pageNo: 1,
      resultsPerPage: 20,
    },
    requiresAuth: true,
  },
  tagsSearch: {
    name: 'Tags Search',
    description: 'Search for tags. Returns paginated tag results.',
    method: 'POST',
    path: '/tags/search',
    defaultBody: {
      term: '',
      pageNo: 1,
      resultsPerPage: 20,
    },
    requiresAuth: true,
  },
};

// ============================================================================
// Component
// ============================================================================

export default function ApiHealthPage() {
  // Config state
  const [subdomain, setSubdomain] = useState('admin');
  const [authToken, setAuthToken] = useState('');

  // Request body state (editable JSON for each endpoint)
  const [authBody, setAuthBody] = useState(JSON.stringify(ENDPOINTS.auth.defaultBody, null, 2));
  const [casesSearchBody, setCasesSearchBody] = useState(JSON.stringify(ENDPOINTS.casesSearch.defaultBody, null, 2));
  const [tagsSearchBody, setTagsSearchBody] = useState(JSON.stringify(ENDPOINTS.tagsSearch.defaultBody, null, 2));

  // Response state
  const [authResponse, setAuthResponse] = useState<string | null>(null);
  const [casesSearchResponse, setCasesSearchResponse] = useState<string | null>(null);
  const [tagsSearchResponse, setTagsSearchResponse] = useState<string | null>(null);

  // Loading state
  const [authLoading, setAuthLoading] = useState(false);
  const [casesSearchLoading, setCasesSearchLoading] = useState(false);
  const [tagsSearchLoading, setTagsSearchLoading] = useState(false);

  // Error state
  const [authError, setAuthError] = useState<string | null>(null);
  const [casesSearchError, setCasesSearchError] = useState<string | null>(null);
  const [tagsSearchError, setTagsSearchError] = useState<string | null>(null);

  // Server logs state
  const [serverLogs, setServerLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Build the proxy URL
  const buildProxyUrl = useCallback((path: string) => {
    return `/api/caseworker-proxy/${subdomain}${path}`;
  }, [subdomain]);

  // Log to server
  const logToServer = useCallback(async (logData: Omit<LogEntry, 'id' | 'timestamp'>) => {
    try {
      await fetch('/api/health-log/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData),
      });
    } catch (error) {
      console.error('Failed to log to server:', error);
    }
  }, []);

  // Fetch server logs
  const fetchServerLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const response = await fetch('/api/health-log/logs');
      const data = await response.json();
      if (data.success) {
        setServerLogs(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch server logs:', error);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  // Clear server logs
  const clearServerLogs = useCallback(async () => {
    try {
      await fetch('/api/health-log/logs', { method: 'DELETE' });
      setServerLogs([]);
      toast.success('Server logs cleared');
    } catch (error) {
      console.error('Failed to clear server logs:', error);
      toast.error('Failed to clear logs');
    }
  }, []);

  // Load logs on mount
  useEffect(() => {
    fetchServerLogs();
  }, [fetchServerLogs]);

  // Generic request handler
  const makeRequest = useCallback(async (
    endpoint: EndpointConfig,
    body: string,
    setResponse: (r: string | null) => void,
    setError: (e: string | null) => void,
    setLoading: (l: boolean) => void,
    onSuccess?: (data: unknown, rawResponse: string) => void
  ) => {
    setLoading(true);
    setError(null);
    setResponse(null);

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(body);
    } catch {
      setError('Invalid JSON in request body');
      setLoading(false);
      return;
    }

    const url = buildProxyUrl(endpoint.path);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (endpoint.requiresAuth && authToken) {
      headers['Authorization'] = authToken;
    }

    const startTime = performance.now();

    try {
      const response = await fetch(url, {
        method: endpoint.method,
        headers,
        body: JSON.stringify(parsedBody),
      });

      const responseText = await response.text();
      const duration = Math.round(performance.now() - startTime);

      // Log to server
      await logToServer({
        endpoint: endpoint.name,
        method: endpoint.method,
        requestUrl: url,
        requestHeaders: headers,
        requestBody: parsedBody,
        responseStatus: response.status,
        responseStatusText: response.statusText,
        responseHeaders: Object.fromEntries(response.headers.entries()),
        responseBody: responseText,
        duration,
      });

      // Refresh logs
      fetchServerLogs();

      setResponse(responseText);

      if (!response.ok) {
        setError(`HTTP ${response.status}: ${response.statusText}`);
        return;
      }

      // Try to parse and prettify JSON response
      try {
        const data = JSON.parse(responseText);
        setResponse(JSON.stringify(data, null, 2));
        if (onSuccess) {
          onSuccess(data, responseText);
        }
        toast.success(`${endpoint.name} successful`);
      } catch {
        // Response is not JSON
        if (onSuccess) {
          onSuccess(responseText, responseText);
        }
        toast.success(`${endpoint.name} successful`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Request failed';
      const duration = Math.round(performance.now() - startTime);

      // Log error to server
      await logToServer({
        endpoint: endpoint.name,
        method: endpoint.method,
        requestUrl: url,
        requestHeaders: headers,
        requestBody: parsedBody,
        responseStatus: 0,
        responseStatusText: 'Error',
        responseHeaders: {},
        responseBody: '',
        duration,
        error: errorMessage,
      });

      fetchServerLogs();
      setError(errorMessage);
      toast.error(`${endpoint.name} failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [buildProxyUrl, authToken, logToServer, fetchServerLogs]);

  // Handle auth request
  const handleAuth = useCallback(() => {
    makeRequest(
      ENDPOINTS.auth,
      authBody,
      setAuthResponse,
      setAuthError,
      setAuthLoading,
      (data, rawResponse) => {
        // Extract token from response
        let token: string | null = null;
        if (typeof data === 'string') {
          token = data;
        } else if (typeof data === 'object' && data !== null) {
          const obj = data as Record<string, unknown>;
          if (typeof obj.token === 'string') {
            token = obj.token;
          }
        }
        if (!token) {
          // Try raw response as token
          token = rawResponse.replace(/^"|"$/g, '');
        }
        if (token) {
          setAuthToken(token);
          toast.success('Token saved - will be used for subsequent requests');
        }
      }
    );
  }, [authBody, makeRequest]);

  // Handle cases search request
  const handleCasesSearch = useCallback(() => {
    makeRequest(
      ENDPOINTS.casesSearch,
      casesSearchBody,
      setCasesSearchResponse,
      setCasesSearchError,
      setCasesSearchLoading
    );
  }, [casesSearchBody, makeRequest]);

  // Handle tags search request
  const handleTagsSearch = useCallback(() => {
    makeRequest(
      ENDPOINTS.tagsSearch,
      tagsSearchBody,
      setTagsSearchResponse,
      setTagsSearchError,
      setTagsSearchLoading
    );
  }, [tagsSearchBody, makeRequest]);

  // Copy to clipboard
  const copyToClipboard = useCallback((text: string, label: string = 'Text') => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  }, []);

  // Generate bookmarklet
  const generateBookmarklet = useCallback((endpointKey: string) => {
    const endpoint = ENDPOINTS[endpointKey];
    const baseUrl = window.location.origin;

    let bodyJson: string;
    if (endpointKey === 'auth') {
      bodyJson = authBody;
    } else if (endpointKey === 'casesSearch') {
      bodyJson = casesSearchBody;
    } else {
      bodyJson = tagsSearchBody;
    }

    // Create a bookmarklet that opens the API Health page with pre-filled data
    const bookmarkletCode = `javascript:(function(){
      const url='${baseUrl}/api-health?endpoint=${endpointKey}&subdomain=${subdomain}${authToken ? '&token=' + encodeURIComponent(authToken) : ''}';
      window.open(url,'_blank');
    })();`;

    return bookmarkletCode.replace(/\s+/g, ' ');
  }, [subdomain, authToken, authBody, casesSearchBody, tagsSearchBody]);

  // Endpoint Card Component
  const EndpointCard = ({
    endpointKey,
    body,
    setBody,
    response,
    error,
    loading,
    onSend,
  }: {
    endpointKey: string;
    body: string;
    setBody: (b: string) => void;
    response: string | null;
    error: string | null;
    loading: boolean;
    onSend: () => void;
  }) => {
    const endpoint = ENDPOINTS[endpointKey];
    const Icon = endpointKey === 'auth' ? Key : endpointKey === 'casesSearch' ? Search : Tag;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {endpoint.name}
            <Badge variant="outline" className="ml-2">
              {endpoint.method}
            </Badge>
          </CardTitle>
          <CardDescription>{endpoint.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Endpoint URL */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Endpoint URL:</Label>
            <div className="p-2 bg-muted rounded font-mono text-xs break-all">
              {buildProxyUrl(endpoint.path)}
            </div>
          </div>

          {/* Auth requirement warning */}
          {endpoint.requiresAuth && !authToken && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This endpoint requires authentication. Please authenticate first.
              </AlertDescription>
            </Alert>
          )}

          {/* Request body editor */}
          <div className="space-y-2">
            <Label>Request Body (JSON):</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="font-mono text-xs min-h-[150px]"
              placeholder="Enter JSON request body..."
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              onClick={onSend}
              disabled={loading || (endpoint.requiresAuth && !authToken)}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Request
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(body, 'Request body')}
              title="Copy request body"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          {/* Error display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Response display */}
          {response && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Response:</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(response, 'Response')}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </div>
              <ScrollArea className="h-[200px] border rounded">
                <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">
                  {response}
                </pre>
              </ScrollArea>
            </div>
          )}

          {/* Bookmarklet */}
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Bookmark className="h-3 w-3" />
              Bookmarklet:
            </Label>
            <div className="flex gap-2">
              <a
                href={generateBookmarklet(endpointKey)}
                className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded cursor-move"
                onClick={(e) => e.preventDefault()}
                title="Drag to bookmarks bar"
              >
                <Bookmark className="h-3 w-3 mr-1" />
                {endpoint.name}
              </a>
              <span className="text-xs text-muted-foreground self-center">
                Drag to bookmarks bar
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">API Health Check</h1>
        <p className="text-muted-foreground">
          Test Caseworker API endpoints via the server proxy. All requests are logged to server storage.
        </p>
      </div>

      {/* Configuration Panel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            API Configuration
          </CardTitle>
          <CardDescription>
            Configure the API endpoint and authentication token
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Subdomain */}
            <div className="space-y-2">
              <Label htmlFor="subdomain">Subdomain</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="subdomain"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  placeholder="admin"
                  className="font-mono"
                />
                <span className="text-muted-foreground text-sm whitespace-nowrap">.farier.com</span>
              </div>
              <p className="text-xs text-muted-foreground">
                API Base: https://{subdomain}.farier.com/api/ajax
              </p>
            </div>

            {/* Auth Token */}
            <div className="space-y-2">
              <Label htmlFor="auth-token">Authentication Token</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="auth-token"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="JWT token (auto-filled after auth)"
                  className="font-mono text-xs"
                  type="password"
                />
                {authToken && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(authToken, 'Token')}
                    title="Copy token"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {authToken ? (
                  <span className="text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Token set - will be used for authenticated requests
                  </span>
                ) : (
                  'Use the Auth endpoint to get a token, or paste one manually'
                )}
              </p>
            </div>
          </div>

          {/* Bookmarklet for current config */}
          <Separator />
          <div className="space-y-2">
            <Label className="text-sm font-medium">Quick Access Bookmarklet:</Label>
            <div className="flex items-center gap-2">
              <a
                href={`javascript:(function(){window.open('${window.location.origin}/api-health?subdomain=${subdomain}${authToken ? '&token=' + encodeURIComponent(authToken) : ''}','_blank');})();`}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded cursor-move"
                onClick={(e) => e.preventDefault()}
                title="Drag to bookmarks bar"
              >
                <Bookmark className="h-4 w-4 mr-2" />
                API Health ({subdomain})
              </a>
              <span className="text-sm text-muted-foreground">
                Drag to bookmarks bar to quickly open this page with current config
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <Tabs defaultValue="auth" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="auth" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Auth
          </TabsTrigger>
          <TabsTrigger value="casesSearch" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Cases Search
          </TabsTrigger>
          <TabsTrigger value="tagsSearch" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Tags Search
          </TabsTrigger>
        </TabsList>

        <TabsContent value="auth">
          <EndpointCard
            endpointKey="auth"
            body={authBody}
            setBody={setAuthBody}
            response={authResponse}
            error={authError}
            loading={authLoading}
            onSend={handleAuth}
          />
        </TabsContent>

        <TabsContent value="casesSearch">
          <EndpointCard
            endpointKey="casesSearch"
            body={casesSearchBody}
            setBody={setCasesSearchBody}
            response={casesSearchResponse}
            error={casesSearchError}
            loading={casesSearchLoading}
            onSend={handleCasesSearch}
          />
        </TabsContent>

        <TabsContent value="tagsSearch">
          <EndpointCard
            endpointKey="tagsSearch"
            body={tagsSearchBody}
            setBody={setTagsSearchBody}
            response={tagsSearchResponse}
            error={tagsSearchError}
            loading={tagsSearchLoading}
            onSend={handleTagsSearch}
          />
        </TabsContent>
      </Tabs>

      {/* API Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>API Documentation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-3 bg-muted rounded space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Key className="h-4 w-4" />
                Authentication
              </h4>
              <p className="text-xs text-muted-foreground font-mono">
                POST /api/ajax/auth
              </p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Body:</strong></p>
                <ul className="list-disc list-inside pl-2">
                  <li>email (required)</li>
                  <li>password (required)</li>
                  <li>secondFactor (optional - OTP)</li>
                  <li>locale (default: en-GB)</li>
                </ul>
                <p><strong>Returns:</strong> JWT token string</p>
              </div>
            </div>
            <div className="p-3 bg-muted rounded space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Search className="h-4 w-4" />
                Cases Search
              </h4>
              <p className="text-xs text-muted-foreground font-mono">
                POST /api/ajax/cases/search
              </p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Headers:</strong> Authorization: {`<token>`}</p>
                <p><strong>Body:</strong></p>
                <ul className="list-disc list-inside pl-2">
                  <li>dateRange (type, from, to)</li>
                  <li>pageNo, resultsPerPage</li>
                  <li>statusID, casetypeID (optional)</li>
                  <li>orderBy, orderByDirection (optional)</li>
                </ul>
              </div>
            </div>
            <div className="p-3 bg-muted rounded space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Tags Search
              </h4>
              <p className="text-xs text-muted-foreground font-mono">
                POST /api/ajax/tags/search
              </p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Headers:</strong> Authorization: {`<token>`}</p>
                <p><strong>Body:</strong></p>
                <ul className="list-disc list-inside pl-2">
                  <li>term (search string)</li>
                  <li>pageNo</li>
                  <li>resultsPerPage</li>
                </ul>
                <p><strong>Returns:</strong> {`{ results, totalResults }`}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Server Logs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Server Request Log
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchServerLogs}
                disabled={logsLoading}
              >
                {logsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearServerLogs}
                disabled={serverLogs.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          </div>
          <CardDescription>
            All requests are logged to server storage at <code className="text-xs">/logs/api-health-requests.json</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96 border rounded-md bg-slate-950 text-slate-50">
            <div className="p-4 font-mono text-xs space-y-4">
              {serverLogs.length === 0 ? (
                <p className="text-slate-500 italic">No requests logged yet. Send a request to see it logged here.</p>
              ) : (
                serverLogs.map((entry) => (
                  <div key={entry.id} className="border-b border-slate-800 pb-4 last:border-b-0">
                    {/* Timestamp and status */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-slate-500">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                      <Badge className={`text-white text-[10px] px-1.5 py-0 ${
                        entry.responseStatus >= 200 && entry.responseStatus < 300
                          ? 'bg-green-600'
                          : entry.responseStatus > 0
                          ? 'bg-red-600'
                          : 'bg-yellow-600'
                      }`}>
                        {entry.responseStatus || 'ERROR'}
                      </Badge>
                      <span className="text-slate-500">{entry.duration}ms</span>
                      <Badge variant="outline" className="text-[10px]">{entry.endpoint}</Badge>
                    </div>

                    {/* URL */}
                    <div className="mb-2">
                      <span className="text-yellow-400 font-bold">{entry.method}</span>
                      <span className="text-slate-300 ml-2">{entry.requestUrl}</span>
                    </div>

                    {/* Request body */}
                    {entry.requestBody && (
                      <div className="mb-2">
                        <span className="text-slate-500">Request:</span>
                        <pre className="text-cyan-400 ml-2 whitespace-pre-wrap break-all">
                          {typeof entry.requestBody === 'string'
                            ? entry.requestBody
                            : JSON.stringify(entry.requestBody, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Response or error */}
                    {entry.error ? (
                      <div>
                        <span className="text-red-400">Error: {entry.error}</span>
                      </div>
                    ) : entry.responseBody && (
                      <div>
                        <span className="text-slate-500">Response:</span>
                        <pre className="text-green-400 ml-2 whitespace-pre-wrap break-all max-h-32 overflow-auto">
                          {(() => {
                            try {
                              return JSON.stringify(JSON.parse(entry.responseBody), null, 2);
                            } catch {
                              return entry.responseBody.substring(0, 500) + (entry.responseBody.length > 500 ? '...' : '');
                            }
                          })()}
                        </pre>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
