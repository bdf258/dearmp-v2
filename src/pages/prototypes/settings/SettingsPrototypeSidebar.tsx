import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  User,
  Building2,
  Users,
  Bot,
  Tags,
  Shield,
  Bell,
  UserCog,
  LogOut,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Settings Prototype with Sidebar Navigation
 *
 * Uses a persistent left sidebar for navigation between settings sections.
 * Provides a clean two-panel layout for easy navigation.
 * All data is hardcoded for prototyping purposes.
 */

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { id: 'profile', label: 'Profile', icon: <User className="h-4 w-4" /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4" /> },
  { id: 'security', label: 'Security', icon: <Shield className="h-4 w-4" /> },
  { id: 'office', label: 'Office Details', icon: <Building2 className="h-4 w-4" />, adminOnly: true },
  { id: 'team', label: 'Team', icon: <Users className="h-4 w-4" />, adminOnly: true },
  { id: 'assignments', label: 'Assignments', icon: <UserCog className="h-4 w-4" />, adminOnly: true },
  { id: 'ai', label: 'AI Features', icon: <Bot className="h-4 w-4" />, adminOnly: true },
  { id: 'tags', label: 'Tags', icon: <Tags className="h-4 w-4" />, adminOnly: true },
];

export default function SettingsPrototypeSidebar() {
  const [activeSection, setActiveSection] = useState('profile');

  // Toggle between user/admin view for demo purposes
  const [isAdmin, setIsAdmin] = useState(true);

  // Hardcoded data
  const user = {
    name: 'Sarah Johnson',
    email: 'sarah.johnson@parliament.uk',
    role: isAdmin ? 'admin' : 'staff',
    office: 'Office of Jane Smith MP',
    initials: 'SJ',
  };

  const officeInfo = {
    mpName: 'The Rt Hon Jane Smith MP',
    mpEmail: 'jane.smith@parliament.uk',
    inboundEmail: 'contact@janesmith.parliament.uk',
    signature: 'Best regards,\nThe Rt Hon Jane Smith MP\nMember of Parliament for North Bristol',
  };

  const teamMembers = [
    { id: '1', name: 'Sarah Johnson', email: 'sarah.johnson@parliament.uk', role: 'admin', initials: 'SJ' },
    { id: '2', name: 'Michael Chen', email: 'michael.chen@parliament.uk', role: 'staff', initials: 'MC' },
    { id: '3', name: 'Emily Davis', email: 'emily.davis@parliament.uk', role: 'readonly', initials: 'ED' },
  ];

  const tags = [
    { id: '1', name: 'Housing', color: '#3b82f6' },
    { id: '2', name: 'Healthcare', color: '#22c55e' },
    { id: '3', name: 'Education', color: '#8b5cf6' },
    { id: '4', name: 'Transport', color: '#f97316' },
  ];

  const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdmin);

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Profile</h2>
              <p className="text-muted-foreground">Manage your personal information</p>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 mb-6">
                  <Avatar className="h-20 w-20">
                    <AvatarFallback className="text-xl bg-primary/10 text-primary">
                      {user.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-semibold">{user.name}</h3>
                    <p className="text-muted-foreground">{user.email}</p>
                    <Badge variant="secondary" className="mt-1 capitalize">{user.role}</Badge>
                  </div>
                </div>

                <Separator className="my-6" />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="full-name">Full Name</Label>
                    <Input id="full-name" defaultValue={user.name} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" defaultValue={user.email} disabled />
                    <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <Button variant="outline">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                  <Button>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Notifications</h2>
              <p className="text-muted-foreground">Choose how you want to be notified</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Email Notifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>New assignments</Label>
                    <p className="text-sm text-muted-foreground">When a case is assigned to you</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Case updates</Label>
                    <p className="text-sm text-muted-foreground">When cases you're working on change</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Daily digest</Label>
                    <p className="text-sm text-muted-foreground">Daily summary of pending tasks</p>
                  </div>
                  <Switch />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Weekly report</Label>
                    <p className="text-sm text-muted-foreground">Weekly activity summary</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Security</h2>
              <p className="text-muted-foreground">Protect your account</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Two-Factor Authentication</CardTitle>
                <CardDescription>Add an extra layer of security</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg bg-green-50 border border-green-200">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="font-medium">2FA is enabled</p>
                      <p className="text-sm text-muted-foreground">Your account is protected</p>
                    </div>
                  </div>
                  <Button variant="outline">Manage</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Password</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline">Change Password</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sessions</CardTitle>
                <CardDescription>Manage your active sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium text-sm">Current session</p>
                      <p className="text-xs text-muted-foreground">London, UK • Chrome on MacOS</p>
                    </div>
                    <Badge variant="secondary">Active</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'office':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Office Details</h2>
              <p className="text-muted-foreground">Configure your office identity</p>
            </div>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <Label>MP Name</Label>
                  <Input defaultValue={officeInfo.mpName} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>MP Email</Label>
                    <Input type="email" defaultValue={officeInfo.mpEmail} />
                  </div>
                  <div className="space-y-2">
                    <Label>Inbound Email</Label>
                    <Input type="email" defaultValue={officeInfo.inboundEmail} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email Signature</Label>
                  <Textarea defaultValue={officeInfo.signature} className="min-h-[100px]" />
                </div>
                <div className="flex justify-end">
                  <Button>Save Changes</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'team':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Team</h2>
                <p className="text-muted-foreground">Manage team members</p>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Invite
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {teamMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Avatar>
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
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="staff">Staff</SelectItem>
                            <SelectItem value="readonly">Read Only</SelectItem>
                          </SelectContent>
                        </Select>
                        {member.id !== '1' && (
                          <Button variant="ghost" size="icon" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'assignments':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Assignment Rules</h2>
              <p className="text-muted-foreground">Configure automatic assignment</p>
            </div>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-Assignment</Label>
                    <p className="text-sm text-muted-foreground">Automatically assign incoming emails</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Round-Robin</Label>
                    <p className="text-sm text-muted-foreground">Distribute evenly among staff</p>
                  </div>
                  <Switch />
                </div>
                <Separator />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Default Casework Assignee</Label>
                    <Select defaultValue="michael">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No default</SelectItem>
                        <SelectItem value="michael">Michael Chen</SelectItem>
                        <SelectItem value="emily">Emily Davis</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Default Policy Assignee</Label>
                    <Select defaultValue="emily">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No default</SelectItem>
                        <SelectItem value="michael">Michael Chen</SelectItem>
                        <SelectItem value="emily">Emily Davis</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'ai':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">AI Features</h2>
              <p className="text-muted-foreground">Configure AI automation</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Automation Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email Classification</Label>
                    <p className="text-sm text-muted-foreground">Auto-classify as policy or casework</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Draft Response Generation</Label>
                    <p className="text-sm text-muted-foreground">Generate AI drafts for policy emails</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-Tagging</Label>
                    <p className="text-sm text-muted-foreground">Suggest tags for incoming emails</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Response Style</CardTitle>
              </CardHeader>
              <CardContent>
                <Select defaultValue="formal">
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="brief">Brief</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>
        );

      case 'tags':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Tags</h2>
                <p className="text-muted-foreground">Organize cases and messages</p>
              </div>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Tag
              </Button>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {tags.map((tag) => (
                    <div key={tag.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-6 w-6 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="font-medium">{tag.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">Edit</Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex gap-6 min-h-[calc(100vh-8rem)]">
      {/* Sidebar Navigation */}
      <div className="w-64 flex-shrink-0">
        <Card className="sticky top-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Settings</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAdmin(!isAdmin)}
                className="text-xs"
              >
                {isAdmin ? 'View as User' : 'View as Admin'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-14rem)]">
              <nav className="space-y-1 p-2">
                {filteredNavItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                      activeSection === item.id
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                    {activeSection === item.id && (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </button>
                ))}
              </nav>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Content Area */}
      <div className="flex-1 max-w-3xl">
        {renderContent()}
      </div>
    </div>
  );
}
