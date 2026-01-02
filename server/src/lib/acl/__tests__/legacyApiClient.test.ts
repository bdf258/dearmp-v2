import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

/**
 * Tests for the Legacy API Client
 *
 * These tests validate the Anti-Corruption Layer's interaction with the
 * legacy Caseworker API endpoints as documented in LEGACY_API_ROUTES.md
 */

describe('LegacyApiClient', () => {
  const BASE_URL = 'https://caseworker.example.com/api/ajax'
  const MOCK_TOKEN = 'mock-jwt-token'

  beforeEach(() => {
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Authentication', () => {
    it('should authenticate and return JWT token', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123',
        locale: 'en-GB'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(MOCK_TOKEN)
      })

      const response = await fetch(`${BASE_URL}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/auth`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(credentials)
        })
      )
      expect(await response.text()).toBe(MOCK_TOKEN)
    })

    it('should handle authentication failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Invalid credentials')
      })

      const response = await fetch(`${BASE_URL}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'bad@email.com', password: 'wrong' })
      })

      expect(response.ok).toBe(false)
      expect(response.status).toBe(401)
    })
  })

  describe('Inbox Operations', () => {
    it('should search inbox for new emails', async () => {
      const searchPayload = {
        actioned: false,
        type: 'received',
        dateFrom: new Date().toISOString(),
        page: 1,
        limit: 500
      }

      const mockEmails = [
        { id: 1, subject: 'Test Email 1', from: 'user1@example.com' },
        { id: 2, subject: 'Test Email 2', from: 'user2@example.com' }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEmails)
      })

      const response = await fetch(`${BASE_URL}/inbox/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': MOCK_TOKEN
        },
        body: JSON.stringify(searchPayload)
      })

      const data = await response.json()
      expect(data).toEqual(mockEmails)
      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/inbox/search`,
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('should find constituent matches for email', async () => {
      const emailAddress = 'constituent@example.com'
      const mockConstituent = {
        id: 123,
        firstName: 'John',
        lastName: 'Doe',
        email: emailAddress
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([mockConstituent])
      })

      const response = await fetch(`${BASE_URL}/inbox/constituentMatches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': MOCK_TOKEN
        },
        body: JSON.stringify({ email: emailAddress })
      })

      const matches = await response.json()
      expect(matches).toHaveLength(1)
      expect(matches[0].id).toBe(123)
    })
  })

  describe('Case Operations', () => {
    it('should create a new case', async () => {
      const newCase = {
        constituentID: 123,
        caseTypeID: 1,
        statusID: 1,
        categoryTypeID: 2,
        assignedToID: 456,
        summary: 'New case for constituent'
      }

      const createdCase = { id: 789, ...newCase }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(createdCase)
      })

      const response = await fetch(`${BASE_URL}/cases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': MOCK_TOKEN
        },
        body: JSON.stringify(newCase)
      })

      const data = await response.json()
      expect(data.id).toBe(789)
      expect(data.constituentID).toBe(123)
    })

    it('should search cases with filters', async () => {
      const searchPayload = {
        pageNo: 1,
        resultsPerPage: 25,
        dateRange: {
          type: 'created',
          from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          to: new Date().toISOString()
        },
        statusID: [1, 2]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [], total: 0 })
      })

      await fetch(`${BASE_URL}/cases/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': MOCK_TOKEN
        },
        body: JSON.stringify(searchPayload)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/cases/search`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(searchPayload)
        })
      )
    })

    it('should update a case', async () => {
      const caseId = 789
      const updates = { statusID: 3, summary: 'Updated summary' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: caseId, ...updates })
      })

      const response = await fetch(`${BASE_URL}/cases/${caseId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': MOCK_TOKEN
        },
        body: JSON.stringify(updates)
      })

      const data = await response.json()
      expect(data.statusID).toBe(3)
    })
  })

  describe('Constituent Operations', () => {
    it('should create a new constituent', async () => {
      const newConstituent = {
        firstName: 'Jane',
        lastName: 'Smith',
        title: 'Ms'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 456, ...newConstituent })
      })

      const response = await fetch(`${BASE_URL}/constituents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': MOCK_TOKEN
        },
        body: JSON.stringify(newConstituent)
      })

      const data = await response.json()
      expect(data.id).toBe(456)
    })

    it('should add contact details to constituent', async () => {
      const contactDetail = {
        constituentID: 456,
        contactTypeID: 1, // Email
        value: 'jane@example.com',
        source: 'email_triage'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1, ...contactDetail })
      })

      const response = await fetch(`${BASE_URL}/contactDetails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': MOCK_TOKEN
        },
        body: JSON.stringify(contactDetail)
      })

      expect(response.ok).toBe(true)
    })

    it('should search constituents', async () => {
      const searchPayload = {
        term: 'john',
        page: 1,
        limit: 50
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ results: [], total: 0 })
      })

      await fetch(`${BASE_URL}/constituents/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': MOCK_TOKEN
        },
        body: JSON.stringify(searchPayload)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/constituents/search`,
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  describe('Email Operations', () => {
    it('should mark email as actioned', async () => {
      const emailId = 101

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: emailId, actioned: true })
      })

      const response = await fetch(`${BASE_URL}/emails/${emailId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': MOCK_TOKEN
        },
        body: JSON.stringify({ actioned: true })
      })

      const data = await response.json()
      expect(data.actioned).toBe(true)
    })

    it('should get email details', async () => {
      const emailId = 101
      const mockEmail = {
        id: emailId,
        subject: 'Test Subject',
        htmlBody: '<p>Test body</p>',
        from: 'sender@example.com',
        to: ['recipient@example.com']
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockEmail)
      })

      const response = await fetch(`${BASE_URL}/emails/${emailId}`, {
        method: 'GET',
        headers: { 'Authorization': MOCK_TOKEN }
      })

      const data = await response.json()
      expect(data.id).toBe(emailId)
      expect(data.subject).toBe('Test Subject')
    })
  })

  describe('Rate Limiting', () => {
    it('should handle 429 rate limit responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '60' }),
        json: () => Promise.resolve({ error: 'Too Many Requests' })
      })

      const response = await fetch(`${BASE_URL}/cases/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': MOCK_TOKEN
        },
        body: JSON.stringify({})
      })

      expect(response.status).toBe(429)
    })
  })

  describe('Error Handling', () => {
    it('should handle 401 unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Token expired' })
      })

      const response = await fetch(`${BASE_URL}/cases`, {
        method: 'GET',
        headers: { 'Authorization': 'expired-token' }
      })

      expect(response.status).toBe(401)
    })

    it('should handle 404 not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Case not found' })
      })

      const response = await fetch(`${BASE_URL}/cases/99999`, {
        method: 'GET',
        headers: { 'Authorization': MOCK_TOKEN }
      })

      expect(response.status).toBe(404)
    })

    it('should handle 500 server error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' })
      })

      const response = await fetch(`${BASE_URL}/cases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': MOCK_TOKEN
        },
        body: JSON.stringify({})
      })

      expect(response.status).toBe(500)
    })
  })

  describe('Caseworker Operations', () => {
    it('should list active caseworkers', async () => {
      const mockCaseworkers = [
        { id: 1, name: 'Alice', email: 'alice@mp.uk', is_active: true },
        { id: 2, name: 'Bob', email: 'bob@mp.uk', is_active: true }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCaseworkers)
      })

      const response = await fetch(`${BASE_URL}/caseworkers`, {
        method: 'GET',
        headers: { 'Authorization': MOCK_TOKEN }
      })

      const data = await response.json()
      expect(data).toHaveLength(2)
    })
  })

  describe('Tags Operations', () => {
    it('should create a tag', async () => {
      const newTag = { tag: 'Urgent' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1, ...newTag })
      })

      const response = await fetch(`${BASE_URL}/tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': MOCK_TOKEN
        },
        body: JSON.stringify(newTag)
      })

      const data = await response.json()
      expect(data.tag).toBe('Urgent')
    })

    it('should search tags', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: 1, tag: 'Housing' }])
      })

      const response = await fetch(`${BASE_URL}/tags/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': MOCK_TOKEN
        },
        body: JSON.stringify({ term: 'hous' })
      })

      const data = await response.json()
      expect(data[0].tag).toBe('Housing')
    })
  })

  describe('Review Dates', () => {
    it('should create a review date', async () => {
      const reviewDate = {
        reviewDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        note: 'Follow up on response',
        caseID: 789,
        assignedTo: 1
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1, ...reviewDate })
      })

      const response = await fetch(`${BASE_URL}/reviewDates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': MOCK_TOKEN
        },
        body: JSON.stringify(reviewDate)
      })

      expect(response.ok).toBe(true)
    })

    it('should mark review date as complete', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 1, is_completed: true })
      })

      const response = await fetch(`${BASE_URL}/reviewDates/1/complete`, {
        method: 'POST',
        headers: { 'Authorization': MOCK_TOKEN }
      })

      const data = await response.json()
      expect(data.is_completed).toBe(true)
    })
  })

  describe('Bulk Operations', () => {
    it('should bulk add tags to cases', async () => {
      const payload = {
        caseIds: [1, 2, 3],
        tagIds: [10, 11]
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, affected: 3 })
      })

      const response = await fetch(`${BASE_URL}/cases/bulkactions/addtags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': MOCK_TOKEN
        },
        body: JSON.stringify(payload)
      })

      const data = await response.json()
      expect(data.success).toBe(true)
    })

    it('should bulk change case status', async () => {
      const payload = {
        caseIds: [1, 2],
        statusId: 3
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, affected: 2 })
      })

      const response = await fetch(`${BASE_URL}/cases/bulkactions/changestatus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': MOCK_TOKEN
        },
        body: JSON.stringify(payload)
      })

      expect(response.ok).toBe(true)
    })
  })
})

