import { Link } from 'react-router-dom';
import { useSupabase } from '@/lib/SupabaseContext';
import { useTriageProgress } from '@/lib/TriageProgressContext';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Menu, ArrowLeft, ArrowRight, ChevronLeft } from 'lucide-react';

interface HeaderProps {
  onToggleSidebar: () => void;
  isSidebarCollapsed?: boolean;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { profile, currentOffice } = useSupabase();
  const { progress, navigation } = useTriageProgress();

  const progressPercentage = progress
    ? (progress.current / progress.total) * 100
    : 0;

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex items-center gap-2">
        {/* Hamburger menu button for mobile */}
        <button
          onClick={onToggleSidebar}
          className="rounded-md p-2 hover:bg-accent md:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* Back button - shown when in triage mode */}
        {navigation && (
          <Button
            variant="ghost"
            size="icon"
            onClick={navigation.onBack}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}

        <h2 className="text-lg font-semibold text-card-foreground">
          {currentOffice?.name || 'Office'}
        </h2>
      </div>

      {/* Triage Progress Bar - shown when on triage page */}
      {progress && (
        <div className="flex items-center gap-3 flex-1 max-w-md mx-8">
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            Triage:
          </span>
          <Progress value={progressPercentage} className="flex-1 h-2" />
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {progress.current}/{progress.total}
          </span>
        </div>
      )}

      <div className="flex items-center gap-4">
        {/* Navigation buttons - shown when in triage mode */}
        {navigation && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={navigation.onPrevious}
              disabled={!navigation.canGoPrevious}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={navigation.onNext}
              disabled={!navigation.canGoNext}
              className="h-8 w-8"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* User Info - links to settings */}
        <Link to="/settings" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="text-right">
            <p className="text-sm font-medium text-card-foreground">
              {profile?.full_name || 'User'}
            </p>
            <p className="text-xs text-muted-foreground">
              {profile?.role || 'staff'}
            </p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <span className="text-sm font-medium">
              {profile?.full_name?.charAt(0) || 'U'}
            </span>
          </div>
        </Link>
      </div>
    </header>
  );
}
