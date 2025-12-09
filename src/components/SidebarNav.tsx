import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  FileText,
  Users,
  Building2,
  Settings,
  Home,
  Mail,
  Flag,
  Inbox,
  FolderOpen,
  FilePlus,
  Filter,
  BarChart3,
  PenTool,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface SidebarNavProps {
  currentMode: 'casework' | 'westminster';
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  section?: 'policy' | 'office' | 'casework';
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: Home,
  },
  {
    title: 'Triage',
    href: '/policy/triage',
    icon: Mail,
    section: 'policy',
  },
  {
    title: 'Campaigns',
    href: '/policy/campaigns',
    icon: Flag,
    section: 'policy',
  },
  {
    title: 'Policy Emails',
    href: '/policy/emails',
    icon: Inbox,
    section: 'policy',
  },
  {
    title: 'Office Style',
    href: '/policy/office-style',
    icon: PenTool,
    section: 'policy',
  },
  {
    title: 'Letters',
    href: '/office/letters',
    icon: FileText,
    section: 'office',
  },
  {
    title: 'Third Parties',
    href: '/office/third-parties',
    icon: Building2,
    section: 'office',
  },
  {
    title: 'Constituents',
    href: '/office/constituents',
    icon: Users,
    section: 'office',
  },
  {
    title: 'Triage',
    href: '/casework/triage',
    icon: Inbox,
    section: 'casework',
  },
  {
    title: 'Cases',
    href: '/casework/cases',
    icon: FolderOpen,
    section: 'casework',
  },
  {
    title: 'New Case',
    href: '/casework/new-case',
    icon: FilePlus,
    section: 'casework',
  },
  {
    title: 'Inbound Rules',
    href: '/casework/inbound-rules',
    icon: Filter,
    section: 'casework',
  },
  {
    title: 'Reporting',
    href: '/casework/reporting',
    icon: BarChart3,
    section: 'casework',
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export function SidebarNav({ currentMode }: SidebarNavProps) {
  const location = useLocation();

  const renderNavSection = (section: string, items: NavItem[]) => (
    <div className="mb-6">
      <h2 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {section}
      </h2>
      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  // Filter items based on current mode
  const generalItems = navItems.filter(
    (item) => !item.section || item.section === undefined
  );
  const policyItems = navItems.filter((item) => item.section === 'policy');
  const officeItems = navItems.filter((item) => item.section === 'office');
  const caseworkItems = navItems.filter((item) => item.section === 'casework');

  return (
    <aside className="w-64 border-r border-sidebar-border bg-sidebar">
      <div className="flex h-full flex-col">
        {/* Logo/Title */}
        <div className="flex h-16 items-center border-b border-sidebar-border px-6">
          <h1 className="text-xl font-bold text-sidebar-primary">DearMP</h1>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* General Navigation */}
          {generalItems.length > 0 && (
            <>
              {renderNavSection('', generalItems)}
              <Separator className="my-4" />
            </>
          )}

          {/* Policy Section (Westminster mode) */}
          {currentMode === 'westminster' && policyItems.length > 0 && (
            <>
              {renderNavSection('Policy', policyItems)}
              <Separator className="my-4" />
            </>
          )}

         {/* Casework Section (Casework mode) */}
          {currentMode === 'casework' && caseworkItems.length > 0 && (
            <>{renderNavSection('Casework', caseworkItems)}</>
          )}


          {/* Office Section (both modes) */}
          {officeItems.length > 0 && (
            <>
              {renderNavSection('Office', officeItems)}
              <Separator className="my-4" />
            </>
          )}

        </div>
      </div>
    </aside>
  );
}
