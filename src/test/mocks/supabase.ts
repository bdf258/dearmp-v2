import { vi } from 'vitest'

// Types for mock responses
type MockQueryBuilder = {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
}

// Create a chainable mock query builder
export function createMockQueryBuilder(data: unknown = null, error: unknown = null): MockQueryBuilder {
  const mockBuilder: MockQueryBuilder = {
    select: vi.fn(() => mockBuilder),
    insert: vi.fn(() => mockBuilder),
    update: vi.fn(() => mockBuilder),
    delete: vi.fn(() => mockBuilder),
    eq: vi.fn(() => mockBuilder),
    single: vi.fn(() => Promise.resolve({ data, error })),
    order: vi.fn(() => mockBuilder),
  }
  return mockBuilder
}

// Mock Supabase auth
export const mockAuth = {
  getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
  signInWithPassword: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
  signOut: vi.fn(() => Promise.resolve({ error: null })),
  onAuthStateChange: vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
  mfa: {
    listFactors: vi.fn(() => Promise.resolve({ data: { totp: [] }, error: null })),
    challenge: vi.fn(() => Promise.resolve({ data: { id: 'challenge-id' }, error: null })),
    verify: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    enroll: vi.fn(() => Promise.resolve({ data: null, error: null })),
    unenroll: vi.fn(() => Promise.resolve({ data: null, error: null })),
  },
}

// Create a mock Supabase client
export function createMockSupabaseClient() {
  return {
    auth: mockAuth,
    from: vi.fn(() => ({
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
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  }
}

// Reset all mocks
export function resetSupabaseMocks() {
  vi.clearAllMocks()
}
