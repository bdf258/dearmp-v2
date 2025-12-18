/**
 * RequestAddressDialog Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RequestAddressDialog } from '../RequestAddressDialog';

describe('RequestAddressDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    recipientName: 'John Smith',
    recipientEmail: 'john@example.com',
    originalSubject: 'Housing Query',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with correct title', () => {
    render(<RequestAddressDialog {...defaultProps} />);
    expect(screen.getByText('Request Postal Address')).toBeInTheDocument();
  });

  it('shows recipient information', () => {
    render(<RequestAddressDialog {...defaultProps} />);
    expect(screen.getByText(/John Smith/)).toBeInTheDocument();
    expect(screen.getByText(/john@example.com/)).toBeInTheDocument();
  });

  it('prepopulates subject with Re: prefix', () => {
    render(<RequestAddressDialog {...defaultProps} />);
    const subjectInput = screen.getByDisplayValue('Re: Housing Query');
    expect(subjectInput).toBeInTheDocument();
  });

  it('includes template message with recipient name', () => {
    render(<RequestAddressDialog {...defaultProps} />);
    expect(screen.getByDisplayValue(/Dear John Smith/)).toBeInTheDocument();
  });

  it('allows editing the message', async () => {
    const user = userEvent.setup();
    render(<RequestAddressDialog {...defaultProps} />);

    const textarea = screen.getByRole('textbox', { name: /message/i });
    await user.clear(textarea);
    await user.type(textarea, 'Custom message');

    expect(textarea).toHaveValue('Custom message');
  });

  it('allows editing the subject', async () => {
    const user = userEvent.setup();
    render(<RequestAddressDialog {...defaultProps} />);

    const subjectInput = screen.getByDisplayValue('Re: Housing Query');
    await user.clear(subjectInput);
    await user.type(subjectInput, 'New Subject');

    expect(subjectInput).toHaveValue('New Subject');
  });

  it('calls onOpenChange when cancel is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<RequestAddressDialog {...defaultProps} onOpenChange={onOpenChange} />);

    await user.click(screen.getByText('Cancel'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onSend with correct data when send is clicked', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue({ success: true });
    render(<RequestAddressDialog {...defaultProps} onSend={onSend} />);

    await user.click(screen.getByText('Send Request'));

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith({
        to: 'john@example.com',
        subject: 'Re: Housing Query',
        body: expect.stringContaining('Dear John Smith'),
      });
    });
  });

  it('shows loading state when sending', async () => {
    const user = userEvent.setup();
    // Create a promise that we control
    let resolvePromise: (value: { success: boolean }) => void;
    const sendPromise = new Promise<{ success: boolean }>((resolve) => {
      resolvePromise = resolve;
    });
    const onSend = vi.fn().mockReturnValue(sendPromise);

    render(<RequestAddressDialog {...defaultProps} onSend={onSend} />);

    await user.click(screen.getByText('Send Request'));

    expect(screen.getByText('Sending...')).toBeInTheDocument();

    // Resolve the promise
    resolvePromise!({ success: true });
  });

  it('disables send button when message is empty', async () => {
    const user = userEvent.setup();
    render(<RequestAddressDialog {...defaultProps} />);

    const textarea = screen.getByRole('textbox', { name: /message/i });
    await user.clear(textarea);

    const sendButton = screen.getByText('Send Request');
    expect(sendButton.closest('button')).toBeDisabled();
  });

  it('closes dialog on successful send', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSend = vi.fn().mockResolvedValue({ success: true });

    render(
      <RequestAddressDialog
        {...defaultProps}
        onOpenChange={onOpenChange}
        onSend={onSend}
      />
    );

    await user.click(screen.getByText('Send Request'));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('uses custom MP name and constituency in template', () => {
    render(
      <RequestAddressDialog
        {...defaultProps}
        mpName="Jane Doe"
        constituency="North District"
      />
    );

    const textarea = screen.getByRole('textbox', { name: /message/i });
    expect(textarea).toHaveValue(expect.stringContaining('Jane Doe'));
    expect(textarea).toHaveValue(expect.stringContaining('North District'));
  });
});
