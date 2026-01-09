/**
 * API Documentation Page
 *
 * A standard API documentation interface for the Caseworker API.
 * Features sidebar navigation with anchor links, editable API domain,
 * and interactive endpoint testing.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  CheckCircle,
  Copy,
  Send,
  ChevronRight,
  Settings,
  Key,
  Search,
  Tag,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface EndpointConfig {
  id: string;
  name: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;        // Proxy path (without /api/ajax prefix)
  fullPath: string;    // Full API path (for documentation display)
  requiresAuth: boolean;
  requestBody?: {
    description: string;
    fields: {
      name: string;
      type: string;
      required: boolean;
      description: string;
      example?: string;
    }[];
    example: Record<string, unknown>;
  };
  responseBody?: {
    description: string;
    example: Record<string, unknown> | string;
  };
  notes?: string[];
}

interface NavSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  endpoints: string[];
}

// ============================================================================
// API Configuration
// ============================================================================

const DEFAULT_API_DOMAIN = 'aballinger.caseworkermp.com';

const ENDPOINTS: Record<string, EndpointConfig> = {
  auth: {
    id: 'auth',
    name: 'Authentication',
    description: 'Authenticate a user and obtain a JWT token for subsequent API requests.',
    method: 'POST',
    path: '/auth',
    fullPath: '/api/ajax/auth',
    requiresAuth: false,
    requestBody: {
      description: 'User credentials and optional second factor authentication.',
      fields: [
        { name: 'email', type: 'string', required: true, description: 'User email address', example: 'user@example.com' },
        { name: 'password', type: 'string', required: true, description: 'User password', example: '********' },
        { name: 'secondFactor', type: 'string', required: false, description: 'OTP code or Yubikey token for 2FA', example: '123456' },
        { name: 'locale', type: 'string', required: false, description: 'Locale for response messages', example: 'en-GB' },
      ],
      example: {
        email: '',
        password: '',
        secondFactor: '',
        locale: 'en-GB',
      },
    },
    responseBody: {
      description: 'Returns a JWT token string on successful authentication.',
      example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    },
    notes: [
      'The returned token should be included in the Authorization header for authenticated endpoints.',
      'Token format: Include the raw token value in the Authorization header.',
      'Tokens typically expire after a set period - re-authenticate when receiving 401 responses.',
    ],
  },
  casesSearch: {
    id: 'casesSearch',
    name: 'Search Cases',
    description: 'Search for cases with various filters including date range, status, and case type.',
    method: 'POST',
    path: '/cases/search',
    fullPath: '/api/ajax/cases/search',
    requiresAuth: true,
    requestBody: {
      description: 'Search parameters for filtering cases.',
      fields: [
        { name: 'dateRange', type: 'object', required: false, description: 'Date range filter with type, from, and to fields' },
        { name: 'dateRange.type', type: 'string', required: false, description: 'Type of date to filter by (created, modified)' },
        { name: 'dateRange.from', type: 'string', required: false, description: 'Start date in ISO 8601 format' },
        { name: 'dateRange.to', type: 'string', required: false, description: 'End date in ISO 8601 format' },
        { name: 'pageNo', type: 'number', required: false, description: 'Page number for pagination (default: 1)', example: '1' },
        { name: 'resultsPerPage', type: 'number', required: false, description: 'Number of results per page (default: 20)', example: '20' },
        { name: 'statusID', type: 'number', required: false, description: 'Filter by case status ID' },
        { name: 'casetypeID', type: 'number', required: false, description: 'Filter by case type ID' },
        { name: 'orderBy', type: 'string', required: false, description: 'Field to order results by' },
        { name: 'orderByDirection', type: 'string', required: false, description: 'Sort direction (asc, desc)' },
      ],
      example: {
        dateRange: {
          type: 'modified',
          from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          to: new Date().toISOString(),
        },
        pageNo: 1,
        resultsPerPage: 20,
      },
    },
    responseBody: {
      description: 'Returns paginated case results with metadata.',
      example: {
        results: [],
        totalResults: 0,
        pageNo: 1,
        resultsPerPage: 20,
      },
    },
  },
  tagsSearch: {
    id: 'tagsSearch',
    name: 'Search Tags',
    description: 'Search for tags by term with pagination support.',
    method: 'POST',
    path: '/tags/search',
    fullPath: '/api/ajax/tags/search',
    requiresAuth: true,
    requestBody: {
      description: 'Search parameters for finding tags.',
      fields: [
        { name: 'term', type: 'string', required: false, description: 'Search term to filter tags', example: 'housing' },
        { name: 'pageNo', type: 'number', required: false, description: 'Page number for pagination (default: 1)', example: '1' },
        { name: 'resultsPerPage', type: 'number', required: false, description: 'Number of results per page (default: 20)', example: '20' },
      ],
      example: {
        term: '',
        pageNo: 1,
        resultsPerPage: 20,
      },
    },
    responseBody: {
      description: 'Returns paginated tag results.',
      example: {
        results: [],
        totalResults: 0,
      },
    },
  },
};

const NAV_SECTIONS: NavSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: <FileText className="h-4 w-4" />,
    endpoints: [],
  },
  {
    id: 'authentication',
    title: 'Authentication',
    icon: <Key className="h-4 w-4" />,
    endpoints: ['auth'],
  },
  {
    id: 'cases',
    title: 'Cases',
    icon: <Search className="h-4 w-4" />,
    endpoints: ['casesSearch'],
  },
  {
    id: 'tags',
    title: 'Tags',
    icon: <Tag className="h-4 w-4" />,
    endpoints: ['tagsSearch'],
  },
];

// ============================================================================
// Component
// ============================================================================

export default function ApiHealthPage() {
  // Config state
  const [apiDomain, setApiDomain] = useState(DEFAULT_API_DOMAIN);
  const [authToken, setAuthToken] = useState('');

  // Active section for navigation highlighting
  const [activeSection, setActiveSection] = useState('getting-started');

  // Request/response state per endpoint
  const [requestBodies, setRequestBodies] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    Object.entries(ENDPOINTS).forEach(([key, endpoint]) => {
      if (endpoint.requestBody) {
        initial[key] = JSON.stringify(endpoint.requestBody.example, null, 2);
      }
    });
    return initial;
  });

  const [responses, setResponses] = useState<Record<string, { status: number; body: string; duration: number } | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Refs for scroll tracking
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle scroll to update active section
  useEffect(() => {
    const handleScroll = () => {
      if (!contentRef.current) return;

      const scrollTop = contentRef.current.scrollTop;
      const sections = ['getting-started', ...Object.keys(ENDPOINTS)];

      for (const section of sections) {
        const element = sectionRefs.current[section];
        if (element) {
          const { offsetTop } = element;
          if (scrollTop >= offsetTop - 100) {
            setActiveSection(section);
          }
        }
      }
    };

    const content = contentRef.current;
    content?.addEventListener('scroll', handleScroll);
    return () => content?.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to section
  const scrollToSection = useCallback((sectionId: string) => {
    const element = sectionRefs.current[sectionId];
    if (element && contentRef.current) {
      contentRef.current.scrollTo({
        top: element.offsetTop - 20,
        behavior: 'smooth',
      });
    }
    setActiveSection(sectionId);
  }, []);

  // Build full API URL
  const buildApiUrl = useCallback((path: string) => {
    return `https://${apiDomain}${path}`;
  }, [apiDomain]);

  // Make API request
  const makeRequest = useCallback(async (endpointId: string) => {
    const endpoint = ENDPOINTS[endpointId];
    if (!endpoint) return;

    setLoading(prev => ({ ...prev, [endpointId]: true }));
    setResponses(prev => ({ ...prev, [endpointId]: null }));

    const body = requestBodies[endpointId];
    let parsedBody: unknown;

    try {
      parsedBody = JSON.parse(body);
    } catch {
      toast.error('Invalid JSON in request body');
      setLoading(prev => ({ ...prev, [endpointId]: false }));
      return;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (endpoint.requiresAuth && authToken) {
      headers['Authorization'] = authToken;
    }

    const startTime = performance.now();

    try {
      // Use proxy endpoint to avoid CORS
      const proxyUrl = `/api/caseworker-proxy/custom${endpoint.path}?domain=${encodeURIComponent(apiDomain)}`;

      const response = await fetch(proxyUrl, {
        method: endpoint.method,
        headers,
        body: JSON.stringify(parsedBody),
      });

      const responseText = await response.text();
      const duration = Math.round(performance.now() - startTime);

      let formattedBody = responseText;
      try {
        const parsed = JSON.parse(responseText);
        formattedBody = JSON.stringify(parsed, null, 2);

        // Auto-save auth token
        if (endpointId === 'auth' && response.ok) {
          const token = typeof parsed === 'string' ? parsed : parsed.token || responseText.replace(/^"|"$/g, '');
          if (token) {
            setAuthToken(token);
            toast.success('Token saved automatically');
          }
        }
      } catch {
        // Not JSON, use as-is
      }

      setResponses(prev => ({
        ...prev,
        [endpointId]: { status: response.status, body: formattedBody, duration },
      }));

      if (response.ok) {
        toast.success(`${endpoint.name} - ${response.status} OK`);
      } else {
        toast.error(`${endpoint.name} - ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      const errorMessage = error instanceof Error ? error.message : 'Request failed';

      setResponses(prev => ({
        ...prev,
        [endpointId]: { status: 0, body: `Error: ${errorMessage}`, duration },
      }));

      toast.error(`${endpoint.name} failed: ${errorMessage}`);
    } finally {
      setLoading(prev => ({ ...prev, [endpointId]: false }));
    }
  }, [apiDomain, authToken, requestBodies]);

  // Copy to clipboard
  const copyToClipboard = useCallback((text: string, label: string = 'Text') => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  }, []);

  // Get method badge color
  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-blue-500';
      case 'POST': return 'bg-green-500';
      case 'PUT': return 'bg-yellow-500';
      case 'DELETE': return 'bg-red-500';
      case 'PATCH': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar Navigation */}
      <nav className="w-64 border-r border-gray-200 bg-gray-50 flex-shrink-0 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-semibold text-gray-900">Caseworker API</h1>
          <p className="text-sm text-gray-500 mt-1">v2.1 Documentation</p>
        </div>

        <div className="p-2">
          {NAV_SECTIONS.map(section => (
            <div key={section.id} className="mb-2">
              <button
                onClick={() => scrollToSection(section.endpoints[0] || section.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeSection === section.id || section.endpoints.includes(activeSection)
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {section.icon}
                {section.title}
              </button>

              {section.endpoints.length > 0 && (
                <div className="ml-6 mt-1 space-y-1">
                  {section.endpoints.map(endpointId => {
                    const endpoint = ENDPOINTS[endpointId];
                    return (
                      <button
                        key={endpointId}
                        onClick={() => scrollToSection(endpointId)}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
                          activeSection === endpointId
                            ? 'text-blue-700 bg-blue-50'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                      >
                        <ChevronRight className="h-3 w-3" />
                        {endpoint.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Configuration Bar */}
        <header className="border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">API Domain:</span>
              <Input
                value={apiDomain}
                onChange={(e) => setApiDomain(e.target.value)}
                placeholder="api.example.com"
                className="w-64 h-8 text-sm font-mono"
              />
            </div>

            <div className="flex items-center gap-2 flex-1">
              <Key className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Auth Token:</span>
              <div className="flex-1 flex items-center gap-2">
                <Input
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="Paste your JWT token or authenticate below"
                  type="password"
                  className="flex-1 h-8 text-sm font-mono"
                />
                {authToken && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(authToken, 'Token')}
                      className="h-8"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Documentation Content */}
        <main ref={contentRef} className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-8">
            {/* Getting Started Section */}
            <section
              ref={el => { sectionRefs.current['getting-started'] = el; }}
              id="getting-started"
              className="mb-12"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Getting Started</h2>

              <div className="prose prose-gray max-w-none">
                <p className="text-gray-600 mb-4">
                  Welcome to the Caseworker API documentation. This API allows you to interact with
                  the Caseworker system programmatically, enabling you to search cases, manage tags,
                  and perform various operations.
                </p>

                <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Base URL</h3>
                <div className="bg-gray-100 rounded-md p-3 font-mono text-sm mb-4">
                  https://{apiDomain}/api/ajax
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Authentication</h3>
                <p className="text-gray-600 mb-4">
                  Most API endpoints require authentication. To authenticate:
                </p>
                <ol className="list-decimal list-inside text-gray-600 space-y-2 mb-4">
                  <li>Call the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">/auth</code> endpoint with your credentials</li>
                  <li>Copy the returned JWT token</li>
                  <li>Include the token in the <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">Authorization</code> header for subsequent requests</li>
                </ol>

                <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-3">Quick Start</h3>
                <p className="text-gray-600 mb-4">
                  Enter your API domain above (default: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm">{DEFAULT_API_DOMAIN}</code>)
                  and paste your auth token, or use the Authentication endpoint below to obtain one.
                </p>
              </div>
            </section>

            {/* Endpoint Sections */}
            {Object.entries(ENDPOINTS).map(([endpointId, endpoint]) => (
              <section
                key={endpointId}
                ref={el => { sectionRefs.current[endpointId] = el; }}
                id={endpointId}
                className="mb-12 scroll-mt-4"
              >
                {/* Endpoint Header */}
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">{endpoint.name}</h2>
                  <a
                    href={`#${endpointId}`}
                    className="text-gray-400 hover:text-gray-600"
                    title="Link to this section"
                  >
                    ¶
                  </a>
                </div>

                <p className="text-gray-600 mb-4">{endpoint.description}</p>

                {/* Method and Path */}
                <div className="flex items-center gap-2 mb-6">
                  <Badge className={`${getMethodColor(endpoint.method)} text-white font-mono`}>
                    {endpoint.method}
                  </Badge>
                  <code className="bg-gray-100 px-3 py-1.5 rounded text-sm font-mono flex-1">
                    {endpoint.fullPath}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(buildApiUrl(endpoint.fullPath), 'URL')}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy URL
                  </Button>
                </div>

                {/* Auth Requirement */}
                {endpoint.requiresAuth && (
                  <div className={`mb-4 px-4 py-2 rounded-md text-sm ${
                    authToken
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                  }`}>
                    <Key className="h-4 w-4 inline mr-2" />
                    {authToken
                      ? 'This endpoint requires authentication. Token is set.'
                      : 'This endpoint requires authentication. Please set a token above or authenticate first.'}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Request Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Request</h3>

                    {endpoint.requestBody && (
                      <>
                        <p className="text-sm text-gray-600 mb-3">{endpoint.requestBody.description}</p>

                        {/* Parameters Table */}
                        <div className="border rounded-md overflow-hidden mb-4">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium text-gray-700">Parameter</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-700">Type</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-700">Required</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {endpoint.requestBody.fields.map(field => (
                                <tr key={field.name}>
                                  <td className="px-3 py-2">
                                    <code className="text-xs bg-gray-100 px-1 rounded">{field.name}</code>
                                    <p className="text-xs text-gray-500 mt-0.5">{field.description}</p>
                                  </td>
                                  <td className="px-3 py-2 text-gray-600">{field.type}</td>
                                  <td className="px-3 py-2">
                                    {field.required ? (
                                      <span className="text-red-600 text-xs font-medium">Required</span>
                                    ) : (
                                      <span className="text-gray-400 text-xs">Optional</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Request Body Editor */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">Request Body</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(requestBodies[endpointId] || '', 'Request body')}
                              className="h-6 text-xs"
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </Button>
                          </div>
                          <Textarea
                            value={requestBodies[endpointId] || ''}
                            onChange={(e) => setRequestBodies(prev => ({ ...prev, [endpointId]: e.target.value }))}
                            className="font-mono text-xs min-h-[150px] bg-gray-900 text-gray-100 border-gray-700"
                            placeholder="Enter JSON request body..."
                          />
                        </div>

                        {/* Send Button */}
                        <Button
                          onClick={() => makeRequest(endpointId)}
                          disabled={loading[endpointId] || (endpoint.requiresAuth && !authToken)}
                          className="w-full"
                        >
                          {loading[endpointId] ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Try it out
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Response Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Response</h3>

                    {endpoint.responseBody && (
                      <p className="text-sm text-gray-600 mb-3">{endpoint.responseBody.description}</p>
                    )}

                    {/* Response Display */}
                    {responses[endpointId] ? (
                      <div className="border rounded-md overflow-hidden">
                        <div className="bg-gray-100 px-3 py-2 flex items-center justify-between border-b">
                          <div className="flex items-center gap-2">
                            <Badge className={`${
                              responses[endpointId]!.status >= 200 && responses[endpointId]!.status < 300
                                ? 'bg-green-500'
                                : responses[endpointId]!.status > 0
                                ? 'bg-red-500'
                                : 'bg-yellow-500'
                            } text-white text-xs`}>
                              {responses[endpointId]!.status || 'ERROR'}
                            </Badge>
                            <span className="text-xs text-gray-500">{responses[endpointId]!.duration}ms</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(responses[endpointId]!.body, 'Response')}
                            className="h-6 text-xs"
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <div className="bg-gray-900 p-3 overflow-auto max-h-[300px]">
                          <pre className="text-xs font-mono text-gray-100 whitespace-pre-wrap break-all">
                            {responses[endpointId]!.body}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      /* Example Response */
                      endpoint.responseBody && (
                        <div className="border rounded-md overflow-hidden">
                          <div className="bg-gray-100 px-3 py-2 flex items-center justify-between border-b">
                            <span className="text-xs text-gray-500">Example Response</span>
                          </div>
                          <div className="bg-gray-900 p-3 overflow-auto max-h-[200px]">
                            <pre className="text-xs font-mono text-gray-400 whitespace-pre-wrap">
                              {typeof endpoint.responseBody.example === 'string'
                                ? endpoint.responseBody.example
                                : JSON.stringify(endpoint.responseBody.example, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )
                    )}

                    {/* Notes */}
                    {endpoint.notes && endpoint.notes.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Notes</h4>
                        <ul className="text-sm text-gray-600 space-y-1">
                          {endpoint.notes.map((note, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-gray-400 mt-1">•</span>
                              <span>{note}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            ))}

            {/* Footer */}
            <footer className="border-t border-gray-200 pt-8 mt-8">
              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center gap-4">
                  <span>Caseworker API Documentation</span>
                  <a
                    href={`https://${apiDomain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open API Domain
                  </a>
                </div>
                <span>All requests are proxied through the server</span>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
