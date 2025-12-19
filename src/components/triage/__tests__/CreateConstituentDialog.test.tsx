/**
 * CreateConstituentDialog Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateConstituentDialog } from '../CreateConstituentDialog';

// Mock the triage hooks
const mockCreateConstituentWithContacts = vi.fn();
vi.mock('@/hooks/triage/useTriage', () => ({
  useTriageActions: () => ({
    createConstituentWithContacts: mockCreateConstituentWithContacts,
    isProcessing: false,
  }),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('CreateConstituentDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onCreated: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateConstituentWithContacts.mockResolvedValue({
      success: true,
      constituentId: 'new-id-123',
    });
  });

  it('renders dialog with correct title', () => {
    render(<CreateConstituentDialog {...defaultProps} />);
    expect(screen.getByText('Create New Constituent')).toBeInTheDocument();
  });

  it('shows all form fields', () => {
    render(<CreateConstituentDialog {...defaultProps} />);

    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone/i)).toBeInTheDocument();
  });

  it('prepopulates fields from defaults', () => {
    render(
      <CreateConstituentDialog
        {...defaultProps}
        defaultName="John Smith"
        defaultEmail="john@example.com"
        defaultAddress="123 Main St"
      />
    );

    expect(screen.getByDisplayValue('John Smith')).toBeInTheDocument();
    expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument();
  });

  it('disables submit button when name is empty', () => {
    render(<CreateConstituentDialog {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: /Create Constituent/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when name is provided', async () => {
    const user = userEvent.setup();
    render(<CreateConstituentDialog {...defaultProps} />);

    await user.type(screen.getByLabelText(/Full Name/i), 'Jane Doe');

    const submitButton = screen.getByRole('button', { name: /Create Constituent/i });
    expect(submitButton).not.toBeDisabled();
  });

  it('calls createConstituentWithContacts with correct data', async () => {
    const user = userEvent.setup();
    render(<CreateConstituentDialog {...defaultProps} />);

    await user.type(screen.getByLabelText(/Full Name/i), 'Jane Doe');
    await user.type(screen.getByLabelText(/Email/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/Address/i), '456 Oak Ave');
    await user.type(screen.getByLabelText(/Phone/i), '555-1234');

    await user.click(screen.getByRole('button', { name: /Create Constituent/i }));

    await waitFor(() => {
      expect(mockCreateConstituentWithContacts).toHaveBeenCalledWith({
        full_name: 'Jane Doe',
        email: 'jane@example.com',
        address: '456 Oak Ave',
        phone: '555-1234',
      });
    });
  });

  it('calls onCreated with new constituent ID on success', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    render(<CreateConstituentDialog {...defaultProps} onCreated={onCreated} />);

    await user.type(screen.getByLabelText(/Full Name/i), 'Jane Doe');
    await user.click(screen.getByRole('button', { name: /Create Constituent/i }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('new-id-123');
    });
  });

  it('closes dialog on success', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<CreateConstituentDialog {...defaultProps} onOpenChange={onOpenChange} />);

    await user.type(screen.getByLabelText(/Full Name/i), 'Jane Doe');
    await user.click(screen.getByRole('button', { name: /Create Constituent/i }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('calls onOpenChange when cancel is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<CreateConstituentDialog {...defaultProps} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows error when name is empty on submit', async () => {
    const { toast } = await import('sonner');
    render(
      <CreateConstituentDialog
        {...defaultProps}
        defaultName="  " // Whitespace only
      />
    );

    // Override the disabled state by directly submitting form
    const form = screen.getByRole('button', { name: /Create Constituent/i }).closest('form');
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true }));
    }

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Name is required');
    });
  });

  it('only sends non-empty optional fields', async () => {
    const user = userEvent.setup();
    render(<CreateConstituentDialog {...defaultProps} />);

    await user.type(screen.getByLabelText(/Full Name/i), 'John Only Name');
    await user.click(screen.getByRole('button', { name: /Create Constituent/i }));

    await waitFor(() => {
      expect(mockCreateConstituentWithContacts).toHaveBeenCalledWith({
        full_name: 'John Only Name',
        email: undefined,
        address: undefined,
        phone: undefined,
      });
    });
  });

  it('resets form when dialog reopens', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <CreateConstituentDialog {...defaultProps} defaultName="Initial Name" />
    );

    // Change the value
    const nameInput = screen.getByLabelText(/Full Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Changed Name');

    expect(nameInput).toHaveValue('Changed Name');

    // Close and reopen the dialog
    rerender(<CreateConstituentDialog {...defaultProps} open={false} defaultName="Initial Name" />);
    rerender(<CreateConstituentDialog {...defaultProps} open={true} defaultName="Initial Name" />);

    // Value should be reset to default
    expect(screen.getByLabelText(/Full Name/i)).toHaveValue('Initial Name');
  });
});
