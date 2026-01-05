import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  LogOut,
  User,
  Shield,
  Bell,
  Eye,
  Building2,
  Mail,
  CheckCircle2,
  Smartphone
} from 'lucide-react';

/**
 * User Settings Prototype
 *
 * A clean, simple settings page designed for regular staff members.
 * Uses card-based layout with clear visual hierarchy.
 * All data is hardcoded for prototyping purposes.
 */
export default function SettingsPrototypeUser() {
  // Hardcoded user data
  const user = {
    name: 'Sarah Johnson',
    email: 'sarah.johnson@parliament.uk',
    role: 'staff',
    office: 'Office of Jane Smith MP',
    initials: 'SJ',
    twoFactorEnabled: true,
  };

  const officeInfo = {
    mpName: 'The Rt Hon Jane Smith MP',
    constituency: 'North Bristol',
    inboundEmail: 'contact@janesmith.parliament.uk',
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account preferences
        </p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Your Profile
          </CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg bg-primary/10 text-primary">
                {user.initials}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">{user.name}</h3>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <Badge variant="secondary" className="capitalize">
                {user.role}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Office</Label>
              <p className="font-medium">{user.office}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs uppercase tracking-wide">Role</Label>
              <p className="font-medium capitalize">{user.role}</p>
            </div>
          </div>

          <Separator />

          <Button variant="outline" className="w-full sm:w-auto">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>

      {/* Security Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>Keep your account secure</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user.twoFactorEnabled ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Enabled
                </Badge>
              ) : (
                <Button size="sm">Enable</Button>
              )}
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Two-factor authentication adds an extra layer of security by requiring a code from your
            authenticator app in addition to your password.
          </p>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>Choose what you want to be notified about</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive email updates about new cases assigned to you
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Case updates</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when cases you're working on are updated
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Daily digest</Label>
              <p className="text-sm text-muted-foreground">
                Receive a daily summary of your pending tasks
              </p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      {/* Office Information (Read Only) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Office Information
          </CardTitle>
          <CardDescription>Details about your office</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">{officeInfo.mpName}</p>
                <p className="text-sm text-muted-foreground">{officeInfo.constituency}</p>
              </div>
            </div>

            <Separator />

            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-muted-foreground text-xs">Office Email</Label>
                <p className="text-sm font-medium">{officeInfo.inboundEmail}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Contact your administrator to update office information
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
