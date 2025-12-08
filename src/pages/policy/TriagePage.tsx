import { useState } from 'react';
import { useDummyData } from '@/lib/useDummyData';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MoreHorizontal, Mail, Tag, UserPlus, Flag } from 'lucide-react';

export default function TriagePage() {
  const { messages, users, campaigns } = useDummyData();
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);

  // Filter for policy emails that need triage
  const triageMessages = messages.filter(
    (msg) => msg.is_policy_email && msg.is_triage_needed
  );

  const handleAssignToUser = (messageId: string, userId: string) => {
    console.log(`Assigning message ${messageId} to user ${userId}`);
    // In a real app, this would update the message
  };

  const handleAssignToCampaign = (messageId: string, campaignId: string) => {
    console.log(`Assigning message ${messageId} to campaign ${campaignId}`);
    // In a real app, this would update the message
  };

  const handleMarkAsCasework = (messageId: string) => {
    console.log(`Marking message ${messageId} as casework email`);
    // In a real app, this would update is_policy_email to false
  };

  const handleAddTag = (messageId: string) => {
    console.log(`Adding tag to message ${messageId}`);
    // In a real app, this would open a tag selection dialog
  };

  const selectedMessageData = messages.find((m) => m.id === selectedMessage);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Policy Triage</h1>
        <p className="text-muted-foreground">
          Review and categorize incoming policy emails
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Policy Emails Requiring Triage</CardTitle>
          <CardDescription>
            {triageMessages.length} email{triageMessages.length !== 1 ? 's' : ''}{' '}
            awaiting review
          </CardDescription>
        </CardHeader>
        <CardContent>
          {triageMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Mail className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-lg font-medium">All caught up!</p>
              <p className="text-sm text-muted-foreground">
                No policy emails require triage at this time.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Campaign Match</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {triageMessages.map((message) => {
                  const matchedCampaign = campaigns.find(
                    (c) => c.fingerprint_hash === message.fingerprint_hash
                  );

                  return (
                    <TableRow key={message.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{message.from_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {message.from_email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => setSelectedMessage(message.id)}
                          className="text-left hover:underline"
                        >
                          {message.subject}
                        </button>
                      </TableCell>
                      <TableCell>
                        {new Date(message.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {matchedCampaign ? (
                          <Badge variant="secondary">
                            {matchedCampaign.name}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            No match
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setSelectedMessage(message.id)}
                            >
                              <Mail className="mr-2 h-4 w-4" />
                              View Message
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Assign To User</DropdownMenuLabel>
                            {users.map((user) => (
                              <DropdownMenuItem
                                key={user.id}
                                onClick={() =>
                                  handleAssignToUser(message.id, user.id)
                                }
                              >
                                <UserPlus className="mr-2 h-4 w-4" />
                                {user.name}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            {matchedCampaign && (
                              <>
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleAssignToCampaign(
                                      message.id,
                                      matchedCampaign.id
                                    )
                                  }
                                >
                                  <Flag className="mr-2 h-4 w-4" />
                                  Assign to Campaign
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleAddTag(message.id)}
                            >
                              <Tag className="mr-2 h-4 w-4" />
                              Add Tag
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleMarkAsCasework(message.id)}
                            >
                              Mark as Casework Email
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Message View Dialog */}
      <Dialog
        open={selectedMessage !== null}
        onOpenChange={(open) => !open && setSelectedMessage(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedMessageData?.subject}</DialogTitle>
            <DialogDescription>
              From: {selectedMessageData?.from_name} (
              {selectedMessageData?.from_email})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="whitespace-pre-wrap text-sm">
                {selectedMessageData?.body}
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setSelectedMessage(null)}>
                Close
              </Button>
              <Button>Take Action</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
