Please rate this plan, bearing in mind you don't have access to the API routes it talks about directly:

Validation of Your Approach
Your understanding is largely correct. Here's the verification:

Your Assumption	API Endpoint	Status
InboxSearch for new emails	POST /inbox/search	✅ Correct
Get recent constituents	POST /constituents/search	✅ Available
Get recent cases	POST /cases/search with dateRange filter	✅ Available
Match emails to constituents	POST /inbox/constituentMatches	✅ Built-in!
PATCH cases	PATCH /cases/{id}	✅ Correct
Create constituent	POST /constituents	✅ Correct
Create case	POST /cases	✅ Correct
Bonus discovery: There's a built-in POST /inbox/bulkActions/createCases that can create cases directly from emails with constituent linking.

Proposed Architecture
Here's an optimal architecture that hides LLM latency behind user interaction time:

┌─────────────────────────────────────────────────────────────────────────────┐
│                           TRIAGE PIPELINE ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │  INITIALIZATION  │
                              │    (Parallel)    │
                              └────────┬─────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              ▼                        ▼                        ▼
    ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
    │ POST /inbox/    │     │ POST /cases/    │     │ POST /constit-  │
    │ search          │     │ search          │     │ uents/search    │
    │ (new emails)    │     │ (24h dateRange) │     │ (24h filter)    │
    └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
             │                       │                       │
             └───────────────────────┴───────────────────────┘
                                     │
                                     ▼
                          ┌─────────────────────┐
                          │   BUILD LOCAL CACHE │
                          │  - constituentMap   │
                          │  - caseMap          │
                          │  - emailQueue       │
                          └──────────┬──────────┘
                                     │
     ┌───────────────────────────────┴───────────────────────────────┐
     │                     PREFETCH PIPELINE (Background)             │
     │  ┌─────────┐   ┌─────────┐   ┌─────────┐        ┌─────────┐   │
     │  │Email[0] │──▶│Email[1] │──▶│Email[2] │──▶ ... │Email[n] │   │
     │  │ + LLM   │   │ + LLM   │   │ + LLM   │        │ + LLM   │   │
     │  └────┬────┘   └────┬────┘   └────┬────┘        └────┬────┘   │
     │       │             │             │                  │        │
     │       ▼             ▼             ▼                  ▼        │
     │  ┌─────────────────────────────────────────────────────────┐  │
     │  │              PREFETCHED TRIAGE QUEUE                    │  │
     │  │  [ {email, suggestion, matchedConstit, matchedCase} ]   │  │
     │  └─────────────────────────────────────────────────────────┘  │
     └───────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
     ┌───────────────────────────────────────────────────────────────┐
     │                     USER TRIAGE FLOW (Foreground)              │
     │                                                                │
     │  ┌──────────────┐     ┌────────────────┐     ┌──────────────┐ │
     │  │ Show Email   │────▶│ User Reviews   │────▶│ User Decides │ │
     │  │ + Suggestion │     │ LLM Suggestion │     │ Accept/Modify│ │
     │  └──────────────┘     └────────────────┘     └──────┬───────┘ │
     │                                                      │        │
     │         While user reviews, prefetch continues ───▶  │        │
     │                                                      │        │
     └──────────────────────────────────────────────────────┼────────┘
                                                            │
                                                            ▼
     ┌───────────────────────────────────────────────────────────────┐
     │                     COMMIT QUEUE (Rate-Limited)                │
     │                                                                │
     │  ┌────────────┐    ┌────────────────────────────────────────┐ │
     │  │ User       │───▶│ Add to Commit Queue                    │ │
     │  │ Confirms   │    │ (debounced, rate-limited to 10 RPS)    │ │
     │  └────────────┘    └────────────────────┬───────────────────┘ │
     │                                         │                     │
     │                    ┌────────────────────┴────────────────┐    │
     │                    ▼                                     ▼    │
     │         ┌─────────────────────┐           ┌─────────────────┐ │
     │         │ Existing Case?      │           │ New Constituent │ │
     │         │ PATCH /cases/{id}   │           │ + New Case      │ │
     │         └─────────────────────┘           └─────────────────┘ │
     │                    │                              │           │
     │                    │    ┌─────────────────────────┘           │
     │                    ▼    ▼                                     │
     │         ┌─────────────────────────────────────────────────┐   │
     │         │  POST /constituents (if new)                    │   │
     │         │  POST /cases (constituentID from above)         │   │
     │         │  PATCH /emails/{id} { actioned: true }          │   │
     │         └─────────────────────────────────────────────────┘   │
     └───────────────────────────────────────────────────────────────┘

