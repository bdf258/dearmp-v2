import { useNavigate } from 'react-router-dom';
import { useSupabase } from '@/lib/SupabaseContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Users, Mail, Flag, Inbox } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { cases, constituents, messages, campaigns, currentOfficeMode } = useSupabase();

  // Count emails needing triage (inbound messages without case or campaign)
  const emailsToTriage = messages.filter(m =>
    m.direction === 'inbound' &&
    !m.case_id &&
    !m.campaign_id &&
    (m.triage_status === 'pending' || m.triage_status === 'triaged' || m.triage_status === null)
  ).length;

  const stats = [
    {
      title: 'Active Cases',
      value: cases.filter(c => c.status !== 'closed' && c.status !== 'archived').length,
      icon: FileText,
      description: 'Cases in progress',
    },
    {
      title: 'Constituents',
      value: constituents.length,
      icon: Users,
      description: 'Total constituents',
    },
    {
      title: 'Messages',
      value: messages.filter(m => !m.case_id && !m.campaign_id).length,
      icon: Mail,
      description: 'Unassigned messages',
    },
    {
      title: 'Active Campaigns',
      value: campaigns.filter(c => c.status === 'active').length,
      icon: Flag,
      description: 'Ongoing campaigns',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's an overview of your {currentOfficeMode} office.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Start Triage Button */}
      {emailsToTriage > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Inbox className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">
                  {emailsToTriage} {emailsToTriage === 1 ? 'email' : 'emails'} to triage
                </p>
                <p className="text-sm text-muted-foreground">
                  Start with the oldest email first
                </p>
              </div>
            </div>
            <Button onClick={() => navigate('/triage/next')}>
              Start Triage
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Cases</CardTitle>
            <CardDescription>Latest casework activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {cases.slice(0, 3).map((caseItem) => (
                <div key={caseItem.id} className="flex items-start gap-3">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">{caseItem.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {caseItem.status} • {caseItem.priority} priority
                    </p>
                  </div>
                </div>
              ))}
              {cases.length === 0 && (
                <p className="text-sm text-muted-foreground">No cases yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Messages</CardTitle>
            <CardDescription>Latest incoming correspondence</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {messages.slice(0, 3).map((message) => (
                <div key={message.id} className="flex items-start gap-3">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">{message.subject || '(No subject)'}</p>
                    <p className="text-xs text-muted-foreground">
                      {message.channel} • {new Date(message.received_at).toLocaleDateString()}
                    </p>
                  </div>
                  {!message.case_id && !message.campaign_id && (
                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                      Triage
                    </span>
                  )}
                </div>
              ))}
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground">No messages yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
