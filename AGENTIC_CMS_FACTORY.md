# Agentic Case Management System Factory

## Strategy for Rapidly Building Industry-Specific Case Management Systems

**Document Version:** 1.0
**Date:** December 2024
**Classification:** Strategic Architecture

---

## Executive Summary

This document outlines a strategy for using agentic coding tools to rapidly build dozens of industry-specific case management systems. It addresses:

1. **Common Infrastructure vs. Individual Customization** — What to share, what to specialize
2. **Federated Data Sharing** — X-Road integration for cross-system interoperability
3. **Data Act 2025 & GDPR Portability Compliance** — Legal framework for data migration
4. **Shadow Database Migration Tool** — Bookmarklet-based 2-way sync for client migration
5. **LLM Pipeline Architecture** — Separation of analysis and generation concerns

**Key Principle:** Reverse-engineer incumbent systems to understand workflows, but generate new systems from clean specifications—never directly transfer proprietary implementation details.

---

## Table of Contents

1. [Common Infrastructure vs. Individual Systems](#1-common-infrastructure-vs-individual-systems)
2. [Federated Data Sharing via X-Road](#2-federated-data-sharing-via-x-road)
3. [Data Act 2025 & GDPR Portability Compliance](#3-data-act-2025--gdpr-portability-compliance)
4. [Shadow Database Migration Tool](#4-shadow-database-migration-tool)
5. [LLM Pipeline Architecture](#5-llm-pipeline-architecture)
6. [Prompt Pipeline for System Generation](#6-prompt-pipeline-for-system-generation)
7. [Validation Framework](#7-validation-framework)
8. [Implementation Roadmap](#8-implementation-roadmap)

---

## 1. Common Infrastructure vs. Individual Systems

### 1.1 The Platform Layer (Shared)

These components should be built once and reused across all industry verticals:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMMON PLATFORM LAYER                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ Authentication   │  │ Authorization    │  │ Audit Logging    │          │
│  │ ─────────────────│  │ ─────────────────│  │ ─────────────────│          │
│  │ • Keycloak/OIDC  │  │ • RBAC Engine    │  │ • Structured     │          │
│  │ • MFA            │  │ • Row-Level Sec  │  │ • Tamper-proof   │          │
│  │ • Session Mgmt   │  │ • Attribute-Based│  │ • GDPR-ready     │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ X-Road Adapter   │  │ Migration Engine │  │ Notification     │          │
│  │ ─────────────────│  │ ─────────────────│  │ ─────────────────│          │
│  │ • Security Server│  │ • Bookmarklet SDK│  │ • Email/SMS      │          │
│  │ • Message Signing│  │ • 2-Way Sync     │  │ • Push           │          │
│  │ • Service Reg    │  │ • Conflict Res   │  │ • In-app         │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ Document Store   │  │ Search Engine    │  │ Reporting        │          │
│  │ ─────────────────│  │ ─────────────────│  │ ─────────────────│          │
│  │ • S3-compatible  │  │ • Full-text      │  │ • Dashboards     │          │
│  │ • Versioning     │  │ • Faceted        │  │ • Export         │          │
│  │ • Encryption     │  │ • Fuzzy matching │  │ • Scheduled      │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ UI Component Lib │  │ Background Jobs  │  │ API Gateway      │          │
│  │ ─────────────────│  │ ─────────────────│  │ ─────────────────│          │
│  │ • Design system  │  │ • pg-boss/BullMQ │  │ • Rate limiting  │          │
│  │ • Form builders  │  │ • Retry logic    │  │ • Versioning     │          │
│  │ • Data tables    │  │ • Dead letter    │  │ • Documentation  │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 The Vertical Layer (Industry-Specific)

These components must be customized for each industry:

| Component | Why Industry-Specific | Example Variations |
|-----------|----------------------|-------------------|
| **Domain Schema** | Each industry has unique entities | Parliamentary: Cases, Constituents, MPs / Healthcare: Patients, Episodes, Providers |
| **Workflow Engine** | Different approval chains, SLAs | Legal: Court dates, filings / Insurance: Claims stages |
| **Compliance Rules** | Sector-specific regulations | Finance: FCA rules / Healthcare: HIPAA/GDPR-H |
| **Integrations** | Vertical-specific external systems | Education: DfE APIs / Housing: Land Registry |
| **Terminology** | Domain language differs | "Constituent" vs "Patient" vs "Claimant" |
| **Reports** | KPIs vary by industry | MP: Response times / Claims: Loss ratios |

### 1.3 Shared vs. Specialized Decision Framework

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SHARE vs. SPECIALIZE DECISION TREE                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Is this component...                                                    │
│                                                                          │
│  ┌─ Security-related? ────────────────────────────────► SHARE           │
│  │   (Auth, encryption, audit)                          (never vary)    │
│  │                                                                       │
│  ├─ Cross-cutting infrastructure? ────────────────────► SHARE           │
│  │   (Logging, queues, storage)                         (configure)     │
│  │                                                                       │
│  ├─ UI pattern without domain logic? ─────────────────► SHARE           │
│  │   (Tables, forms, modals)                            (theme only)    │
│  │                                                                       │
│  ├─ Domain entity or relationship? ───────────────────► SPECIALIZE      │
│  │   (Case types, workflows)                            (generate)      │
│  │                                                                       │
│  ├─ Regulatory requirement? ──────────────────────────► SPECIALIZE      │
│  │   (Compliance rules, retention)                      (configure)     │
│  │                                                                       │
│  └─ External integration? ────────────────────────────► SPECIALIZE      │
│      (3rd party APIs)                                   (adapter)       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.4 Shared Infrastructure Repository Structure

```
cms-platform/
├── packages/
│   ├── core/                     # Shared runtime
│   │   ├── auth/                 # Authentication (Keycloak adapter)
│   │   ├── authz/                # Authorization engine
│   │   ├── audit/                # Audit logging
│   │   ├── federation/           # X-Road adapter
│   │   └── migration/            # Shadow DB sync engine
│   │
│   ├── ui/                       # Component library
│   │   ├── primitives/           # Buttons, inputs, etc.
│   │   ├── patterns/             # Tables, forms, dialogs
│   │   └── layouts/              # Page templates
│   │
│   ├── cli/                      # Generator tooling
│   │   ├── analyze/              # Incumbent analysis tools
│   │   ├── generate/             # Code generation
│   │   └── validate/             # Schema validation
│   │
│   └── types/                    # Shared TypeScript types
│       ├── canonical/            # Cross-system data types
│       ├── federation/           # X-Road message types
│       └── migration/            # Sync protocol types
│
├── verticals/                    # Industry implementations
│   ├── parliamentary/            # DearMP
│   ├── healthcare/               # (future)
│   ├── legal-aid/                # (future)
│   ├── housing/                  # (future)
│   └── ...
│
├── specs/                        # Generated specifications
│   ├── parliamentary.spec.json   # Domain spec for DearMP
│   └── ...
│
└── migrations/                   # Cross-vertical migrations
    └── federation-audit-log.sql  # Shared audit schema
```

---

## 2. Federated Data Sharing via X-Road

### 2.1 Multi-System Federation Architecture

When multiple CMS instances exist across industries, X-Road enables secure data sharing:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FEDERATED CMS ECOSYSTEM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    ┌─────────────┐      ┌─────────────┐      ┌─────────────┐               │
│    │ Parliamentary│      │ Healthcare  │      │ Housing     │               │
│    │ CMS (DearMP) │      │ CMS         │      │ CMS         │               │
│    │              │      │             │      │             │               │
│    │ ┌─────────┐ │      │ ┌─────────┐ │      │ ┌─────────┐ │               │
│    │ │ Domain  │ │      │ │ Domain  │ │      │ │ Domain  │ │               │
│    │ │ Logic   │ │      │ │ Logic   │ │      │ │ Logic   │ │               │
│    │ └────┬────┘ │      │ └────┬────┘ │      │ └────┬────┘ │               │
│    │      │      │      │      │      │      │      │      │               │
│    │ ┌────▼────┐ │      │ ┌────▼────┐ │      │ ┌────▼────┐ │               │
│    │ │Platform │ │      │ │Platform │ │      │ │Platform │ │               │
│    │ │ Layer   │ │      │ │ Layer   │ │      │ │ Layer   │ │               │
│    │ └────┬────┘ │      │ └────┬────┘ │      │ └────┬────┘ │               │
│    └──────┼──────┘      └──────┼──────┘      └──────┼──────┘               │
│           │                    │                    │                       │
│    ┌──────▼──────┐      ┌──────▼──────┐      ┌──────▼──────┐               │
│    │ X-Road      │      │ X-Road      │      │ X-Road      │               │
│    │ Security    │◄────►│ Security    │◄────►│ Security    │               │
│    │ Server      │      │ Server      │      │ Server      │               │
│    └──────┬──────┘      └──────┬──────┘      └──────┬──────┘               │
│           │                    │                    │                       │
│           └────────────────────┼────────────────────┘                       │
│                                │                                            │
│                    ┌───────────▼───────────┐                                │
│                    │   X-Road Central      │                                │
│                    │   ─────────────────── │                                │
│                    │   • Trust Services    │                                │
│                    │   • Service Registry  │                                │
│                    │   • Config Management │                                │
│                    └───────────────────────┘                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Cross-System Query Examples

| Scenario | Source CMS | Target CMS | Data Exchanged |
|----------|-----------|-----------|----------------|
| MP needs NHS records for constituent | Parliamentary | Healthcare | Appointment history, GP registration |
| Housing officer checks benefits status | Housing | Benefits | UC entitlement, payment dates |
| Legal aid verifies income | Legal Aid | HMRC | Tax status, earnings |
| Social worker checks school attendance | Social Services | Education | Attendance records, safeguarding flags |

### 2.3 Shared Canonical Schema

All CMS instances use a common canonical format for cross-system data:

```typescript
// packages/types/canonical/person.ts

/**
 * Canonical person representation for X-Road exchange
 * Each CMS maps its domain model to/from this format
 */
export interface CanonicalPerson {
  // Universal identifiers
  identifiers: {
    scheme: 'nino' | 'nhs-number' | 'uprn' | 'internal';
    value: string;
    verified: boolean;
  }[];

  // Demographics
  names: {
    given: string[];
    family: string;
    use: 'official' | 'nickname' | 'maiden';
  }[];

  dateOfBirth?: string; // ISO 8601

  // Contact
  addresses: CanonicalAddress[];
  telecoms: {
    system: 'phone' | 'email' | 'fax';
    value: string;
    use: 'home' | 'work' | 'mobile';
  }[];
}

/**
 * Canonical case summary for cross-system reference
 * Minimal data to avoid over-sharing
 */
export interface CanonicalCaseReference {
  sourceSystem: string;       // 'parliamentary-cms', 'healthcare-cms'
  caseId: string;
  status: 'open' | 'closed' | 'pending';
  category: string;
  openedDate: string;
  lastActivity: string;

  // Cross-references to other systems
  relatedCases?: {
    system: string;
    caseId: string;
    relationship: 'duplicate' | 'related' | 'supersedes';
  }[];
}
```

---

## 3. Data Act 2025 & GDPR Portability Compliance

### 3.1 Legal Framework Overview

The **EU Data Act 2025** (entering force September 2025) and **GDPR Article 20** (Right to Data Portability) create obligations and opportunities:

| Regulation | Key Provision | Implication for Migration |
|-----------|--------------|---------------------------|
| **GDPR Art. 20** | Right to receive personal data in structured, machine-readable format | Users can request their data from incumbent systems |
| **GDPR Art. 20(2)** | Right to transmit data to another controller "without hindrance" | Incumbent cannot unreasonably block migration |
| **Data Act Art. 4** | Right to access IoT and connected device data | Expands to business data, not just personal |
| **Data Act Art. 6** | Obligation to make data available to third parties | Incumbents must provide APIs or exports |
| **Data Act Art. 8** | Interoperability requirements | Common formats, reasonable terms |

### 3.2 Portability-First Migration Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GDPR PORTABILITY MIGRATION FLOW                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Phase 1: User Exercises Rights                                             │
│  ───────────────────────────────────────────────────────────────────────    │
│                                                                              │
│  ┌─────────────────┐         ┌─────────────────┐                            │
│  │ Client/User     │ ──────► │ Incumbent       │                            │
│  │                 │  GDPR   │ System          │                            │
│  │ "I want my data │  Art.20 │                 │                            │
│  │  in portable    │ Request │ ┌─────────────┐ │                            │
│  │  format"        │         │ │ Export API  │ │                            │
│  └─────────────────┘         │ │ (required)  │ │                            │
│                              │ └──────┬──────┘ │                            │
│                              └────────┼────────┘                            │
│                                       │                                      │
│                                       ▼                                      │
│  Phase 2: Data Export               JSON/CSV                                │
│  ──────────────────                  Export                                 │
│                                       │                                      │
│  Phase 3: Our Shadow DB Ingestion    │                                      │
│  ─────────────────────────────────   │                                      │
│                                       ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Our Migration Engine                                                 │   │
│  │ ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │   │
│  │ │ Parse       │───►│ Transform   │───►│ Load to     │              │   │
│  │ │ Incumbent   │    │ to Our      │    │ Shadow DB   │              │   │
│  │ │ Format      │    │ Schema      │    │             │              │   │
│  │ └─────────────┘    └─────────────┘    └─────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Phase 4: Parallel Operation (Optional)                                     │
│  ─────────────────────────────────────────                                  │
│                                                                              │
│  ┌──────────────┐                           ┌──────────────┐               │
│  │ Incumbent    │◄─── Bookmarklet ─────────►│ Our CMS      │               │
│  │ (read/write) │     2-Way Sync            │ Shadow DB    │               │
│  └──────────────┘                           └──────────────┘               │
│                                                                              │
│  Phase 5: Cutover                                                           │
│  ───────────────                                                            │
│                                                                              │
│  Incumbent ──────────────────────────────────► Our CMS (Primary)            │
│  (deprecated)                                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 GDPR Portability Request Template

```markdown
## Subject Access Request - Data Portability (GDPR Article 20)

To: [Incumbent System Provider]
From: [Client Organization]
Date: [Date]

Under Article 20 of the UK GDPR, I am exercising my right to data portability.

Please provide all personal data concerning our organization that we have provided
to your system, in a structured, commonly used, and machine-readable format.

This includes but is not limited to:
- All case/matter records
- All contact/constituent records
- All correspondence (emails, letters, notes)
- All documents and attachments
- All workflow history and audit logs
- All custom field definitions and values
- All user accounts and role assignments

Preferred formats: JSON, CSV, or documented XML schema
Delivery: Secure download link or encrypted file transfer

We also request, pursuant to Article 20(2), that you transmit this data directly
to our new service provider [Our CMS Name] if technically feasible.

Please respond within 30 days as required by law.
```

### 3.4 Data Act 2025 Compliance Checklist

For incumbents we're migrating FROM:

- [ ] Request data access under Art. 4 (IoT/connected data)
- [ ] Invoke Art. 6 third-party access rights
- [ ] Document any refusal for regulatory complaint
- [ ] Use Art. 8 interoperability provisions if APIs blocked

For our systems as the NEW provider:

- [ ] Implement machine-readable export (JSON/CSV)
- [ ] Provide documented API for data access
- [ ] Support transmission to third parties
- [ ] Maintain format documentation
- [ ] Respond to requests within 30 days

---

## 4. Shadow Database Migration Tool

### 4.1 Bookmarklet-Based 2-Way Sync Architecture

The migration tool runs as a browser bookmarklet, enabling sync without requiring incumbent API access:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BOOKMARKLET SYNC ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  User's Browser                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │ Incumbent System Tab (their webapp)                          │   │   │
│  │  │ ─────────────────────────────────────────────────────────── │   │   │
│  │  │                                                              │   │   │
│  │  │  ┌──────────────────────────────────────────────────────┐  │   │   │
│  │  │  │ INJECTED BOOKMARKLET                                  │  │   │   │
│  │  │  │                                                        │  │   │   │
│  │  │  │  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │  │   │   │
│  │  │  │  │ DOM        │  │ XHR        │  │ LocalStorage   │  │  │   │   │
│  │  │  │  │ Observer   │  │ Interceptor│  │ Bridge         │  │  │   │   │
│  │  │  │  └─────┬──────┘  └─────┬──────┘  └───────┬────────┘  │  │   │   │
│  │  │  │        │               │                 │            │  │   │   │
│  │  │  │        └───────────────┼─────────────────┘            │  │   │   │
│  │  │  │                        ▼                              │  │   │   │
│  │  │  │              ┌─────────────────┐                      │  │   │   │
│  │  │  │              │ Sync Engine     │                      │  │   │   │
│  │  │  │              │ (in bookmarklet)│                      │  │   │   │
│  │  │  │              └────────┬────────┘                      │  │   │   │
│  │  │  │                       │                               │  │   │   │
│  │  │  └───────────────────────┼───────────────────────────────┘  │   │   │
│  │  │                          │ postMessage                      │   │   │
│  │  └──────────────────────────┼──────────────────────────────────┘   │   │
│  │                             │                                       │   │
│  │  ┌──────────────────────────▼──────────────────────────────────┐   │   │
│  │  │ Hidden Iframe (our domain)                                   │   │   │
│  │  │ ─────────────────────────────────────────────────────────── │   │   │
│  │  │  ┌────────────────────────────────────────────────────────┐ │   │   │
│  │  │  │ Sync Relay                                              │ │   │   │
│  │  │  │ • Authenticates to Our API                             │ │   │   │
│  │  │  │ • Sends captured data                                  │ │   │   │
│  │  │  │ • Receives updates to push back                        │ │   │   │
│  │  │  └────────────────────────────────────────────────────────┘ │   │   │
│  │  └──────────────────────────┬──────────────────────────────────┘   │   │
│  │                             │                                       │   │
│  └─────────────────────────────┼───────────────────────────────────────┘   │
│                                │ HTTPS                                      │
│                                ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Our Backend                                                          │   │
│  │ ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐  │   │
│  │ │ Sync API    │  │ Transform   │  │ Shadow Database              │  │   │
│  │ │ Endpoint    │──│ Layer       │──│ (our schema)                 │  │   │
│  │ └─────────────┘  └─────────────┘  └─────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Bookmarklet Sync Modes

| Mode | Direction | Use Case |
|------|-----------|----------|
| **Observe** | Incumbent → Shadow | Initial data capture, ongoing monitoring |
| **Mirror** | Bidirectional (incumbent primary) | Parallel operation during transition |
| **Shadow** | Bidirectional (our system primary) | Final cutover preparation |
| **Replay** | Shadow → Incumbent | Write back changes made in our system |

### 4.3 Bookmarklet SDK Core

```typescript
// packages/migration/bookmarklet-sdk/src/core.ts

interface SyncConfig {
  targetOrigin: string;           // Our API domain
  incumbentId: string;            // Identifies the incumbent system
  clientId: string;               // Client organization ID
  syncMode: 'observe' | 'mirror' | 'shadow' | 'replay';
}

interface CapturedEntity {
  incumbentType: string;          // Their entity type (from DOM/API)
  incumbentId: string;            // Their ID
  data: Record<string, unknown>;  // Raw captured data
  capturedAt: string;             // ISO timestamp
  captureMethod: 'dom' | 'xhr' | 'api';
}

class SyncEngine {
  private iframe: HTMLIFrameElement;
  private pendingSync: CapturedEntity[] = [];

  constructor(private config: SyncConfig) {
    this.injectIframe();
    this.setupInterceptors();
  }

  /**
   * Inject hidden iframe for cross-origin communication
   */
  private injectIframe(): void {
    this.iframe = document.createElement('iframe');
    this.iframe.src = `${this.config.targetOrigin}/sync-relay`;
    this.iframe.style.display = 'none';
    document.body.appendChild(this.iframe);

    window.addEventListener('message', this.handleMessage.bind(this));
  }

  /**
   * Intercept XHR/fetch to capture API responses
   */
  private setupInterceptors(): void {
    // Monkey-patch fetch
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      this.captureApiResponse(args[0] as string, response.clone());
      return response;
    };

    // Monkey-patch XHR
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(...args) {
      this.addEventListener('load', () => {
        // Capture response when complete
      });
      return originalOpen.apply(this, args);
    };
  }

  /**
   * Capture entity from page
   */
  capture(entity: CapturedEntity): void {
    this.pendingSync.push(entity);
    this.scheduleFlush();
  }

  /**
   * Send captured data to our backend via iframe relay
   */
  private flush(): void {
    if (this.pendingSync.length === 0) return;

    this.iframe.contentWindow?.postMessage({
      type: 'SYNC_BATCH',
      incumbentId: this.config.incumbentId,
      clientId: this.config.clientId,
      entities: this.pendingSync,
    }, this.config.targetOrigin);

    this.pendingSync = [];
  }

  /**
   * Handle messages from our iframe (write-back instructions)
   */
  private handleMessage(event: MessageEvent): void {
    if (event.origin !== this.config.targetOrigin) return;

    if (event.data.type === 'WRITE_BACK') {
      this.executeWriteBack(event.data.instructions);
    }
  }

  /**
   * Execute write-back by simulating user actions
   */
  private executeWriteBack(instructions: WriteBackInstruction[]): void {
    // This would interact with incumbent's forms/API
    // Implementation depends on specific incumbent system
  }
}
```

### 4.4 Schema Mapping Layer

Our schema is intentionally different from incumbents. The mapping is explicit:

```typescript
// packages/migration/schema-mapping/src/registry.ts

interface SchemaMapping {
  incumbentSystem: string;
  incumbentType: string;
  ourType: string;

  // Transform incumbent → our schema
  inbound: (incumbentData: unknown) => unknown;

  // Transform our schema → incumbent (for write-back)
  outbound: (ourData: unknown) => unknown;

  // Identify which incumbent fields map to which of ours
  fieldMappings: {
    incumbentPath: string;
    ourPath: string;
    transform?: (value: unknown) => unknown;
  }[];
}

// Example mapping for a generic "Caseworker Pro" system
const caseworkerProMappings: SchemaMapping[] = [
  {
    incumbentSystem: 'caseworker-pro',
    incumbentType: 'Ticket',
    ourType: 'Case',

    inbound: (ticket: any) => ({
      id: undefined,  // We generate our own
      externalId: String(ticket.TicketID),
      externalSystem: 'caseworker-pro',
      title: ticket.Subject,
      description: ticket.Description,
      status: mapStatus(ticket.StatusCode),
      priority: mapPriority(ticket.PriorityLevel),
      createdAt: parseDate(ticket.CreatedDate),
      // ... more mappings
    }),

    outbound: (case_: any) => ({
      TicketID: parseInt(case_.externalId),
      Subject: case_.title,
      Description: case_.description,
      StatusCode: reverseMapStatus(case_.status),
      // ... reverse mappings
    }),

    fieldMappings: [
      { incumbentPath: 'TicketID', ourPath: 'externalId', transform: String },
      { incumbentPath: 'Subject', ourPath: 'title' },
      { incumbentPath: 'StatusCode', ourPath: 'status', transform: mapStatus },
      // ...
    ],
  },
];
```

### 4.5 Conflict Resolution Strategy

```typescript
// packages/migration/sync-engine/src/conflict-resolution.ts

type ConflictResolution =
  | 'incumbent-wins'      // Default during parallel operation
  | 'shadow-wins'         // After cutover decision
  | 'latest-wins'         // Timestamp-based
  | 'merge'               // Field-level merge
  | 'manual';             // Flag for human review

interface ConflictRecord {
  entityType: string;
  entityId: string;
  incumbentVersion: unknown;
  shadowVersion: unknown;
  detectedAt: string;
  resolution: ConflictResolution;
  resolvedAt?: string;
  resolvedBy?: string;
}

function detectConflict(
  incumbent: SyncedEntity,
  shadow: SyncedEntity
): ConflictRecord | null {
  // Compare last modified timestamps
  if (incumbent.lastModified > shadow.lastSyncedAt &&
      shadow.lastModified > shadow.lastSyncedAt) {
    // Both modified since last sync
    return {
      entityType: incumbent.type,
      entityId: incumbent.id,
      incumbentVersion: incumbent.data,
      shadowVersion: shadow.data,
      detectedAt: new Date().toISOString(),
      resolution: 'manual', // Default to manual review
    };
  }
  return null;
}
```

---

## 5. LLM Pipeline Architecture

### 5.1 Separation of Concerns: Analysis vs. Generation

**Critical principle:** The LLMs that analyze incumbent systems must be isolated from the LLMs that generate new systems. This prevents:

1. **Accidental IP transfer** — Incumbent implementation details shouldn't leak into generated code
2. **Legal risk** — Generated systems should be clean-room implementations
3. **Bias** — New systems shouldn't inherit incumbent's design flaws

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LLM PIPELINE ISOLATION ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ANALYSIS ENVIRONMENT (Sandboxed)                                     │   │
│  │ ─────────────────────────────────────────────────────────────────── │   │
│  │                                                                      │   │
│  │  Inputs:                          Outputs:                          │   │
│  │  ├─ Screenshots of incumbent      ├─ Entity list (names only)       │   │
│  │  ├─ DOM structure                 ├─ Workflow diagrams              │   │
│  │  ├─ Network traffic patterns      ├─ Field type catalog             │   │
│  │  └─ User journey recordings       └─ UX pattern descriptions        │   │
│  │                                                                      │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Analysis LLM                                                    │ │   │
│  │  │ • Extracts WHAT the system does                                │ │   │
│  │  │ • Identifies entities and relationships                        │ │   │
│  │  │ • Maps user workflows                                          │ │   │
│  │  │ • Documents field types and validations                        │ │   │
│  │  │                                                                 │ │   │
│  │  │ ⛔ NEVER outputs:                                               │ │   │
│  │  │    • Code snippets from incumbent                              │ │   │
│  │  │    • Specific API structures                                   │ │   │
│  │  │    • Database schema details                                   │ │   │
│  │  │    • Proprietary business logic                                │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                      │   │
│  │                              │                                       │   │
│  │                              ▼                                       │   │
│  │                   ┌──────────────────┐                               │   │
│  │                   │ SPECIFICATION    │                               │   │
│  │                   │ (Abstract)       │                               │   │
│  │                   │                  │                               │   │
│  │                   │ • Entities       │                               │   │
│  │                   │ • Workflows      │                               │   │
│  │                   │ • Field catalog  │                               │   │
│  │                   │ • Integrations   │                               │   │
│  │                   └────────┬─────────┘                               │   │
│  │                            │                                         │   │
│  └────────────────────────────┼─────────────────────────────────────────┘   │
│                               │                                              │
│          ═══════════════════════════════════════════════════                │
│          ║  SPECIFICATION FIREWALL (Human Review Required) ║                │
│          ═══════════════════════════════════════════════════                │
│                               │                                              │
│                               ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ GENERATION ENVIRONMENT (Clean Room)                                  │   │
│  │ ─────────────────────────────────────────────────────────────────── │   │
│  │                                                                      │   │
│  │  Inputs:                          Outputs:                          │   │
│  │  ├─ Abstract specification        ├─ Database schema                │   │
│  │  ├─ Platform component library    ├─ API endpoints                  │   │
│  │  ├─ Industry best practices       ├─ React components               │   │
│  │  └─ Regulatory requirements       └─ Test suites                    │   │
│  │                                                                      │   │
│  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │  │ Generation LLM                                                  │ │   │
│  │  │ • Generates from specification + platform                       │ │   │
│  │  │ • Uses OUR patterns and conventions                            │ │   │
│  │  │ • Applies OUR security standards                               │ │   │
│  │  │                                                                 │ │   │
│  │  │ ⛔ NEVER sees:                                                  │ │   │
│  │  │    • Incumbent source code                                     │ │   │
│  │  │    • Incumbent API responses                                   │ │   │
│  │  │    • Incumbent database dumps                                  │ │   │
│  │  │    • Raw incumbent screenshots (only spec)                     │ │   │
│  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Data Flow Rules

| Data Type | Analysis LLM | Specification | Generation LLM |
|-----------|-------------|---------------|----------------|
| Screenshots | ✅ Input | ❌ Not included | ❌ Never sees |
| DOM structure | ✅ Input | ❌ Not included | ❌ Never sees |
| API responses | ✅ Input | ❌ Not included | ❌ Never sees |
| Entity names | ✅ Extracts | ✅ Included | ✅ Uses |
| Workflow descriptions | ✅ Writes | ✅ Included | ✅ Uses |
| Field types | ✅ Infers | ✅ Included (abstract) | ✅ Uses |
| Incumbent code | ❌ Never | ❌ Never | ❌ Never |
| Our platform code | ❌ N/A | ❌ N/A | ✅ References |

### 5.3 Specification Schema

The "Specification Firewall" is a structured document that passes between phases:

```typescript
// specs/schema.ts

interface SystemSpecification {
  metadata: {
    specVersion: string;
    industry: string;
    generatedAt: string;
    reviewedBy?: string;
    approvedAt?: string;
  };

  entities: EntitySpec[];
  workflows: WorkflowSpec[];
  integrations: IntegrationSpec[];
  compliance: ComplianceSpec;
}

interface EntitySpec {
  name: string;                    // e.g., "Case"
  pluralName: string;              // e.g., "Cases"
  description: string;             // What it represents

  fields: FieldSpec[];
  relationships: RelationshipSpec[];

  // Behavioral hints (not implementation)
  behaviors: {
    supportsSearch: boolean;
    supportsVersioning: boolean;
    requiresAudit: boolean;
    retentionPolicy?: string;
  };
}

interface FieldSpec {
  name: string;
  displayName: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'enum' | 'reference' | 'file';
  required: boolean;

  // For enums
  options?: { value: string; label: string }[];

  // Validation (abstract, not regex from incumbent)
  validation?: {
    pattern?: 'email' | 'phone' | 'postcode' | 'url';
    min?: number;
    max?: number;
  };
}

interface WorkflowSpec {
  name: string;
  description: string;
  triggerEntity: string;

  states: {
    name: string;
    description: string;
    isInitial: boolean;
    isFinal: boolean;
  }[];

  transitions: {
    from: string;
    to: string;
    action: string;
    conditions?: string[];
    requiredRole?: string;
  }[];
}
```

---

## 6. Prompt Pipeline for System Generation

### 6.1 Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SYSTEM GENERATION PIPELINE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Stage 1: Discovery            Stage 2: Specification     Stage 3: Review   │
│  (Analysis LLM)                (Analysis LLM)             (Human)           │
│  ┌─────────────────┐          ┌─────────────────┐        ┌───────────────┐ │
│  │ P1.1 Screenshot │          │ P2.1 Entity     │        │ Manual spec   │ │
│  │      Analysis   │─────────►│      Extraction │───────►│ review        │ │
│  └─────────────────┘          └─────────────────┘        └───────┬───────┘ │
│  ┌─────────────────┐          ┌─────────────────┐                │         │
│  │ P1.2 Workflow   │─────────►│ P2.2 Workflow   │────────────────┤         │
│  │      Recording  │          │      Mapping    │                │         │
│  └─────────────────┘          └─────────────────┘                │         │
│  ┌─────────────────┐          ┌─────────────────┐                │         │
│  │ P1.3 Field      │─────────►│ P2.3 Field      │────────────────┤         │
│  │      Cataloging │          │      Typing     │                │         │
│  └─────────────────┘          └─────────────────┘                ▼         │
│                                                          ┌───────────────┐ │
│                                                          │ Approved Spec │ │
│                                                          └───────┬───────┘ │
│                                                                  │         │
│  ═══════════════════════════════════════════════════════════════════════   │
│                              SPECIFICATION FIREWALL                         │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                  │         │
│                                                                  ▼         │
│  Stage 4: Schema Gen           Stage 5: Code Gen           Stage 6: Test   │
│  (Generation LLM)              (Generation LLM)            (Automated)     │
│  ┌─────────────────┐          ┌─────────────────┐        ┌───────────────┐ │
│  │ P4.1 Database   │          │ P5.1 API        │        │ Unit tests    │ │
│  │      Schema     │─────────►│      Endpoints  │───────►│ Integration   │ │
│  └─────────────────┘          └─────────────────┘        │ E2E tests     │ │
│  ┌─────────────────┐          ┌─────────────────┐        └───────────────┘ │
│  │ P4.2 TypeScript │─────────►│ P5.2 React      │                         │
│  │      Types      │          │      Components │                         │
│  └─────────────────┘          └─────────────────┘                         │
│  ┌─────────────────┐          ┌─────────────────┐                         │
│  │ P4.3 Migration  │─────────►│ P5.3 Mapping    │                         │
│  │      Mapping    │          │      Adapters   │                         │
│  └─────────────────┘          └─────────────────┘                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Stage 1: Discovery Prompts (Analysis LLM)

#### P1.1 Screenshot Analysis

```markdown
## PROMPT: Screenshot Analysis

You are analyzing screenshots of an existing case management system to understand
its functionality. Your goal is to identify UI patterns and functionality, NOT to
replicate the implementation.

### Input
[Screenshots of incumbent system pages]

### Task
For each screenshot, identify:
1. **Page Purpose**: What task does this page serve?
2. **Key Entities**: What data objects are displayed/edited?
3. **User Actions**: What can the user do on this page?
4. **Navigation**: How does this page connect to others?

### Output Format
```yaml
pages:
  - id: page_1
    purpose: "List view of customer support tickets"
    entities:
      - name: "Ticket"
        visibleFields: ["id", "subject", "status", "assignee", "created_date"]
    actions:
      - "Create new ticket"
      - "Filter by status"
      - "Search by keyword"
    navigation:
      - target: "Ticket detail"
        trigger: "Click on row"
```

### Rules
- DO NOT describe implementation details (colors, fonts, specific layouts)
- DO NOT include any text that appears to be code or markup
- DO describe functionality in abstract, platform-agnostic terms
- DO use generic field names, not verbatim labels from screenshots
```

#### P1.2 Workflow Recording Analysis

```markdown
## PROMPT: Workflow Analysis

You are analyzing a recorded user session to understand business workflows.

### Input
[Description or transcript of user actions in incumbent system]

### Task
Extract the workflow as an abstract state machine:
1. What states can an entity be in?
2. What transitions are possible?
3. What triggers each transition?
4. What role/permission is required?

### Output Format
```yaml
workflows:
  - name: "Ticket Resolution"
    entity: "Ticket"
    states:
      - name: "new"
        description: "Ticket just created, not yet reviewed"
        isInitial: true
      - name: "in_progress"
        description: "Assigned and being worked on"
      - name: "resolved"
        description: "Solution provided"
        isFinal: true
    transitions:
      - from: "new"
        to: "in_progress"
        action: "Assign to agent"
        requiredRole: "supervisor"
```

### Rules
- DO NOT include specific button names or UI elements
- DO NOT reference specific API calls or code
- DO describe the business logic abstractly
```

### 6.3 Stage 2: Specification Extraction Prompts

#### P2.1 Entity Extraction

```markdown
## PROMPT: Entity Specification

Based on the discovery analysis, create a formal entity specification.

### Input
[Output from P1.1 and P1.2]

### Task
Create a specification for each identified entity:
1. Define all fields with abstract types
2. Identify relationships between entities
3. Specify behavioral requirements

### Output Format
```json
{
  "entities": [
    {
      "name": "Case",
      "description": "A support case raised by a customer",
      "fields": [
        {
          "name": "title",
          "type": "text",
          "required": true,
          "validation": { "maxLength": 200 }
        },
        {
          "name": "status",
          "type": "enum",
          "options": ["open", "in_progress", "resolved", "closed"]
        }
      ],
      "relationships": [
        {
          "name": "customer",
          "target": "Customer",
          "type": "many-to-one",
          "required": true
        }
      ]
    }
  ]
}
```

### Rules
- Use OUR standard type names, not incumbent's
- Normalize field names to snake_case
- Abstract away implementation specifics
```

### 6.4 Stage 4: Generation Prompts (Generation LLM)

#### P4.1 Database Schema Generation

```markdown
## PROMPT: Database Schema Generation

You are generating a PostgreSQL database schema for a new case management system.
You have access to our platform's schema conventions and the approved specification.

### Input
1. [Approved SystemSpecification JSON]
2. [Platform schema conventions from packages/core/db/conventions.md]

### Task
Generate a complete database schema including:
1. Tables for each entity
2. Foreign key relationships
3. Indexes for common query patterns
4. Row-level security policies
5. Audit trigger setup

### Conventions to Follow
- All tables have UUID primary keys
- All tables have created_at, updated_at timestamps
- Use our audit_log trigger pattern
- Apply RLS based on office_id tenant isolation

### Output Format
```sql
-- Entity: Case
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL REFERENCES offices(id),
  -- ... generated fields ...
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_cases_office ON cases(office_id);

-- RLS
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY cases_tenant_isolation ON cases
  USING (office_id = current_setting('app.current_office_id')::uuid);
```

### Rules
- DO NOT reference any incumbent system details
- DO follow our platform conventions exactly
- DO include migration-ready external_id columns
```

#### P5.1 API Endpoint Generation

```markdown
## PROMPT: API Endpoint Generation

Generate Express.js API endpoints for the case management system.

### Input
1. [Approved SystemSpecification JSON]
2. [Generated database schema from P4.1]
3. [Platform API patterns from packages/core/api/patterns.md]

### Task
Generate RESTful API endpoints:
1. Standard CRUD operations
2. Search/filter endpoints
3. Workflow transition endpoints
4. Batch operations where appropriate

### Conventions
- Use our response envelope format
- Apply our error handling middleware
- Include OpenAPI documentation comments
- Use our validation patterns (zod schemas)

### Output Format
```typescript
// src/api/routes/cases.ts
import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '@platform/core/middleware';
import { CaseService } from '../services/case.service';

const router = Router();

const CreateCaseSchema = z.object({
  title: z.string().max(200),
  // ... from specification
});

/**
 * @openapi
 * /cases:
 *   post:
 *     summary: Create a new case
 *     ...
 */
router.post('/',
  validateRequest(CreateCaseSchema),
  async (req, res) => {
    // Implementation using our patterns
  }
);

export default router;
```

### Rules
- Generate from specification, NOT from incumbent
- Follow our patterns exactly
- Include audit logging calls
```

### 6.5 Validation Checkpoints

Between each stage, automated validation ensures quality:

```typescript
// packages/cli/validate/src/checkpoints.ts

interface ValidationCheckpoint {
  stage: string;
  checks: ValidationCheck[];
}

const checkpoints: ValidationCheckpoint[] = [
  {
    stage: 'post-discovery',
    checks: [
      {
        name: 'no-code-leakage',
        description: 'Ensure no code snippets in discovery output',
        validate: (output) => {
          const codePatterns = [
            /function\s+\w+\s*\(/,
            /const\s+\w+\s*=/,
            /SELECT\s+.*\s+FROM/i,
            /<[a-z]+[^>]*>/i,
          ];
          return !codePatterns.some(p => p.test(JSON.stringify(output)));
        },
      },
      {
        name: 'entity-naming',
        description: 'Ensure entity names are abstract',
        validate: (output) => {
          // Check names don't contain incumbent-specific terms
          const bannedTerms = ['incumbent', 'legacy', 'old_'];
          return !bannedTerms.some(t =>
            JSON.stringify(output).toLowerCase().includes(t)
          );
        },
      },
    ],
  },
  {
    stage: 'post-specification',
    checks: [
      {
        name: 'spec-completeness',
        description: 'All required spec sections present',
        validate: (spec: SystemSpecification) => {
          return spec.entities.length > 0 &&
                 spec.workflows.length > 0 &&
                 spec.entities.every(e => e.fields.length > 0);
        },
      },
      {
        name: 'human-review-required',
        description: 'Spec must be reviewed before generation',
        validate: (spec: SystemSpecification) => {
          return !!spec.metadata.reviewedBy && !!spec.metadata.approvedAt;
        },
      },
    ],
  },
  {
    stage: 'post-generation',
    checks: [
      {
        name: 'platform-compliance',
        description: 'Generated code uses platform patterns',
        validate: (code) => {
          // Check for required imports/patterns
          return code.includes('@platform/core') &&
                 code.includes('validateRequest');
        },
      },
      {
        name: 'security-patterns',
        description: 'Security patterns correctly applied',
        validate: (code) => {
          // Check RLS, auth middleware, etc.
          return code.includes('ROW LEVEL SECURITY') &&
                 code.includes('requireAuth');
        },
      },
    ],
  },
];
```

---

## 7. Validation Framework

### 7.1 Multi-Layer Validation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VALIDATION FRAMEWORK                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Layer 1: Specification Validation                                          │
│  ──────────────────────────────────                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Schema Valid    │  │ No Code Leakage │  │ Human Approval  │             │
│  │ (JSON Schema)   │  │ (Pattern Check) │  │ (Sign-off)      │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
│  Layer 2: Generated Code Validation                                         │
│  ──────────────────────────────────                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ TypeScript      │  │ ESLint/Prettier │  │ Security Scan   │             │
│  │ Compilation     │  │ Formatting      │  │ (Snyk/Semgrep)  │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
│  Layer 3: Functional Validation                                             │
│  ──────────────────────────────                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Unit Tests      │  │ Integration     │  │ E2E Tests       │             │
│  │ (Generated)     │  │ Tests           │  │ (Playwright)    │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
│  Layer 4: Compliance Validation                                             │
│  ─────────────────────────────                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ GDPR Checklist  │  │ Accessibility   │  │ Performance     │             │
│  │ (Data handling) │  │ (WCAG 2.1 AA)   │  │ (Lighthouse)    │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
│  Layer 5: Migration Validation                                              │
│  ─────────────────────────────                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Schema Mapping  │  │ Data Integrity  │  │ Roundtrip Test  │             │
│  │ Completeness    │  │ Checks          │  │ (Sync both ways)│             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Automated Test Generation

```typescript
// packages/cli/generate/src/test-generator.ts

/**
 * Generate tests from specification
 * Tests are generated, not copied from incumbent
 */
function generateTestSuite(spec: SystemSpecification): string {
  const tests: string[] = [];

  for (const entity of spec.entities) {
    tests.push(`
      describe('${entity.name}', () => {
        describe('CRUD operations', () => {
          it('should create a ${entity.name}', async () => {
            const data = generate${entity.name}Data();
            const result = await api.post('/${entity.name.toLowerCase()}s', data);
            expect(result.status).toBe(201);
            expect(result.body.id).toBeDefined();
          });

          it('should enforce required fields', async () => {
            const data = {};
            const result = await api.post('/${entity.name.toLowerCase()}s', data);
            expect(result.status).toBe(400);
            ${entity.fields.filter(f => f.required).map(f => `
            expect(result.body.errors).toContainEqual(
              expect.objectContaining({ field: '${f.name}' })
            );
            `).join('')}
          });
        });

        describe('Authorization', () => {
          it('should enforce tenant isolation', async () => {
            // Create in tenant A
            const itemA = await createAs('tenantA');

            // Try to access from tenant B
            const result = await api
              .asUser('tenantB')
              .get('/${entity.name.toLowerCase()}s/' + itemA.id);

            expect(result.status).toBe(404);
          });
        });
      });
    `);
  }

  return tests.join('\n\n');
}
```

### 7.3 Clean Room Certification

Each generated system must pass certification:

```markdown
## Clean Room Certification Checklist

### 1. No Direct Code Transfer
- [ ] No source code from incumbent exists in repository
- [ ] No API response structures copied verbatim
- [ ] No database schema directly replicated
- [ ] Generated code reviewed for inadvertent similarities

### 2. Specification Firewall Integrity
- [ ] Specification was human-reviewed before generation
- [ ] Specification contains only abstract descriptions
- [ ] No screenshots or DOM fragments in spec
- [ ] All field names normalized to our conventions

### 3. LLM Isolation Verified
- [ ] Analysis and generation LLMs are separate instances
- [ ] No shared context or memory between phases
- [ ] Prompt logs reviewed for leakage
- [ ] Generation prompts reference only spec + platform

### 4. Independent Implementation
- [ ] All code passes our linting rules
- [ ] All patterns match platform conventions
- [ ] Security patterns independently applied
- [ ] Tests generated from spec, not incumbent

Certified by: _________________
Date: _________________
```

---

## 8. Implementation Roadmap

### 8.1 Phase 1: Platform Foundation (Months 1-3)

**Objective:** Extract shared infrastructure from DearMP into reusable packages.

| Task | Effort | Dependency |
|------|--------|------------|
| Create monorepo structure | 1 week | - |
| Extract auth package | 2 weeks | Monorepo |
| Extract UI component library | 3 weeks | Monorepo |
| Extract audit logging | 1 week | Monorepo |
| Extract migration engine | 2 weeks | Monorepo |
| Document platform conventions | 2 weeks | All packages |

### 8.2 Phase 2: Analysis Pipeline (Months 3-5)

**Objective:** Build tooling for analyzing incumbent systems.

| Task | Effort | Dependency |
|------|--------|------------|
| Screenshot analysis prompts | 2 weeks | - |
| Workflow recording tool | 2 weeks | - |
| Specification schema design | 1 week | - |
| Specification extraction prompts | 2 weeks | Schema |
| Validation checkpoint framework | 2 weeks | Spec schema |
| Human review UI | 2 weeks | Validation |

### 8.3 Phase 3: Generation Pipeline (Months 5-7)

**Objective:** Build code generation from specifications.

| Task | Effort | Dependency |
|------|--------|------------|
| Database schema generator | 2 weeks | Platform packages |
| TypeScript types generator | 1 week | Schema generator |
| API endpoint generator | 3 weeks | Types generator |
| React component generator | 3 weeks | Platform UI |
| Test suite generator | 2 weeks | All generators |

### 8.4 Phase 4: Migration Tools (Months 7-9)

**Objective:** Build the bookmarklet-based migration system.

| Task | Effort | Dependency |
|------|--------|------------|
| Bookmarklet SDK core | 3 weeks | - |
| Sync relay service | 2 weeks | - |
| Schema mapping registry | 2 weeks | - |
| Conflict resolution engine | 2 weeks | Mapping registry |
| Write-back capability | 3 weeks | Sync relay |

### 8.5 Phase 5: First Vertical (Months 9-12)

**Objective:** Generate first new vertical using the complete pipeline.

| Task | Effort | Dependency |
|------|--------|------------|
| Select target industry | 1 week | - |
| Analyze incumbent system | 3 weeks | Analysis pipeline |
| Review and approve specification | 2 weeks | Analysis complete |
| Generate new system | 2 weeks | Generation pipeline |
| Validate and test | 3 weeks | Generated system |
| Migration pilot | 4 weeks | Migration tools |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Analysis LLM** | LLM instance used only for understanding incumbent systems |
| **Bookmarklet** | Browser-injected JavaScript for cross-site sync |
| **Canonical Schema** | Shared data format for cross-system exchange |
| **Clean Room** | Development environment isolated from incumbent details |
| **Generation LLM** | LLM instance used only for creating new code |
| **Incumbent** | Existing system being replaced |
| **Shadow Database** | Our database running parallel to incumbent during migration |
| **Specification Firewall** | Human review checkpoint between analysis and generation |
| **X-Road** | Federated data exchange infrastructure |

---

## Appendix B: Legal Considerations

### B.1 Clean Room Development

The separation of analysis and generation LLMs is modeled on clean room software engineering principles established in legal precedent (e.g., *Sega v. Accolade*). Key requirements:

1. **Functional specification only**: Analysis produces what the system does, not how
2. **Independent implementation**: Generation works from spec + platform, never incumbent code
3. **Documentation**: Maintain logs proving separation
4. **Review**: Human checkpoint between phases

### B.2 GDPR Portability Rights

Under GDPR Article 20, clients have the right to:
- Receive their personal data in structured, machine-readable format
- Transmit that data to another controller without hindrance

This right enables the migration strategy without requiring incumbent cooperation.

### B.3 Data Act 2025

The EU Data Act (entering force September 2025) extends data access rights to:
- Business data, not just personal data
- IoT and connected device data
- Interoperability requirements for data holders

This strengthens the legal basis for data migration from incumbents.

---

*Document prepared for strategic planning. Implementation decisions should involve legal review.*
