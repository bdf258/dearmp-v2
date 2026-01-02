/**
 * Test Triage Page
 *
 * Allows developers to upload .eml files and test the full triage processing
 * pipeline. This page uses the EXACT same server-side logic as real emails
 * coming from the caseworker API.
 *
 * Features:
 * - Upload .eml files
 * - Parse and preview email content
 * - Trigger triage processing (constituent matching, LLM analysis, etc.)
 * - View processing results
 * - Clean up test emails
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSupabase } from '@/lib/SupabaseContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  Trash2,
  RefreshCw,
  AlertCircle,
  Mail,
  User,
  Calendar,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

// Server API base URL - defaults to localhost:3001 in development
const API_BASE_URL = import.meta.env.VITE_SERVER_API_URL || 'http://localhost:3001';

// Types
interface ParsedEmailInfo {
  subject: string;
  fromAddress: string;
  fromName?: string;
  toAddresses: string[];
  receivedAt: string;
  textBody: string;
}

interface TestEmailRecord {
  id: string;
  officeId: string;
  externalId: number;
  subject: string | null;
  htmlBody: string | null;
  fromAddress: string | null;
  toAddresses: string[] | null;
  receivedAt: string | null;
  createdAt: string;
  actioned: boolean;
  isTestEmail: boolean;
}

interface UploadResponse {
  success: boolean;
  data: {
    emailId: string;
    jobId: string;
    email: TestEmailRecord;
    parsed: ParsedEmailInfo;
    message: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

interface JobStatus {
  jobId: string;
  state: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  retryCount: number;
  output?: unknown;
}

interface QueueStatus {
  healthy: boolean;
  workerConnected: boolean;
  queues: Record<string, number>;
  error?: string;
}

// Pipeline step tracking
type PipelineStep =
  | 'uploading'
  | 'parsing'
  | 'saving'
  | 'queued'
  | 'worker_pickup'
  | 'processing'
  | 'completed'
  | 'failed';

const PIPELINE_STEPS: { key: PipelineStep; label: string; description: string }[] = [
  { key: 'uploading', label: 'Uploading', description: 'Sending .eml file to server' },
  { key: 'parsing', label: 'Parsing', description: 'Extracting email headers and body' },
  { key: 'saving', label: 'Saving', description: 'Storing email in database' },
  { key: 'queued', label: 'Queued', description: 'Job added to processing queue' },
  { key: 'worker_pickup', label: 'Worker Pickup', description: 'Waiting for worker to pick up job' },
  { key: 'processing', label: 'Processing', description: 'Finding constituents, generating suggestions' },
  { key: 'completed', label: 'Completed', description: 'Triage processing complete' },
];

interface TestEmail {
  id: string;
  subject: string | null;
  fromAddress: string | null;
  receivedAt: string | null;
  createdAt: string;
  actioned: boolean;
  jobId?: string;
  jobStatus?: JobStatus;
}

export default function TestTriagePage() {
  const { session } = useSupabase();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = useState<TestEmail | null>(null);
  const [currentParsed, setCurrentParsed] = useState<ParsedEmailInfo | null>(null);
  const [testEmails, setTestEmails] = useState<TestEmail[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);
  const [pipelineStep, setPipelineStep] = useState<PipelineStep | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // Get auth token for API calls
  const getAuthToken = useCallback(async () => {
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }
    return session.access_token;
  }, [session]);

  // Fetch queue status to check if worker is connected
  const fetchQueueStatus = useCallback(async () => {
    try {
      const token = await getAuthToken();

      const response = await fetch(`${API_BASE_URL}/test-triage/queue-status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        setQueueStatus({ healthy: false, workerConnected: false, queues: {}, error: 'Failed to fetch queue status' });
        return;
      }

      const data = await response.json();
      if (data.success) {
        setQueueStatus(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch queue status:', error);
      setQueueStatus({ healthy: false, workerConnected: false, queues: {}, error: String(error) });
    }
  }, [getAuthToken]);

  // Fetch test emails list
  const fetchTestEmails = useCallback(async () => {
    try {
      setIsLoadingList(true);
      const token = await getAuthToken();

      const response = await fetch(`${API_BASE_URL}/test-triage/list`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch test emails: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setTestEmails(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch test emails:', error);
    } finally {
      setIsLoadingList(false);
    }
  }, [getAuthToken]);

  // Fetch job status
  const fetchJobStatus = useCallback(async (jobId: string): Promise<JobStatus | null> => {
    try {
      const token = await getAuthToken();

      const response = await fetch(`${API_BASE_URL}/test-triage/status/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.success ? data.data : null;
    } catch (error) {
      console.error('Failed to fetch job status:', error);
      return null;
    }
  }, [getAuthToken]);

  // Poll job status until complete
  useEffect(() => {
    if (!pollingJobId) return;

    const pollInterval = setInterval(async () => {
      const status = await fetchJobStatus(pollingJobId);
      if (status) {
        setCurrentEmail(prev => prev ? { ...prev, jobStatus: status } : null);

        // Update pipeline step based on job state
        if (status.state === 'created') {
          setPipelineStep('queued');
        } else if (status.state === 'active') {
          setPipelineStep('processing');
        } else if (status.state === 'completed') {
          setPipelineStep('completed');
          setPollingJobId(null);
          toast.success('Triage processing completed!');
          fetchTestEmails();
        } else if (status.state === 'failed') {
          setPipelineStep('failed');
          setPipelineError(status.output ? JSON.stringify(status.output) : 'Job failed');
          setPollingJobId(null);
          toast.error('Triage processing failed');
          fetchTestEmails();
        } else if (status.state === 'retry') {
          setPipelineStep('worker_pickup');
        }
      } else {
        // Job not found yet - might still be queued
        setPipelineStep('worker_pickup');
      }
    }, 1500);

    return () => clearInterval(pollInterval);
  }, [pollingJobId, fetchJobStatus, fetchTestEmails]);

  // Load test emails and queue status on mount
  useEffect(() => {
    if (session) {
      fetchTestEmails();
      fetchQueueStatus();
    }
  }, [session, fetchTestEmails, fetchQueueStatus]);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith('.eml')) {
      toast.error('Please upload an .eml file');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setPipelineError(null);
    setPipelineStep('uploading');

    try {
      const token = await getAuthToken();

      // Step 1: Reading file
      setPipelineStep('parsing');
      const emlContent = await file.text();

      // Step 2: Sending to server
      setPipelineStep('uploading');
      const response = await fetch(`${API_BASE_URL}/test-triage/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emlContent }),
      });

      const data: UploadResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Upload failed');
      }

      // Step 3: Saved and queued
      setPipelineStep('queued');

      setCurrentEmail({
        id: data.data.email.id,
        subject: data.data.email.subject,
        fromAddress: data.data.email.fromAddress,
        receivedAt: data.data.email.receivedAt,
        createdAt: data.data.email.createdAt || new Date().toISOString(),
        actioned: data.data.email.actioned,
        jobId: data.data.jobId,
      });
      setCurrentParsed(data.data.parsed);
      setPollingJobId(data.data.jobId);

      // Refresh queue status to see if worker picks it up
      fetchQueueStatus();

      toast.success('Email uploaded and queued for processing');
      fetchTestEmails();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload email';
      setUploadError(message);
      setPipelineStep('failed');
      setPipelineError(message);
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  }, [getAuthToken, fetchTestEmails, fetchQueueStatus]);

  // Handle file input change
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset input so same file can be uploaded again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFileUpload]);

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  // Delete test email
  const handleDelete = useCallback(async (emailId: string) => {
    try {
      const token = await getAuthToken();

      const response = await fetch(`${API_BASE_URL}/test-triage/${emailId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete email');
      }

      toast.success('Test email deleted');
      if (currentEmail?.id === emailId) {
        setCurrentEmail(null);
        setCurrentParsed(null);
      }
      fetchTestEmails();
    } catch (error) {
      toast.error('Failed to delete email');
    }
  }, [getAuthToken, currentEmail, fetchTestEmails]);

  // Reprocess email
  const handleReprocess = useCallback(async (emailId: string) => {
    try {
      const token = await getAuthToken();

      const response = await fetch(`${API_BASE_URL}/test-triage/process/${emailId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to reprocess email');
      }

      const data = await response.json();
      if (data.success) {
        setPollingJobId(data.data.jobId);
        setCurrentEmail(prev => prev?.id === emailId ? { ...prev, jobId: data.data.jobId } : prev);
        toast.success('Email queued for reprocessing');
      }
    } catch (error) {
      toast.error('Failed to reprocess email');
    }
  }, [getAuthToken]);

  // View email details
  const handleViewEmail = useCallback(async (email: TestEmail) => {
    setCurrentEmail(email);
    setCurrentParsed(null);

    if (email.jobId) {
      const status = await fetchJobStatus(email.jobId);
      if (status) {
        setCurrentEmail(prev => prev ? { ...prev, jobStatus: status } : null);
      }
    }
  }, [fetchJobStatus]);

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>Please log in to access the test triage page.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Test Triage Pipeline</h1>
        <p className="text-muted-foreground">
          Upload .eml files to test the full email triage processing pipeline.
          This uses the exact same server-side logic as real emails from the caseworker API.
        </p>
      </div>

      {/* Queue Status Banner */}
      {queueStatus && (
        <Alert variant={queueStatus.healthy ? 'default' : 'destructive'}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Queue Status</AlertTitle>
          <AlertDescription className="flex flex-wrap gap-4">
            <span>
              <strong>Health:</strong>{' '}
              {queueStatus.healthy ? (
                <Badge variant="default" className="bg-green-500">Healthy</Badge>
              ) : (
                <Badge variant="destructive">Unhealthy</Badge>
              )}
            </span>
            <span>
              <strong>Worker:</strong>{' '}
              {queueStatus.workerConnected ? (
                <Badge variant="default" className="bg-green-500">Connected</Badge>
              ) : (
                <Badge variant="secondary">Not detected</Badge>
              )}
            </span>
            {queueStatus.queues && Object.keys(queueStatus.queues).length > 0 && (
              <span>
                <strong>Pending jobs:</strong>{' '}
                {Object.entries(queueStatus.queues).map(([queue, count]) => (
                  <Badge key={queue} variant="outline" className="ml-1">
                    {queue}: {count}
                  </Badge>
                ))}
              </span>
            )}
            {queueStatus.error && (
              <span className="text-destructive">{queueStatus.error}</span>
            )}
            <Button variant="ghost" size="sm" onClick={fetchQueueStatus} className="ml-auto">
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Pipeline Progress */}
      {pipelineStep && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Processing Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {PIPELINE_STEPS.map((step, index) => {
                const isActive = step.key === pipelineStep;
                const isPast = PIPELINE_STEPS.findIndex(s => s.key === pipelineStep) > index;

                return (
                  <div key={step.key} className="flex items-center">
                    <div className="flex flex-col items-center min-w-[80px]">
                      <div
                        className={`
                          w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium
                          ${isPast ? 'bg-green-500 text-white' : ''}
                          ${isActive && pipelineStep !== 'failed' ? 'bg-blue-500 text-white animate-pulse' : ''}
                          ${isActive && pipelineStep === 'failed' ? 'bg-red-500 text-white' : ''}
                          ${!isPast && !isActive ? 'bg-muted text-muted-foreground' : ''}
                        `}
                      >
                        {isPast ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : isActive && pipelineStep !== 'failed' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isActive && pipelineStep === 'failed' ? (
                          <AlertCircle className="h-4 w-4" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <span className={`text-xs mt-1 text-center ${isActive ? 'font-medium' : 'text-muted-foreground'}`}>
                        {step.label}
                      </span>
                    </div>
                    {index < PIPELINE_STEPS.length - 1 && (
                      <div className={`w-8 h-0.5 mx-1 ${isPast ? 'bg-green-500' : 'bg-muted'}`} />
                    )}
                  </div>
                );
              })}
            </div>
            {pipelineStep && !['completed', 'failed'].includes(pipelineStep) && (
              <p className="text-sm text-muted-foreground mt-3">
                {PIPELINE_STEPS.find(s => s.key === pipelineStep)?.description}
              </p>
            )}
            {pipelineError && (
              <Alert variant="destructive" className="mt-3">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="font-mono text-xs">{pipelineError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Email
            </CardTitle>
            <CardDescription>
              Drag and drop an .eml file or click to browse
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Drop Zone */}
            <div
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                transition-colors hover:border-primary hover:bg-muted/50
                ${isUploading ? 'opacity-50 pointer-events-none' : ''}
              `}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".eml"
                className="hidden"
                onChange={handleFileChange}
              />
              {isUploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Uploading and processing...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drop .eml file here or click to upload
                  </p>
                </div>
              )}
            </div>

            {uploadError && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Upload Error</AlertTitle>
                <AlertDescription>{uploadError}</AlertDescription>
              </Alert>
            )}

            {/* Current Email Preview */}
            {currentEmail && (
              <div className="mt-6 space-y-4">
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Uploaded Email</h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReprocess(currentEmail.id)}
                        disabled={!!pollingJobId}
                      >
                        <RefreshCw className={`h-4 w-4 mr-1 ${pollingJobId ? 'animate-spin' : ''}`} />
                        Reprocess
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(currentEmail.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Subject:</span>
                      <span>{currentEmail.subject || '(No subject)'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">From:</span>
                      <span>{currentEmail.fromAddress}</span>
                    </div>
                    {currentEmail.receivedAt && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Received:</span>
                        <span>{format(new Date(currentEmail.receivedAt), 'PPpp')}</span>
                      </div>
                    )}
                  </div>

                  {/* Job Status */}
                  {currentEmail.jobStatus && (
                    <div className="mt-4 p-3 rounded-lg bg-muted">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">Processing Status</span>
                        <Badge
                          variant={
                            currentEmail.jobStatus.state === 'completed' ? 'default' :
                            currentEmail.jobStatus.state === 'failed' ? 'destructive' :
                            'secondary'
                          }
                        >
                          {currentEmail.jobStatus.state}
                        </Badge>
                      </div>
                      <div className="text-xs space-y-1 text-muted-foreground">
                        <p>Job ID: {currentEmail.jobStatus.jobId}</p>
                        {currentEmail.jobStatus.startedAt && (
                          <p>Started: {format(new Date(currentEmail.jobStatus.startedAt), 'PPpp')}</p>
                        )}
                        {currentEmail.jobStatus.completedAt && (
                          <p>Completed: {format(new Date(currentEmail.jobStatus.completedAt), 'PPpp')}</p>
                        )}
                        {currentEmail.jobStatus.retryCount > 0 && (
                          <p>Retries: {currentEmail.jobStatus.retryCount}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Parsed Content Preview */}
                  {currentParsed && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Email Body Preview</h4>
                      <pre className="p-3 rounded-lg bg-muted text-xs overflow-auto max-h-48">
                        {currentParsed.textBody}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test Emails List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Test Emails</span>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchTestEmails}
                disabled={isLoadingList}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isLoadingList ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </CardTitle>
            <CardDescription>
              Previously uploaded test emails
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingList ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : testEmails.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No test emails uploaded yet</p>
              </div>
            ) : (
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {testEmails.map(email => (
                    <div
                      key={email.id}
                      className={`
                        p-3 rounded-lg border cursor-pointer transition-colors
                        hover:bg-muted/50
                        ${currentEmail?.id === email.id ? 'border-primary bg-muted/30' : ''}
                      `}
                      onClick={() => handleViewEmail(email)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">
                            {email.subject || '(No subject)'}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {email.fromAddress}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {email.createdAt && format(new Date(email.createdAt), 'PPp')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {email.actioned ? (
                            <Badge variant="default" className="shrink-0">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Processed
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="shrink-0">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(email.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Section */}
      <Card>
        <CardHeader>
          <CardTitle>How This Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  1
                </div>
                <h4 className="font-medium">Upload</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Upload an .eml file. The server parses it and creates a test email record
                in the database with a negative external_id to distinguish it from real emails.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  2
                </div>
                <h4 className="font-medium">Process</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                The email is queued for triage processing using the exact same pipeline as
                real emails: constituent matching, LLM analysis, case suggestions, etc.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-muted">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  3
                </div>
                <h4 className="font-medium">Review</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                View the processing results, including constituent matches, suggested cases,
                and LLM-generated classification. Clean up test emails when done.
              </p>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Note</AlertTitle>
            <AlertDescription>
              Test emails are stored in the same database as real emails but marked with
              <code className="mx-1 px-1 rounded bg-muted">is_test_email = true</code>.
              Always clean up test emails after testing to avoid confusion.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
