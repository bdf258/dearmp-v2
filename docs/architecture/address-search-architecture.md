# Address Search & Constituency Verification Architecture

> **Status**: Draft
> **Date**: 2025-01-05
> **Purpose**: Automatic postcode detection and constituency verification during email triage

---

## Overview

This document describes the architecture for automatically detecting postal addresses and postcodes in inbound emails, and verifying whether the sender is within the MP's constituency. This feature enhances the triage workflow by identifying constituents who may not be in the database but have included their address in the email body.

### Problem Statement

Currently, the triage process only identifies constituents by matching their email address against the database. This misses two important scenarios:

1. **New constituents** who aren't in the database but have included their postcode in the email
2. **Existing constituents** whose records don't have an associated address

In both cases, we can potentially verify constituency membership by extracting a postcode from the email body and checking if it falls within the constituency boundary.

---

## Process Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Email Received                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              1. Constituent Lookup (by email)               │
│              - Query local DB by sender email               │
│              - Fall back to legacy API lookup               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              2. Check Address Presence                      │
│              - No constituent match? → Continue             │
│              - Constituent match without address? → Continue│
│              - Constituent with verified address? → SKIP    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              3. Extract Postcode from Email Body            │
│              - Apply UK postcode regex patterns             │
│              - Extract all candidate postcodes              │
│              - Validate format (not all matches are valid)  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              4. Validate Postcode via API                   │
│              - Query postcodes.io for postcode data         │
│              - Retrieve parliamentary constituency          │
│              - Cache results for performance                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              5. Constituency Match Decision                 │
│              - Compare against office constituency          │
│              - Set verification status                      │
│              - Enrich triage context with result            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              6. Continue Triage Processing                  │
│              - Pass verification result to LLM context      │
│              - Influence suggested action/confidence        │
│              - Display verification status in UI            │
└─────────────────────────────────────────────────────────────┘
```

---

## Decision Logic

### When to Trigger Address Search

| Scenario | Constituent Match | Has Address | Action |
|----------|-------------------|-------------|--------|
| Unknown sender | No match | N/A | **Search email body for postcode** |
| Known sender, no address | Match found | No | **Search email body for postcode** |
| Known sender, has address | Match found | Yes | Skip search (already verified) |
| Known sender, address unverified | Match found | Partial | Optional: search for updated postcode |

### Verification Status Values

```typescript
type ConstituencyVerificationStatus =
  | 'verified_in_constituency'      // Postcode confirmed in constituency
  | 'verified_outside_constituency' // Postcode confirmed NOT in constituency
  | 'postcode_found_unverified'     // Postcode found but API lookup failed
  | 'no_postcode_found'             // No valid postcode in email body
  | 'address_on_file'               // Existing constituent with verified address
  | 'not_checked';                  // Search not performed
```

---

## Technical Implementation

### 1. Postcode Extraction Service

Create a dedicated service for extracting and validating UK postcodes from text.

**File:** `server/src/domain/services/PostcodeExtractor.ts`

```typescript
interface ExtractedPostcode {
  postcode: string;           // Normalized format (e.g., "SW1A 1AA")
  originalMatch: string;      // As found in text
  position: number;           // Character position in text
  confidence: 'high' | 'medium' | 'low';
}

interface PostcodeExtractionResult {
  postcodes: ExtractedPostcode[];
  primaryPostcode?: ExtractedPostcode;  // Most likely to be sender's
  rawMatches: string[];
}
```

#### UK Postcode Pattern

UK postcodes follow specific patterns. The regex should handle:
- Standard format: `SW1A 1AA`
- No space: `SW1A1AA`
- Lowercase: `sw1a 1aa`
- With surrounding text: `"My address is 10 Downing Street, SW1A 2AA, London"`

```typescript
// UK postcode regex - covers all valid formats
const UK_POSTCODE_REGEX = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/gi;

