/**
 * ConstituentSelector
 *
 * Searchable dropdown for selecting a constituent with create-new option.
 * Shows constituent name, email, and address.
 */

import { useMemo } from 'react';
import { useSupabase } from '@/lib/SupabaseContext';
import { SearchableDropdown, type DropdownItem, type RecognitionStatus } from './SearchableDropdown';
import { User, Mail, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConstituentSelectorProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreateNew?: () => void;
  /** @deprecated Use recognitionStatus instead */
  isRecognized?: boolean;
  recognitionStatus?: RecognitionStatus;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function ConstituentSelector({
  selectedId,
  onSelect,
  onCreateNew,
  isRecognized,
  recognitionStatus,
  disabled,
  label = 'Constituent',
  className,
}: ConstituentSelectorProps) {
  const { constituents, constituentContacts } = useSupabase();

  // Build dropdown items
  const items: DropdownItem[] = useMemo(() => {
    return constituents.map((c) => {
      const contacts = constituentContacts.filter(cc => cc.constituent_id === c.id);
      const primaryEmail = contacts.find(cc => cc.type === 'email' && cc.is_primary);
      const email = primaryEmail?.value || contacts.find(cc => cc.type === 'email')?.value;
      const address = contacts.find(cc => cc.type === 'address')?.value;

      // Build secondary text showing email and address
      const parts: string[] = [];
      if (email) parts.push(email);
      if (address) parts.push(address);

      return {
        id: c.id,
        name: c.full_name,
        secondary: parts.join(' • '),
      };
    });
  }, [constituents, constituentContacts]);

  return (
    <SearchableDropdown
      label={label}
      icon={<User className="h-4 w-4 text-muted-foreground" />}
      placeholder="Select constituent"
      items={items}
      selectedId={selectedId}
      onSelect={onSelect}
      onCreateNew={onCreateNew}
      createNewLabel="Create new constituent"
      isRecognized={isRecognized}
      recognitionStatus={recognitionStatus}
      disabled={disabled}
      searchPlaceholder="Search by name or email..."
      emptyMessage="No constituents found"
      className={className}
    />
  );
}

// Compact constituent display for showing selected constituent info
export function ConstituentCard({
  constituentId,
  className,
}: {
  constituentId: string | null;
  className?: string;
}) {
  const { constituents, constituentContacts } = useSupabase();

  const data = useMemo(() => {
    if (!constituentId) return null;
    const constituent = constituents.find(c => c.id === constituentId);
    if (!constituent) return null;

    const contacts = constituentContacts.filter(cc => cc.constituent_id === constituentId);
    const email = contacts.find(cc => cc.type === 'email' && cc.is_primary)?.value
      || contacts.find(cc => cc.type === 'email')?.value;
    const address = contacts.find(cc => cc.type === 'address')?.value;

    return { constituent, email, address };
  }, [constituentId, constituents, constituentContacts]);

  if (!data) return null;

  return (
    <div className={cn('p-3 bg-muted/30 rounded-lg', className)}>
      <div className="font-medium flex items-center gap-2">
        <User className="h-4 w-4 text-muted-foreground" />
        {data.constituent.full_name}
      </div>
      {data.email && (
        <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
          <Mail className="h-3 w-3" />
          {data.email}
        </div>
      )}
      {data.address && (
        <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
          <MapPin className="h-3 w-3" />
          {data.address}
        </div>
      )}
    </div>
  );
}
