import { useDummyData } from '@/lib/useDummyData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Users, Mail, Flag } from 'lucide-react';

export default function Dashboard() {
  const { cases, constituents, messages, campaigns, currentOfficeMode } = useDummyData();

  const stats = [
    {
      title: 'Active Cases',
      value: cases.filter(c => c.status !== 'closed').length,
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
      title: 'Unassigned Messages',
      value: messages.filter(m => m.is_triage_needed).length,
      icon: Mail,
      description: 'Requiring triage',
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
                    <p className="text-sm font-medium">{message.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      From: {message.from_name}
                    </p>
                  </div>
                  {message.is_triage_needed && (
                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                      Triage
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
