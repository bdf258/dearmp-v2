import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Filter, Plus } from 'lucide-react';

export default function InboundRulesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inbound Rules</h1>
          <p className="text-muted-foreground">
            Configure automated rules for processing incoming messages
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Rule
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Automation Rules
          </CardTitle>
          <CardDescription>
            Set up rules to automatically tag, assign, or categorize incoming messages
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Filter className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No rules configured yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Inbound rules help automate your workflow by automatically processing
              messages based on criteria you define.
            </p>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Rule
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Auto-Assignment</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Automatically assign messages to specific team members based on keywords
              or sender
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Auto-Tagging</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Apply tags automatically based on message content or metadata
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Categorization</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Automatically categorize messages as policy or casework based on rules
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
