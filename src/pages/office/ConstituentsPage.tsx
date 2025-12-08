import { useDummyData } from '@/lib/useDummyData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ConstituentsPage() {
  const { constituents } = useDummyData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Constituents</h1>
        <p className="text-muted-foreground">
          Manage constituent information and relationships
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Constituent Directory</CardTitle>
          <CardDescription>
            View and manage constituent profiles ({constituents.length} total)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {constituents.map((constituent) => (
              <div
                key={constituent.id}
                className="flex items-start justify-between rounded-lg border p-4"
              >
                <div className="space-y-1">
                  <h3 className="font-semibold">
                    {constituent.first_name} {constituent.last_name}
                  </h3>
                  <p className="text-sm text-muted-foreground">{constituent.email}</p>
                  <p className="text-sm text-muted-foreground">{constituent.phone}</p>
                  <p className="text-sm text-muted-foreground">{constituent.address}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    Added: {new Date(constituent.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