Implementation Code Structure
// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface TriageEmail {
  id: number;
  subject: string;
  from: string;
  htmlBody: string;
  to: string[];
  receivedAt: Date;
}

interface TriageSuggestion {
  email: TriageEmail;
  llmAnalysis: {
    summary: string;
    suggestedCaseType: number;
    suggestedCategory: number;
    urgency: 'low' | 'medium' | 'high';
    suggestedResponse?: string;
  };
  matchedConstituent: Constituent | null;
  matchedCase: Case | null;
  status: 'pending' | 'ready' | 'processing' | 'error';
}

interface TriageDecision {
  email: TriageEmail;
  action: 'create_new' | 'add_to_case' | 'ignore';
  constituentId?: number;      // existing constituent
  newConstituent?: NewConstituentData;
  caseId?: number;             // existing case to update
  newCase?: NewCaseData;
  markActioned: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE CLASSES
// ═══════════════════════════════════════════════════════════════════════════

class RateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private readonly rps: number;
  private lastRequestTime = 0;

  constructor(requestsPerSecond = 10) {
    this.rps = requestsPerSecond;
  }

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        const now = Date.now();
        const minInterval = 1000 / this.rps;
        const waitTime = Math.max(0, minInterval - (now - this.lastRequestTime));
        
        if (waitTime > 0) await this.sleep(waitTime);
        
        this.lastRequestTime = Date.now();
        try {
          resolve(await fn());
        } catch (e) {
          reject(e);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      await task();
    }
    this.processing = false;
  }

  private sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }
}

class TriagePipeline {
  private rateLimiter = new RateLimiter(10);
  private prefetchQueue: TriageSuggestion[] = [];
  private commitQueue: TriageDecision[] = [];
  private constituentCache: Map<string, Constituent> = new Map();
  private caseCache: Map<number, Case> = new Map();
  private prefetchIndex = 0;
  private readonly PREFETCH_AHEAD = 3; // Pre-process 3 emails ahead

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZATION
  // ─────────────────────────────────────────────────────────────────────────

  async initialize(): Promise<{ emailCount: number }> {
    // Run all three queries in parallel
    const [emails, recentCases, recentConstituents] = await Promise.all([
      this.fetchNewEmails(),
      this.fetchRecentCases(),
      this.fetchRecentConstituents(),
    ]);

    // Build local caches for fast matching
    this.buildCaches(recentConstituents, recentCases);
    
    // Initialize prefetch queue with emails
    this.prefetchQueue = emails.map(email => ({
      email,
      llmAnalysis: null!,
      matchedConstituent: null,
      matchedCase: null,
      status: 'pending' as const,
    }));

    // Start prefetching first N emails
    this.startPrefetching();

    return { emailCount: emails.length };
  }

