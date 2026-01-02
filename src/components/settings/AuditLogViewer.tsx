import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/lib/SupabaseContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ClipboardList,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  Shield,
  UserCog,
  Settings,
  Mail,
  FileText,
} from 'lucide-react';

interface AuditLog {
  id: string;
  office_id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  severity: string;
  ip_address: string | null;
  created_at: string;
}

interface AuditStats {
  total_events: number;
  critical_events: number;
  high_events: number;
  unique_actors: number;
  most_common_action: string;
  most_common_count: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  standard: 'bg-gray-100 text-gray-800 border-gray-200',
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  role_change: <UserCog className="h-4 w-4" />,
  user_create: <UserCog className="h-4 w-4" />,
  user_delete: <UserCog className="h-4 w-4" />,
  mfa_enroll: <Shield className="h-4 w-4" />,
  mfa_unenroll: <Shield className="h-4 w-4" />,
  mfa_verify: <Shield className="h-4 w-4" />,
  mfa_disable: <Shield className="h-4 w-4" />,
  settings_change: <Settings className="h-4 w-4" />,
  outlook_connect: <Mail className="h-4 w-4" />,
  outlook_disconnect: <Mail className="h-4 w-4" />,
  case_assign: <FileText className="h-4 w-4" />,
  case_close: <FileText className="h-4 w-4" />,
};

const ACTION_LABELS: Record<string, string> = {
  role_change: 'Role Changed',
  user_create: 'User Created',
  user_delete: 'User Deleted',
  mfa_enroll: 'MFA Enrolled',
  mfa_unenroll: 'MFA Unenrolled',
  mfa_verify: 'MFA Verified',
  mfa_disable: 'MFA Disabled',
  settings_change: 'Settings Changed',
  outlook_connect: 'Outlook Connected',
  outlook_disconnect: 'Outlook Disconnected',
  bulk_export: 'Bulk Export',
  session_anomaly: 'Session Anomaly',
  case_assign: 'Case Assigned',
  case_close: 'Case Closed',
  email_send: 'Email Sent',
  login_success: 'Login Success',
  login_failure: 'Login Failed',
  update: 'Update',
  create: 'Create',
  delete: 'Delete',
};

