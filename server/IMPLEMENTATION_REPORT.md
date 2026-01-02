# Legacy System Integration - Implementation Report

**Date:** December 22, 2025
**Repository:** dearmp-v2
**Status:** Phase 1 Complete - Multi-Tenant Architecture

---

## Executive Summary

This report documents the analysis and implementation of the Anti-Corruption Layer (ACL) for integrating the new DearMP v2 system with the legacy Caseworker system. We have:

1. Analyzed the legacy system's API endpoints and database schema
2. Created comprehensive API route documentation
3. Implemented **multi-tenant isolation** matching the main application's `office_id` pattern
4. Created a Supabase migration for the parallel legacy shadow schema
5. Designed a clean architecture server structure

---

## Multi-Tenancy Architecture

### Overview

The DearMP v2 application is a multi-tenant SaaS where each MP office is isolated. The legacy integration layer follows the same pattern:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MULTI-TENANT ARCHITECTURE                          │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
  │  Office A   │    │  Office B   │    │  Office C   │
  │  (MP Smith) │    │  (MP Jones) │    │  (MP Brown) │
  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
         │                  │                  │
         ▼                  ▼                  ▼
  ┌─────────────────────────────────────────────────────┐
  │              Row-Level Security (RLS)               │
  │         office_id = get_my_office_id()              │
  └─────────────────────────────────────────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
  │ Legacy API  │    │ Legacy API  │    │ Legacy API  │
  │ Instance A  │    │ Instance B  │    │ Instance C  │
  └─────────────┘    └─────────────┘    └─────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **office_id on every table** | Matches main schema; enables RLS; supports per-office legacy API instances |
| **UNIQUE(office_id, external_id)** | Legacy IDs are only unique within an office's instance |
| **Per-office credentials** | `legacy.api_credentials` stores encrypted API tokens per office |
| **Per-office sync status** | Each office syncs independently with its own cursor/progress |
| **Sync audit log** | Compliance and debugging for multi-tenant sync operations |

### RLS Policy Pattern

All legacy tables use office-scoped RLS matching the main application:

```sql
-- Authenticated users can only read their office's data
CREATE POLICY "Office isolation read" ON legacy.{table}
  FOR SELECT TO authenticated
  USING (office_id = public.get_my_office_id());

-- Service role has full access for sync operations
CREATE POLICY "Service role full access" ON legacy.{table}
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
```

---

## Server Architecture

### Clean Architecture Layers

```
server/
├── src/
│   ├── domain/           # Enterprise Business Rules
│   │   ├── entities/     # Core domain objects
│   │   ├── value-objects/# Immutable value types
│   │   ├── events/       # Domain events
│   │   └── interfaces/   # Repository & service contracts
│   │
│   ├── application/      # Application Business Rules
│   │   ├── services/     # Use case orchestration
│   │   ├── use-cases/    # Single-purpose operations
│   │   ├── dtos/         # Data transfer objects
│   │   └── ports/        # Input/output boundaries
│   │
│   ├── infrastructure/   # Frameworks & Drivers
│   │   ├── repositories/ # Supabase data access
│   │   ├── api/          # Legacy API client
│   │   ├── queue/        # BullMQ job processing
│   │   ├── cache/        # Redis caching
│   │   └── adapters/     # ACL transformations
│   │
│   └── presentation/     # Interface Adapters
│       ├── http/         # Express/Hono routes
│       └── workers/      # Background job handlers
```

### Dependency Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Dependency Direction                          │
│                              ──────▶                                 │
│                                                                      │
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────────┐  │
│  │  Presentation  │──▶│  Application   │──▶│      Domain        │  │
│  │  (HTTP/Workers)│   │  (Use Cases)   │   │  (Entities/Rules)  │  │
│  └───────┬────────┘   └───────┬────────┘   └────────────────────┘  │
│          │                    │                       ▲             │
│          │                    │                       │             │
│          ▼                    ▼                       │             │
│  ┌───────────────────────────────────────────────────┴───────────┐ │
│  │                      Infrastructure                            │ │
│  │            (Implements Domain Interfaces)                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Design Patterns Applied

| Pattern | Usage |
|---------|-------|
| **Repository** | Abstract data access for legacy entities |
| **Adapter** | Transform legacy API data ↔ domain entities |
| **Factory** | Create domain objects from raw data |
| **Strategy** | Different sync strategies (full, incremental, real-time) |
| **Command** | Encapsulate triage decisions as executable commands |
| **Observer** | Notify on sync events for UI updates |
| **Service Layer** | Coordinate use cases and transactions |

