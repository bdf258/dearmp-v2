import { useSupabase } from '@/lib/SupabaseContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { OutlookConnect } from '@/components/settings/OutlookConnect';

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

      {/* General Office Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General Office Settings</CardTitle>
          <CardDescription>Configure office-wide preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            General office settings will be available here. This includes office name,
            working hours, and other general configurations.
          </p>
        </CardContent>
      </Card>

      {/* User Management */}
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>Manage team members and their permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            User management interface will be available here. Add, remove, and configure
            team member permissions.
          </p>
        </CardContent>
      </Card>

      {/* Outlook Integration */}
      {currentOffice?.id && <OutlookConnect officeId={currentOffice.id} />}

      {/* Tag Management */}
      <Card>
        <CardHeader>
          <CardTitle>Tag Management</CardTitle>
          <CardDescription>Create and manage tags for organizing cases and messages</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Tag management interface will be available here. Create custom tags with colors
            to categorize your work.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