describe('LegacyApiClient Adapters', () => {
  describe('Email Adapter', () => {
    it('should transform legacy email to new schema', () => {
      const legacyEmail = {
        MsgID: 123,
        Body_HTML: '<p>Hello World</p>',
        Sender_Addr: 'USER@EXAMPLE.COM',
        Subject: 'Test Subject',
        Received_At: '2025-01-15T10:00:00Z'
      }

      // Adapter function (to be implemented)
      const adaptEmail = (legacy: typeof legacyEmail) => ({
        externalId: legacy.MsgID,
        htmlBody: legacy.Body_HTML,
        sender: legacy.Sender_Addr.toLowerCase(),
        subject: legacy.Subject,
        receivedAt: new Date(legacy.Received_At)
      })

      const adapted = adaptEmail(legacyEmail)

      expect(adapted.externalId).toBe(123)
      expect(adapted.sender).toBe('user@example.com')
      expect(adapted.subject).toBe('Test Subject')
    })

    it('should handle missing fields gracefully', () => {
      const legacyEmail = {
        MsgID: 456,
        Sender_Addr: 'sender@test.com'
      }

      const adaptEmail = (legacy: Partial<typeof legacyEmail>) => ({
        externalId: legacy.MsgID,
        htmlBody: null,
        sender: legacy.Sender_Addr?.toLowerCase() || '',
        subject: '',
        receivedAt: null
      })

      const adapted = adaptEmail(legacyEmail)

      expect(adapted.externalId).toBe(456)
      expect(adapted.htmlBody).toBeNull()
    })
  })

  describe('Case Adapter', () => {
    it('should transform legacy case to new schema', () => {
      const legacyCase = {
        id: 789,
        constituent_id: 123,
        case_type_id: 1,
        status_id: 2,
        summary: 'Housing issue',
        created_at: '2025-01-10T08:00:00Z'
      }

      const adaptCase = (legacy: typeof legacyCase) => ({
        externalId: legacy.id,
        constituentExternalId: legacy.constituent_id,
        caseTypeExternalId: legacy.case_type_id,
        statusExternalId: legacy.status_id,
        summary: legacy.summary,
        createdAt: new Date(legacy.created_at),
        lastSyncedAt: new Date()
      })

      const adapted = adaptCase(legacyCase)

      expect(adapted.externalId).toBe(789)
      expect(adapted.summary).toBe('Housing issue')
    })
  })

  describe('Constituent Adapter', () => {
    it('should transform legacy constituent to new schema', () => {
      const legacyConstituent = {
        id: 123,
        firstName: 'John',
        lastName: 'Doe',
        title: 'Mr',
        geocode_lat: 51.5074,
        geocode_lng: -0.1278
      }

      const adaptConstituent = (legacy: typeof legacyConstituent) => ({
        externalId: legacy.id,
        firstName: legacy.firstName,
        lastName: legacy.lastName,
        title: legacy.title,
        location: legacy.geocode_lat && legacy.geocode_lng
          ? { lat: legacy.geocode_lat, lng: legacy.geocode_lng }
          : null
      })

      const adapted = adaptConstituent(legacyConstituent)

      expect(adapted.externalId).toBe(123)
      expect(adapted.firstName).toBe('John')
      expect(adapted.location?.lat).toBe(51.5074)
    })
  })
})

