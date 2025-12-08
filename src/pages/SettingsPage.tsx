import { useDummyData } from '@/lib/useDummyData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
  const { currentOfficeMode, setCurrentOfficeMode } = useDummyData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your office settings and preferences
        </p>
      </div>

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

      {/* Email Integration */}
      <Card>
        <CardHeader>
          <CardTitle>Email Integration</CardTitle>
          <CardDescription>Configure email inbox connections</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Email integration settings will be available here. Connect your office email
            accounts for automatic message importing.
          </p>
        </CardContent>
      </Card>

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

      {/* Inbound Rule Management */}
      <Card>
        <CardHeader>
          <CardTitle>Inbound Rule Management</CardTitle>
          <CardDescription>
            Configure automatic routing and tagging rules for incoming messages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Inbound rule configuration will be available here. Set up rules to
            automatically route, tag, and assign incoming messages.
          </p>
        </CardContent>
      </Card>

      {/* Retention Policies */}
      <Card>
        <CardHeader>
          <CardTitle>Retention Policies</CardTitle>
          <CardDescription>Manage data retention and archival policies</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Retention policy settings will be available here. Configure how long different
            types of data are retained in the system.
          </p>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Configure notification preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Notification settings will be available here. Choose which events trigger
            notifications and how you receive them.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
