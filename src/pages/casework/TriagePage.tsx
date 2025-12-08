import { useState } from 'react';
import { useDummyData } from '@/lib/useDummyData';
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
  const { messages, users } = useDummyData();
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);

  // Filter messages that need triage
  const triageMessages = messages.filter((msg) => msg.is_triage_needed);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleAssignToUser = (messageId: string, userId: string) => {
    console.log(`Assigning message ${messageId} to user ${userId}`);
    // In a real app, this would update the backend
  };

  const handleAddTag = (messageId: string) => {
    console.log(`Adding tag to message ${messageId}`);
    // In a real app, this would open a tag selection dialog
  };

  const handleTogglePolicyEmail = (messageId: string, currentValue: boolean) => {
    console.log(`Toggling policy email for message ${messageId} to ${!currentValue}`);
    // In a real app, this would update the backend
  };

  const handleCreateCase = (messageId: string) => {
    console.log(`Creating case from message ${messageId}`);
    // In a real app, this would navigate to new case page with pre-filled data
  };

  const handleViewMessage = (messageId: string) => {
    setSelectedMessage(messageId);
    console.log(`Viewing message ${messageId}`);
    // In a real app, this would open a modal or navigate to message detail
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
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {triageMessages.map((message) => (
                  <TableRow key={message.id}>
                    <TableCell>
                      <div className="font-medium">{message.from_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {message.from_email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate font-medium">
                        {message.subject}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-md truncate text-sm text-muted-foreground">
                        {message.snippet}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{formatDate(message.created_at)}</div>
                    </TableCell>
                    <TableCell>
                      {message.is_policy_email ? (
                        <Badge variant="secondary">Policy</Badge>
                      ) : (
                        <Badge variant="outline">Casework</Badge>
                      )}
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
                            onClick={() =>
                              handleTogglePolicyEmail(
                                message.id,
                                message.is_policy_email
                              )
                            }
                          >
                            <Mail className="mr-2 h-4 w-4" />
                            {message.is_policy_email
                              ? 'Mark as Casework'
                              : 'Mark as Policy'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleCreateCase(message.id)}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Create Case
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Assign to</DropdownMenuLabel>
                          {users.map((user) => (
                            <DropdownMenuItem
                              key={user.id}
                              onClick={() => handleAssignToUser(message.id, user.id)}
                            >
                              {user.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
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
              return (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">From</div>
                    <div>{msg.from_name} ({msg.from_email})</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">To</div>
                    <div>{msg.to_name} ({msg.to_email})</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Subject</div>
                    <div>{msg.subject}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Message</div>
                    <div className="whitespace-pre-wrap mt-2 p-4 bg-muted rounded-md">
                      {msg.body}
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
