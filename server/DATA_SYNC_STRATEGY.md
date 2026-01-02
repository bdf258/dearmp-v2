# Data Synchronization Strategy

This document defines how we maintain consistency between the **Legacy System (Master)** and the **Shadow DB (Replica)**.

## 1. The Schema Contract
Every table in the Shadow DB that mirrors a Legacy Entity MUST have:
- `id`: UUID (Internal ID for our system)
- `external_id`: String/Int (The ID from the Legacy System) - **Indexed & Unique**
- `last_synced_at`: Timestamp

## 2. Ingestion (The Poller)
*Located in: `src/worker/jobs/pollLegacy.ts`*

Runs every X minutes.
1.  **Fetch:** Calls Legacy API `GET /search?modifiedSince={last_check}`.
2.  **Transform:** Passes JSON through the ACL Adapter.
3.  **Upsert:**
    - Check if `external_id` exists in Shadow DB.
    - IF EXISTS: Update fields.
    - IF NEW: Insert new record.

## 3. The "Dual Write" (User Action)
*Located in: `src/api/services/caseService.ts`*

When a user creates/updates an item:

1.  **Step 1: Write to Legacy (Blocking)**
    - Send POST/PATCH to Legacy API.
    - Await 200 OK.
    - Extract `id` from response.

2.  **Step 2: Write to Shadow (Immediate)**
    - Transform the request data into New Schema format.
    - Insert into Shadow DB including the `external_id` received in Step 1.

3.  **Step 3: Return to Frontend**
    - Frontend receives the *Shadow DB* object.

## 4. Conflict Resolution
- **Rule:** Legacy System wins.
- If the Poller detects a change in the Legacy System that conflicts with a local change, the Poller overwrites the local data.
