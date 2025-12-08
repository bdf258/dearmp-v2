import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ThirdPartiesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Third Parties</h1>
        <p className="text-muted-foreground">
          Manage third party organizations and contacts
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Third Party Management</CardTitle>
          <CardDescription>
            Track and manage relationships with organizations, government departments, and
            other third parties
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed">
            <div className="text-center">
              <h3 className="mb-2 text-lg font-semibold">Third Parties Feature</h3>
              <p className="text-sm text-muted-foreground">
                This page will contain the third parties management interface
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