---

## Completed Work

### 1. Documentation Created

| File | Purpose |
|------|---------|
| `server/LEGACY_API_ROUTES.md` | Complete reference of all legacy API endpoints |
| `server/DATABASE_SCHEMA.md` | Legacy database schema (reverse-engineered) |
| `server/DATA_FETCHING_ANALYSIS.md` | API architecture and data flow patterns |
| `server/API_INTEGRATION_PLAN.md` | Triage pipeline architecture |

### 2. Database Migration

| File | Purpose |
|------|---------|
| `supabase/migrations/20241220000001_legacy_schema.sql` | Multi-tenant legacy shadow schema |

**Schema Features:**
- **Multi-tenant**: All tables have `office_id` with proper RLS
- **External ID mapping**: `UNIQUE(office_id, external_id)` for legacy reference
- **Sync tracking**: Per-office sync status and cursor
- **Audit logging**: `sync_audit_log` for compliance and debugging
- **Credential storage**: `api_credentials` for per-office API access
- **Upsert helpers**: Office-scoped functions for data sync
- **Complete entities**: Added missing tables (letters, appointments, SMS, email attachments)

### 3. Tables Created

**Reference Data (per-office):**
- `status_types`, `case_types`, `category_types`, `contact_types`, `connection_types`

**Core Entities:**
- `caseworkers`, `constituents`, `contact_details`, `cases`, `emails`, `casenotes`

**Supporting:**
- `tags`, `case_tags`, `flags`, `constituent_flags`, `case_files`, `review_dates`, `connections`
- `letters`, `appointments`, `sms_messages`, `email_attachments` (newly added)

**Custom Fields:**
- `custom_field_definitions`, `custom_field_values`

**Sync Infrastructure:**
- `sync_status`, `sync_audit_log`, `api_credentials`

---

## Architecture Decisions

### Anti-Corruption Layer (ACL)

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  New Frontend   │────▶│  Shadow DB      │────▶│  Legacy API     │
│  (DearMP v2)    │     │  (Supabase)     │     │  (Caseworker)   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                        ┌────────▼────────┐
                        │   ACL Layer     │
                        │   (Adapters)    │
                        │                 │
                        │ ┌─────────────┐ │
                        │ │  Adapter    │ │  Legacy → Domain
                        │ │  (Inbound)  │ │
                        │ └─────────────┘ │
                        │                 │
                        │ ┌─────────────┐ │
                        │ │  Adapter    │ │  Domain → Legacy
                        │ │  (Outbound) │ │
                        │ └─────────────┘ │
                        └─────────────────┘
