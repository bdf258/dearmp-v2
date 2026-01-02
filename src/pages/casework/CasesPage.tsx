import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '@/lib/SupabaseContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, FolderOpen } from 'lucide-react';

export default function CasesPage() {
  const navigate = useNavigate();
  const { cases, profiles } = useSupabase();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [assignedFilter, setAssignedFilter] = useState<string>('all');

  // Filter and search cases
  const filteredCases = useMemo(() => {
    return cases.filter((caseItem) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        searchQuery === '' ||
        caseItem.title.toLowerCase().includes(searchLower) ||
        (caseItem.description?.toLowerCase().includes(searchLower) ?? false) ||
        String(caseItem.reference_number).includes(searchLower);

      // Status filter
      const matchesStatus =
        statusFilter === 'all' || caseItem.status === statusFilter;

      // Assigned filter
      const matchesAssigned =
        assignedFilter === 'all' ||
        caseItem.assigned_to === assignedFilter;

      return matchesSearch && matchesStatus && matchesAssigned;
    });
  }, [cases, searchQuery, statusFilter, assignedFilter]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline">Unknown</Badge>;
    switch (status) {
      case 'open':
        return <Badge variant="outline">Open</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'closed':
        return <Badge variant="default">Closed</Badge>;
      case 'archived':
        return <Badge>Archived</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string | null) => {
    if (!priority) return <Badge variant="outline">Unknown</Badge>;
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive">Urgent</Badge>;
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge variant="secondary">Medium</Badge>;
      case 'low':
        return <Badge variant="outline">Low</Badge>;
      default:
        return <Badge>{priority}</Badge>;
    }
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return 'Unassigned';
    const profile = profiles.find((p) => p.id === userId);
    return profile?.full_name || 'Unassigned';
  };

  const handleCaseClick = (caseId: string) => {
    navigate(`/casework/cases/${caseId}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cases</h1>
        <p className="text-muted-foreground">
          Manage and track all constituent cases
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Cases</CardTitle>
          <CardDescription>
            {filteredCases.length} case{filteredCases.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search cases by title, description, or reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assignedFilter} onValueChange={setAssignedFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.full_name || 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cases Table */}
          {filteredCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No cases found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery || statusFilter !== 'all' || assignedFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Create a new case to get started'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCases.map((caseItem) => (
                  <TableRow
                    key={caseItem.id}
                    className="cursor-pointer"
                    onClick={() => handleCaseClick(caseItem.id)}
                  >
                    <TableCell>
                      <div className="font-mono text-sm">
                        #{caseItem.reference_number}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{caseItem.title}</div>
                      <div className="text-sm text-muted-foreground max-w-md truncate">
                        {caseItem.description}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(caseItem.status)}</TableCell>
                    <TableCell>{getPriorityBadge(caseItem.priority)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {getUserName(caseItem.assigned_to)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDate(caseItem.updated_at)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
