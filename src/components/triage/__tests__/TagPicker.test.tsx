/**
 * TagPicker Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagPicker, TagList } from '../TagPicker';
import { SupabaseProvider } from '@/lib/SupabaseContext';

// Mock the SupabaseContext
const mockTags = [
  { id: 'tag1', name: 'Important', color: '#ef4444', created_at: '', office_id: '' },
  { id: 'tag2', name: 'Follow Up', color: '#3b82f6', created_at: '', office_id: '' },
  { id: 'tag3', name: 'Resolved', color: '#22c55e', created_at: '', office_id: '' },
];

vi.mock('@/lib/SupabaseContext', () => ({
  useSupabase: () => ({
    tags: mockTags,
    createTag: vi.fn().mockResolvedValue({ id: 'new', name: 'New Tag', color: '#000' }),
  }),
  SupabaseProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('TagPicker', () => {
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

    expect(screen.getByText('Important')).toBeInTheDocument();
    expect(screen.getByText('Follow Up')).toBeInTheDocument();
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

    await user.click(screen.getByText('Add tags'));

    await waitFor(() => {
      expect(screen.getByText('Important')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Important'));
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

    // Click on the tag picker to open it
    await user.click(screen.getByText('Important'));

    await waitFor(() => {
      // Should be in the dropdown
      expect(screen.getAllByText('Important').length).toBeGreaterThan(0);
    });

    // Click to toggle off
    const importantItems = screen.getAllByText('Important');
    await user.click(importantItems[importantItems.length - 1]);

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

    // tag1 was original but not selected now -> should have line-through (removed)
    // tag2 was original and still selected -> unchanged
    // tag3 is newly added -> should have dashed border (new)
    const tags = screen.getAllByText(/(Important|Follow Up|Resolved)/);
    expect(tags.length).toBe(3); // All three should be shown
  });
});

describe('TagList', () => {
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
