import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  FileText,
  Users,
  Building2,
  Inbox,
  FolderOpen,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
  LayoutDashboard,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SidebarNavProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMinimized: boolean;
  onMinimize: () => void;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  section: 'casework' | 'coming_soon';
}

const navItems: NavItem[] = [
  // Casework section
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    section: 'casework',
  },
  {
    title: 'Triage',
    href: '/triage/next',
    icon: Inbox,
    section: 'casework',
  },
  // Coming Soon section
  {
    title: 'Triage Dashboard',
    href: '/triage',
    icon: Inbox,
    section: 'coming_soon',
  },
  {
    title: 'Campaigns',
    href: '/triage/campaigns',
    icon: MessageSquare,
    section: 'coming_soon',
  },
  {
    title: 'Cases',
    href: '/casework/cases',
    icon: FolderOpen,
    section: 'coming_soon',
  },
  {
    title: 'Letters',
    href: '/office/letters',
    icon: FileText,
    section: 'coming_soon',
  },
  {
    title: 'Third Parties',
    href: '/office/third-parties',
    icon: Building2,
    section: 'coming_soon',
  },
  {
    title: 'Constituents',
    href: '/office/constituents',
    icon: Users,
    section: 'coming_soon',
  },
];

export function SidebarNav({ isCollapsed, onToggle, isMinimized, onMinimize }: SidebarNavProps) {
  const location = useLocation();

  const renderNavSection = (section: string, items: NavItem[], linkTo?: string) => (
    <div className={cn('mb-6', isMinimized && 'mb-4')}>
      {!isMinimized && (
        linkTo ? (
          <Link
            to={linkTo}
            onClick={() => {
              if (window.innerWidth < 768) {
                onToggle();
              }
            }}
            className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-sidebar-accent-foreground transition-colors"
          >
            {section}
          </Link>
        ) : (
          <h2 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {section}
          </h2>
        )
      )}
      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;

          const linkContent = (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => {
                // Close sidebar on mobile when a link is clicked
                if (window.innerWidth < 768) {
                  onToggle();
                }
              }}
              className={cn(
                'flex items-center rounded-lg text-sm font-medium transition-colors',
                isMinimized ? 'justify-center px-2 py-2' : 'gap-3 px-4 py-2',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {!isMinimized && item.title}
            </Link>
          );

          if (isMinimized) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>
                  {linkContent}
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  {item.title}
                </TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>
    </div>
  );

  // Filter items by section
  const caseworkItems = navItems.filter((item) => item.section === 'casework');
  const comingSoonItems = navItems.filter((item) => item.section === 'coming_soon');

  return (
    <TooltipProvider>
      {/* Overlay for mobile */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-full border-r border-sidebar-border bg-sidebar transition-all duration-300 md:relative md:translate-x-0',
          isCollapsed ? '-translate-x-full' : 'translate-x-0',
          isMinimized ? 'w-16' : 'w-64'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo/Title */}
          <div className={cn(
            'flex h-16 items-center border-b border-sidebar-border',
            isMinimized ? 'justify-center px-2' : 'justify-between px-4'
          )}>
            {isMinimized ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <button
                    onClick={onMinimize}
                    className="rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                    aria-label="Expand sidebar"
                  >
                    <PanelLeftOpen className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  Expand sidebar
                </TooltipContent>
              </Tooltip>
            ) : (
              <>
                <h1 className="text-xl font-bold text-sidebar-primary">DearMP</h1>
                <div className="flex items-center gap-1">
                  {/* Collapse button for desktop */}
                  <button
                    onClick={onMinimize}
                    className="hidden md:flex rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                    aria-label="Collapse sidebar"
                  >
                    <PanelLeftClose className="h-5 w-5" />
                  </button>
                  {/* Close button for mobile */}
                  <button
                    onClick={onToggle}
                    className="md:hidden rounded-md p-2 hover:bg-sidebar-accent"
                    aria-label="Close sidebar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Navigation */}
          <div className={cn('flex-1 overflow-y-auto', isMinimized ? 'p-2' : 'p-4')}>
            {/* Casework Section */}
            {renderNavSection('Casework', caseworkItems)}
            <Separator className={cn(isMinimized ? 'my-2' : 'my-4')} />

            {/* Coming Soon Section */}
            {renderNavSection('Coming Soon', comingSoonItems)}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