// Area codes that don't exist (filter false positives)
const INVALID_AREA_CODES = ['QA', 'QF', 'QI', 'QJ', 'QK', 'QO', 'QP', 'QT', 'QU', 'QX', 'QY'];
```

#### Confidence Scoring

Not all postcode-like strings are actual postcodes. Apply confidence scoring:

| Factor | High Confidence | Medium Confidence | Low Confidence |
|--------|----------------|-------------------|----------------|
| Context | Near "address", "postcode", "live at" | Near signature/footer | Isolated in body |
| Format | Standard spacing | No space | Unusual casing |
| Validation | Passes format check | Unusual but valid | Edge case format |

### 2. Constituency Lookup Service

Create a service to query constituency data from postcodes.

**File:** `server/src/infrastructure/api/PostcodeApiClient.ts`

```typescript
interface ConstituencyInfo {
  constituencyId: string;
  constituencyName: string;
  mpName?: string;
  country: string;
  region: string;
  latitude: number;
  longitude: number;
}

interface PostcodeLookupResult {
  valid: boolean;
  postcode: string;
  constituency?: ConstituencyInfo;
  error?: string;
}

class PostcodeApiClient {
  private baseUrl = 'https://api.postcodes.io';

  async lookupPostcode(postcode: string): Promise<PostcodeLookupResult>;
  async bulkLookup(postcodes: string[]): Promise<PostcodeLookupResult[]>;
}
```

#### API Integration: postcodes.io

[postcodes.io](https://postcodes.io) is a free, open-source API for UK postcode data:

**Single Lookup:**
```
GET https://api.postcodes.io/postcodes/{postcode}
```

**Response includes:**
```json
{
  "result": {
    "postcode": "SW1A 1AA",
    "parliamentary_constituency": "Cities of London and Westminster",
    "parliamentary_constituency_2024": "Cities of London and Westminster",
    "latitude": 51.501009,
    "longitude": -0.141588,
    "region": "London",
    "country": "England"
  }
}
```

**Bulk Lookup (up to 100 postcodes):**
```
POST https://api.postcodes.io/postcodes
Body: { "postcodes": ["SW1A 1AA", "EC1A 1BB"] }
```

#### Caching Strategy

Postcode-to-constituency mappings rarely change. Implement aggressive caching:

| Cache Layer | TTL | Purpose |
|-------------|-----|---------|
| In-memory (LRU) | 1 hour | Hot postcodes during session |
| Database | 30 days | Persistent lookup cache |
| Edge (CDN) | 7 days | If using edge functions |

**Cache Schema:**
```sql
CREATE TABLE postcode_cache (
  postcode VARCHAR(10) PRIMARY KEY,  -- Normalized, no spaces
  constituency_name TEXT NOT NULL,
  constituency_id TEXT,
  region TEXT,
  country TEXT,
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  cached_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '30 days'
);

CREATE INDEX idx_postcode_cache_expires ON postcode_cache(expires_at);
```

### 3. Address Search Integration Point

Integrate the address search into the existing triage flow.

**File:** `server/src/application/use-cases/triage/ProcessEmail.ts`

```typescript
// After constituent lookup, before LLM analysis
async function processEmail(emailId: string, officeId: OfficeId): Promise<TriageResult> {
  // Step 1: Fetch email
  const email = await this.fetchEmail(emailId, officeId);

  // Step 2: Match to constituent (existing logic)
  const constituentMatch = await this.matchConstituent(email, officeId);

  // Step 3: NEW - Address search if needed
  const addressVerification = await this.verifyConstituencyFromEmail(
    email,
    constituentMatch,
    officeId
  );

  // Step 4: Continue with LLM analysis (with enriched context)
  const triageContext = this.buildTriageContext(
    email,
    constituentMatch,
    addressVerification,  // NEW: Include verification result
    existingCases
  );

  // ...
}
```

### 4. Triage Context Enhancement

Extend the `TriageContextDto` to include address verification results.

**File:** `server/src/application/dtos/TriageContextDto.ts`

```typescript
// Add to TriageContextDto interface
export interface TriageContextDto {
  // ... existing fields ...

