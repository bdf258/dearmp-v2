# Legacy API Routes Reference

This document details the exact API routes available in the legacy Caseworker system for integration with the Shadow Database/Anti-Corruption Layer.

## Base URL

All API calls go to:
```
https://{host}/api/ajax/{endpoint}
```

## Authentication

### Login
```
POST /auth
Body: { email, password, secondFactor, locale }
Response: JWT token (plain text)
```

### SSO (Microsoft)
```
POST /auth/sso
Body: { JWT, locale, type: "microsoft" }
```

### Required Headers
```javascript
{
  "Content-Type": "application/json",
  "Authorization": "{jwt-token-from-login}"
}
```

---

## Core Triage Pipeline Endpoints

These are the primary endpoints needed for the triage pipeline:

### 1. Inbox Operations

| Endpoint | Method | Purpose | Payload |
|----------|--------|---------|---------|
| `/inbox/search` | POST | Fetch new emails | `{ actioned: false, type: 'received', dateFrom, page, limit }` |
| `/inbox/constituentMatches` | POST | Match email to constituent | `{ email: string }` |
| `/inbox/getInboxes` | GET | List available inboxes | - |
| `/inbox/bulkActions/createCases` | POST | Create cases from emails | `{ emailIds[], constituentId?, caseTypeId? }` |
| `/inbox/bulkActions/assignCaseworker` | POST | Assign caseworker | `{ emailIds[], caseworkerId }` |
| `/inbox/triggerAutomation` | POST | Trigger automation rules | `{ emailId }` |

### 2. Cases

| Endpoint | Method | Purpose | Payload |
|----------|--------|---------|---------|
| `/cases` | POST | Create case | `{ constituentID, caseTypeID, statusID, categoryTypeID, contactTypeID, assignedToID, summary, reviewDate }` |
| `/cases/{id}` | GET | Get case details | - |
| `/cases/{id}` | PATCH | Update case | Partial case object |
| `/cases/{id}` | DELETE | Delete case | - |
| `/cases/search` | POST | Search cases | See search payload below |
| `/cases/{id}/merge` | POST | Merge cases | `{ targetCaseId }` |
| `/cases/statistics/casetype/{id}` | GET | Case type statistics | - |

**Case Search Payload:**
```javascript
{
  pageNo: number,
  resultsPerPage: number,
  orderBy: { field: string, direction: 'asc' | 'desc' },
  dateRange: {
    type: 'created' | 'modified',
    from: ISO8601,
    to: ISO8601
  },
  casetypeID: number[],
  statusID: number[],
  categorytypeID: number[],
  caseworkerID: number[],
  tagged: { searchType: 'all' | 'any', tagID: number[] },
  notTagged: boolean,
  searchString: string
}
```

### 3. Constituents

| Endpoint | Method | Purpose | Payload |
|----------|--------|---------|---------|
| `/constituents` | POST | Create constituent | `{ firstName, lastName, title, organisationType? }` |
| `/constituents/{id}` | GET | Get constituent | - |
| `/constituents/{id}` | PATCH | Update constituent | Partial constituent object |
| `/constituents/search` | POST | Search constituents | `{ term, page, limit, createdAfter? }` |
| `/constituents/{id}/contactDetails` | GET | Get contact details | - |
| `/constituent/{id}/merge` | POST | Merge constituents | `{ sourceId, precedence }` |
| `/constituent/{id}/geocode` | DELETE | Remove geocode | - |
| `/constituents/initRequest` | POST | CSV import | FormData |

### 4. Contact Details

| Endpoint | Method | Purpose | Payload |
|----------|--------|---------|---------|
| `/contactDetails` | POST | Add contact detail | `{ contactTypeID, constituentID, value, source }` |
| `/contactDetails/{id}` | PATCH | Update contact detail | `{ id, value }` |
| `/contactDetails/{id}` | DELETE | Delete contact detail | - |

### 5. Emails