export function AuditLogViewer() {
  const { supabase, profile } = useSupabase();

  // State
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'critical' | 'high'>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [error, setError] = useState<string | null>(null);

  const PAGE_SIZE = 20;
  const isAdmin = profile?.role === 'admin';

  // Fetch audit logs
  const fetchLogs = useCallback(async (resetPage = false) => {
    if (!isAdmin) return;

    try {
      setError(null);
      if (resetPage) {
        setPage(0);
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const currentPage = resetPage ? 0 : page;

      const { data, error: fetchError } = await supabase.rpc('get_audit_logs', {
        p_limit: PAGE_SIZE + 1, // Fetch one extra to check if there are more
        p_offset: currentPage * PAGE_SIZE,
        p_severity: filter === 'all' ? undefined : filter,
      });

      if (fetchError) throw fetchError;

      const fetchedLogs = (data || []) as AuditLog[];
      setHasMore(fetchedLogs.length > PAGE_SIZE);
      setLogs(fetchedLogs.slice(0, PAGE_SIZE));
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch audit logs');
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [supabase, isAdmin, page, filter]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!isAdmin) return;

    try {
      const { data, error: statsError } = await supabase.rpc('get_audit_stats', {
        p_days: 30,
      });

      if (statsError) throw statsError;

      if (data && data.length > 0) {
        setStats(data[0] as AuditStats);
      }
    } catch (err) {
      console.error('Error fetching audit stats:', err);
    }
  }, [supabase, isAdmin]);

  // Initial fetch
  useEffect(() => {
    if (isAdmin) {
      fetchLogs(true);
      fetchStats();
    } else {
      setLoading(false);
    }
  }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch when filter changes
  useEffect(() => {
    if (isAdmin && !loading) {
      fetchLogs(true);
    }
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle page change
  useEffect(() => {
    if (isAdmin && !loading && page > 0) {
      fetchLogs(false);
    }
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    fetchLogs(true);
    fetchStats();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionLabel = (action: string) => {
    return ACTION_LABELS[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getActionIcon = (action: string) => {
    return ACTION_ICONS[action] || <ClipboardList className="h-4 w-4" />;
  };

  // Not admin view
  if (!isAdmin) {
    return (
      <AccordionItem value="audit-logs">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            <div className="text-left">
              <div className="font-medium">Security Audit Log</div>
              <div className="text-sm text-muted-foreground font-normal">
                View security events and actions
              </div>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pl-8 pt-2">
            <p className="text-sm text-muted-foreground">
              Only administrators can view the security audit log.
            </p>
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <>
      <AccordionItem value="audit-logs">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            <div className="text-left">
              <div className="font-medium">Security Audit Log</div>
              <div className="text-sm text-muted-foreground font-normal">
                View security events and actions
              </div>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pl-8 pt-2 space-y-4">
            {/* Stats Summary */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold">{stats.total_events}</div>
                  <div className="text-xs text-muted-foreground">Total Events (30d)</div>
                </div>
                <div className="rounded-lg border p-3 border-red-200 bg-red-50">
                  <div className="text-2xl font-bold text-red-700">{stats.critical_events}</div>
                  <div className="text-xs text-red-600">Critical Events</div>
                </div>
                <div className="rounded-lg border p-3 border-orange-200 bg-orange-50">
                  <div className="text-2xl font-bold text-orange-700">{stats.high_events}</div>
                  <div className="text-xs text-orange-600">High Priority</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-2xl font-bold">{stats.unique_actors}</div>
                  <div className="text-xs text-muted-foreground">Unique Users</div>
                </div>
              </div>
            )}

            <Separator />

            {/* Filter and Refresh Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Label className="text-sm">Filter by severity:</Label>
                <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* Error Display */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-600">{error}</span>
              </div>
            )}

            {/* Loading State */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No audit logs found</p>
              </div>
            ) : (
              <>
                {/* Audit Log Table */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Time</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead className="w-[100px]">Severity</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(log.created_at)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getActionIcon(log.action)}
                              <span className="text-sm font-medium">
                                {getActionLabel(log.action)}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {log.entity_type}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {log.actor_name || 'System'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={SEVERITY_COLORS[log.severity] || SEVERITY_COLORS.standard}
                            >
                              {log.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Page {page + 1}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0 || refreshing}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPage(p => p + 1)}
                      disabled={!hasMore || refreshing}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Log Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedLog && getActionIcon(selectedLog.action)}
              {selectedLog && getActionLabel(selectedLog.action)}
            </DialogTitle>
            <DialogDescription>
              Audit log details
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-xs">Time</Label>
                  <p className="text-sm font-medium">{formatDate(selectedLog.created_at)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Severity</Label>
                  <Badge
                    variant="outline"
                    className={SEVERITY_COLORS[selectedLog.severity] || SEVERITY_COLORS.standard}
                  >
                    {selectedLog.severity}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Actor</Label>
                  <p className="text-sm font-medium">{selectedLog.actor_name || 'System'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Entity Type</Label>
                  <p className="text-sm font-medium">{selectedLog.entity_type}</p>
                </div>
                {selectedLog.ip_address && (
                  <div>
                    <Label className="text-muted-foreground text-xs">IP Address</Label>
                    <p className="text-sm font-mono">{selectedLog.ip_address}</p>
                  </div>
                )}
                {selectedLog.entity_id && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Entity ID</Label>
                    <p className="text-sm font-mono text-xs">{selectedLog.entity_id}</p>
                  </div>
                )}
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-muted-foreground text-xs">Metadata</Label>
                    <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