  // NEW: Address verification result
  addressVerification?: {
    status: ConstituencyVerificationStatus;
    extractedPostcode?: string;
    extractedAddress?: string;  // Full address if parseable
    constituencyMatch?: {
      isMatch: boolean;
      extractedConstituency: string;
      officeConstituency: string;
    };
    confidence: number;
    source: 'email_body' | 'email_signature' | 'existing_record';
  };
}
```

### 5. Triage Suggestion Enhancement

The LLM (or rule-based) suggestion logic should consider verification status.

**File:** `server/src/infrastructure/queue/handlers/TriageJobHandler.ts`

```typescript
function generateRuleBasedSuggestion(
  email: Email,
  constituentMatch: ConstituentMatch | null,
  addressVerification: AddressVerificationResult
): TriageSuggestion {
  // Adjust confidence based on verification
  let actionConfidence = 0.5;

  if (addressVerification.status === 'verified_in_constituency') {
    // Boost confidence - we know they're a constituent
    actionConfidence += 0.3;

    return {
      recommendedAction: constituentMatch ? 'create_case' : 'create_new',
      actionConfidence,
      actionReasoning: `Postcode ${addressVerification.extractedPostcode} verified in ${addressVerification.constituencyMatch.extractedConstituency}`,
      // Populate extracted address for constituent creation
      extractedConstituentDetails: {
        postcode: addressVerification.extractedPostcode,
        address: addressVerification.extractedAddress,
      }
    };
  }

  if (addressVerification.status === 'verified_outside_constituency') {
    // This is likely not our constituent
    return {
      recommendedAction: 'ignore',
      actionConfidence: 0.7,
      actionReasoning: `Postcode ${addressVerification.extractedPostcode} is in ${addressVerification.constituencyMatch.extractedConstituency}, not this constituency`,
    };
  }

  // ... other cases
}
```

---

## UI Integration

### Triage Queue Display

Show verification status in the triage queue with visual indicators:

| Status | Icon | Color | Label |
|--------|------|-------|-------|
| verified_in_constituency | ✓ | Green | "Verified Constituent" |
| verified_outside_constituency | ✗ | Red | "Outside Constituency" |
| postcode_found_unverified | ? | Yellow | "Address Found (Unverified)" |
| no_postcode_found | - | Gray | "No Address" |

### Constituent Card Enhancement

When displaying the constituent card in triage:

```
┌─────────────────────────────────────────────────────────────┐
│ 👤 Unknown Sender                                           │
│    john.smith@gmail.com                                     │
│                                                             │
│ 📍 Address Found in Email                                   │
│    Postcode: SW1A 1AA                                       │
│    ✓ Verified: Cities of London and Westminster             │
│                                                             │
│ [Create Constituent]  [Request Full Address]                │
└─────────────────────────────────────────────────────────────┘
```

### Action Buttons

Based on verification status, show appropriate actions:

| Status | Primary Action | Secondary Action |
|--------|---------------|------------------|
| verified_in_constituency | "Create Case" | "Create Constituent" (if new) |
| verified_outside_constituency | "Send Redirect Letter" | "Ignore" |
| postcode_found_unverified | "Create Case" | "Request Address" |
| no_postcode_found | "Request Address" | "Ignore" |

---

## Edge Cases & Error Handling

### Multiple Postcodes Found

When multiple postcodes are found in an email:

1. **Prioritize by context**: Postcodes near "my address", "I live at" score higher
2. **Prioritize by position**: Postcodes in signature/footer are more likely sender's
3. **Check all against constituency**: If one matches, use that one
4. **Present options**: If ambiguous, let user choose

### Invalid/Non-existent Postcodes

The email may contain postcode-like strings that aren't valid:

1. **Format validation**: Apply strict UK postcode regex
2. **API validation**: postcodes.io returns 404 for non-existent postcodes
3. **Graceful degradation**: Mark as `postcode_found_unverified`, don't block triage

### API Rate Limits & Failures

postcodes.io has rate limits (free tier: ~100 req/sec):

1. **Bulk endpoints**: Use bulk lookup for multiple postcodes
2. **Caching**: Cache all successful lookups
3. **Fallback**: On API failure, mark as `postcode_found_unverified`
4. **Retry**: Exponential backoff for transient failures

### Northern Ireland

Northern Ireland uses BT postcodes and has different constituency data:

1. **Detect BT prefix**: Northern Ireland postcodes start with BT
2. **Use correct API fields**: Check `parliamentary_constituency` includes NI data
3. **Handle Assembly vs Westminster**: Differentiate if needed

---

## Data Model Changes

### Office Table Extension

Store the office's constituency for comparison:

```sql
ALTER TABLE offices ADD COLUMN constituency_name TEXT;
ALTER TABLE offices ADD COLUMN constituency_gss_code TEXT;  -- ONS code for exact matching
```

### Email Table Extension

Store extracted address data:

```sql
ALTER TABLE emails ADD COLUMN extracted_postcode VARCHAR(10);
ALTER TABLE emails ADD COLUMN extracted_address TEXT;
ALTER TABLE emails ADD COLUMN constituency_verification_status TEXT;
ALTER TABLE emails ADD COLUMN verified_constituency_name TEXT;
ALTER TABLE emails ADD COLUMN address_verified_at TIMESTAMPTZ;
```

### Constituent Table Extension

Ensure constituent records can store verified addresses:

```sql
ALTER TABLE constituents ADD COLUMN postcode VARCHAR(10);
ALTER TABLE constituents ADD COLUMN address_line1 TEXT;
ALTER TABLE constituents ADD COLUMN address_line2 TEXT;
ALTER TABLE constituents ADD COLUMN city TEXT;
ALTER TABLE constituents ADD COLUMN county TEXT;
ALTER TABLE constituents ADD COLUMN address_verified BOOLEAN DEFAULT false;
ALTER TABLE constituents ADD COLUMN address_verified_at TIMESTAMPTZ;
ALTER TABLE constituents ADD COLUMN constituency_name TEXT;
```

---

## Configuration

### Office Settings

Allow offices to configure address verification behavior:

```typescript
interface OfficeAddressSettings {
  // Enable/disable automatic address extraction
  enableAddressExtraction: boolean;

