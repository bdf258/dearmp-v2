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
import { LogOut, Settings, Users, Mail, Tags, Pencil, Trash2, Plus, Check, X, RefreshCw, Bot, UserCog, Building2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import type { UserRole, Tag, OfficeSettingsUpdate } from '@/lib/database.types';
import { TwoFASettings } from '@/components/settings/TwoFASettings';

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
    currentOfficeSettings,
    profiles,
    tags,
    updateOffice,
    updateOfficeSettings,
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

  // MP/Office Identity state
  const [isEditingMpName, setIsEditingMpName] = useState(false);
  const [mpName, setMpName] = useState('');
  const [isEditingMpEmail, setIsEditingMpEmail] = useState(false);
  const [mpEmail, setMpEmail] = useState('');
  const [isEditingInboundEmail, setIsEditingInboundEmail] = useState(false);
  const [inboundEmail, setInboundEmail] = useState('');
  const [isEditingSignature, setIsEditingSignature] = useState(false);
  const [signatureTemplate, setSignatureTemplate] = useState('');

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

  // Office Settings state
  const [savingSettings, setSavingSettings] = useState(false);

  // Initialize office name
  useEffect(() => {
    if (currentOffice) {
      setOfficeName(currentOffice.name);
    }
  }, [currentOffice]);

  // Initialize office settings fields
  useEffect(() => {
    if (currentOfficeSettings) {
      setMpName(currentOfficeSettings.mp_name || '');
      setMpEmail(currentOfficeSettings.mp_email || '');
      setInboundEmail(currentOfficeSettings.inbound_email || '');
      setSignatureTemplate(currentOfficeSettings.signature_template || '');
    }
  }, [currentOfficeSettings]);

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

  const handleUpdateSettings = async (updates: OfficeSettingsUpdate) => {
    setSavingSettings(true);
    await updateOfficeSettings(updates);
    setSavingSettings(false);
  };

  const handleSaveMpName = async () => {
    setSavingSettings(true);
    await updateOfficeSettings({ mp_name: mpName.trim() || null });
    setSavingSettings(false);
    setIsEditingMpName(false);
  };

  const handleSaveMpEmail = async () => {
    setSavingSettings(true);
    await updateOfficeSettings({ mp_email: mpEmail.trim() || null });
    setSavingSettings(false);
    setIsEditingMpEmail(false);
  };

  const handleSaveInboundEmail = async () => {
    setSavingSettings(true);
    await updateOfficeSettings({ inbound_email: inboundEmail.trim() || null });
    setSavingSettings(false);
    setIsEditingInboundEmail(false);
  };

  const handleSaveSignature = async () => {
    setSavingSettings(true);
    await updateOfficeSettings({ signature_template: signatureTemplate.trim() || null });
    setSavingSettings(false);
    setIsEditingSignature(false);
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

            {/* MP/Office Identity Settings */}
            <AccordionItem value="mp-identity">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div className="text-left">
                    <div className="font-medium">MP/Office Identity</div>
                    <div className="text-sm text-muted-foreground font-normal">Configure MP details, email addresses, and signature</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pl-8 pt-2 space-y-4">
                  {/* MP Name */}
                  <div className="space-y-2">
                    <Label>MP Name</Label>
                    <p className="text-sm text-muted-foreground">
                      The name used in email signatures and official correspondence
                    </p>
                    {isEditingMpName ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={mpName}
                          onChange={(e) => setMpName(e.target.value)}
                          placeholder="e.g., The Rt Hon Jane Smith MP"
                          className="max-w-sm"
                        />
                        <Button
                          size="sm"
                          onClick={handleSaveMpName}
                          disabled={savingSettings}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setMpName(currentOfficeSettings?.mp_name || '');
                            setIsEditingMpName(false);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-sm">{currentOfficeSettings?.mp_name || 'Not set'}</p>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setIsEditingMpName(true)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* MP Email */}
                  <div className="space-y-2">
                    <Label>MP Email Address</Label>
                    <p className="text-sm text-muted-foreground">
                      The official email address for outgoing correspondence
                    </p>
                    {isEditingMpEmail ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="email"
                          value={mpEmail}
                          onChange={(e) => setMpEmail(e.target.value)}
                          placeholder="mp.name@parliament.uk"
                          className="max-w-sm"
                        />
                        <Button
                          size="sm"
                          onClick={handleSaveMpEmail}
                          disabled={savingSettings}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setMpEmail(currentOfficeSettings?.mp_email || '');
                            setIsEditingMpEmail(false);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-sm">{currentOfficeSettings?.mp_email || 'Not set'}</p>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setIsEditingMpEmail(true)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Inbound Email */}
                  <div className="space-y-2">
                    <Label>Inbound Email Address</Label>
                    <p className="text-sm text-muted-foreground">
                      The email address that receives inbound mail for this office
                    </p>
                    {isEditingInboundEmail ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="email"
                          value={inboundEmail}
                          onChange={(e) => setInboundEmail(e.target.value)}
                          placeholder="office@constituency.example.com"
                          className="max-w-sm"
                        />
                        <Button
                          size="sm"
                          onClick={handleSaveInboundEmail}
                          disabled={savingSettings}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setInboundEmail(currentOfficeSettings?.inbound_email || '');
                            setIsEditingInboundEmail(false);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-sm">{currentOfficeSettings?.inbound_email || 'Not set'}</p>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setIsEditingInboundEmail(true)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Signature Template */}
                  <div className="space-y-2">
                    <Label>Email Signature Template</Label>
                    <p className="text-sm text-muted-foreground">
                      The default signature appended to outgoing emails
                    </p>
                    {isEditingSignature ? (
                      <div className="space-y-2">
                        <Textarea
                          value={signatureTemplate}
                          onChange={(e) => setSignatureTemplate(e.target.value)}
                          placeholder="Best regards,&#10;{{mp_name}}&#10;Member of Parliament for {{constituency}}"
                          className="min-h-[120px] max-w-lg"
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={handleSaveSignature}
                            disabled={savingSettings}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSignatureTemplate(currentOfficeSettings?.signature_template || '');
                              setIsEditingSignature(false);
                            }}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          {currentOfficeSettings?.signature_template ? (
                            <pre className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md max-w-lg">
                              {currentOfficeSettings.signature_template}
                            </pre>
                          ) : (
                            <p className="text-sm text-muted-foreground">Not set</p>
                          )}
                        </div>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setIsEditingSignature(true)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {!isAdmin && (
                    <p className="text-sm text-muted-foreground pt-2">
                      Only administrators can modify MP/Office identity settings.
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

            {/* Two-Factor Authentication */}
            <TwoFASettings />

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

            {/* AI Settings */}
            <AccordionItem value="ai-settings">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <Bot className="h-5 w-5 text-muted-foreground" />
                  <div className="text-left">
                    <div className="font-medium">AI Settings</div>
                    <div className="text-sm text-muted-foreground font-normal">Configure AI-powered features for email processing</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pl-8 pt-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Email Classification</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically classify incoming emails as policy or casework
                      </p>
                    </div>
                    <Switch
                      checked={currentOfficeSettings?.ai_classification_enabled ?? true}
                      onCheckedChange={(checked) => handleUpdateSettings({ ai_classification_enabled: checked })}
                      disabled={!isAdmin || savingSettings}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Draft Response Generation</Label>
                      <p className="text-sm text-muted-foreground">
                        Generate AI draft responses for policy emails
                      </p>
                    </div>
                    <Switch
                      checked={currentOfficeSettings?.ai_draft_response_enabled ?? true}
                      onCheckedChange={(checked) => handleUpdateSettings({ ai_draft_response_enabled: checked })}
                      disabled={!isAdmin || savingSettings}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto-Tagging</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically suggest tags for incoming emails
                      </p>
                    </div>
                    <Switch
                      checked={currentOfficeSettings?.ai_tagging_enabled ?? true}
                      onCheckedChange={(checked) => handleUpdateSettings({ ai_tagging_enabled: checked })}
                      disabled={!isAdmin || savingSettings}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Response Style</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Set the tone for AI-generated policy responses
                    </p>
                    <Select
                      value={currentOfficeSettings?.policy_response_style ?? 'formal'}
                      onValueChange={(value) => handleUpdateSettings({ policy_response_style: value as 'formal' | 'friendly' | 'brief' })}
                      disabled={!isAdmin || savingSettings}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="formal">Formal</SelectItem>
                        <SelectItem value="friendly">Friendly</SelectItem>
                        <SelectItem value="brief">Brief</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {!isAdmin && (
                    <p className="text-sm text-muted-foreground pt-2">
                      Only administrators can modify AI settings.
                    </p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Assignment Settings */}
            <AccordionItem value="assignment-settings">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <UserCog className="h-5 w-5 text-muted-foreground" />
                  <div className="text-left">
                    <div className="font-medium">Assignment Settings</div>
                    <div className="text-sm text-muted-foreground font-normal">Configure how emails and cases are assigned</div>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pl-8 pt-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto-Assignment</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically assign incoming emails to staff members
                      </p>
                    </div>
                    <Switch
                      checked={currentOfficeSettings?.auto_assign_enabled ?? true}
                      onCheckedChange={(checked) => handleUpdateSettings({ auto_assign_enabled: checked })}
                      disabled={!isAdmin || savingSettings}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Round-Robin Distribution</Label>
                      <p className="text-sm text-muted-foreground">
                        Distribute assignments evenly among staff members
                      </p>
                    </div>
                    <Switch
                      checked={currentOfficeSettings?.round_robin_enabled ?? false}
                      onCheckedChange={(checked) => handleUpdateSettings({ round_robin_enabled: checked })}
                      disabled={!isAdmin || savingSettings}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Default Casework Assignee</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Default staff member to assign casework emails to
                    </p>
                    <Select
                      value={currentOfficeSettings?.default_casework_assignee ?? 'none'}
                      onValueChange={(value) => handleUpdateSettings({ default_casework_assignee: value === 'none' ? null : value })}
                      disabled={!isAdmin || savingSettings}
                    >
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="No default assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No default assignee</SelectItem>
                        {profiles.filter(p => p.office_id === currentOffice?.id).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name || 'Unknown'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Default Policy Assignee</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Default staff member to assign policy emails to
                    </p>
                    <Select
                      value={currentOfficeSettings?.default_policy_assignee ?? 'none'}
                      onValueChange={(value) => handleUpdateSettings({ default_policy_assignee: value === 'none' ? null : value })}
                      disabled={!isAdmin || savingSettings}
                    >
                      <SelectTrigger className="w-64">
                        <SelectValue placeholder="No default assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No default assignee</SelectItem>
                        {profiles.filter(p => p.office_id === currentOffice?.id).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name || 'Unknown'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Casework Acknowledgment</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically send acknowledgment emails for casework requests
                      </p>
                    </div>
                    <Switch
                      checked={currentOfficeSettings?.casework_acknowledgment_enabled ?? false}
                      onCheckedChange={(checked) => handleUpdateSettings({ casework_acknowledgment_enabled: checked })}
                      disabled={!isAdmin || savingSettings}
                    />
                  </div>

                  {!isAdmin && (
                    <p className="text-sm text-muted-foreground pt-2">
                      Only administrators can modify assignment settings.
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
