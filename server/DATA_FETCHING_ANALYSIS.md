# Data Fetching & API Analysis

This document details how the legacy CaseWorker application fetches data and provides information for integration with the Shadow Database.

## Overview

The CaseWorker application is a **frontend-only React application** that communicates with a backend API. All data operations are performed through RESTful API calls.

**Key Finding**: The database and backend logic reside on a separate server that exposes a REST API at `/api/ajax/{endpoint}`.

---

## API Architecture

### Base URL Pattern

```javascript
const baseUrl = window.location.protocol + "//" + window.location.host + "/api/ajax"
```

### HTTP Methods

| Method | Function | Description |
|--------|----------|-------------|
| GET | `get(url, signal)` | Retrieve data |
| POST | `post(url, data, signal)` | Create/search operations |
| PUT | `put(url, data, signal)` | Full updates |
| PATCH | `patch(url, data, signal)` | Partial updates |
| DELETE | `deleteReq(url, data, signal)` | Delete operations |
| POST (file) | `file(url, data, signal)` | FormData file uploads |

---

## Authentication

### Token-Based (JWT)

**Login:**
```
POST /api/ajax/auth
Body: { email, password, secondFactor (OTP), locale }
Response: JWT token as plain text
```

**SSO:**
```
POST /api/ajax/auth/sso
Body: { JWT, locale, type: "microsoft" }
```

### Request Headers
```javascript
{
  "Content-Type": "application/json",
  "Authorization": localStorage.getItem("token")
}
```

### Token Management
- **Storage**: `window.localStorage.getItem("token")`
- **Refresh**: Token updated from response headers if present
- **Timeout**: 30-minute inactivity timeout

---

## Core Data Flows

### 1. Inbox/Email Triage Flow

```
[Poll Legacy API]
      │
      ▼
POST /inbox/search
{ actioned: false, type: 'received', dateFrom: today }
      │
      ▼
[For each email]
      │
      ├── POST /inbox/constituentMatches { email }
      │         │
      │         ▼
      │   [Constituent found?]
      │         │
      │    ┌────┴────┐
      │   Yes       No
      │    │         │
      │    ▼         ▼
      │   GET cases  [Flag as new]
      │
      ▼
[User Decision]
      │
      ├── Create Case: POST /cases + PATCH /emails/{id} { actioned: true }
      ├── Add to Case: PATCH /cases/{id} + PATCH /emails/{id} { actioned: true }
      └── Ignore: PATCH /emails/{id} { actioned: true }
```

### 2. Case Management Flow

```
[Search/List]
POST /cases/search
{
  pageNo, resultsPerPage,
  dateRange: { type, from, to },
  statusID[], casetypeID[], caseworkerID[]
}
      │
      ▼
[View Case]
GET /cases/{id}
      │
      ├── GET /cases/{id}/casenotes
      ├── GET /cases/{id}/attachments
      └── GET /reviewDates/forCase/{id}
      │
      ▼
[Update]
PATCH /cases/{id} { ... }
```

### 3. Constituent Management Flow

```
[Search]
POST /constituents/search { term, page, limit }
      │
      ▼
[View]
GET /constituents/{id}
GET /constituents/{id}/contactDetails
GET /connections/fromconstituentid/{id}
      │
      ▼
[Create Contact Detail]
POST /contactDetails { constituentID, contactTypeID, value, source }
```

---

## Rate Limiting

The legacy API has rate limits. Recommended approach:

- **Maximum**: 10 requests per second
- **Use token bucket algorithm**
- **Implement exponential backoff on 429 errors**

---

## Local Storage Keys

| Key | Description |
|-----|-------------|
| `token` | JWT authentication token |
| `installationPreferences` | Locale, org settings, feature flags |
| `userIdentity` | Current user information |
| `userPreferences` | User-specific settings |
| `masterConfig` | Global app configuration |
| `casetypes` | Case type reference data |
| `contacttypes` | Contact type reference data |
| `enquirytypes` | Enquiry type reference data |
| `statustypes` | Status type reference data |

---

## Shadow Database Sync Strategy

### Initialization (Parallel Fetch)

```javascript
Promise.all([
  POST /inbox/search { actioned: false, type: 'received', dateFrom: today },
  POST /cases/search { dateRange: { type: 'created', from: yesterday } },
  POST /constituents/search { createdAfter: yesterday }
])
```

### Continuous Polling

```
Every 5 minutes:
  POST /cases/search { dateRange: { type: 'modified', from: lastPoll } }
  POST /constituents/search { modifiedAfter: lastPoll }
```

### Dual Write Pattern

When user creates/updates:

1. **Step 1**: Write to Legacy API (blocking)
2. **Step 2**: On success, write to Shadow DB with `external_id`
3. **Step 3**: Return Shadow DB object to frontend

---

## API Endpoint Summary

| Entity | Create | Read | Update | Delete | Search |
|--------|--------|------|--------|--------|--------|
| Cases | POST /cases | GET /cases/{id} | PATCH /cases/{id} | DELETE /cases/{id} | POST /cases/search |
| Constituents | POST /constituents | GET /constituents/{id} | PATCH /constituents/{id} | - | POST /constituents/search |
| Emails | POST /emails | GET /emails/{id} | PATCH /emails/{id} | DELETE /emails/{id} | POST /emails/search |
| Casenotes | POST /cases/{id}/notes | GET /casenotes/{id} | PATCH /casenotes/{id} | DELETE /casenotes/{id} | GET /cases/{id}/casenotes |
| Tags | POST /tags | GET /tags/{id} | PATCH /tags | DELETE /tags/{id} | POST /tags/search |
| Flags | POST /flags | GET /flags/{id} | PATCH /flags | DELETE /flags/{id} | POST /flags/search |
| Files | POST /casefiles | GET /casefiles/{id} | PATCH /casefiles/{id} | DELETE /casefiles/{id} | GET /cases/{id}/attachments |

---

## Error Handling

| Code | Meaning | Action |
|------|---------|--------|
| 401 | Unauthorized | Trigger auto-logout, refresh token |
| 403 | Forbidden | User lacks permission |
| 404 | Not Found | Resource doesn't exist |
| 429 | Rate Limited | Exponential backoff, retry |
| 5xx | Server Error | Retry with backoff |

---

## Security Considerations

1. **Token in localStorage**: Vulnerable to XSS - consider HttpOnly cookies
2. **Cross-subdomain**: Ensure backend validates tenant in JWT
3. **Rate limiting**: Implement client-side to avoid blocks
4. **Token refresh**: Implement before expiry
