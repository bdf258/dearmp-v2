import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LogOut,
  Users,
  Building2,
  Bot,
  Tags,
  UserCog,
  Shield,
  Plus,
  Trash2,
  Mail,
  History,
  Copy,
  CheckCircle2
} from 'lucide-react';

/**
 * Admin Settings Prototype
 *
 * A comprehensive settings dashboard for administrators.
 * Uses tabbed layout for better organization of many settings.
 * All data is hardcoded for prototyping purposes.
 */
export default function SettingsPrototypeAdmin() {
  // Hardcoded data
  const user = {
    name: 'James Wilson',
    email: 'james.wilson@parliament.uk',
    role: 'admin',
    office: 'Office of Jane Smith MP',
    initials: 'JW',
  };

  const officeInfo = {
    mpName: 'The Rt Hon Jane Smith MP',
    mpEmail: 'jane.smith@parliament.uk',
    inboundEmail: 'contact@janesmith.parliament.uk',
    signature: 'Best regards,\nThe Rt Hon Jane Smith MP\nMember of Parliament for North Bristol',
  };

  const teamMembers = [
    { id: '1', name: 'James Wilson', email: 'james.wilson@parliament.uk', role: 'admin', initials: 'JW' },
    { id: '2', name: 'Sarah Johnson', email: 'sarah.johnson@parliament.uk', role: 'staff', initials: 'SJ' },
    { id: '3', name: 'Michael Chen', email: 'michael.chen@parliament.uk', role: 'staff', initials: 'MC' },
    { id: '4', name: 'Emily Davis', email: 'emily.davis@parliament.uk', role: 'readonly', initials: 'ED' },
  ];

  const invitations = [
    { id: '1', email: 'newuser@example.com', role: 'staff', expires: '2024-02-15', token: 'abc123def456' },
  ];

  const tags = [
    { id: '1', name: 'Housing', color: '#3b82f6' },
    { id: '2', name: 'Healthcare', color: '#22c55e' },
    { id: '3', name: 'Education', color: '#8b5cf6' },
    { id: '4', name: 'Transport', color: '#f97316' },
    { id: '5', name: 'Environment', color: '#06b6d4' },
    { id: '6', name: 'Benefits', color: '#ef4444' },
  ];

  const auditLogs = [
    { action: 'User role changed', user: 'James Wilson', target: 'Emily Davis', date: '2024-01-15 14:32' },
    { action: 'Tag created', user: 'Sarah Johnson', target: 'Environment', date: '2024-01-14 10:15' },
    { action: 'Settings updated', user: 'James Wilson', target: 'AI Settings', date: '2024-01-13 16:45' },
    { action: 'User invited', user: 'James Wilson', target: 'newuser@example.com', date: '2024-01-12 09:20' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
          <p className="text-muted-foreground">
            Manage your office, team, and system preferences
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-medium">{user.name}</p>
            <Badge variant="default" className="capitalize">{user.role}</Badge>
          </div>
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {user.initials}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>

      {/* Tabbed Settings */}
      <Tabs defaultValue="office" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="office" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Office</span>
          </TabsTrigger>
          <TabsTrigger value="team" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Team</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">AI</span>
          </TabsTrigger>
          <TabsTrigger value="tags" className="flex items-center gap-2">
            <Tags className="h-4 w-4" />
            <span className="hidden sm:inline">Tags</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
        </TabsList>

        {/* Office Settings Tab */}
        <TabsContent value="office" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Office Details</CardTitle>
              <CardDescription>Configure your office identity and contact information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mp-name">MP Name</Label>
                  <Input id="mp-name" defaultValue={officeInfo.mpName} />
                  <p className="text-xs text-muted-foreground">
                    Used in signatures and official correspondence
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mp-email">MP Email</Label>
                  <Input id="mp-email" type="email" defaultValue={officeInfo.mpEmail} />
                  <p className="text-xs text-muted-foreground">
                    Official email for outgoing messages
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inbound-email">Inbound Email Address</Label>
                <Input id="inbound-email" type="email" defaultValue={officeInfo.inboundEmail} />
                <p className="text-xs text-muted-foreground">
                  Email address that receives incoming mail
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="signature">Email Signature Template</Label>
                <Textarea
                  id="signature"
                  defaultValue={officeInfo.signature}
                  className="min-h-[120px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Default signature appended to outgoing emails
                </p>
              </div>

              <div className="flex justify-end">
                <Button>Save Changes</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                Assignment Rules
              </CardTitle>
              <CardDescription>Configure how emails and cases are assigned to team members</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-Assignment</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically assign incoming emails to staff
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Round-Robin Distribution</Label>
                  <p className="text-sm text-muted-foreground">
                    Distribute assignments evenly among team
                  </p>
                </div>
                <Switch />
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Default Casework Assignee</Label>
                  <Select defaultValue="sarah">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No default</SelectItem>
                      <SelectItem value="sarah">Sarah Johnson</SelectItem>
                      <SelectItem value="michael">Michael Chen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Default Policy Assignee</Label>
                  <Select defaultValue="michael">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No default</SelectItem>
                      <SelectItem value="sarah">Sarah Johnson</SelectItem>
                      <SelectItem value="michael">Michael Chen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Management Tab */}
        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>Manage your team and their access levels</CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {teamMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {member.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Select defaultValue={member.role}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="readonly">Read Only</SelectItem>
                        </SelectContent>
                      </Select>
                      {member.id !== '1' && (
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>Invitations that haven't been accepted yet</CardDescription>
            </CardHeader>
            <CardContent>
              {invitations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No pending invitations
                </p>
              ) : (
                <div className="space-y-3">
                  {invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{inv.email}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="outline" className="capitalize">{inv.role}</Badge>
                            <span>Expires {inv.expires}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Link
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Settings Tab */}
        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Features</CardTitle>
              <CardDescription>Configure AI-powered automation for email processing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-0.5">
                  <Label className="text-base">Email Classification</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically classify emails as policy or casework
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-0.5">
                  <Label className="text-base">Draft Response Generation</Label>
                  <p className="text-sm text-muted-foreground">
                    Generate AI draft responses for policy emails
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-0.5">
                  <Label className="text-base">Auto-Tagging</Label>
                  <p className="text-sm text-muted-foreground">
                    Suggest relevant tags for incoming emails
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-0.5">
                  <Label className="text-base">Casework Acknowledgment</Label>
                  <p className="text-sm text-muted-foreground">
                    Send automatic acknowledgment for casework requests
                  </p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Response Style</CardTitle>
              <CardDescription>Set the tone for AI-generated responses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="p-4 rounded-lg border-2 border-primary bg-primary/5 cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="font-semibold cursor-pointer">Formal</Label>
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Professional and traditional parliamentary tone
                  </p>
                </div>
                <div className="p-4 rounded-lg border cursor-pointer hover:border-primary/50">
                  <Label className="font-semibold cursor-pointer">Friendly</Label>
                  <p className="text-sm text-muted-foreground mt-2">
                    Warm and approachable while remaining professional
                  </p>
                </div>
                <div className="p-4 rounded-lg border cursor-pointer hover:border-primary/50">
                  <Label className="font-semibold cursor-pointer">Brief</Label>
                  <p className="text-sm text-muted-foreground mt-2">
                    Concise responses focused on key information
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tags Tab */}
        <TabsContent value="tags" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Tag Management</CardTitle>
                  <CardDescription>Create and manage tags for organizing cases and messages</CardDescription>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tag
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-6 w-6 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="font-medium">{tag.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm">Edit</Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>Add extra security to your account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg border bg-green-50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Two-Factor Authentication Enabled</p>
                    <p className="text-sm text-muted-foreground">
                      Your account is protected with 2FA
                    </p>
                  </div>
                </div>
                <Button variant="outline">Manage</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Audit Log
              </CardTitle>
              <CardDescription>Recent activity in your office</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {auditLogs.map((log, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium text-sm">{log.action}</p>
                      <p className="text-sm text-muted-foreground">
                        {log.user} {log.target && `• ${log.target}`}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{log.date}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-center">
                <Button variant="outline">View Full Audit Log</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
