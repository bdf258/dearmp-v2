# Anti-Corruption Layer (ACL)

This folder (`src/lib/acl`) is the only place in the codebase allowed to know the shape of the Legacy Data.

## Structure

### 1. Interfaces (`interfaces.ts`)
Defines the structure of the **Legacy** API responses.

```typescript
interface LegacyEmail {
  MsgID: number;
  Body_HTML: string;
  Sender_Addr: string;
  // ... ugly legacy fields
}
```

### 2. Adapters (`adapters/emailAdapter.ts`)

Pure functions that convert Legacy Data -> New Schema.

```typescript
export function adaptEmail(legacy: LegacyEmail): NewEmailSchema {
  return {
    externalId: legacy.MsgID,
    content: sanitize(legacy.Body_HTML),
    sender: legacy.Sender_Addr.toLowerCase(),
    // ... clean mapped fields
  };
}
```

### 3. Payload Generators (`payloads/casePayload.ts`)

Pure functions that convert New Schema -> Legacy API Payloads.

```typescript
export function toLegacyCaseCreate(local: NewCase): LegacyCasePayload {
  return {
    type_code: mapTypeToLegacyCode(local.type),
    customer_ref: local.constituentExternalId,
    // ... logic to satisfy legacy constraints
  };
}
```

## Rules

1. **Isolation:** The rest of the app acts as if the Legacy API does not exist. It only speaks "New Schema."

2. **Enrichment:** If the Legacy API is missing data we need (e.g., "Sentiment Score"), the Adapter initializes it as `null` and relies on the Triage Pipeline to fill it.
