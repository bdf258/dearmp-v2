/**
 * PrioritySelector Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PrioritySelector, PriorityBadge } from '../PrioritySelector';

describe('PrioritySelector', () => {
  it('renders all priority options', () => {
    const onChange = vi.fn();
    render(<PrioritySelector value="medium" onChange={onChange} />);

    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('highlights the selected priority', () => {
    const onChange = vi.fn();
    render(<PrioritySelector value="high" onChange={onChange} />);

    // The "High" button should have the active styling
    const highButton = screen.getByText('High');
    expect(highButton).toHaveClass('bg-orange-100');
  });

  it('calls onChange when a priority is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PrioritySelector value="medium" onChange={onChange} />);

    await user.click(screen.getByText('Urgent'));
    expect(onChange).toHaveBeenCalledWith('urgent');
  });

  it('does not call onChange when disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PrioritySelector value="medium" onChange={onChange} disabled />);

    await user.click(screen.getByText('Urgent'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders label when provided', () => {
    render(<PrioritySelector value="medium" onChange={vi.fn()} label="Case Priority" />);
    expect(screen.getByText('Case Priority')).toBeInTheDocument();
  });

  it('uses small size when specified', () => {
    render(<PrioritySelector value="medium" onChange={vi.fn()} size="sm" />);
    expect(screen.getByText('L')).toBeInTheDocument(); // Short label for Low
    expect(screen.getByText('M')).toBeInTheDocument(); // Short label for Medium
  });
});

describe('PriorityBadge', () => {
  it('renders the priority label', () => {
    render(<PriorityBadge priority="high" />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('returns null when priority is null', () => {
    const { container } = render(<PriorityBadge priority={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('applies correct color classes for each priority', () => {
    const { rerender } = render(<PriorityBadge priority="low" />);
    expect(screen.getByText('Low')).toHaveClass('bg-green-100');

    rerender(<PriorityBadge priority="medium" />);
    expect(screen.getByText('Medium')).toHaveClass('bg-yellow-100');

    rerender(<PriorityBadge priority="high" />);
    expect(screen.getByText('High')).toHaveClass('bg-orange-100');

    rerender(<PriorityBadge priority="urgent" />);
    expect(screen.getByText('Urgent')).toHaveClass('bg-red-100');
  });
});
