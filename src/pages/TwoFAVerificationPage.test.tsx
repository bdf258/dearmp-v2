import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TwoFAVerificationPage from './TwoFAVerificationPage'

// Mock the SupabaseContext
const mockMfaListFactors = vi.fn()
const mockMfaChallenge = vi.fn()
const mockMfaVerify = vi.fn()
const mockSignOut = vi.fn()

vi.mock('@/lib/SupabaseContext', () => ({
  useSupabase: () => ({
    supabase: {
      auth: {
        mfa: {
          listFactors: mockMfaListFactors,
          challenge: mockMfaChallenge,
          verify: mockMfaVerify,
        },
        signOut: mockSignOut,
      },
    },
  }),
}))

describe('TwoFAVerificationPage', () => {
  const mockOnVerified = vi.fn()
  const mockOnSignOut = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockMfaListFactors.mockResolvedValue({
      data: {
        totp: [{ id: 'factor-123', status: 'verified' }],
      },
      error: null,
    })
  })

  describe('rendering', () => {
    it('should render the 2FA verification heading', async () => {
      render(
        <TwoFAVerificationPage
          onVerified={mockOnVerified}
          onSignOut={mockOnSignOut}
        />
      )

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { name: /two-factor authentication/i })
        ).toBeInTheDocument()
      })
    })

    it('should render description text', async () => {
      render(
        <TwoFAVerificationPage
          onVerified={mockOnVerified}
          onSignOut={mockOnSignOut}
        />
      )

      await waitFor(() => {
        expect(
          screen.getByText(/enter the 6-digit code/i)
        ).toBeInTheDocument()
      })
    })

    it('should render the verification code input', async () => {
      render(
        <TwoFAVerificationPage
          onVerified={mockOnVerified}
          onSignOut={mockOnSignOut}
        />
      )

      await waitFor(() => {
        const codeInput = screen.getByLabelText(/verification code/i)
        expect(codeInput).toBeInTheDocument()
      })
    })

    it('should have a verify button', async () => {
      render(
        <TwoFAVerificationPage
          onVerified={mockOnVerified}
          onSignOut={mockOnSignOut}
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /verify/i })).toBeInTheDocument()
      })
    })

    it('should have a sign out button', async () => {
      render(
        <TwoFAVerificationPage
          onVerified={mockOnVerified}
          onSignOut={mockOnSignOut}
        />
      )

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /sign out/i })
        ).toBeInTheDocument()
      })
    })

    it('should show helpful hint about authenticator app', async () => {
      render(
        <TwoFAVerificationPage
          onVerified={mockOnVerified}
          onSignOut={mockOnSignOut}
        />
      )

      await waitFor(() => {
        expect(
          screen.getByText(/open your authenticator app/i)
        ).toBeInTheDocument()
      })
    })

    it('should show troubleshooting message', async () => {
      render(
        <TwoFAVerificationPage
          onVerified={mockOnVerified}
          onSignOut={mockOnSignOut}
        />
      )

      await waitFor(() => {
        expect(
          screen.getByText(/having trouble\?/i)
        ).toBeInTheDocument()
      })
    })
  })

  describe('input behavior', () => {
    it('should have numeric inputMode', async () => {
      render(
        <TwoFAVerificationPage
          onVerified={mockOnVerified}
          onSignOut={mockOnSignOut}
        />
      )

      await waitFor(() => {
        const codeInput = screen.getByLabelText(/verification code/i)
        expect(codeInput).toHaveAttribute('inputMode', 'numeric')
      })
    })

    it('should have maxLength of 6', async () => {
      render(
        <TwoFAVerificationPage
          onVerified={mockOnVerified}
          onSignOut={mockOnSignOut}
        />
      )

      await waitFor(() => {
        const codeInput = screen.getByLabelText(/verification code/i)
        expect(codeInput).toHaveAttribute('maxLength', '6')
      })
    })

    it('should only allow numeric input', async () => {
      const user = userEvent.setup()

      render(
        <TwoFAVerificationPage
          onVerified={mockOnVerified}
          onSignOut={mockOnSignOut}
        />
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument()
      })

      const codeInput = screen.getByLabelText(/verification code/i)
      await user.type(codeInput, 'abc123def456')

      expect(codeInput).toHaveValue('123456')
    })
  })

  describe('button states', () => {
    it('should disable verify button when code is empty', async () => {
      render(
        <TwoFAVerificationPage
          onVerified={mockOnVerified}
          onSignOut={mockOnSignOut}
        />
      )

      await waitFor(() => {
        const verifyButton = screen.getByRole('button', { name: /verify/i })
        expect(verifyButton).toBeDisabled()
      })
    })

    it('should disable verify button when code is less than 6 digits', async () => {
      const user = userEvent.setup()

      render(
        <TwoFAVerificationPage
          onVerified={mockOnVerified}
          onSignOut={mockOnSignOut}
        />
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument()
      })

      const codeInput = screen.getByLabelText(/verification code/i)
      await user.type(codeInput, '12345')

      const verifyButton = screen.getByRole('button', { name: /verify/i })
      expect(verifyButton).toBeDisabled()
    })

    it('should enable verify button when code has 6 digits', async () => {
      const user = userEvent.setup()

      render(
        <TwoFAVerificationPage
          onVerified={mockOnVerified}
          onSignOut={mockOnSignOut}
        />
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument()
      })

      const codeInput = screen.getByLabelText(/verification code/i)
      await user.type(codeInput, '123456')

      await waitFor(() => {
        const verifyButton = screen.getByRole('button', { name: /verify/i })
        expect(verifyButton).toBeEnabled()
      })
    })
  })

  describe('verification flow', () => {
    it('should call MFA challenge and verify on button click', async () => {
      const user = userEvent.setup()

      mockMfaChallenge.mockResolvedValue({
        data: { id: 'challenge-456' },
        error: null,
      })
      mockMfaVerify.mockResolvedValue({
        data: {},
        error: null,
      })

      render(
        <TwoFAVerificationPage
          onVerified={mockOnVerified}
          onSignOut={mockOnSignOut}
        />
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument()
      })

      const codeInput = screen.getByLabelText(/verification code/i)
      await user.type(codeInput, '123456')

      const verifyButton = screen.getByRole('button', { name: /verify/i })
      await user.click(verifyButton)

      await waitFor(() => {
        expect(mockMfaChallenge).toHaveBeenCalledWith({
          factorId: 'factor-123',
        })
      })

      await waitFor(() => {
        expect(mockMfaVerify).toHaveBeenCalledWith({
          factorId: 'factor-123',
          challengeId: 'challenge-456',
          code: '123456',
        })
      })

      await waitFor(() => {
        expect(mockOnVerified).toHaveBeenCalled()
      })
    })

    it('should display error on invalid code', async () => {
      const user = userEvent.setup()

      mockMfaChallenge.mockResolvedValue({
        data: { id: 'challenge-456' },
        error: null,
      })
      mockMfaVerify.mockRejectedValue(new Error('invalid code'))

      render(
        <TwoFAVerificationPage
          onVerified={mockOnVerified}
          onSignOut={mockOnSignOut}
        />
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument()
      })

      const codeInput = screen.getByLabelText(/verification code/i)
      await user.type(codeInput, '000000')

      const verifyButton = screen.getByRole('button', { name: /verify/i })
      await user.click(verifyButton)

      await waitFor(() => {
        expect(screen.getByText(/invalid code/i)).toBeInTheDocument()
      })
    })

    it('should display error on expired code', async () => {
      const user = userEvent.setup()

      mockMfaChallenge.mockResolvedValue({
        data: { id: 'challenge-456' },
        error: null,
      })
      mockMfaVerify.mockRejectedValue(new Error('code expired'))

      render(
        <TwoFAVerificationPage
          onVerified={mockOnVerified}
          onSignOut={mockOnSignOut}
        />
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument()
      })

      const codeInput = screen.getByLabelText(/verification code/i)
      await user.type(codeInput, '123456')

      const verifyButton = screen.getByRole('button', { name: /verify/i })
      await user.click(verifyButton)

      await waitFor(() => {
        expect(screen.getByText(/expired/i)).toBeInTheDocument()
      })
    })

    it('should clear code field after error', async () => {
      const user = userEvent.setup()

      mockMfaChallenge.mockResolvedValue({
        data: { id: 'challenge-456' },
        error: null,
      })
      mockMfaVerify.mockRejectedValue(new Error('invalid'))

      render(
        <TwoFAVerificationPage
          onVerified={mockOnVerified}
          onSignOut={mockOnSignOut}
        />
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument()
      })

      const codeInput = screen.getByLabelText(/verification code/i)
      await user.type(codeInput, '123456')

      const verifyButton = screen.getByRole('button', { name: /verify/i })
      await user.click(verifyButton)

      await waitFor(() => {
        expect(codeInput).toHaveValue('')
      })
    })
  })

  describe('sign out flow', () => {
    it('should call signOut and onSignOut when sign out button is clicked', async () => {
      const user = userEvent.setup()

      mockSignOut.mockResolvedValue({ error: null })

      render(
        <TwoFAVerificationPage
          onVerified={mockOnVerified}
          onSignOut={mockOnSignOut}
        />
      )

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
      })

      const signOutButton = screen.getByRole('button', { name: /sign out/i })
      await user.click(signOutButton)

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(mockOnSignOut).toHaveBeenCalled()
      })
    })
  })

  describe('error states', () => {
    it('should display error when unable to load MFA factors', async () => {
      mockMfaListFactors.mockResolvedValue({
        data: null,
        error: new Error('Network error'),
      })

      render(
        <TwoFAVerificationPage
          onVerified={mockOnVerified}
          onSignOut={mockOnSignOut}
        />
      )

      await waitFor(() => {
        expect(
          screen.getByText(/unable to load 2fa settings/i)
        ).toBeInTheDocument()
      })
    })

    it('should display challenge error', async () => {
      const user = userEvent.setup()

      mockMfaChallenge.mockRejectedValue(new Error('Challenge failed'))

      render(
        <TwoFAVerificationPage
          onVerified={mockOnVerified}
          onSignOut={mockOnSignOut}
        />
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument()
      })

      const codeInput = screen.getByLabelText(/verification code/i)
      await user.type(codeInput, '123456')

      const verifyButton = screen.getByRole('button', { name: /verify/i })
      await user.click(verifyButton)

      await waitFor(() => {
        expect(screen.getByText(/challenge failed/i)).toBeInTheDocument()
      })
    })
  })

  describe('keyboard interaction', () => {
    it('should verify on enter key when code is complete', async () => {
      const user = userEvent.setup()

      mockMfaChallenge.mockResolvedValue({
        data: { id: 'challenge-456' },
        error: null,
      })
      mockMfaVerify.mockResolvedValue({
        data: {},
        error: null,
      })

      render(
        <TwoFAVerificationPage
          onVerified={mockOnVerified}
          onSignOut={mockOnSignOut}
        />
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument()
      })

      const codeInput = screen.getByLabelText(/verification code/i)
      await user.type(codeInput, '123456')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(mockMfaChallenge).toHaveBeenCalled()
      })
    })

    it('should not verify on enter when code is incomplete', async () => {
      const user = userEvent.setup()

      render(
        <TwoFAVerificationPage
          onVerified={mockOnVerified}
          onSignOut={mockOnSignOut}
        />
      )

      await waitFor(() => {
        expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument()
      })

      const codeInput = screen.getByLabelText(/verification code/i)
      await user.type(codeInput, '123')
      await user.keyboard('{Enter}')

      expect(mockMfaChallenge).not.toHaveBeenCalled()
    })
  })
})
