import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Layers, Mail, FolderOpen, LayoutDashboard, Component, Settings } from 'lucide-react';

interface PrototypeLink {
  path: string;
  title: string;
  description: string;
  category: string;
}

const prototypes: PrototypeLink[] = [
  {
    path: '/triage-prototype-1',
    title: 'Triage Prototype 1',
    description: 'Tiered Waterfall Triage - Process emails in phases based on complexity',
    category: 'Triage',
  },
  {
    path: '/triage-prototype-2',
    title: 'Triage Prototype 2',
    description: 'Alternative triage workflow design',
    category: 'Triage',
  },
  {
    path: '/triage-prototype-3',
    title: 'Triage Prototype 3',
    description: 'Third triage workflow iteration',
    category: 'Triage',
  },
  {
    path: '/triage-prototype-4',
    title: 'Triage Prototype 4',
    description: 'Fourth triage workflow iteration',
    category: 'Triage',
  },
  {
    path: '/triage-prototype-5',
    title: 'Triage Prototype 5',
    description: 'Fifth triage workflow iteration',
    category: 'Triage',
  },
  {
    path: '/prototypes/case/tabs',
    title: 'Case View - Tabs',
    description: 'Case detail page using tabbed layout',
    category: 'Case',
  },
  {
    path: '/prototypes/case/columns',
    title: 'Case View - Columns',
    description: 'Case detail page using column-based layout',
    category: 'Case',
  },
  {
    path: '/prototypes/case/cards',
    title: 'Case View - Cards',
    description: 'Case detail page using card-based layout',
    category: 'Case',
  },
  {
    path: '/prototypes/dashboard',
    title: 'Dashboard Prototype',
    description: 'Alternative dashboard layout and design',
    category: 'Dashboard',
  },
  {
    path: '/prototypes/components',
    title: 'Component Library',
    description: 'All triage workspace components in their various states (empty, AI, approved)',
    category: 'Components',
  },
  {
    path: '/prototypes/settings/user',
    title: 'User Settings',
    description: 'Clean, simple settings page for regular staff members with card-based layout',
    category: 'Settings',
  },
  {
    path: '/prototypes/settings/admin',
    title: 'Admin Settings',
    description: 'Comprehensive admin dashboard with tabbed layout for full office management',
    category: 'Settings',
  },
  {
    path: '/prototypes/settings/sidebar',
    title: 'Settings with Sidebar',
    description: 'Alternative layout with persistent sidebar navigation for settings sections',
    category: 'Settings',
  },
];

const categoryIcons: Record<string, React.ReactNode> = {
  Triage: <Mail className="h-4 w-4" />,
  Case: <FolderOpen className="h-4 w-4" />,
  Dashboard: <LayoutDashboard className="h-4 w-4" />,
  Components: <Component className="h-4 w-4" />,
  Settings: <Settings className="h-4 w-4" />,
};

const categoryColors: Record<string, string> = {
  Triage: 'bg-blue-100 text-blue-700 border-blue-200',
  Case: 'bg-purple-100 text-purple-700 border-purple-200',
  Dashboard: 'bg-green-100 text-green-700 border-green-200',
  Components: 'bg-orange-100 text-orange-700 border-orange-200',
  Settings: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function PrototypesPage() {
  const groupedPrototypes = prototypes.reduce((acc, prototype) => {
    if (!acc[prototype.category]) {
      acc[prototype.category] = [];
    }
    acc[prototype.category].push(prototype);
    return acc;
  }, {} as Record<string, PrototypeLink[]>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Layers className="h-8 w-8" />
          Prototypes
        </h1>
        <p className="text-muted-foreground mt-1">
          Explore experimental UI designs and workflow prototypes
        </p>
      </div>

      {Object.entries(groupedPrototypes).map(([category, items]) => (
        <div key={category} className="space-y-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            {categoryIcons[category]}
            {category} Prototypes
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((prototype) => (
              <Link key={prototype.path} to={prototype.path}>
                <Card className="h-full transition-colors hover:bg-muted/50 hover:border-primary/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className={categoryColors[prototype.category]}
                      >
                        {prototype.category}
                      </Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-lg">{prototype.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{prototype.description}</CardDescription>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
