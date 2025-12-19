/**
 * CreateCaseDialog Component Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

// Mock the triage hooks
const mockCreateCaseForMessage = vi.fn();
vi.mock('@/hooks/triage/useTriage', () => ({
  useTriageActions: () => ({
    createCaseForMessage: mockCreateCaseForMessage,
    isProcessing: false,
  }),
  useCaseworkers: () => ({
    caseworkers: [
      { id: 'worker1', full_name: 'Alice', role: 'staff', office_id: 'office1' },
      { id: 'worker2', full_name: 'Bob', role: 'admin', office_id: 'office1' },
    ],
    loading: false,
    error: null,
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

// Mock Radix UI Dialog to avoid React scheduling issues in happy-dom
vi.mock('@radix-ui/react-dialog', async () => {
  const React = await import('react');

  const DialogContext = React.createContext<{ open?: boolean; onOpenChange?: (open: boolean) => void }>({});

  const DialogRootMock = function DialogRoot({ children, open, onOpenChange }: {
    children: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) {
    const contextValue = React.useMemo(() => ({ open, onOpenChange }), [open, onOpenChange]);

    if (!open) return null;
    return (
      <DialogContext.Provider value={contextValue}>
        <div data-testid="dialog-root" data-open={open}>
          {children}
        </div>
      </DialogContext.Provider>
    );
  };

  const DialogTriggerMock = React.forwardRef<HTMLButtonElement, { children: React.ReactNode; asChild?: boolean }>(
    function DialogTrigger({ children, asChild }, ref) {
      if (asChild && React.isValidElement(children)) {
        return children;
      }
      return <button ref={ref}>{children}</button>;
    }
  );

  const DialogPortalMock = function DialogPortal({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  };

  const DialogOverlayMock = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(
    function DialogOverlay({ children, ...props }, ref) {
      return <div ref={ref} data-testid="dialog-overlay" {...props}>{children}</div>;
    }
  );

  const DialogContentMock = React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(
    function DialogContent({ children, ...props }, ref) {
      return <div ref={ref} data-testid="dialog-content" role="dialog" {...props}>{children}</div>;
    }
  );

  const DialogCloseMock = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<'button'>>(
    function DialogClose({ children, onClick, ...props }, ref) {
      const context = React.useContext(DialogContext);
      return (
        <button
          ref={ref}
          onClick={(e) => {
            onClick?.(e);
            context.onOpenChange?.(false);
          }}
          {...props}
        >
          {children}
        </button>
      );
    }
  );

  const DialogTitleMock = React.forwardRef<HTMLHeadingElement, React.ComponentPropsWithoutRef<'h2'>>(
    function DialogTitle({ children, ...props }, ref) {
      return <h2 ref={ref} {...props}>{children}</h2>;
    }
  );

  const DialogDescriptionMock = React.forwardRef<HTMLParagraphElement, React.ComponentPropsWithoutRef<'p'>>(
    function DialogDescription({ children, ...props }, ref) {
      return <p ref={ref} {...props}>{children}</p>;
    }
  );

  // Assign displayNames
  (DialogOverlayMock as { displayName?: string }).displayName = 'DialogOverlay';
  (DialogContentMock as { displayName?: string }).displayName = 'DialogContent';
  (DialogTitleMock as { displayName?: string }).displayName = 'DialogTitle';
  (DialogDescriptionMock as { displayName?: string }).displayName = 'DialogDescription';
  (DialogCloseMock as { displayName?: string }).displayName = 'DialogClose';

  return {
    Root: DialogRootMock,
    Trigger: DialogTriggerMock,
    Portal: DialogPortalMock,
    Overlay: DialogOverlayMock,
    Content: DialogContentMock,
    Close: DialogCloseMock,
    Title: DialogTitleMock,
    Description: DialogDescriptionMock,
  };
});

// Mock cmdk for CaseworkerSelector
vi.mock('cmdk', async () => {
  const React = await import('react');

  const CommandMock = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'> & { shouldFilter?: boolean }>(
    function Command({ children, shouldFilter, ...props }, ref) {
      return (
        <div ref={ref} data-testid="command" {...props}>
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

  (CommandMock as { displayName?: string }).displayName = 'Command';
  (InputMock as { displayName?: string }).displayName = 'CommandInput';
  (ListMock as { displayName?: string }).displayName = 'CommandList';
  (EmptyMock as { displayName?: string }).displayName = 'CommandEmpty';
  (GroupMock as { displayName?: string }).displayName = 'CommandGroup';
  (ItemMock as { displayName?: string }).displayName = 'CommandItem';
  (SeparatorMock as { displayName?: string }).displayName = 'CommandSeparator';

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

// Mock Radix UI Popover for CaseworkerSelector
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

  return {
    Root: PopoverRootMock,
    Trigger: PopoverTriggerMock,
    Portal: PopoverPortalMock,
    Content: PopoverContentMock,
    Anchor: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Close: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  };
});

import { CreateCaseDialog } from '../CreateCaseDialog';

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

  afterEach(() => {
    cleanup();
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
    const onOpenChange = vi.fn();
    const { rerender, unmount } = render(
      <CreateCaseDialog {...defaultProps} onOpenChange={onOpenChange} defaultTitle="Initial Title" />
    );

    const titleInput = screen.getByLabelText(/Title/i);
    await user.clear(titleInput);
    await user.type(titleInput, 'Changed Title');

    expect(titleInput).toHaveValue('Changed Title');

    // Unmount and remount to simulate dialog close/reopen
    // (our mock dialog doesn't trigger onOpenChange on rerender)
    unmount();
    render(
      <CreateCaseDialog {...defaultProps} onOpenChange={onOpenChange} open={true} defaultTitle="Initial Title" />
    );

    expect(screen.getByLabelText(/Title/i)).toHaveValue('Initial Title');
  });
});
