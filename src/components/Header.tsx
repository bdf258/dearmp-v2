import { useSupabase } from '@/lib/SupabaseContext';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

interface HeaderProps {
  currentMode: 'casework' | 'westminster';
  onModeChange: (mode: 'casework' | 'westminster') => void;
}

export function Header({ currentMode, onModeChange }: HeaderProps) {
  const { profile, currentOffice } = useSupabase();

  const handleModeToggle = (checked: boolean) => {
    onModeChange(checked ? 'westminster' : 'casework');
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-card-foreground">
          {currentOffice?.name || 'Office'}
        </h2>
      </div>

      <div className="flex items-center gap-6">
        {/* Mode Switcher */}
        <Card className="flex items-center gap-3 px-4 py-2">
          <Label htmlFor="mode-switch" className="text-sm font-medium">
            Casework
          </Label>
          <Switch
            id="mode-switch"
            checked={currentMode === 'westminster'}
            onCheckedChange={handleModeToggle}
          />
          <Label htmlFor="mode-switch" className="text-sm font-medium">
            Westminster
          </Label>
        </Card>

        {/* User Info */}
        <div className="flex items-center gap-2">
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
        </div>
      </div>
    </header>
  );
}
