import { useState } from 'react';
import { useSupabase } from '@/lib/SupabaseContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CheckCircle2, XCircle, FileText, Mail, FileCheck, Loader2 } from 'lucide-react';

interface ApprovalItem {
  id: string;
  type: 'bulk_response' | 'draft_letter' | 'policy_statement';
  title: string;
  content: string;
  context: string;
  created_by_user_id: string;
  created_at: string;
}

export default function MPApprovalPage() {
  const { bulkResponses, profiles, supabase, getCurrentUserId, refreshData } = useSupabase();

  // Convert bulk responses to approval items (draft status ones need approval)
  const approvalItems: ApprovalItem[] = bulkResponses
    .filter(br => br.status === 'draft')
    .map(br => ({
      id: br.id,
      type: 'bulk_response' as const,
      title: br.subject || 'Bulk Response',
      content: br.body_markdown || '',
      context: 'Bulk response for campaign',
      created_by_user_id: br.created_by || '',
      created_at: br.created_at,
    }));

  const [approvalQueue, setApprovalQueue] = useState<ApprovalItem[]>(approvalItems);
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(
    approvalQueue.length > 0 ? approvalQueue[0] : null
  );
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showApprovalSuccess, setShowApprovalSuccess] = useState(false);
  const [showReturnSuccess, setShowReturnSuccess] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const getTypeIcon = (type: ApprovalItem['type']) => {
    switch (type) {
      case 'bulk_response':
        return <Mail className="h-4 w-4" />;
      case 'draft_letter':
        return <FileText className="h-4 w-4" />;
      case 'policy_statement':
        return <FileCheck className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: ApprovalItem['type']) => {
    switch (type) {
      case 'bulk_response':
        return 'Bulk Response';
      case 'draft_letter':
        return 'Draft Letter';
      case 'policy_statement':
        return 'Policy Statement';
    }
  };

  const getTypeBadgeVariant = (type: ApprovalItem['type']) => {
    switch (type) {
      case 'bulk_response':
        return 'default';
      case 'draft_letter':
        return 'secondary';
      case 'policy_statement':
        return 'outline';
    }
  };

  const handleApprove = async () => {
    if (!selectedItem) return;

    setIsApproving(true);
    try {
      // Call the RPC function to process the bulk response approval
      // Note: Type assertion used because this RPC function is created via SQL migration
      const { error } = await (supabase.rpc as (fn: string, params: Record<string, unknown>) => ReturnType<typeof supabase.rpc>)(
        'process_bulk_response_approval',
        {
          p_bulk_response_id: selectedItem.id,
          p_approver_user_id: getCurrentUserId()
        }
      );

      if (error) throw error;

      // Success - show feedback and update UI
      setShowApprovalSuccess(true);

      // Refresh data to get updated bulk responses
      await refreshData();

      setTimeout(() => {
        const newQueue = approvalQueue.filter(item => item.id !== selectedItem.id);
        setApprovalQueue(newQueue);
        setSelectedItem(newQueue.length > 0 ? newQueue[0] : null);
        setShowApprovalSuccess(false);
      }, 1500);

    } catch (err) {
      console.error('Failed to approve:', err);
      alert('Failed to process approval. Check console for details.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleReturnForEdits = () => {
    if (!selectedItem || !feedback.trim()) return;

    setIsReturnDialogOpen(false);
    setShowReturnSuccess(true);

    setTimeout(() => {
      const newQueue = approvalQueue.filter(item => item.id !== selectedItem.id);
      setApprovalQueue(newQueue);
      setSelectedItem(newQueue.length > 0 ? newQueue[0] : null);
      setFeedback('');
      setShowReturnSuccess(false);
    }, 1500);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCreatorName = (userId: string) => {
    const profile = profiles.find(p => p.id === userId);
    return profile ? profile.full_name : 'Unknown';
  };

  if (approvalQueue.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4" />
          <h2 className="text-2xl font-semibold mb-2">All Clear!</h2>
          <p className="text-muted-foreground">
            No items pending approval at this time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-6">
      {/* Approval Queue List */}
      <div className="w-80 flex flex-col">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">Approval Queue</h1>
          <p className="text-sm text-muted-foreground">
            {approvalQueue.length} {approvalQueue.length === 1 ? 'item' : 'items'} awaiting review
          </p>
        </div>

        <ScrollArea className="flex-1 -mr-4 pr-4">
          <div className="space-y-2">
            {approvalQueue.map((item) => (
              <Card
                key={item.id}
                className={`cursor-pointer transition-colors hover:bg-accent ${
                  selectedItem?.id === item.id ? 'border-primary bg-accent' : ''
                }`}
                onClick={() => setSelectedItem(item)}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">
                      {getTypeIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-medium line-clamp-2">
                        {item.title}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={getTypeBadgeVariant(item.type) as any} className="text-xs">
                      {getTypeLabel(item.type)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(item.created_at).split(',')[0]}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      <Separator orientation="vertical" className="h-auto" />

      {/* Item Detail View */}
      <div className="flex-1 flex flex-col">
        {selectedItem ? (
          <>
            {showApprovalSuccess && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-800">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Approved successfully!</span>
              </div>
            )}

            {showReturnSuccess && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-blue-800">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Returned for edits with your feedback</span>
              </div>
            )}

            <ScrollArea className="flex-1 -mr-4 pr-4">
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getTypeIcon(selectedItem.type)}
                        <Badge variant={getTypeBadgeVariant(selectedItem.type) as any}>
                          {getTypeLabel(selectedItem.type)}
                        </Badge>
                      </div>
                      <CardTitle className="text-2xl mb-2">{selectedItem.title}</CardTitle>
                      <CardDescription>
                        Created by {getCreatorName(selectedItem.created_by_user_id)} on{' '}
                        {formatDate(selectedItem.created_at)}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                      Context
                    </h3>
                    <p className="text-sm">{selectedItem.context}</p>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wide">
                      Content for Review
                    </h3>
                    <div className="prose prose-sm max-w-none bg-muted/50 p-6 rounded-lg whitespace-pre-wrap">
                      {selectedItem.content}
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="flex gap-3 justify-end border-t pt-6">
                  <Button
                    variant="outline"
                    onClick={() => setIsReturnDialogOpen(true)}
                    className="gap-2"
                    disabled={isApproving}
                  >
                    <XCircle className="h-4 w-4" />
                    Return for Edits
                  </Button>
                  <Button onClick={handleApprove} className="gap-2" disabled={isApproving}>
                    {isApproving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {isApproving ? 'Processing...' : 'Approve'}
                  </Button>
                </CardFooter>
              </Card>
            </ScrollArea>

            {/* Return for Edits Dialog */}
            <AlertDialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Return for Edits</AlertDialogTitle>
                  <AlertDialogDescription>
                    Please provide feedback on what changes are needed.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="py-4">
                  <Label htmlFor="feedback" className="text-sm font-medium">
                    Feedback for your team
                  </Label>
                  <Textarea
                    id="feedback"
                    placeholder="Describe the changes you'd like to see..."
                    className="mt-2 min-h-[120px]"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                  />
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setFeedback('')}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleReturnForEdits}
                    disabled={!feedback.trim()}
                  >
                    Submit Feedback
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">Select an item to review</p>
          </div>
        )}
      </div>
    </div>
  );
}