| Endpoint | Method | Purpose | Payload |
|----------|--------|---------|---------|
| `/emails/{id}` | GET | Get email | - |
| `/emails` | POST | Save draft | `{ to, cc, bcc, from, htmlBody, subject, caseID }` |
| `/emails/{id}` | PATCH | Update email | `{ emailID, ...fields }` or `{ actioned: boolean }` |
| `/emails/{id}` | DELETE | Delete email | - |
| `/emails/{id}/send` | POST | Send email | - |
| `/emails/search` | POST | Search emails | `{ page, limit, subject, to, from, body, type, caseWorkerIds }` |
| `/emails/{id}/attach` | POST | Attach file | `{ content, name, type }` or `{ type, caseFileID, letterID, signed }` |
| `/emails/attachments/{id}` | DELETE | Delete attachment | - |
| `/emails/attachments/{id}/content` | GET | Get attachment content | - |
| `/emails/{id}/cancel` | GET | Get scheduled count | - |
| `/emails/{id}/cancel` | POST | Cancel scheduled | - |
| `/emails/bulkactions/markasactioned` | POST | Bulk mark actioned | `{ emailIds[] }` |
| `/emails/bulkactions/delete` | POST | Bulk delete | `{ emailIds[] }` |
| `/emails/from` | GET | Get from addresses | - |
| `/emails/from/validate` | POST | Validate from address | `{ email }` |
| `/emails/getEmailBody` | POST | Get template body | `{ templateId }` |
| `/emails/checkEmailMergeCodes` | POST | Validate merge codes | `{ body }` |

### 6. Case Notes

| Endpoint | Method | Purpose | Payload |
|----------|--------|---------|---------|
| `/casenotes/{id}` | GET | Get case note | - |
| `/casenotes/{id}` | PATCH | Update case note | Partial casenote |
| `/casenotes/{id}` | DELETE | Delete case note | - |
| `/cases/{id}/casenotes` | GET | List case notes | `?page=&limit=&orderBy=` |
| `/cases/{id}/notes` | GET | Get notes only | - |
| `/cases/{id}/notes` | POST | Create note | `{ note }` |
| `/cases/{id}/emails` | GET | Get emails only | - |
| `/cases/{id}/letters` | GET | Get letters only | - |
| `/cases/{id}/files` | GET | Get files only | - |
| `/cases/{id}/appointments` | GET | Get appointments | - |
| `/cases/{id}/reviewDates` | GET | Get review dates | - |
| `/cases/{id}/attachments` | GET | Get all attachments | - |

### 7. Case Files

| Endpoint | Method | Purpose | Payload |
|----------|--------|---------|---------|
| `/casefiles` | POST | Upload file | FormData with file + data |
| `/casefiles/{id}` | GET | Get file info | - |
| `/casefiles/{id}` | PATCH | Update file | `{ reference }` |
| `/casefiles/{id}` | DELETE | Delete file | - |
| `/casefiles/{id}/content` | GET | Download content | - |

### 8. Review Dates

| Endpoint | Method | Purpose | Payload |
|----------|--------|---------|---------|
| `/reviewDates` | POST | Create review date | `{ reviewDate, note, caseID, assignedTo }` |
| `/reviewDates/{id}` | GET | Get review date | - |
| `/reviewDates/{id}` | PATCH | Update review date | Partial object |
| `/reviewDates/{id}` | DELETE | Delete review date | - |
| `/reviewDates/{id}/complete` | POST | Mark complete | - |
| `/reviewDates/{id}/incomplete` | POST | Mark incomplete | - |
| `/reviewDates/forCase/{id}` | GET | List for case | - |
| `/reviewDates/forCase/{id}` | POST | Create for case | `{ reviewDate, note, assignedTo }` |
| `/reviewDates/forCase/{id}/update` | POST | Update for case | `{ reviewDate, note }` |

### 9. Tags

| Endpoint | Method | Purpose | Payload |
|----------|--------|---------|---------|
| `/tags` | POST | Create tag | `{ tag }` |
| `/tags/{id}` | GET | Get tag | - |
| `/tags` | PATCH | Update tag | `{ id, tag }` |
| `/tags/{id}` | DELETE | Delete tag | - |
| `/tags/search` | POST | Search tags | `{ term }` |
| `/tags/silent/{id}` | DELETE | Delete if unused | - |
| `/managetags/merge` | POST | Merge tags | `{ idsToBeMerged, tagToMergeInto: { id, tag } }` |
| `/managetags/delete` | POST | Bulk delete tags | `{ ids[] }` |

### 10. Flags