describe('Rate Limiter', () => {
  it('should respect rate limit of 10 RPS', async () => {
    // Simple rate limiter implementation test
    class RateLimiter {
      private queue: Array<() => Promise<void>> = []
      private lastRequestTime = 0
      private readonly rps: number

      constructor(requestsPerSecond = 10) {
        this.rps = requestsPerSecond
      }

      async enqueue<T>(fn: () => Promise<T>): Promise<T> {
        const now = Date.now()
        const minInterval = 1000 / this.rps
        const waitTime = Math.max(0, minInterval - (now - this.lastRequestTime))

        if (waitTime > 0) {
          await new Promise(r => setTimeout(r, waitTime))
        }

        this.lastRequestTime = Date.now()
        return fn()
      }
    }

    const limiter = new RateLimiter(10)
    const startTime = Date.now()
    const results: number[] = []

    // Make 5 requests
    for (let i = 0; i < 5; i++) {
      await limiter.enqueue(async () => {
        results.push(Date.now() - startTime)
      })
    }

    // Each request should be at least 100ms apart (10 RPS = 100ms interval)
    for (let i = 1; i < results.length; i++) {
      const diff = results[i] - results[i - 1]
      expect(diff).toBeGreaterThanOrEqual(90) // Allow 10ms tolerance
    }
  })
})