  private async fetchNewEmails(): Promise<TriageEmail[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return this.rateLimiter.enqueue(() =>
      fetch('/api/ajax/inbox/search', {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          actioned: false,
          type: 'received',
          dateFrom: today.toISOString(),
          page: 1,
          limit: 500, // Adjust as needed
        }),
      }).then(r => r.json())
    );
  }

  private async fetchRecentCases(): Promise<Case[]> {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return this.rateLimiter.enqueue(() =>
      fetch('/api/ajax/cases/search', {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          dateRange: {
            type: 'created',
            from: yesterday.toISOString(),
            to: new Date().toISOString(),
          },
          pageNo: 1,
          resultsPerPage: 500,
        }),
      }).then(r => r.json())
    );
  }

  private async fetchRecentConstituents(): Promise<Constituent[]> {
    return this.rateLimiter.enqueue(() =>
      fetch('/api/ajax/constituents/search', {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          createdAfter: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          page: 1,
          limit: 500,
        }),
      }).then(r => r.json())
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PREFETCHING (Background processing hidden behind user time)
  // ─────────────────────────────────────────────────────────────────────────

  private async startPrefetching() {
    // Process first PREFETCH_AHEAD emails immediately
    for (let i = 0; i < Math.min(this.PREFETCH_AHEAD, this.prefetchQueue.length); i++) {
      this.processSingleEmail(i);
    }
  }

  private async processSingleEmail(index: number) {
    const item = this.prefetchQueue[index];
    if (!item || item.status !== 'pending') return;

    item.status = 'processing';

    try {
      // 1. Find constituent matches (API call)
      const constituentMatch = await this.findConstituentMatch(item.email);
      item.matchedConstituent = constituentMatch;

      // 2. If constituent found, check for existing cases
      if (constituentMatch) {
        item.matchedCase = this.findMatchingCase(constituentMatch.id, item.email);
      }

      // 3. Run LLM analysis (can be parallelized with above)
      item.llmAnalysis = await this.runLLMAnalysis(item.email, constituentMatch);

      item.status = 'ready';
    } catch (error) {
      item.status = 'error';
      console.error(`Failed to process email ${item.email.id}:`, error);
    }
  }

  private async findConstituentMatch(email: TriageEmail): Promise<Constituent | null> {
    // First check local cache (by email address)
    const cached = this.constituentCache.get(email.from.toLowerCase());
    if (cached) return cached;

    // If not in cache, query the API
    return this.rateLimiter.enqueue(() =>
      fetch('/api/ajax/inbox/constituentMatches', {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          email: email.from,
          // Could also parse name from email headers
        }),
      }).then(r => r.json()).then(matches => matches[0] || null)
    );
  }

  private async runLLMAnalysis(email: TriageEmail, constituent: Constituent | null) {
    // Your LLM call here - this is where the latency is hidden
    // The user is reviewing the previous email while this runs
    return {
      summary: "...",
      suggestedCaseType: 1,
      suggestedCategory: 1,
      urgency: 'medium' as const,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // USER INTERACTION
  // ─────────────────────────────────────────────────────────────────────────

  async getNextEmailForTriage(): Promise<TriageSuggestion | null> {
    const current = this.prefetchQueue[this.prefetchIndex];
    if (!current) return null;

    // Wait for current to be ready if still processing
    while (current.status === 'pending' || current.status === 'processing') {
      await new Promise(r => setTimeout(r, 100));
    }

    // Trigger prefetch of next emails
    this.prefetchAhead();

    return current;
  }

  private prefetchAhead() {
    // Start processing next PREFETCH_AHEAD emails
    for (let i = 1; i <= this.PREFETCH_AHEAD; i++) {
      const nextIndex = this.prefetchIndex + i;
      if (nextIndex < this.prefetchQueue.length) {
        const item = this.prefetchQueue[nextIndex];
        if (item.status === 'pending') {
          this.processSingleEmail(nextIndex);
        }
      }
    }
  }

  async submitTriageDecision(decision: TriageDecision) {
    this.commitQueue.push(decision);
    this.prefetchIndex++;
    
    // Process commit queue in background
    this.processCommitQueue();
    
    // Return next email immediately
    return this.getNextEmailForTriage();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COMMIT QUEUE (Rate-limited writes)
  // ─────────────────────────────────────────────────────────────────────────

  private async processCommitQueue() {
    while (this.commitQueue.length > 0) {
      const decision = this.commitQueue.shift()!;
      await this.executeDecision(decision);
    }
  }

  private async executeDecision(decision: TriageDecision) {
    switch (decision.action) {
      case 'create_new':
        await this.createNewConstituentAndCase(decision);
        break;
      case 'add_to_case':
        await this.updateExistingCase(decision);
        break;
      case 'ignore':
        // Just mark as actioned
        break;
    }

    // Always mark email as actioned
    if (decision.markActioned) {
      await this.markEmailActioned(decision.email.id);
    }
  }

  private async createNewConstituentAndCase(decision: TriageDecision) {
    let constituentId = decision.constituentId;

    // Create constituent if needed
    if (decision.newConstituent) {
      const constituent = await this.rateLimiter.enqueue(() =>
        fetch('/api/ajax/constituents', {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify(decision.newConstituent),
        }).then(r => r.json())
      );
      constituentId = constituent.id;

      // Add contact details
      await this.rateLimiter.enqueue(() =>
        fetch('/api/ajax/contactDetails', {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({
            constituentID: constituentId,
            contactTypeID: 1, // Email type
            value: decision.email.from,
            source: 'email_triage',
          }),
        })
      );
    }

    // Create case
    if (decision.newCase && constituentId) {
      await this.rateLimiter.enqueue(() =>
        fetch('/api/ajax/cases', {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({
            ...decision.newCase,
            constituentID: constituentId,
          }),
        })
      );
    }
  }

  private async updateExistingCase(decision: TriageDecision) {
    if (!decision.caseId) return;

    await this.rateLimiter.enqueue(() =>
      fetch(`/api/ajax/cases/${decision.caseId}`, {
        method: 'PATCH',
        headers: this.headers(),
        body: JSON.stringify(decision.newCase),
      })
    );
  }

  private async markEmailActioned(emailId: number) {
    await this.rateLimiter.enqueue(() =>
      fetch(`/api/ajax/emails/${emailId}`, {
        method: 'PATCH',
        headers: this.headers(),
        body: JSON.stringify({ actioned: true }),
      })
    );
  }

  private headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': localStorage.getItem('token') || '',
    };
  }

  private buildCaches(constituents: Constituent[], cases: Case[]) {
    // Index constituents by email for fast lookup
    constituents.forEach(c => {
      c.contactDetails?.forEach(cd => {
        if (cd.type === 'email') {
          this.constituentCache.set(cd.value.toLowerCase(), c);
        }
      });
    });

    // Index cases by constituent ID
    cases.forEach(c => this.caseCache.set(c.id, c));
  }

  private findMatchingCase(constituentId: number, email: TriageEmail): Case | null {
    // Find open cases for this constituent
    for (const [, caseItem] of this.caseCache) {
      if (caseItem.constituentId === constituentId && caseItem.status !== 'closed') {
        return caseItem;
      }
    }
    return null;
  }
}