| Endpoint | Method | Purpose | Payload |
|----------|--------|---------|---------|
| `/flags` | POST | Create flag | `{ flag }` |
| `/flags/{id}` | GET | Get flag | - |
| `/flags` | PATCH | Update flag | `{ id, flag }` |
| `/flags/{id}` | DELETE | Delete flag | - |
| `/flags/search` | POST | Search flags | `{ term }` |
| `/manageflags/merge` | POST | Merge flags | `{ idsToBeMerged, flagToMergeInto }` |
| `/manageflags/delete` | POST | Bulk delete flags | `{ ids[] }` |
| `/flags/flagsToSegment` | POST | Add flags to segment | `{ flagIds[], segmentId }` |

### 11. Caseworkers

| Endpoint | Method | Purpose | Payload |
|----------|--------|---------|---------|
| `/caseworkers` | GET | List active caseworkers | - |
| `/caseworkers/all` | GET | List all caseworkers | - |
| `/caseworkers/forCase/{id}` | GET | Available for case | - |

### 12. Reference Data

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/connectionTypes` | GET | Get connection types |
| `/roleTypes` | GET | Get role types |
| `/organisations/types` | GET | Get organisation types |

### 13. Custom Fields

| Endpoint | Method | Purpose | Payload |
|----------|--------|---------|---------|
| `/customfields` | POST | Create field | `{ name, fieldType }` |
| `/customfields/{id}` | PATCH | Update field | Partial object |
| `/customfields/bulkedit` | POST | Bulk edit | `{ fields[] }` |
| `/customfields/test` | POST | Test name unique | `{ name }` |

### 14. Connections

| Endpoint | Method | Purpose | Payload |
|----------|--------|---------|---------|
| `/connections` | POST | Create connection | `{ parentID, childID, connectionTypeID }` |
| `/connections/fromconstituentid/{id}` | GET | Get connections | - |

### 15. SMS

| Endpoint | Method | Purpose | Payload |
|----------|--------|---------|---------|
| `/SMSData` | GET | Get SMS data | - |
| `/SMSData` | POST | Get by date range | `{ from, to }` |
| `/sms/send` | POST | Send SMS | `{ caseID, from, to, body }` |
| `/sms/{id}` | PATCH | Update SMS | `{ actioned }` |

---

## Bulk Operations on Cases

| Endpoint | Method | Payload |
|----------|--------|---------|
| `/cases/bulkactions/attachfile` | POST | `{ caseIds[], file }` |
| `/cases/bulkactions/addnote` | POST | `{ caseIds[], note }` |
| `/cases/bulkactions/changestatus` | POST | `{ caseIds[], statusId }` |
| `/cases/bulkactions/addtags` | POST | `{ caseIds[], tagIds[] }` |
| `/cases/bulkactions/sendemail` | POST | `{ caseIds[], emailTemplate }` |
| `/cases/bulkactions/setreviewdate` | POST | `{ caseIds[], reviewDate }` |
| `/cases/bulkactions/clearreviewdate` | POST | `{ caseIds[] }` |
| `/cases/bulkactions/details` | POST | `{ caseIds[], updates }` |
| `/cases/bulkactions/delete` | POST | `{ caseIds[] }` |

---

## Rate Limiting

The legacy system has a rate limit of approximately **10 requests per second**. The Shadow System must implement rate limiting to avoid being blocked.

## Error Handling

- **401 Unauthorized**: Token expired or invalid - triggers auto-logout
- **403 Forbidden**: User lacks permission for resource
- **404 Not Found**: Resource doesn't exist
- **429 Too Many Requests**: Rate limit exceeded

---

## Triage Pipeline Integration Points

### Initialization (Parallel)
```javascript
Promise.all([
  POST /inbox/search { actioned: false, type: 'received', dateFrom: today },
  POST /cases/search { dateRange: { type: 'created', from: yesterday, to: now } },
  POST /constituents/search { createdAfter: yesterday }
])
```

### Per-Email Processing
```javascript
// 1. Find constituent match
POST /inbox/constituentMatches { email: emailFrom }

// 2. If match found, get their cases
GET /constituents/{id}/cases
```

### Commit Actions
```javascript
// Create new constituent
POST /constituents { firstName, lastName, ... }
POST /contactDetails { constituentID, contactTypeID, value, source }

// Create case
POST /cases { constituentID, caseTypeID, statusID, ... }

// Or update existing case
PATCH /cases/{id} { ... }

// Mark email as actioned
PATCH /emails/{id} { actioned: true }
```
