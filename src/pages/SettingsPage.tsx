import { useState, useEffect } from 'react';
import { useSupabase } from '@/lib/SupabaseContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { OutlookConnect } from '@/components/settings/OutlookConnect';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { LogOut, Settings, Users, Mail, Tags, Pencil, Trash2, Plus, Check, X, RefreshCw } from 'lucide-react';
import type { UserRole, Tag } from '@/lib/database.types';

const TAG_COLORS = [
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#22c55e', label: 'Green' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#6b7280', label: 'Gray' },
];

export default function SettingsPage() {
  const {
    currentOfficeMode,
    setCurrentOfficeMode,
    signOut,
    profile,
    currentOffice,
    profiles,
    tags,
    updateOffice,
    updateProfileRole,
    createTag,
    updateTag,
    deleteTag,
    emailIntegration,
    fetchEmailIntegration,
    deleteEmailIntegration,
  } = useSupabase();

  // General Settings state
  const [isEditingOfficeName, setIsEditingOfficeName] = useState(false);
  const [officeName, setOfficeName] = useState('');
  const [savingOfficeName, setSavingOfficeName] = useState(false);

  // Tag Management state
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('');
  const [savingTag, setSavingTag] = useState(false);

  // Email Integration state
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [disconnectingEmail, setDisconnectingEmail] = useState(false);

  // User Management state
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);

  // Initialize office name
  useEffect(() => {
    if (currentOffice) {
      setOfficeName(currentOffice.name);
    }
  }, [currentOffice]);

  // Fetch email integration on mount
  useEffect(() => {
    fetchEmailIntegration();
  }, []);

  // Filter profiles to only show those in the current office
  const officeProfiles = profiles.filter(p => p.office_id === currentOffice?.id);

  // Handlers
  const handleSaveOfficeName = async () => {
    if (!officeName.trim()) return;
    setSavingOfficeName(true);
    await updateOffice({ name: officeName.trim() });
    setSavingOfficeName(false);
    setIsEditingOfficeName(false);
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    setSavingTag(true);
    await createTag(newTagName.trim(), newTagColor);
    setNewTagName('');
    setNewTagColor('#3b82f6');
    setSavingTag(false);
  };

  const handleStartEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
  };

  const handleSaveEditTag = async () => {
    if (!editingTag || !editTagName.trim()) return;
    setSavingTag(true);
    await updateTag(editingTag.id, { name: editTagName.trim(), color: editTagColor });
    setEditingTag(null);
    setSavingTag(false);
  };

  const handleCancelEditTag = () => {
    setEditingTag(null);
    setEditTagName('');
    setEditTagColor('');
  };

  const handleDeleteTag = async (tagId: string) => {
    await deleteTag(tagId);
  };

  const handleRefreshEmailIntegration = async () => {
    setLoadingEmail(true);
    await fetchEmailIntegration();
    setLoadingEmail(false);
  };

  const handleDisconnectEmail = async () => {
    setDisconnectingEmail(true);
    await deleteEmailIntegration();
    setDisconnectingEmail(false);
  };

  const handleUpdateRole = async (profileId: string, role: UserRole) => {
    setUpdatingRole(profileId);
    await updateProfileRole(profileId, role);
    setUpdatingRole(null);
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your office settings and preferences
        </p>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Name</Label>
              <p className="font-medium">{profile?.full_name || 'Not set'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Role</Label>
              <p className="font-medium capitalize">{profile?.role || 'Staff'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Office</Label>
              <p className="font-medium">{currentOffice?.name || 'Not assigned'}</p>
            </div>
          </div>
          <Separator />
          <Button variant="outline" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>

      {/* Office Mode Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Office Mode</CardTitle>
          <CardDescription>
            Switch between casework and Westminster modes to access different features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="office-mode">Current Mode</Label>
              <p className="text-sm text-muted-foreground">
                You are currently in{' '}
                <span className="font-semibold capitalize">{currentOfficeMode}</span> mode
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="office-mode" className="text-sm">
                Casework
              </Label>
              <Switch
                id="office-mode"
                checked={currentOfficeMode === 'westminster'}
                onCheckedChange={(checked) =>
                  setCurrentOfficeMode(checked ? 'westminster' : 'casework')
                }
              />
              <Label htmlFor="office-mode" className="text-sm">
                Westminster
              </Label>
            </div>
          </div>

          <Separator />

          <div className="rounded-lg bg-muted p-4">
            <h4 className="mb-2 font-medium">Mode Description</h4>
            {currentOfficeMode === 'casework' ? (
              <p className="text-sm text-muted-foreground">
                Casework mode focuses on constituent services, case management, and local
                issues. This mode provides access to cases, constituent management, and
                casework-specific tools.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Westminster mode focuses on policy work, campaigns, and parliamentary
                correspondence. This mode provides access to policy email triage, campaign
                management, and Westminster-specific tools.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Office Settings Accordion */}
      <Card>
        <CardHeader>
          <CardTitle>Office Configuration</CardTitle>
          <CardDescription>Manage your office settings and integrations</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Accordion type="single" collapsible className="w-full">
            {/* General Office Settings */}
            <AccordionItem value="general-settings">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <Settings className="h-5 w-5 text-muted-foreground" />
                  <div className="text-left">
                    <div className="font-medium">General Office Settings</div>
                    <div className="text-sm text-muted-foreground font-normal">Configure office-wide preferences</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pl-8 pt-2 space-y-4">
                  <div className="space-y-2">
                    <Label>Office Name</Label>
                    {isEditingOfficeName ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={officeName}
                          onChange={(e) => setOfficeName(e.target.value)}
                          placeholder="Enter office name"
                          className="max-w-sm"
                        />
                        <Button
                          size="sm"
                          onClick={handleSaveOfficeName}
                          disabled={savingOfficeName || !officeName.trim()}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setOfficeName(currentOffice?.name || '');
                            setIsEditingOfficeName(false);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-sm">{currentOffice?.name || 'Not set'}</p>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setIsEditingOfficeName(true)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  {!isAdmin && (
                    <p className="text-sm text-muted-foreground">
                      Only administrators can modify office settings.
                    </p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* User Management */}
            <AccordionItem value="user-management">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div className="text-left">
                    <div className="font-medium">User Management</div>
                    <div className="text-sm text-muted-foreground font-normal">Manage team members and their permissions</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pl-8 pt-2 space-y-4">
                  {officeProfiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No team members found.</p>
                  ) : (
                    <div className="space-y-3">
                      {officeProfiles.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium">
                                {p.full_name?.charAt(0)?.toUpperCase() || '?'}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-sm">{p.full_name || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">
                                {p.id === profile?.id && '(You)'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isAdmin && p.id !== profile?.id ? (
                              <Select
                                value={p.role ?? undefined}
                                onValueChange={(value) => handleUpdateRole(p.id, value as UserRole)}
                                disabled={updatingRole === p.id}
                              >
                                <SelectTrigger className="w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="staff">Staff</SelectItem>
                                  <SelectItem value="readonly">Read Only</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant="secondary" className="capitalize">
                                {p.role}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!isAdmin && (
                    <p className="text-sm text-muted-foreground">
                      Only administrators can modify user roles.
                    </p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

      {/* Outlook Integration */}
      {currentOffice?.id && <OutlookConnect officeId={currentOffice.id} />}
            {/* Email Integration */}
            <AccordionItem value="email-integration">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div className="text-left">
                    <div className="font-medium">Email Integration</div>
                    <div className="text-sm text-muted-foreground font-normal">Configure email inbox connections</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pl-8 pt-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Connection Status</Label>
                      <div className="flex items-center gap-2 mt-1">
                        {emailIntegration ? (
                          <>
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                            <span className="text-sm text-green-600">Connected</span>
                          </>
                        ) : (
                          <>
                            <div className="h-2 w-2 rounded-full bg-gray-400" />
                            <span className="text-sm text-muted-foreground">Not connected</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRefreshEmailIntegration}
                      disabled={loadingEmail}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${loadingEmail ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  </div>

                  {emailIntegration && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div>
                          <Label className="text-muted-foreground">Status</Label>
                          <p className="text-sm font-medium capitalize">{emailIntegration.is_connected ? 'Connected' : 'Disconnected'}</p>
                        </div>
                        {emailIntegration.last_used_at && (
                          <div>
                            <Label className="text-muted-foreground">Last Used</Label>
                            <p className="text-sm font-medium">
                              {new Date(emailIntegration.last_used_at).toLocaleString()}
                            </p>
                          </div>
                        )}
                        <div>
                          <Label className="text-muted-foreground">Last Updated</Label>
                          <p className="text-sm font-medium">
                            {new Date(emailIntegration.updated_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {isAdmin && (
                        <>
                          <Separator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" disabled={disconnectingEmail}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Disconnect Email
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Disconnect Email Integration?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove the email connection from your office. You will need to
                                  reconnect to continue importing emails.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDisconnectEmail}>
                                  Disconnect
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </>
                  )}

                  {!emailIntegration && (
                    <p className="text-sm text-muted-foreground">
                      No email integration configured. Contact your administrator to set up email importing.
                    </p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Tag Management */}
            <AccordionItem value="tag-management" className="border-b-0">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <Tags className="h-5 w-5 text-muted-foreground" />
                  <div className="text-left">
                    <div className="font-medium">Tag Management</div>
                    <div className="text-sm text-muted-foreground font-normal">Create and manage tags for organizing cases and messages</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pl-8 pt-2 space-y-4">
                  {/* Create new tag */}
                  <div className="space-y-2">
                    <Label>Create New Tag</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="Tag name"
                        className="max-w-[200px]"
                      />
                      <Select value={newTagColor} onValueChange={setNewTagColor}>
                        <SelectTrigger className="w-28">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-4 w-4 rounded"
                              style={{ backgroundColor: newTagColor }}
                            />
                            <span className="text-xs">
                              {TAG_COLORS.find(c => c.value === newTagColor)?.label || 'Color'}
                            </span>
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {TAG_COLORS.map((color) => (
                            <SelectItem key={color.value} value={color.value}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-4 w-4 rounded"
                                  style={{ backgroundColor: color.value }}
                                />
                                {color.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        onClick={handleCreateTag}
                        disabled={savingTag || !newTagName.trim()}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Existing tags */}
                  <div className="space-y-2">
                    <Label>Existing Tags ({tags.length})</Label>
                    {tags.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No tags created yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {tags.map((tag) => (
                          <div
                            key={tag.id}
                            className="flex items-center justify-between rounded-lg border p-2"
                          >
                            {editingTag?.id === tag.id ? (
                              <div className="flex items-center gap-2 flex-1">
                                <Input
                                  value={editTagName}
                                  onChange={(e) => setEditTagName(e.target.value)}
                                  className="max-w-[150px] h-8"
                                />
                                <Select value={editTagColor} onValueChange={setEditTagColor}>
                                  <SelectTrigger className="w-24 h-8">
                                    <div
                                      className="h-4 w-4 rounded"
                                      style={{ backgroundColor: editTagColor }}
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TAG_COLORS.map((color) => (
                                      <SelectItem key={color.value} value={color.value}>
                                        <div className="flex items-center gap-2">
                                          <div
                                            className="h-4 w-4 rounded"
                                            style={{ backgroundColor: color.value }}
                                          />
                                          {color.label}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleSaveEditTag}
                                  disabled={savingTag}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleCancelEditTag}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="h-4 w-4 rounded"
                                    style={{ backgroundColor: tag.color }}
                                  />
                                  <span className="text-sm font-medium">{tag.name}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleStartEditTag(tag)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button size="sm" variant="ghost">
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Tag?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This will permanently delete the tag "{tag.name}". This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteTag(tag.id)}>
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
