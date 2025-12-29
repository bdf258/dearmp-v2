/**
 * Triage Test Page
 *
 * Technical testing page for the email triage process.
 * Allows manual .eml upload with extensive logging and step-by-step
 * visualization of the triage workflow.
 *
 * IMPORTANT: This page does NOT call live Caseworker.MP APIs.
 * All API calls are console logged instead.
 */

import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Upload,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  FileText,
  User,
  FolderOpen,
  Brain,
  Send,
  AlertCircle,
  Info,
  Trash2,
  RefreshCw,
  Copy,
  Mail,
  Database,
  Cpu,
  Server,
  Layers,
  Zap,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface ParsedEmail {
  subject: string;
  from: string;
  fromName: string;
  to: string[];
  cc: string[];
  bcc: string[];
  date: string;
  body: string;
  htmlBody: string;
  headers: Record<string, string>;
  rawContent: string;
}

interface LogEntry {
  id: string;
  timestamp: Date;
  step: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'api_call';
  message: string;
  data?: unknown;
  duration?: number;
}

interface StepStatus {
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  result?: unknown;
  error?: string;
}

type TriageSteps =
  | 'parse_email'
  | 'match_constituent'
  | 'find_cases'
  | 'match_campaigns'
  | 'llm_analysis'
  | 'build_context'
  | 'generate_suggestions'
  | 'submit_decision';

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_REFERENCE_DATA = {
  caseTypes: [
    { id: 1, name: 'Housing', description: 'Housing and accommodation issues', keywords: ['rent', 'eviction', 'landlord', 'housing'] },
    { id: 2, name: 'Benefits', description: 'DWP and benefit claims', keywords: ['universal credit', 'pip', 'dwp', 'benefit'] },
    { id: 3, name: 'Immigration', description: 'Visa and immigration matters', keywords: ['visa', 'immigration', 'asylum', 'passport'] },
    { id: 4, name: 'NHS', description: 'Healthcare and NHS issues', keywords: ['hospital', 'gp', 'nhs', 'doctor', 'treatment'] },
    { id: 5, name: 'Education', description: 'Schools and education', keywords: ['school', 'university', 'education', 'student'] },
    { id: 6, name: 'Employment', description: 'Work and employment issues', keywords: ['job', 'employer', 'work', 'redundancy'] },
    { id: 7, name: 'Transport', description: 'Travel and transport issues', keywords: ['train', 'bus', 'road', 'transport'] },
    { id: 8, name: 'Other', description: 'Other constituency matters' },
  ],
  categoryTypes: [
    { id: 1, name: 'Urgent', description: 'Requires immediate attention' },
    { id: 2, name: 'Standard', description: 'Normal processing time' },
    { id: 3, name: 'Complex', description: 'Requires extensive research' },
    { id: 4, name: 'Multi-agency', description: 'Involves multiple organisations' },
  ],
  statusTypes: [
    { id: 1, name: 'Open' },
    { id: 2, name: 'In Progress' },
    { id: 3, name: 'Awaiting Response' },
    { id: 4, name: 'Closed' },
  ],
  caseworkers: [
    { id: 1, name: 'Sarah Johnson', email: 'sarah@office.mp', specialties: ['Housing', 'Benefits'] },
    { id: 2, name: 'James Wilson', email: 'james@office.mp', specialties: ['Immigration', 'NHS'] },
    { id: 3, name: 'Emma Brown', email: 'emma@office.mp', specialties: ['Education', 'Employment'] },
  ],
  tags: [
    { id: 'tag-1', name: 'Urgent', color: '#EF4444', keywords: ['urgent', 'emergency', 'immediate'] },
    { id: 'tag-2', name: 'Vulnerable', color: '#F59E0B', keywords: ['vulnerable', 'disability', 'elderly'] },
    { id: 'tag-3', name: 'Follow-up', color: '#3B82F6', keywords: ['follow up', 'chase', 'reminder'] },
    { id: 'tag-4', name: 'MP Response Required', color: '#8B5CF6', keywords: ['mp', 'personal response'] },
  ],
};

const MOCK_CONSTITUENT = {
  id: 'const-123',
  externalId: 12345,
  fullName: 'John Smith',
  title: 'Mr',
  isOrganisation: false,
  previousCaseCount: 3,
  lastContactDate: '2024-11-15',
  contacts: [
    { type: 'email', value: 'john.smith@example.com', isPrimary: true },
    { type: 'address', value: '123 High Street, London, SW1A 1AA', isPrimary: true },
    { type: 'phone', value: '07700 900123' },
  ],
};

