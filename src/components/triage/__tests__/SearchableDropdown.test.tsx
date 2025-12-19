/**
 * SearchableDropdown Component Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

// Mock cmdk with proper displayName attributes - all inline
vi.mock('cmdk', async () => {
  const React = await import('react');

  const CommandMock = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'> & { shouldFilter?: boolean }>(
    function Command({ children, shouldFilter, ...props }, ref) {
      return (
        <div ref={ref} data-testid="command" data-should-filter={shouldFilter} {...props}>
          {children}
        </div>
      );
    }
  );

  const InputMock = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<'input'> & { value?: string; onValueChange?: (value: string) => void }>(
    function CommandInput({ onValueChange, ...props }, ref) {
      return (
        <input
          ref={ref}
          onChange={(e) => onValueChange?.(e.target.value)}
          {...props}
        />
      );
    }
  );

  const ListMock = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(
    function CommandList({ children, ...props }, ref) {
      return <div ref={ref} {...props}>{children}</div>;
    }
  );

  const EmptyMock = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(
    function CommandEmpty({ children, ...props }, ref) {
      return <div ref={ref} {...props}>{children}</div>;
    }
  );

  const GroupMock = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(
    function CommandGroup({ children, ...props }, ref) {
      return <div ref={ref} {...props}>{children}</div>;
    }
  );

  const ItemMock = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'> & { onSelect?: () => void; value?: string }>(
    function CommandItem({ children, onSelect, value, ...props }, ref) {
      return (
        <div
          ref={ref}
          role="option"
          data-value={value}
          onClick={onSelect}
          style={{ cursor: 'pointer' }}
          {...props}
        >
          {children}
        </div>
      );
    }
  );

  const SeparatorMock = React.forwardRef<HTMLHRElement, React.ComponentPropsWithoutRef<'hr'>>(
    function CommandSeparator(props, ref) {
      return <hr ref={ref} {...props} />;
    }
  );

  // Assign displayNames
  (CommandMock as { displayName?: string }).displayName = 'Command';
  (InputMock as { displayName?: string }).displayName = 'CommandInput';
  (ListMock as { displayName?: string }).displayName = 'CommandList';
  (EmptyMock as { displayName?: string }).displayName = 'CommandEmpty';
  (GroupMock as { displayName?: string }).displayName = 'CommandGroup';
  (ItemMock as { displayName?: string }).displayName = 'CommandItem';
  (SeparatorMock as { displayName?: string }).displayName = 'CommandSeparator';

  // Attach sub-components
  Object.assign(CommandMock, {
    Input: InputMock,
    List: ListMock,
    Empty: EmptyMock,
    Group: GroupMock,
    Item: ItemMock,
    Separator: SeparatorMock,
  });

  return { Command: CommandMock };
});

// Mock Radix UI Popover to avoid React scheduling issues in happy-dom
vi.mock('@radix-ui/react-popover', async () => {
  const React = await import('react');

  const PopoverRootMock = function PopoverRoot({ children }: { children: React.ReactNode }) {
    return <div data-testid="popover-root">{children}</div>;
  };

  const PopoverTriggerMock = React.forwardRef<HTMLDivElement, { children: React.ReactNode; asChild?: boolean }>(
    function PopoverTrigger({ children, asChild }, ref) {
      if (asChild && React.isValidElement(children)) {
        return children;
      }
      return <div ref={ref}>{children}</div>;
    }
  );

  const PopoverPortalMock = function PopoverPortal({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  };

  const PopoverContentMock = React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(
    function PopoverContent({ children, ...props }, ref) {
      return <div ref={ref} data-testid="popover-content" {...props}>{children}</div>;
    }
  );

  const PopoverAnchorMock = function PopoverAnchor({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>;
  };

  const PopoverCloseMock = function PopoverClose({ children }: { children: React.ReactNode }) {
    return <button>{children}</button>;
  };

  return {
    Root: PopoverRootMock,
    Trigger: PopoverTriggerMock,
    Portal: PopoverPortalMock,
    Content: PopoverContentMock,
    Anchor: PopoverAnchorMock,
    Close: PopoverCloseMock,
  };
});

import { SearchableDropdown, type DropdownItem } from '../SearchableDropdown';

const mockItems: DropdownItem[] = [
  { id: '1', name: 'Alice Smith', secondary: 'alice@example.com' },
  { id: '2', name: 'Bob Johnson', secondary: 'bob@example.com' },
  { id: '3', name: 'Charlie Brown' },
];

describe('SearchableDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders placeholder when no item selected', () => {
    render(
      <SearchableDropdown
        placeholder="Select a person"
        items={mockItems}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText('Select a person')).toBeInTheDocument();
  });

  it('renders selected item name', () => {
    render(
      <SearchableDropdown
        placeholder="Select a person"
        items={mockItems}
        selectedId="2"
        onSelect={vi.fn()}
      />
    );

    // The selected name may appear multiple times (in trigger and dropdown)
    expect(screen.getAllByText('Bob Johnson').length).toBeGreaterThan(0);
  });

  it('opens dropdown on click', async () => {
    const user = userEvent.setup();
    render(
      <SearchableDropdown
        placeholder="Select a person"
        items={mockItems}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );

    await user.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
    });
  });

  it('filters items by search query', async () => {
    const user = userEvent.setup();
    render(
      <SearchableDropdown
        placeholder="Select a person"
        items={mockItems}
        selectedId={null}
        onSelect={vi.fn()}
        searchPlaceholder="Search..."
      />
    );

    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText('Search...'), 'Alice');

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
    });
  });

  it('calls onSelect when item is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <SearchableDropdown
        placeholder="Select a person"
        items={mockItems}
        selectedId={null}
        onSelect={onSelect}
      />
    );

    await user.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    });

    // Find and click the option
    const options = screen.getAllByRole('option');
    const bobOption = options.find(el => el.textContent?.includes('Bob Johnson'));
    if (bobOption) {
      await user.click(bobOption);
    }

    expect(onSelect).toHaveBeenCalledWith('2');
  });

  it('shows create new option when onCreateNew is provided', async () => {
    const user = userEvent.setup();
    const onCreateNew = vi.fn();
    render(
      <SearchableDropdown
        placeholder="Select a person"
        items={mockItems}
        selectedId={null}
        onSelect={vi.fn()}
        onCreateNew={onCreateNew}
        createNewLabel="Add new person"
      />
    );

    await user.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByText('Add new person')).toBeInTheDocument();
    });
  });

  it('calls onCreateNew when create new option is clicked', async () => {
    const user = userEvent.setup();
    const onCreateNew = vi.fn();
    render(
      <SearchableDropdown
        placeholder="Select a person"
        items={mockItems}
        selectedId={null}
        onSelect={vi.fn()}
        onCreateNew={onCreateNew}
        createNewLabel="Add new person"
      />
    );

    await user.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByText('Add new person')).toBeInTheDocument();
    });

    // Find and click the create new option
    const options = screen.getAllByRole('option');
    const createOption = options.find(el => el.textContent?.includes('Add new person'));
    if (createOption) {
      await user.click(createOption);
    }

    expect(onCreateNew).toHaveBeenCalled();
  });

  it('shows secondary text when provided', async () => {
    const user = userEvent.setup();
    render(
      <SearchableDropdown
        placeholder="Select a person"
        items={mockItems}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );

    await user.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    });
  });

  it('renders label when provided', () => {
    render(
      <SearchableDropdown
        label="Assignee"
        placeholder="Select a person"
        items={mockItems}
        selectedId={null}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText('Assignee')).toBeInTheDocument();
  });

  it('disables dropdown when disabled prop is true', () => {
    render(
      <SearchableDropdown
        placeholder="Select a person"
        items={mockItems}
        selectedId={null}
        onSelect={vi.fn()}
        disabled
      />
    );

    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
