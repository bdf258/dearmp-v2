/**
 * SearchableDropdown
 *
 * Base reusable searchable dropdown component with "Create new" option.
 * Used by ConstituentSelector, CaseSelector, etc.
 */

import { useState, useMemo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronDown, Plus, CheckCircle2, HelpCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DropdownItem {
  id: string;
  name: string;
  secondary?: string;
  badge?: ReactNode;
}

export type RecognitionStatus = 'confirmed' | 'ai_matched' | 'none';

interface SearchableDropdownProps {
  label?: string;
  icon?: ReactNode;
  placeholder: string;
  items: DropdownItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCreateNew?: () => void;
  createNewLabel?: string;
  /** @deprecated Use recognitionStatus instead */
  isRecognized?: boolean;
  recognitionStatus?: RecognitionStatus;
  disabled?: boolean;
  isLoading?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  /** Remove border from the button for seamless integration */
  borderless?: boolean;
  /** Hide secondary text in the button display */
  hideSecondary?: boolean;
  /** Custom class for the label element */
  labelClassName?: string;
}

export function SearchableDropdown({
  label,
  icon,
  placeholder,
  items,
  selectedId,
  onSelect,
  onCreateNew,
  createNewLabel = 'Create new',
  isRecognized,
  recognitionStatus,
  disabled,
  isLoading,
  searchPlaceholder,
  emptyMessage = 'No results found.',
  className,
  borderless,
  hideSecondary,
  labelClassName,
}: SearchableDropdownProps) {
  // Compute effective recognition status (support legacy isRecognized prop)
  const effectiveStatus: RecognitionStatus = recognitionStatus
    ?? (isRecognized ? 'confirmed' : 'none');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const lowerSearch = search.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(lowerSearch) ||
        item.secondary?.toLowerCase().includes(lowerSearch)
    );
  }, [items, search]);

  const selectedItem = items.find((item) => item.id === selectedId);

  return (
    <div className={cn('space-y-2 min-w-0', className)}>
      {label && <label className={cn('text-sm font-medium', labelClassName)}>{label}</label>}
      <div className="flex items-center gap-2 min-w-0">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={borderless ? 'ghost' : 'outline'}
              role="combobox"
              aria-expanded={open}
              disabled={disabled || isLoading}
              className={cn(
                'flex-1 justify-between h-auto min-h-10 py-2 min-w-0',
                borderless && 'border-0 hover:bg-transparent px-0'
              )}
            >
              <span className="flex items-center gap-2 min-w-0 flex-1">
                {icon && <span className="shrink-0">{icon}</span>}
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : selectedItem ? (
                  <span className="flex flex-col items-start min-w-0 flex-1">
                    <span className="truncate w-full text-left">{selectedItem.name}</span>
                    {!hideSecondary && selectedItem.secondary && (
                      <span className="text-xs text-muted-foreground truncate w-full text-left">
                        {selectedItem.secondary}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground truncate">{placeholder}</span>
                )}
              </span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder={searchPlaceholder || `Search...`}
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                {/* Pinned Create New option */}
                {onCreateNew && (
                  <>
                    <CommandGroup>
                      <CommandItem
                        onSelect={() => {
                          setOpen(false);
                          setSearch('');
                          onCreateNew();
                        }}
                        className="text-primary"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {createNewLabel}
                      </CommandItem>
                    </CommandGroup>
                    <CommandSeparator />
                  </>
                )}
                {/* Filtered items */}
                <CommandGroup>
                  {filteredItems.length === 0 ? (
                    <CommandEmpty>{emptyMessage}</CommandEmpty>
                  ) : (
                    filteredItems.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.id}
                        onSelect={() => {
                          onSelect(item.id === selectedId ? null : item.id);
                          setOpen(false);
                          setSearch('');
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            selectedId === item.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate">{item.name}</span>
                            {item.badge}
                          </div>
                          {item.secondary && (
                            <span className="text-xs text-muted-foreground truncate">
                              {item.secondary}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selectedId && effectiveStatus === 'confirmed' && (
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
        )}
        {selectedId && effectiveStatus === 'ai_matched' && (
          <HelpCircle className="h-5 w-5 text-orange-500 shrink-0" />
        )}
      </div>
    </div>
  );
}
