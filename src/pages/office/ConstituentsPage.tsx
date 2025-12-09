import { useSupabase } from '@/lib/SupabaseContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ConstituentsPage() {
  const { constituents, constituentContacts } = useSupabase();

  // Helper to get contacts for a constituent
  const getContacts = (constituentId: string) => {
    return constituentContacts.filter(c => c.constituent_id === constituentId);
  };

  // Helper to get primary email
  const getPrimaryEmail = (constituentId: string) => {
    const contacts = getContacts(constituentId);
    const primary = contacts.find(c => c.type === 'email' && c.is_primary);
    return primary?.value || contacts.find(c => c.type === 'email')?.value || '';
  };

  // Helper to get primary phone
  const getPrimaryPhone = (constituentId: string) => {
    const contacts = getContacts(constituentId);
    const primary = contacts.find(c => c.type === 'phone' && c.is_primary);
    return primary?.value || contacts.find(c => c.type === 'phone')?.value || '';
  };

  // Helper to get address
  const getAddress = (constituentId: string) => {
    const contacts = getContacts(constituentId);
    return contacts.find(c => c.type === 'address')?.value || '';
  };

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
                    {constituent.full_name}
                  </h3>
                  {getPrimaryEmail(constituent.id) && (
                    <p className="text-sm text-muted-foreground">{getPrimaryEmail(constituent.id)}</p>
                  )}
                  {getPrimaryPhone(constituent.id) && (
                    <p className="text-sm text-muted-foreground">{getPrimaryPhone(constituent.id)}</p>
                  )}
                  {getAddress(constituent.id) && (
                    <p className="text-sm text-muted-foreground">{getAddress(constituent.id)}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    Added: {new Date(constituent.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
            {constituents.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">No constituents yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