  // Strictness level for constituency matching
  // 'strict' = exact constituency name match
  // 'fuzzy' = allow minor variations
  constituencyMatchMode: 'strict' | 'fuzzy';

  // Action for out-of-constituency emails
  outOfConstituencyAction: 'flag' | 'auto_redirect' | 'ignore';

  // Template for redirect response
  redirectTemplateId?: string;

  // Neighboring constituencies to also accept
  acceptedNeighboringConstituencies?: string[];
}
```

---

## Testing Strategy

### Unit Tests

1. **Postcode extraction**: Various email formats with embedded postcodes
2. **Format validation**: Valid and invalid UK postcode formats
3. **Constituency matching**: Exact and fuzzy matching logic

### Integration Tests

1. **API integration**: Mock postcodes.io responses
2. **Cache behavior**: Verify caching and invalidation
3. **End-to-end flow**: Email → extraction → verification → triage

### Test Data

```typescript
const TEST_EMAILS = [
  {
    body: "My address is 10 Downing Street, SW1A 2AA, London",
    expectedPostcode: "SW1A 2AA",
    expectedConstituency: "Cities of London and Westminster"
  },
  {
    body: "Please help with my issue.\n\nJohn Smith\n123 High Street\nManchester M1 1AA",
    expectedPostcode: "M1 1AA",
    expectedConstituency: "Manchester Central"
  },
  // ... more test cases
];
```

---

## Implementation Phases

### Phase 1: Core Infrastructure
1. Create `PostcodeExtractor` service
2. Create `PostcodeApiClient` for postcodes.io
3. Add postcode cache table and queries
4. Add office constituency field

### Phase 2: Triage Integration
1. Integrate extraction into `ProcessEmail` use case
2. Extend `TriageContextDto` with verification data
3. Update rule-based suggestion logic
4. Update LLM prompt to include verification context

### Phase 3: UI Enhancement
1. Display verification status in triage queue
2. Add verification indicator to constituent card
3. Add "Request Address" flow for unverified
4. Add out-of-constituency handling UI

### Phase 4: Polish & Configuration
1. Add office settings for address verification
2. Add bulk verification for queue
3. Add analytics/reporting on verification rates
4. Performance optimization and monitoring

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Postcodes extracted successfully | >80% of emails with addresses | Extraction success rate |
| Constituency verification rate | >95% of extracted postcodes | API lookup success rate |
| Time to verification | <500ms average | P50 latency |
| Cache hit rate | >70% after warm-up | Cache analytics |
| Correct constituency identification | >99% | Manual audit sample |

---

## Security Considerations

1. **PII Handling**: Extracted addresses are PII - apply same protections as other constituent data
2. **API Key Management**: postcodes.io is free but if using paid tier, secure API keys
3. **Rate Limiting**: Implement rate limiting on extraction to prevent abuse
4. **Logging**: Log verification events for audit, but sanitize PII in logs

---

## Related Documentation

- [Triage System Design](../triage_design.md)
- [Inbound Rules Architecture](./inbound-rules.md)
- [TriageContextDto](../../server/src/application/dtos/TriageContextDto.ts)
- [postcodes.io API Documentation](https://postcodes.io/docs)
