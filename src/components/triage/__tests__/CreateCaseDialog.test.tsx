/**
 * CreateCaseDialog Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateCaseDialog } from '../CreateCaseDialog';

// Mock the triage hooks
const mockCreateCaseForMessage = vi.fn();
vi.mock('@/hooks/triage/useTriage', () => ({
  useTriageActions: () => ({
    createCaseForMessage: mockCreateCaseForMessage,
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

// Mock Supabase context for CaseworkerSelector
vi.mock('@/lib/SupabaseContext', () => ({
  useSupabase: () => ({
    profiles: [
      { id: 'worker1', display_name: 'Alice', role: 'staff', office_id: 'office1' },
      { id: 'worker2', display_name: 'Bob', role: 'admin', office_id: 'office1' },
    ],
    getMyOfficeId: () => 'office1',
  }),
}));

describe('CreateCaseDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    onCreated: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateCaseForMessage.mockResolvedValue({
      success: true,
      caseId: 'new-case-456',
    });
  });

  it('renders dialog with correct title', () => {
    render(<CreateCaseDialog {...defaultProps} />);
    expect(screen.getByText('Create New Case')).toBeInTheDocument();
  });

  it('shows message link note when messageId is provided', () => {
    render(<CreateCaseDialog {...defaultProps} messageId="msg-123" />);
    expect(screen.getByText(/will be linked to this case/i)).toBeInTheDocument();
  });

  it('shows all form fields', () => {
    render(<CreateCaseDialog {...defaultProps} />);

    expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
    expect(screen.getByText(/Priority/i)).toBeInTheDocument();
  });

  it('prepopulates title from default', () => {
    render(
      <CreateCaseDialog {...defaultProps} defaultTitle="Housing Issue" />
    );

    expect(screen.getByDisplayValue('Housing Issue')).toBeInTheDocument();
  });

  it('disables submit button when title is empty', () => {
    render(<CreateCaseDialog {...defaultProps} />);

    const submitButton = screen.getByRole('button', { name: /Create Case/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when title is provided', async () => {
    const user = userEvent.setup();
    render(<CreateCaseDialog {...defaultProps} />);

    await user.type(screen.getByLabelText(/Title/i), 'New Case');

    const submitButton = screen.getByRole('button', { name: /Create Case/i });
    expect(submitButton).not.toBeDisabled();
  });

  it('calls createCaseForMessage with correct data', async () => {
    const user = userEvent.setup();
    render(<CreateCaseDialog {...defaultProps} messageId="msg-123" />);

    await user.type(screen.getByLabelText(/Title/i), 'Test Case');
    await user.type(screen.getByLabelText(/Description/i), 'Test description');

    await user.click(screen.getByRole('button', { name: /Create Case/i }));

    await waitFor(() => {
      expect(mockCreateCaseForMessage).toHaveBeenCalledWith('msg-123', {
        title: 'Test Case',
        description: 'Test description',
        priority: 'medium',
        assigned_to: undefined,
      });
    });
  });

  it('calls onCreated with new case ID on success', async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    render(<CreateCaseDialog {...defaultProps} onCreated={onCreated} />);

    await user.type(screen.getByLabelText(/Title/i), 'Test Case');
    await user.click(screen.getByRole('button', { name: /Create Case/i }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('new-case-456');
    });
  });

  it('closes dialog on success', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<CreateCaseDialog {...defaultProps} onOpenChange={onOpenChange} />);

    await user.type(screen.getByLabelText(/Title/i), 'Test Case');
    await user.click(screen.getByRole('button', { name: /Create Case/i }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('calls onOpenChange when cancel is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<CreateCaseDialog {...defaultProps} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('sets default priority to medium', async () => {
    const user = userEvent.setup();
    render(<CreateCaseDialog {...defaultProps} />);

    await user.type(screen.getByLabelText(/Title/i), 'Test Case');
    await user.click(screen.getByRole('button', { name: /Create Case/i }));

    await waitFor(() => {
      expect(mockCreateCaseForMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ priority: 'medium' })
      );
    });
  });

  it('allows changing priority', async () => {
    const user = userEvent.setup();
    render(<CreateCaseDialog {...defaultProps} />);

    await user.type(screen.getByLabelText(/Title/i), 'Test Case');

    // Click on High priority
    await user.click(screen.getByRole('button', { name: /High/i }));
    await user.click(screen.getByRole('button', { name: /Create Case/i }));

    await waitFor(() => {
      expect(mockCreateCaseForMessage).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ priority: 'high' })
      );
    });
  });

  it('shows success toast on creation', async () => {
    const user = userEvent.setup();
    const { toast } = await import('sonner');
    render(<CreateCaseDialog {...defaultProps} />);

    await user.type(screen.getByLabelText(/Title/i), 'My New Case');
    await user.click(screen.getByRole('button', { name: /Create Case/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Case "My New Case" created');
    });
  });

  it('shows error toast on failure', async () => {
    mockCreateCaseForMessage.mockResolvedValue({
      success: false,
      error: 'Database error',
    });

    const user = userEvent.setup();
    const { toast } = await import('sonner');
    render(<CreateCaseDialog {...defaultProps} />);

    await user.type(screen.getByLabelText(/Title/i), 'Test Case');
    await user.click(screen.getByRole('button', { name: /Create Case/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Database error');
    });
  });

  it('resets form when dialog reopens', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <CreateCaseDialog {...defaultProps} defaultTitle="Initial Title" />
    );

    const titleInput = screen.getByLabelText(/Title/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Changed Title');

    expect(titleInput).toHaveValue('Changed Title');

    // Close and reopen
    rerender(<CreateCaseDialog {...defaultProps} open={false} defaultTitle="Initial Title" />);
    rerender(<CreateCaseDialog {...defaultProps} open={true} defaultTitle="Initial Title" />);

    expect(screen.getByLabelText(/Title/i)).toHaveValue('Initial Title');
  });
});
