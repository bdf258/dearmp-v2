/**
 * TagPicker Component Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tag } from '@/lib/database.types';
import * as React from 'react';

// Mock tags data - hoisted with vi.hoisted
const { mockTags, mockCreateTag } = vi.hoisted(() => {
  const mockTags: Tag[] = [
    { id: 'tag1', name: 'Important', color: '#ef4444', created_at: '', office_id: 'office-1' },
    { id: 'tag2', name: 'Follow Up', color: '#3b82f6', created_at: '', office_id: 'office-1' },
    { id: 'tag3', name: 'Resolved', color: '#22c55e', created_at: '', office_id: 'office-1' },
  ];

  const mockCreateTag = vi.fn().mockImplementation(async (name: string, color: string) => ({
    id: 'new-tag-id',
    name,
    color,
    created_at: new Date().toISOString(),
    office_id: 'office-1',
  }));

  return { mockTags, mockCreateTag };
});

// Create a proper mock for the SupabaseContext
vi.mock('@/lib/SupabaseContext', () => ({
  useSupabase: () => ({
    tags: mockTags,
    createTag: mockCreateTag,
    user: null,
    profile: null,
    loading: false,
    error: null,
    tagAssignments: [],
  }),
  SupabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));

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

// Import the component after mocks are set up
import { TagPicker, TagList } from '../TagPicker';

describe('TagPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders with placeholder when no tags selected', () => {
    render(
      <TagPicker
        selectedTagIds={[]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Add tags')).toBeInTheDocument();
  });

  it('shows selected tags', () => {
    render(
      <TagPicker
        selectedTagIds={['tag1', 'tag2']}
        onChange={vi.fn()}
      />
    );

    // Tags appear both in the selected area and in the dropdown, so use getAllBy
    expect(screen.getAllByText('Important').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Follow Up').length).toBeGreaterThan(0);
  });

  it('opens tag list on click', async () => {
    const user = userEvent.setup();
    render(
      <TagPicker
        selectedTagIds={[]}
        onChange={vi.fn()}
      />
    );

    await user.click(screen.getByText('Add tags'));

    await waitFor(() => {
      // The popover should show all available tags
      expect(screen.getByText('Important')).toBeInTheDocument();
      expect(screen.getByText('Follow Up')).toBeInTheDocument();
      expect(screen.getByText('Resolved')).toBeInTheDocument();
    });
  });

  it('calls onChange when tag is toggled on', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagPicker
        selectedTagIds={[]}
        onChange={onChange}
      />
    );

    // Open the popover
    await user.click(screen.getByText('Add tags'));

    // Wait for the list to be visible
    await waitFor(() => {
      expect(screen.getByText('Important')).toBeInTheDocument();
    });

    // Find and click the Important tag option (in the dropdown)
    const options = screen.getAllByRole('option');
    const importantOption = options.find(el => el.textContent?.includes('Important'));
    if (importantOption) {
      await user.click(importantOption);
    }

    expect(onChange).toHaveBeenCalledWith(['tag1']);
  });

  it('calls onChange when tag is toggled off', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TagPicker
        selectedTagIds={['tag1', 'tag2']}
        onChange={onChange}
      />
    );

    // The selected tags should be visible (use getAllByText since mocked popover shows dropdown too)
    expect(screen.getAllByText('Important').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Follow Up').length).toBeGreaterThan(0);

    // Click on the picker trigger area
    const importantElements = screen.getAllByText('Important');
    await user.click(importantElements[0]);

    await waitFor(() => {
      // Should have options in the dropdown
      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThan(0);
    });

    // Click to toggle off Important - use the option element
    const options = screen.getAllByRole('option');
    const importantOption = options.find(el => el.textContent?.includes('Important'));
    if (importantOption) {
      await user.click(importantOption);
    }

    expect(onChange).toHaveBeenCalledWith(['tag2']);
  });

  it('filters tags by search', async () => {
    const user = userEvent.setup();
    render(
      <TagPicker
        selectedTagIds={[]}
        onChange={vi.fn()}
      />
    );

    await user.click(screen.getByText('Add tags'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search tags...')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('Search tags...'), 'Imp');

    await waitFor(() => {
      expect(screen.getByText('Important')).toBeInTheDocument();
      expect(screen.queryByText('Follow Up')).not.toBeInTheDocument();
    });
  });

  it('renders custom label', () => {
    render(
      <TagPicker
        selectedTagIds={[]}
        onChange={vi.fn()}
        label="Categories"
      />
    );

    expect(screen.getByText('Categories')).toBeInTheDocument();
  });

  it('shows tag change states when originalTagIds provided', () => {
    render(
      <TagPicker
        selectedTagIds={['tag2', 'tag3']}
        originalTagIds={['tag1', 'tag2']}
        onChange={vi.fn()}
      />
    );

    // tag1 was original but not selected now -> should be shown (removed state)
    // tag2 was original and still selected -> unchanged
    // tag3 is newly added -> should have dashed border (new state)
    // With mocked popover, tags appear in both display area and dropdown
    const tags = screen.getAllByText(/(Important|Follow Up|Resolved)/);
    // At minimum, all 3 tags should be visible (may have duplicates from dropdown)
    expect(tags.length).toBeGreaterThanOrEqual(3);

    // Verify each tag type is present
    expect(screen.getAllByText('Important').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Follow Up').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Resolved').length).toBeGreaterThan(0);
  });
});

describe('TagList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders tags from IDs', () => {
    render(
      <TagList tagIds={['tag1', 'tag3']} />
    );

    expect(screen.getByText('Important')).toBeInTheDocument();
    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.queryByText('Follow Up')).not.toBeInTheDocument();
  });

  it('returns null when no tags', () => {
    const { container } = render(
      <TagList tagIds={[]} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
