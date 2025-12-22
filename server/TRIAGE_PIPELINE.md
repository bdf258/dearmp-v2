# Triage Pipeline Architecture

This module handles the ingestion and analysis of emails before the user sees them.

## The Queue Flow

```text
[Legacy API]
     │
     ▼
(Ingest Job) ──▶ [New Email Detected]
     │
     ▼
[QUEUE: analysis]
     │
     ├── 1. Fetch Related (Search Legacy API for constituents)
     ├── 2. Build Context (Combine Email + Constituent History)
     ├── 3. LLM Request (Generate Summary, Urgency, Draft)
     │
     ▼
[Shadow DB] ──▶ Update Email record with `analysis_json`
```

## Latency Management

To ensure the frontend feels instant:

### Pre-computation:
- The analysis queue runs 24/7.
- When a user logs in, the last 24h of emails should already have LLM data in the Shadow DB.

### Constituent Matching:
- We do not trust the Legacy System's match 100%.
- The Pipeline attempts to match `email.from` against Shadow DB Constituents.
- If no match, it flags as "Potential New Constituent."

## Failure Handling

- **If LLM fails:** Mark status `analysis_failed`, show raw email to user.
- **If Legacy Sync fails:** Retry 3 times via BullMQ exponential backoff.
