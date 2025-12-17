import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

// vi.mock must be hoisted - use factory function that returns mocks
vi.mock('./supabase', () => {
  const mockAuth = {
    getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signInWithPassword: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    mfa: {
      listFactors: vi.fn(() => Promise.resolve({ data: { totp: [] }, error: null })),
    },
  }

  const mockFrom = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
      order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null })),
    })),
  }))

  return {
    supabase: {
      auth: mockAuth,
      from: mockFrom,
      rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    },
  }
})

import { useSupabaseData } from './useSupabaseData'
import { supabase } from './supabase'

// Get typed references to the mocked functions
const mockedSupabase = vi.mocked(supabase)

describe('useSupabaseData hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should initialize with null user when not authenticated', async () => {
      const { result } = renderHook(() => useSupabaseData())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.user).toBeNull()
      expect(result.current.profile).toBeNull()
    })

    it('should initialize with empty data arrays', async () => {
      const { result } = renderHook(() => useSupabaseData())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.offices).toEqual([])
      expect(result.current.cases).toEqual([])
      expect(result.current.messages).toEqual([])
      expect(result.current.tags).toEqual([])
    })

    it('should initialize MFA state correctly', async () => {
      const { result } = renderHook(() => useSupabaseData())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.requiresMfa).toBe(false)
      expect(result.current.mfaVerified).toBe(false)
    })

    it('should initialize office mode as casework', async () => {
      const { result } = renderHook(() => useSupabaseData())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.currentOfficeMode).toBe('casework')
    })
  })

  describe('signIn', () => {
    it('should call supabase signInWithPassword with credentials', async () => {
      const { result } = renderHook(() => useSupabaseData())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.signIn('test@example.com', 'password123')
      })

      expect(mockedSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
    })

    it('should throw error on authentication failure', async () => {
      const authError = new Error('Invalid credentials')
      vi.mocked(mockedSupabase.auth.signInWithPassword).mockResolvedValueOnce({
        data: { user: null, session: null },
        error: authError as never,
      })

      const { result } = renderHook(() => useSupabaseData())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await expect(
        act(async () => {
          await result.current.signIn('test@example.com', 'wrong')
        })
      ).rejects.toThrow('Invalid credentials')
    })

  })

  describe('signOut', () => {
    it('should call supabase signOut', async () => {
      const { result } = renderHook(() => useSupabaseData())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.signOut()
      })

      expect(mockedSupabase.auth.signOut).toHaveBeenCalled()
    })
  })

  describe('helper functions', () => {
    it('getMyOfficeId should return null when no profile', async () => {
      const { result } = renderHook(() => useSupabaseData())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.getMyOfficeId()).toBeNull()
    })

    it('getCurrentUserId should return null when no user', async () => {
      const { result } = renderHook(() => useSupabaseData())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.getCurrentUserId()).toBeNull()
    })

    it('getTagsForEntity should return empty array with no assignments', async () => {
      const { result } = renderHook(() => useSupabaseData())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const tags = result.current.getTagsForEntity('case', 'case-123')
      expect(tags).toEqual([])
    })
  })

  describe('office mode', () => {
    it('should allow changing office mode', async () => {
      const { result } = renderHook(() => useSupabaseData())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      act(() => {
        result.current.setCurrentOfficeMode('westminster')
      })

      expect(result.current.currentOfficeMode).toBe('westminster')
    })

    it('should allow switching back to casework mode', async () => {
      const { result } = renderHook(() => useSupabaseData())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      act(() => {
        result.current.setCurrentOfficeMode('westminster')
      })

      act(() => {
        result.current.setCurrentOfficeMode('casework')
      })

      expect(result.current.currentOfficeMode).toBe('casework')
    })
  })

  describe('currentOffice', () => {
    it('should be null when no profile', async () => {
      const { result } = renderHook(() => useSupabaseData())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.currentOffice).toBeNull()
    })
  })

  describe('supabase client exposure', () => {
    it('should expose the supabase client', async () => {
      const { result } = renderHook(() => useSupabaseData())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.supabase).toBeDefined()
    })
  })
})