```

### Dual Write Pattern

1. User action → Write to Legacy API (blocking, source of truth)
2. On success → Write to Shadow DB with `external_id`
3. Return Shadow DB object to frontend

### Sync Strategy

- **Initial sync**: Full sync with cursor-based pagination
- **Incremental**: Poll every 5 minutes using `modifiedSince`
- **Conflict resolution**: Legacy always wins (source of truth)

---

## What Needs to Be Done

### Phase 2: Server Implementation

| Task | Priority | Description |
|------|----------|-------------|
| Domain entities | High | TypeScript classes for Case, Constituent, Email, etc. |
| Repository interfaces | High | Contracts for data access |
| Legacy API client | High | TypeScript client with rate limiting |
| ACL adapters | High | Transform legacy ↔ domain objects |
| Supabase repositories | High | Implement repository contracts |

### Phase 3: Triage Pipeline

| Task | Priority | Description |
|------|----------|-------------|
| TriagePipeline class | High | Main orchestrator |
| Prefetch queue | Medium | Pre-process emails ahead of user |
| Commit queue | Medium | Rate-limited writes to legacy |
| LLM integration | Medium | Hook into AI classification |

### Phase 4: Infrastructure

| Task | Priority | Description |
|------|----------|-------------|
| BullMQ setup | High | Job queue for background sync |
| Redis cache | Medium | Cache frequently accessed data |
| Worker service | High | Background job processor |
| Health checks | Medium | Monitoring and alerting |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Legacy API rate limiting | High | Token bucket algorithm, exponential backoff |
| Cross-tenant data leak | Critical | RLS policies, office_id on all queries |
| Schema drift | Medium | Versioned adapters, sync status monitoring |
| Authentication token expiry | Medium | Auto-refresh before 30-min timeout |
| Data conflicts | Low | Legacy wins policy, audit logging |
| Network failures | Low | Retry with exponential backoff, dead letter queue |

---

## Directory Structure

```
server/
├── IMPLEMENTATION_REPORT.md    # This report
├── LEGACY_API_ROUTES.md        # API endpoint reference
├── DATABASE_SCHEMA.md          # Legacy schema analysis
├── DATA_FETCHING_ANALYSIS.md   # API analysis
├── API_INTEGRATION_PLAN.md     # Integration plan
│
└── src/
    ├── domain/
    │   ├── entities/
    │   │   ├── Case.ts
    │   │   ├── Constituent.ts
    │   │   ├── Email.ts
    │   │   └── index.ts
    │   ├── value-objects/
    │   │   ├── ExternalId.ts
    │   │   ├── OfficeId.ts
    │   │   └── index.ts
    │   ├── events/
    │   │   ├── SyncEvent.ts
    │   │   └── index.ts
    │   └── interfaces/
    │       ├── ICaseRepository.ts
    │       ├── IConstituentRepository.ts
    │       ├── ILegacyApiClient.ts
    │       └── index.ts
    │
    ├── application/
    │   ├── services/
    │   │   ├── SyncService.ts
    │   │   ├── TriageService.ts
    │   │   └── index.ts
    │   ├── use-cases/
    │   │   ├── sync/
    │   │   │   ├── SyncCases.ts
    │   │   │   ├── SyncConstituents.ts
    │   │   │   └── SyncEmails.ts
    │   │   └── triage/
    │   │       ├── ProcessEmail.ts
    │   │       ├── CreateCase.ts
    │   │       └── MatchConstituent.ts
    │   ├── dtos/
    │   │   ├── CaseDto.ts
    │   │   ├── ConstituentDto.ts
    │   │   └── index.ts
    │   └── ports/
    │       ├── ISyncPort.ts
    │       └── ITriagePort.ts
    │
    ├── infrastructure/
    │   ├── repositories/
    │   │   ├── SupabaseCaseRepository.ts
    │   │   ├── SupabaseConstituentRepository.ts
    │   │   └── index.ts
    │   ├── api/
    │   │   ├── LegacyApiClient.ts
    │   │   ├── RateLimiter.ts
    │   │   └── index.ts
    │   ├── queue/
    │   │   ├── SyncQueue.ts
    │   │   ├── TriageQueue.ts
    │   │   └── index.ts
    │   ├── cache/
    │   │   ├── RedisCache.ts
    │   │   └── index.ts
    │   └── adapters/
    │       ├── CaseAdapter.ts
    │       ├── ConstituentAdapter.ts
    │       ├── EmailAdapter.ts
    │       └── index.ts
    │
    ├── presentation/
    │   ├── http/
    │   │   ├── routes/
    │   │   │   ├── sync.ts
    │   │   │   └── triage.ts
    │   │   └── middleware/
    │   │       ├── auth.ts
    │   │       └── officeScope.ts
    │   └── workers/
    │       ├── SyncWorker.ts
    │       └── TriageWorker.ts
    │
    ├── config/
    │   ├── database.ts
    │   ├── redis.ts
    │   └── index.ts
    │
    └── index.ts

supabase/migrations/
└── 20241220000001_legacy_schema.sql  # Multi-tenant legacy schema
```

---

## Next Steps

1. **Review this report** with stakeholders
2. **Run migration**: `supabase db push`
3. **Create domain entities** in `server/src/domain/`
4. **Implement repositories** in `server/src/infrastructure/`
5. **Build ACL adapters** for legacy ↔ domain transformation
6. **Set up BullMQ** for background job processing
7. **Connect to staging** legacy system for integration testing

---

## References

- [API_INTEGRATION_PLAN.md](./API_INTEGRATION_PLAN.md) - Detailed integration architecture
- [LEGACY_API_ROUTES.md](./LEGACY_API_ROUTES.md) - API endpoint reference
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Legacy schema analysis
- [DATA_FETCHING_ANALYSIS.md](./DATA_FETCHING_ANALYSIS.md) - API analysis