Key Optimizations
Optimization	Implementation
Rate Limiting	RateLimiter class with token bucket at 10 RPS
Prefetching	Process 3 emails ahead while user reviews current
Parallel Init	Promise.all() for emails, cases, constituents
Local Caching	In-memory maps for recent constituents/cases
Hidden LLM Latency	LLM runs in background during user review time
Background Commits	Writes queued and processed asynchronously
API Sequence Diagram
TIME ──────────────────────────────────────────────────────────────────────▶

INIT PHASE (Parallel):
├─ POST /inbox/search ──────────────┐
├─ POST /cases/search ──────────────┼──▶ Build Caches
└─ POST /constituents/search ───────┘

PREFETCH (Background):
├─ POST /inbox/constituentMatches (email[0]) ─┐
├─ LLM Analysis (email[0]) ──────────────────┼──▶ Ready[0]
├─ POST /inbox/constituentMatches (email[1]) ─┼──▶ Ready[1]  (while user reviews)
└─ LLM Analysis (email[1]) ──────────────────┘

USER TRIAGE:
├─ [User reviews email[0]] ◀─── LLM already done!
├─ [User decides] ──────────────────────────────▶ Queue commit
│                                                  │
│  MEANWHILE: Prefetch email[2], email[3]...       │
│                                                  ▼
COMMIT QUEUE (Rate-limited):
├─ POST /constituents (if new) ────┐
├─ POST /cases ────────────────────┼──▶ 10 RPS max
└─ PATCH /emails/{id} actioned ────┘

Recommendation
Your approach is sound. The main refinements I'd suggest:

Use POST /inbox/constituentMatches instead of manually searching - it's purpose-built for this
Consider POST /inbox/bulkActions/createCases for batch creation if user approves multiple at once
Prefetch 3-5 emails ahead to hide typical LLM latency (2-5 seconds)
Use local caches for recent entities to reduce API calls
Queue commits separately from the UI flow to avoid blocking
Would you like me to implement this as a concrete module in your codebase?

