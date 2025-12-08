import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LettersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Letters</h1>
        <p className="text-muted-foreground">
          Manage outgoing correspondence and letter templates
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Letters Management</CardTitle>
          <CardDescription>
            Create, edit, and send letters to constituents and third parties
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed">
            <div className="text-center">
              <h3 className="mb-2 text-lg font-semibold">Letters Feature</h3>
              <p className="text-sm text-muted-foreground">
                This page will contain the letters management interface
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
