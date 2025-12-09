import { useState } from 'react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal, Mail, Tag, FileText, Eye } from 'lucide-react';

export default function TriagePage() {
  const { messages, messageRecipients, profiles } = useSupabase();
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);

  // Filter messages that need triage (no case or campaign assigned)
  const triageMessages = messages.filter((msg) => !msg.case_id && !msg.campaign_id);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get sender info from message recipients
  const getSenderInfo = (messageId: string) => {
    const sender = messageRecipients.find(
      r => r.message_id === messageId && r.recipient_type === 'from'
    );
    return {
      name: sender?.name || 'Unknown',
      email: sender?.email_address || '',
    };
  };

  const handleAssignToUser = (messageId: string, userId: string) => {
    console.log(`Assigning message ${messageId} to user ${userId}`);
  };

  const handleAddTag = (messageId: string) => {
    console.log(`Adding tag to message ${messageId}`);
  };

  const handleCreateCase = (messageId: string) => {
    console.log(`Creating case from message ${messageId}`);
  };

  const handleViewMessage = (messageId: string) => {
    setSelectedMessage(messageId);
    console.log(`Viewing message ${messageId}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Message Triage</h1>
        <p className="text-muted-foreground">
          Review and process incoming messages that require attention
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Messages Requiring Triage</CardTitle>
          <CardDescription>
            {triageMessages.length} message{triageMessages.length !== 1 ? 's' : ''} awaiting review
          </CardDescription>
        </CardHeader>
        <CardContent>
          {triageMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Mail className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No messages to triage</h3>
              <p className="text-sm text-muted-foreground">
                All incoming messages have been processed
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Preview</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {triageMessages.map((message) => {
                  const sender = getSenderInfo(message.id);
                  return (
                    <TableRow key={message.id}>
                      <TableCell>
                        <div className="font-medium">{sender.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {sender.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs truncate font-medium">
                          {message.subject || '(No subject)'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md truncate text-sm text-muted-foreground">
                          {message.snippet}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{formatDate(message.received_at)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{message.channel}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => handleViewMessage(message.id)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Message
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleAddTag(message.id)}
                            >
                              <Tag className="mr-2 h-4 w-4" />
                              Add Tag
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleCreateCase(message.id)}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Create Case
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Assign to</DropdownMenuLabel>
                            {profiles.map((profile) => (
                              <DropdownMenuItem
                                key={profile.id}
                                onClick={() => handleAssignToUser(message.id, profile.id)}
                              >
                                {profile.full_name || 'Unknown'}
                              </DropdownMenuItem>
                            ))}
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

      {selectedMessage && (
        <Card>
          <CardHeader>
            <CardTitle>Message Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const msg = messages.find((m) => m.id === selectedMessage);
              if (!msg) return null;
              const sender = getSenderInfo(msg.id);
              const recipients = messageRecipients.filter(
                r => r.message_id === msg.id && r.recipient_type === 'to'
              );
              return (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">From</div>
                    <div>{sender.name} ({sender.email})</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">To</div>
                    <div>
                      {recipients.map(r => `${r.name || r.email_address}`).join(', ') || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Subject</div>
                    <div>{msg.subject || '(No subject)'}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Message</div>
                    <div className="whitespace-pre-wrap mt-2 p-4 bg-muted rounded-md">
                      {msg.snippet || msg.body_search_text || '(No content available)'}
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
