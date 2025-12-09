import { useSupabase } from '@/lib/SupabaseContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { LogOut, Settings, Users, Mail, Tags } from 'lucide-react';

export default function SettingsPage() {
  const { currentOfficeMode, setCurrentOfficeMode, signOut, profile, currentOffice } = useSupabase();

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
                <div className="pl-8 pt-2">
                  <p className="text-sm text-muted-foreground">
                    General office settings will be available here. This includes office name,
                    working hours, and other general configurations.
                  </p>
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
                <div className="pl-8 pt-2">
                  <p className="text-sm text-muted-foreground">
                    User management interface will be available here. Add, remove, and configure
                    team member permissions.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

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
                <div className="pl-8 pt-2">
                  <p className="text-sm text-muted-foreground">
                    Email integration settings will be available here. Connect your office email
                    accounts for automatic message importing.
                  </p>
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
                <div className="pl-8 pt-2">
                  <p className="text-sm text-muted-foreground">
                    Tag management interface will be available here. Create custom tags with colors
                    to categorize your work.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