const MOCK_EXISTING_CASES = [
  {
    id: 'case-001',
    externalId: 5001,
    summary: 'Housing disrepair - damp issues in council flat',
    caseTypeName: 'Housing',
    categoryName: 'Standard',
    statusName: 'In Progress',
    createdAt: '2024-10-01',
    lastActivityAt: '2024-11-20',
  },
  {
    id: 'case-002',
    externalId: 5002,
    summary: 'PIP assessment appeal',
    caseTypeName: 'Benefits',
    categoryName: 'Complex',
    statusName: 'Awaiting Response',
    createdAt: '2024-09-15',
    lastActivityAt: '2024-11-18',
  },
];

const MOCK_CAMPAIGNS = [
  {
    id: 'camp-001',
    name: 'Climate Action Now',
    description: 'Campaign asking MP to support climate legislation',
    emailCount: 247,
    matchConfidence: 0.85,
    matchType: 'pattern' as const,
  },
  {
    id: 'camp-002',
    name: 'Save Our Hospital',
    description: 'Local hospital closure opposition',
    emailCount: 1532,
    matchConfidence: 0.45,
    matchType: 'fuzzy' as const,
  },
];

const MOCK_LLM_SUGGESTION = {
  emailType: 'casework' as const,
  classificationConfidence: 0.92,
  classificationReasoning: 'Email describes a personal housing issue requiring casework assistance',
  recommendedAction: 'add_to_case' as const,
  actionConfidence: 0.78,
  actionReasoning: 'Sender has an existing open housing case that this email relates to',
  suggestedExistingCaseId: 'case-001',
  suggestedExistingCaseConfidence: 0.82,
  suggestedCaseType: { id: 1, name: 'Housing', confidence: 0.95 },
  suggestedCategory: { id: 2, name: 'Standard', confidence: 0.88 },
  suggestedAssignee: { id: 1, name: 'Sarah Johnson', confidence: 0.91, reasoning: 'Specializes in housing cases' },
  suggestedPriority: 'medium' as const,
  priorityConfidence: 0.75,
  suggestedTags: [
    { id: 'tag-1', name: 'Follow-up', confidence: 0.72 },
  ],
  suggestedSummary: 'Constituent following up on ongoing housing disrepair issue with council. Damp problem persisting despite previous reports.',
  extractedConstituentDetails: {
    name: 'John Smith',
    address: '123 High Street, London',
    postcode: 'SW1A 1AA',
  },
};

// ============================================================================
// HELPERS
// ============================================================================

