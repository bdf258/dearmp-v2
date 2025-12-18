/**
 * SearchableDropdown Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchableDropdown, type DropdownItem } from '../SearchableDropdown';

const mockItems: DropdownItem[] = [
  { id: '1', name: 'Alice Smith', secondary: 'alice@example.com' },
  { id: '2', name: 'Bob Johnson', secondary: 'bob@example.com' },
  { id: '3', name: 'Charlie Brown' },
];

describe('SearchableDropdown', () => {
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

    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
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

    await user.click(screen.getByText('Bob Johnson'));
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

    await user.click(screen.getByText('Add new person'));
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