function parseEmlFile(content: string): ParsedEmail {
  const lines = content.split(/\r?\n/);
  const headers: Record<string, string> = {};
  let bodyStartIndex = 0;
  let currentHeader = '';

  // Parse headers
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Empty line marks end of headers
    if (line.trim() === '') {
      bodyStartIndex = i + 1;
      break;
    }

    // Continuation of previous header (starts with whitespace)
    if (/^\s/.test(line) && currentHeader) {
      headers[currentHeader] += ' ' + line.trim();
      continue;
    }

    // New header
    const headerMatch = line.match(/^([^:]+):\s*(.*)$/);
    if (headerMatch) {
      currentHeader = headerMatch[1].toLowerCase();
      headers[currentHeader] = headerMatch[2];
    }
  }

  // Parse body
  const bodyLines = lines.slice(bodyStartIndex);
  let body = bodyLines.join('\n');
  let htmlBody = '';

  // Check for multipart content
  const contentType = headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/);

  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = body.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));

    for (const part of parts) {
      if (part.includes('text/plain')) {
        const plainMatch = part.match(/\r?\n\r?\n([\s\S]*)/);
        if (plainMatch) body = plainMatch[1].trim();
      }
      if (part.includes('text/html')) {
        const htmlMatch = part.match(/\r?\n\r?\n([\s\S]*)/);
        if (htmlMatch) htmlBody = htmlMatch[1].trim();
      }
    }
  }

  // Decode quoted-printable if needed
  if (headers['content-transfer-encoding']?.includes('quoted-printable')) {
    body = body
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  // Parse from address
  const fromHeader = headers['from'] || '';
  const fromMatch = fromHeader.match(/(?:"?([^"<]*)"?\s*)?<?([^>]+@[^>]+)>?/);
  const fromName = fromMatch?.[1]?.trim() || '';
  const from = fromMatch?.[2]?.trim() || fromHeader;

  // Parse to addresses
  const toHeader = headers['to'] || '';
  const to = toHeader.split(',').map(addr => {
    const match = addr.match(/<([^>]+)>/);
    return match ? match[1].trim() : addr.trim();
  }).filter(Boolean);

  // Parse cc addresses
  const ccHeader = headers['cc'] || '';
  const cc = ccHeader ? ccHeader.split(',').map(addr => {
    const match = addr.match(/<([^>]+)>/);
    return match ? match[1].trim() : addr.trim();
  }).filter(Boolean) : [];

  return {
    subject: headers['subject'] || '(No subject)',
    from,
    fromName,
    to,
    cc,
    bcc: [],
    date: headers['date'] || new Date().toISOString(),
    body: body.trim(),
    htmlBody,
    headers,
    rawContent: content,
  };
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// ============================================================================
// STEP DIAGRAM COMPONENT
// ============================================================================

interface StepDiagramProps {
  steps: Record<TriageSteps, StepStatus>;
  currentStep: TriageSteps | null;
  onRunStep: (step: TriageSteps) => void;
  onSkipStep: (step: TriageSteps) => void;
  disabled: boolean;
}

const STEP_ORDER: TriageSteps[] = [
  'parse_email',
  'match_constituent',
  'find_cases',
  'match_campaigns',
  'build_context',
  'llm_analysis',
  'generate_suggestions',
  'submit_decision',
];

const STEP_INFO: Record<TriageSteps, { label: string; description: string; icon: typeof Mail }> = {
  parse_email: {
    label: '1. Parse Email',
    description: 'Extract headers, body, and metadata from .eml file',
    icon: FileText,
  },
  match_constituent: {
    label: '2. Match Constituent',
    description: 'Find existing constituent by email address in shadow DB',
    icon: User,
  },
  find_cases: {
    label: '3. Find Existing Cases',
    description: 'Query open cases for matched constituent',
    icon: FolderOpen,
  },
  match_campaigns: {
    label: '4. Match Campaigns',
    description: 'Check for campaign pattern matches',
    icon: Mail,
  },
  build_context: {
    label: '5. Build Context',
    description: 'Assemble TriageContextDto for LLM',
    icon: Database,
  },
  llm_analysis: {
    label: '6. LLM Analysis',
    description: 'Send to Gemini 2.0 Flash for classification',
    icon: Brain,
  },
  generate_suggestions: {
    label: '7. Generate Suggestions',
    description: 'Create TriageSuggestionDto from LLM response',
    icon: Zap,
  },
  submit_decision: {
    label: '8. Submit Decision',
    description: 'Queue triage decision for processing',
    icon: Send,
  },
};

function StepDiagram({ steps, currentStep, onRunStep, onSkipStep, disabled }: StepDiagramProps) {
  const getStatusColor = (status: StepStatus['status']) => {
    switch (status) {
      case 'success': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'running': return 'bg-blue-500 animate-pulse';
      case 'skipped': return 'bg-gray-400';
      default: return 'bg-gray-300';
    }
  };

  const getStatusIcon = (status: StepStatus['status']) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'skipped': return <ChevronRight className="h-4 w-4 text-gray-400" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-2">
      {STEP_ORDER.map((step, index) => {
        const info = STEP_INFO[step];
        const status = steps[step];
        const Icon = info.icon;
        const isActive = currentStep === step;
        const canRun = !disabled && (index === 0 || steps[STEP_ORDER[index - 1]].status === 'success' || steps[STEP_ORDER[index - 1]].status === 'skipped');

        return (
          <div key={step}>
            <div
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                isActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' :
                status.status === 'success' ? 'border-green-200 bg-green-50/50 dark:bg-green-950/20' :
                status.status === 'error' ? 'border-red-200 bg-red-50/50 dark:bg-red-950/20' :
                'border-gray-200'
              }`}
            >
              {/* Status indicator */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getStatusColor(status.status)}`}>
                <Icon className="h-4 w-4 text-white" />
              </div>

              {/* Step info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{info.label}</span>
                  {getStatusIcon(status.status)}
                </div>
                <p className="text-xs text-muted-foreground truncate">{info.description}</p>
                {status.endTime && status.startTime && (
                  <p className="text-xs text-blue-600">
                    Completed in {status.endTime.getTime() - status.startTime.getTime()}ms
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={status.status === 'pending' ? 'default' : 'outline'}
                  onClick={() => onRunStep(step)}
                  disabled={!canRun || status.status === 'running'}
                  className="h-7 px-2"
                >
                  <Play className="h-3 w-3 mr-1" />
                  Run
                </Button>
                {status.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onSkipStep(step)}
                    disabled={!canRun}
                    className="h-7 px-2"
                  >
                    Skip
                  </Button>
                )}
              </div>
            </div>

            {/* Arrow between steps */}
            {index < STEP_ORDER.length - 1 && (
              <div className="flex justify-center py-1">
                <ArrowRight className="h-4 w-4 text-gray-300 rotate-90" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// LOG VIEWER COMPONENT
// ============================================================================

interface LogViewerProps {
  logs: LogEntry[];
  onClear: () => void;
}

function LogViewer({ logs, onClear }: LogViewerProps) {
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'api_call': return <Server className="h-4 w-4 text-purple-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getLogBg = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'bg-green-50 dark:bg-green-950/30';
      case 'error': return 'bg-red-50 dark:bg-red-950/30';
      case 'warning': return 'bg-yellow-50 dark:bg-yellow-950/30';
      case 'api_call': return 'bg-purple-50 dark:bg-purple-950/30';
      default: return 'bg-gray-50 dark:bg-gray-900/30';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Execution Log ({logs.length} entries)</h4>
        <Button size="sm" variant="outline" onClick={onClear} className="h-7">
          <Trash2 className="h-3 w-3 mr-1" />
          Clear
        </Button>
      </div>

      <ScrollArea className="h-[400px] border rounded-lg">
        <div className="p-2 space-y-1">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No log entries yet. Upload an email and run the triage process.
            </p>
          ) : (
            logs.map((log) => (
              <Collapsible key={log.id} open={expandedLogs.has(log.id)}>
                <CollapsibleTrigger asChild>
                  <div
                    className={`flex items-start gap-2 p-2 rounded cursor-pointer hover:opacity-80 ${getLogBg(log.type)}`}
                    onClick={() => log.data && toggleExpand(log.id)}
                  >
                    {getLogIcon(log.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {log.step}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                        {log.duration !== undefined && (
                          <span className="text-xs text-blue-600">
                            {log.duration}ms
                          </span>
                        )}
                      </div>
                      <p className="text-sm">{log.message}</p>
                    </div>
                    {log.data && (
                      expandedLogs.has(log.id) ?
                        <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" /> :
                        <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                    )}
                  </div>
                </CollapsibleTrigger>
                {log.data && (
                  <CollapsibleContent>
                    <div className="ml-6 mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono relative group">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(JSON.stringify(log.data, null, 2));
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <pre className="whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </div>
                  </CollapsibleContent>
                )}
              </Collapsible>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// MAIN TEST PAGE COMPONENT
// ============================================================================

export default function TriageTestPage() {
  // State
  const [parsedEmail, setParsedEmail] = useState<ParsedEmail | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [currentStep, setCurrentStep] = useState<TriageSteps | null>(null);
  const [stepStatuses, setStepStatuses] = useState<Record<TriageSteps, StepStatus>>({
    parse_email: { status: 'pending' },
    match_constituent: { status: 'pending' },
    find_cases: { status: 'pending' },
    match_campaigns: { status: 'pending' },
    build_context: { status: 'pending' },
    llm_analysis: { status: 'pending' },
    generate_suggestions: { status: 'pending' },
    submit_decision: { status: 'pending' },
  });

  // Collected data from each step
  const [matchedConstituent, setMatchedConstituent] = useState<typeof MOCK_CONSTITUENT | null>(null);
  const [existingCases, setExistingCases] = useState<typeof MOCK_EXISTING_CASES>([]);
  const [matchedCampaigns, setMatchedCampaigns] = useState<typeof MOCK_CAMPAIGNS>([]);
  const [triageContext, setTriageContext] = useState<unknown>(null);
  const [llmSuggestion, setLlmSuggestion] = useState<typeof MOCK_LLM_SUGGESTION | null>(null);

  // Decision form state
  const [decision, setDecision] = useState({
    action: 'create_case' as 'create_case' | 'add_to_case' | 'ignore',
    caseId: '',
    priority: 'medium',
    assigneeId: '',
    tagIds: [] as string[],
  });

  // Logging helper
  const log = useCallback((
    step: string,
    type: LogEntry['type'],
    message: string,
    data?: unknown,
    duration?: number
  ) => {
    const entry: LogEntry = {
      id: generateId(),
      timestamp: new Date(),
      step,
      type,
      message,
      data,
      duration,
    };
    setLogs(prev => [entry, ...prev]);

    // Also log to browser console
    const consoleMethod = type === 'error' ? console.error :
                          type === 'warning' ? console.warn :
                          console.log;
    consoleMethod(`[${step}] ${message}`, data || '');
  }, []);

  // Clear all state
  const resetAll = useCallback(() => {
    setParsedEmail(null);
    setLogs([]);
    setCurrentStep(null);
    setStepStatuses({
      parse_email: { status: 'pending' },
      match_constituent: { status: 'pending' },
      find_cases: { status: 'pending' },
      match_campaigns: { status: 'pending' },
      build_context: { status: 'pending' },
      llm_analysis: { status: 'pending' },
      generate_suggestions: { status: 'pending' },
      submit_decision: { status: 'pending' },
    });
    setMatchedConstituent(null);
    setExistingCases([]);
    setMatchedCampaigns([]);
    setTriageContext(null);
    setLlmSuggestion(null);
  }, []);

  // File upload handler
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    resetAll();
    log('upload', 'info', `File selected: ${file.name} (${file.size} bytes)`);

    try {
      const content = await file.text();
      log('upload', 'success', 'File content read successfully', {
        length: content.length,
        firstLines: content.split('\n').slice(0, 5).join('\n')
      });

      // Pre-parse to show preview
      const parsed = parseEmlFile(content);
      setParsedEmail(parsed);
      log('upload', 'success', 'Email parsed for preview', {
        subject: parsed.subject,
        from: parsed.from,
        bodyLength: parsed.body.length,
      });
    } catch (error) {
      log('upload', 'error', `Failed to read file: ${error}`);
    }

    // Reset file input
    event.target.value = '';
  }, [log, resetAll]);

  // Update step status helper
  const updateStep = useCallback((step: TriageSteps, update: Partial<StepStatus>) => {
    setStepStatuses(prev => ({
      ...prev,
      [step]: { ...prev[step], ...update },
    }));
  }, []);

  // Step execution functions
  const runParseEmail = useCallback(async () => {
    if (!parsedEmail) {
      log('parse_email', 'error', 'No email file loaded');
      return;
    }

    setCurrentStep('parse_email');
    updateStep('parse_email', { status: 'running', startTime: new Date() });
    log('parse_email', 'info', 'Starting email parsing...');

    // Simulate processing time
    await new Promise(r => setTimeout(r, 500));

    log('parse_email', 'success', 'Email headers extracted', parsedEmail.headers);
    log('parse_email', 'success', 'Email body extracted', {
      bodyLength: parsedEmail.body.length,
      hasHtml: !!parsedEmail.htmlBody,
    });

    updateStep('parse_email', {
      status: 'success',
      endTime: new Date(),
      result: parsedEmail,
    });
    setCurrentStep(null);
  }, [parsedEmail, log, updateStep]);

  const runMatchConstituent = useCallback(async () => {
    if (!parsedEmail) return;

    setCurrentStep('match_constituent');
    updateStep('match_constituent', { status: 'running', startTime: new Date() });
    log('match_constituent', 'info', 'Searching for constituent by email...');

    // Simulate API call
    log('match_constituent', 'api_call', '[MOCK] Would call: constituentRepository.findByEmail()', {
      officeId: 'office-123',
      email: parsedEmail.from,
    });

    await new Promise(r => setTimeout(r, 800));

    // Use mock data
    const matched = { ...MOCK_CONSTITUENT };
    matched.contacts[0].value = parsedEmail.from; // Use actual email from parsed file

    log('match_constituent', 'api_call', '[MOCK] Would call: LegacyApiClient.findConstituentMatches()', {
      query: { email: parsedEmail.from },
    });

    log('match_constituent', 'success', 'Constituent match found', matched);
    setMatchedConstituent(matched);

    updateStep('match_constituent', {
      status: 'success',
      endTime: new Date(),
      result: matched,
    });
    setCurrentStep(null);
  }, [parsedEmail, log, updateStep]);

  const runFindCases = useCallback(async () => {
    setCurrentStep('find_cases');
    updateStep('find_cases', { status: 'running', startTime: new Date() });
    log('find_cases', 'info', 'Querying open cases for constituent...');

    if (!matchedConstituent) {
      log('find_cases', 'warning', 'No matched constituent - skipping case lookup');
      updateStep('find_cases', {
        status: 'success',
        endTime: new Date(),
        result: [],
      });
      setCurrentStep(null);
      return;
    }

    log('find_cases', 'api_call', '[MOCK] Would call: caseRepository.findOpenCasesForConstituent()', {
      officeId: 'office-123',
      constituentId: matchedConstituent.id,
    });

    await new Promise(r => setTimeout(r, 600));

    log('find_cases', 'success', `Found ${MOCK_EXISTING_CASES.length} open cases`, MOCK_EXISTING_CASES);
    setExistingCases(MOCK_EXISTING_CASES);

    updateStep('find_cases', {
      status: 'success',
      endTime: new Date(),
      result: MOCK_EXISTING_CASES,
    });
    setCurrentStep(null);
  }, [matchedConstituent, log, updateStep]);

  const runMatchCampaigns = useCallback(async () => {
    if (!parsedEmail) return;

    setCurrentStep('match_campaigns');
    updateStep('match_campaigns', { status: 'running', startTime: new Date() });
    log('match_campaigns', 'info', 'Checking for campaign pattern matches...');

    log('match_campaigns', 'api_call', '[MOCK] Would call: campaignMatcher.findMatches()', {
      subject: parsedEmail.subject,
      bodyFingerprint: 'sha256:...',
    });

    await new Promise(r => setTimeout(r, 400));

    // Check if subject contains campaign keywords
    const subjectLower = parsedEmail.subject.toLowerCase();
    const isCampaignLikely =
      subjectLower.includes('climate') ||
      subjectLower.includes('campaign') ||
      subjectLower.includes('petition') ||
      subjectLower.includes('action');

    if (isCampaignLikely) {
      log('match_campaigns', 'success', 'Potential campaign matches found', MOCK_CAMPAIGNS);
      setMatchedCampaigns(MOCK_CAMPAIGNS);
    } else {
      log('match_campaigns', 'info', 'No campaign pattern matches detected');
      setMatchedCampaigns([]);
    }

    updateStep('match_campaigns', {
      status: 'success',
      endTime: new Date(),
      result: isCampaignLikely ? MOCK_CAMPAIGNS : [],
    });
    setCurrentStep(null);
  }, [parsedEmail, log, updateStep]);

  const runBuildContext = useCallback(async () => {
    if (!parsedEmail) return;

    setCurrentStep('build_context');
    updateStep('build_context', { status: 'running', startTime: new Date() });
    log('build_context', 'info', 'Building TriageContextDto...');

    await new Promise(r => setTimeout(r, 300));

    const context = {
      email: {
        subject: parsedEmail.subject,
        body: parsedEmail.body,
        senderEmail: parsedEmail.from,
        senderName: parsedEmail.fromName,
        receivedAt: parsedEmail.date,
      },
      matchedConstituent: matchedConstituent ? {
        id: matchedConstituent.id,
        externalId: matchedConstituent.externalId,
        fullName: matchedConstituent.fullName,
        title: matchedConstituent.title,
        isOrganisation: matchedConstituent.isOrganisation,
        previousCaseCount: matchedConstituent.previousCaseCount,
        lastContactDate: matchedConstituent.lastContactDate,
      } : undefined,
      constituentMatchConfidence: matchedConstituent ? 0.95 : undefined,
      existingCases: existingCases.map(c => ({
        id: c.id,
        externalId: c.externalId,
        summary: c.summary,
        caseTypeName: c.caseTypeName,
        categoryName: c.categoryName,
        statusName: c.statusName,
        createdAt: c.createdAt,
        lastActivityAt: c.lastActivityAt,
      })),
      matchedCampaigns,
      referenceData: MOCK_REFERENCE_DATA,
      officeContext: {
        mpName: 'Test MP',
        constituencyName: 'Test Constituency',
      },
    };

    log('build_context', 'success', 'TriageContextDto assembled', context);
    setTriageContext(context);

    updateStep('build_context', {
      status: 'success',
      endTime: new Date(),
      result: context,
    });
    setCurrentStep(null);
  }, [parsedEmail, matchedConstituent, existingCases, matchedCampaigns, log, updateStep]);

  const runLlmAnalysis = useCallback(async () => {
    setCurrentStep('llm_analysis');
    updateStep('llm_analysis', { status: 'running', startTime: new Date() });
    log('llm_analysis', 'info', 'Sending context to LLM for analysis...');

    log('llm_analysis', 'api_call', '[MOCK] Would call: GeminiLLMService.analyzeEmail()', {
      model: 'gemini-2.0-flash',
      contextLength: JSON.stringify(triageContext).length,
    });

    // Simulate LLM processing time
    await new Promise(r => setTimeout(r, 1500));

    log('llm_analysis', 'info', 'LLM response received, parsing JSON schema...');
    log('llm_analysis', 'success', 'LLM analysis complete', MOCK_LLM_SUGGESTION);

    updateStep('llm_analysis', {
      status: 'success',
      endTime: new Date(),
      result: MOCK_LLM_SUGGESTION,
    });
    setCurrentStep(null);
  }, [triageContext, log, updateStep]);

  const runGenerateSuggestions = useCallback(async () => {
    setCurrentStep('generate_suggestions');
    updateStep('generate_suggestions', { status: 'running', startTime: new Date() });
    log('generate_suggestions', 'info', 'Generating TriageSuggestionDto...');

    await new Promise(r => setTimeout(r, 300));

    log('generate_suggestions', 'info', 'Validating suggestions against reference data...');
    log('generate_suggestions', 'success', 'All suggestions validated successfully');

    setLlmSuggestion(MOCK_LLM_SUGGESTION);

    // Pre-fill decision form based on suggestion
    setDecision({
      action: MOCK_LLM_SUGGESTION.recommendedAction === 'ignore' ? 'ignore' :
              MOCK_LLM_SUGGESTION.recommendedAction === 'add_to_case' ? 'add_to_case' : 'create_case',
      caseId: MOCK_LLM_SUGGESTION.suggestedExistingCaseId || '',
      priority: MOCK_LLM_SUGGESTION.suggestedPriority,
      assigneeId: MOCK_LLM_SUGGESTION.suggestedAssignee?.id.toString() || '',
      tagIds: MOCK_LLM_SUGGESTION.suggestedTags?.map(t => t.id) || [],
    });

    log('generate_suggestions', 'success', 'Suggestion DTO created and decision form pre-filled', MOCK_LLM_SUGGESTION);

    updateStep('generate_suggestions', {
      status: 'success',
      endTime: new Date(),
      result: MOCK_LLM_SUGGESTION,
    });
    setCurrentStep(null);
  }, [log, updateStep]);

  const runSubmitDecision = useCallback(async () => {
    setCurrentStep('submit_decision');
    updateStep('submit_decision', { status: 'running', startTime: new Date() });
    log('submit_decision', 'info', 'Preparing triage decision for submission...');

    const decisionPayload = {
      messageId: 'msg-test-123',
      action: decision.action,
      caseId: decision.caseId || undefined,
      priority: decision.priority,
      assigneeId: decision.assigneeId || undefined,
      tagIds: decision.tagIds,
      timestamp: new Date().toISOString(),
    };

    log('submit_decision', 'api_call', '[MOCK - NOT CALLING LIVE API] Would call: QueueService.submitTriageDecision()', {
      officeId: 'office-123',
      decision: decisionPayload,
    });

    await new Promise(r => setTimeout(r, 500));

    log('submit_decision', 'api_call', '[MOCK - NOT CALLING LIVE API] Would queue: TRIAGE_SUBMIT_DECISION job', {
      jobData: {
        officeId: 'office-123',
        messageId: 'msg-test-123',
        decision: decisionPayload,
      },
    });

    log('submit_decision', 'success', 'Decision submission simulated (no live API call made)', {
      wouldHaveSubmitted: decisionPayload,
    });

    updateStep('submit_decision', {
      status: 'success',
      endTime: new Date(),
      result: { success: true, simulated: true },
    });
    setCurrentStep(null);
  }, [decision, log, updateStep]);

  // Skip step handler
  const handleSkipStep = useCallback((step: TriageSteps) => {
    updateStep(step, { status: 'skipped' });
    log(step, 'warning', 'Step skipped by user');
  }, [log, updateStep]);

  // Run step handler
  const handleRunStep = useCallback(async (step: TriageSteps) => {
    switch (step) {
      case 'parse_email': await runParseEmail(); break;
      case 'match_constituent': await runMatchConstituent(); break;
      case 'find_cases': await runFindCases(); break;
      case 'match_campaigns': await runMatchCampaigns(); break;
      case 'build_context': await runBuildContext(); break;
      case 'llm_analysis': await runLlmAnalysis(); break;
      case 'generate_suggestions': await runGenerateSuggestions(); break;
      case 'submit_decision': await runSubmitDecision(); break;
    }
  }, [runParseEmail, runMatchConstituent, runFindCases, runMatchCampaigns, runBuildContext, runLlmAnalysis, runGenerateSuggestions, runSubmitDecision]);

  // Run all steps
  const runAllSteps = useCallback(async () => {
    for (const step of STEP_ORDER) {
      if (stepStatuses[step].status === 'pending') {
        await handleRunStep(step);
        // Small delay between steps for visual feedback
        await new Promise(r => setTimeout(r, 200));
      }
    }
  }, [stepStatuses, handleRunStep]);

  // Check if any step is running
  const isRunning = useMemo(() =>
    Object.values(stepStatuses).some(s => s.status === 'running'),
    [stepStatuses]
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Triage Process Test Page</h1>
          <p className="text-muted-foreground">
            Technical testing tool for email triage workflow. Upload an .eml file and step through the process.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetAll} disabled={isRunning}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset All
          </Button>
          <Button onClick={runAllSteps} disabled={!parsedEmail || isRunning}>
            <Play className="h-4 w-4 mr-2" />
            Run All Steps
          </Button>
        </div>
      </div>

      {/* Warning banner */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Test Mode - No Live API Calls</AlertTitle>
        <AlertDescription>
          This page does NOT call the Caseworker.MP API. All external API calls are console logged only.
          Mock data is used for constituent matching, case lookup, and LLM responses.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-12 gap-6">
        {/* Left column - Upload and Email Preview */}
        <div className="col-span-4 space-y-4">
          {/* File Upload */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload .eml File
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
                <input
                  type="file"
                  accept=".eml"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="eml-upload"
                />
                <label htmlFor="eml-upload" className="cursor-pointer">
                  <FileText className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Click to upload .eml file</p>
                  <p className="text-xs text-muted-foreground">or drag and drop</p>
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Email Preview */}
          {parsedEmail && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Subject</span>
                  <p className="font-medium">{parsedEmail.subject}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">From</span>
                  <p className="text-sm">
                    {parsedEmail.fromName && <span className="font-medium">{parsedEmail.fromName} </span>}
                    &lt;{parsedEmail.from}&gt;
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">To</span>
                  <p className="text-sm">{parsedEmail.to.join(', ')}</p>
                </div>
                {parsedEmail.cc.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">CC</span>
                    <p className="text-sm">{parsedEmail.cc.join(', ')}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Date</span>
                  <p className="text-sm">{parsedEmail.date}</p>
                </div>
                <Separator />
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Body Preview</span>
                  <ScrollArea className="h-[200px] mt-1">
                    <pre className="text-sm whitespace-pre-wrap font-sans">
                      {parsedEmail.body.slice(0, 1000)}
                      {parsedEmail.body.length > 1000 && '...'}
                    </pre>
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Collected Data Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-5 w-5" />
                Collected Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Matched Constituent</span>
                {matchedConstituent ? (
                  <Badge variant="default">{matchedConstituent.fullName}</Badge>
                ) : (
                  <Badge variant="outline">None</Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Existing Cases</span>
                <Badge variant={existingCases.length > 0 ? 'default' : 'outline'}>
                  {existingCases.length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Campaign Matches</span>
                <Badge variant={matchedCampaigns.length > 0 ? 'default' : 'outline'}>
                  {matchedCampaigns.length}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">LLM Suggestion</span>
                {llmSuggestion ? (
                  <Badge variant="default">{llmSuggestion.recommendedAction}</Badge>
                ) : (
                  <Badge variant="outline">Pending</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Middle column - Process Diagram */}
        <div className="col-span-4">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Triage Process Steps
              </CardTitle>
              <CardDescription>
                Click "Run" to execute each step individually or use "Run All" above.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StepDiagram
                steps={stepStatuses}
                currentStep={currentStep}
                onRunStep={handleRunStep}
                onSkipStep={handleSkipStep}
                disabled={!parsedEmail}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right column - Logs and Decision */}
        <div className="col-span-4 space-y-4">
          {/* Decision Form (when suggestions are ready) */}
          {llmSuggestion && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Triage Decision
                </CardTitle>
                <CardDescription>
                  Review AI suggestions and submit decision (simulated).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-muted rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">AI Recommendation</span>
                    <Badge>{llmSuggestion.recommendedAction}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Confidence</span>
                    <span className="text-sm">{Math.round(llmSuggestion.actionConfidence * 100)}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{llmSuggestion.actionReasoning}</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium">Action</label>
                    <Select
                      value={decision.action}
                      onValueChange={(v) => setDecision(d => ({ ...d, action: v as typeof d.action }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="create_case">Create New Case</SelectItem>
                        <SelectItem value="add_to_case">Add to Existing Case</SelectItem>
                        <SelectItem value="ignore">Ignore/Dismiss</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {decision.action === 'add_to_case' && (
                    <div>
                      <label className="text-xs font-medium">Existing Case</label>
                      <Select
                        value={decision.caseId}
                        onValueChange={(v) => setDecision(d => ({ ...d, caseId: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select case" />
                        </SelectTrigger>
                        <SelectContent>
                          {existingCases.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              #{c.externalId} - {c.summary?.slice(0, 30)}...
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-medium">Priority</label>
                    <Select
                      value={decision.priority}
                      onValueChange={(v) => setDecision(d => ({ ...d, priority: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-medium">Assignee</label>
                    <Select
                      value={decision.assigneeId}
                      onValueChange={(v) => setDecision(d => ({ ...d, assigneeId: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        {MOCK_REFERENCE_DATA.caseworkers.map(cw => (
                          <SelectItem key={cw.id} value={cw.id.toString()}>
                            {cw.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  className="w-full"
                  onClick={() => handleRunStep('submit_decision')}
                  disabled={stepStatuses.submit_decision.status === 'running'}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Submit Decision (Simulated)
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Log Viewer */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                Execution Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LogViewer logs={logs} onClear={() => setLogs([])} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom section - Raw Data Tabs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Raw Data Inspector</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="context">
            <TabsList>
              <TabsTrigger value="context">Triage Context</TabsTrigger>
              <TabsTrigger value="suggestion">LLM Suggestion</TabsTrigger>
              <TabsTrigger value="reference">Reference Data</TabsTrigger>
              <TabsTrigger value="headers">Email Headers</TabsTrigger>
            </TabsList>

            <TabsContent value="context" className="mt-4">
              <ScrollArea className="h-[300px]">
                <pre className="text-xs font-mono bg-muted p-4 rounded-lg">
                  {triageContext ? JSON.stringify(triageContext, null, 2) : 'Context not yet built. Run steps 1-5.'}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="suggestion" className="mt-4">
              <ScrollArea className="h-[300px]">
                <pre className="text-xs font-mono bg-muted p-4 rounded-lg">
                  {llmSuggestion ? JSON.stringify(llmSuggestion, null, 2) : 'Suggestion not yet generated. Run step 6-7.'}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="reference" className="mt-4">
              <ScrollArea className="h-[300px]">
                <pre className="text-xs font-mono bg-muted p-4 rounded-lg">
                  {JSON.stringify(MOCK_REFERENCE_DATA, null, 2)}
                </pre>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="headers" className="mt-4">
              <ScrollArea className="h-[300px]">
                <pre className="text-xs font-mono bg-muted p-4 rounded-lg">
                  {parsedEmail ? JSON.stringify(parsedEmail.headers, null, 2) : 'No email loaded.'}
                </pre>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
