# Database Schema Analysis - Legacy Caseworker System

## Overview

This document describes the inferred database schema for the legacy Caseworker MP application, reverse-engineered from API endpoints, request/response structures, and frontend state management.

## Confidence Levels

| Level | Description |
|-------|-------------|
| **HIGH** | Multiple API endpoints, JSDoc documentation, clear CRUD operations |
| **MEDIUM** | Referenced in APIs but limited detail available |
| **LOW** | Inferred from naming or indirect references |

---

## Core Entities

### 1. Cases (Confidence: HIGH)

The central entity representing constituent issues/requests.

```sql
CREATE TABLE cases (
    id                  INTEGER PRIMARY KEY,
    constituent_id      INTEGER NOT NULL REFERENCES constituents(id),
    case_type_id        INTEGER REFERENCES case_types(id),
    status_id           INTEGER REFERENCES status_types(id),
    category_type_id    INTEGER REFERENCES category_types(id),
    contact_type_id     INTEGER REFERENCES contact_types(id),
    assigned_to_id      INTEGER REFERENCES caseworkers(id),
    summary             TEXT,
    review_date         TIMESTAMP,
    created_at          TIMESTAMP,
    updated_at          TIMESTAMP
);
```

**API Evidence:**
- `POST /cases` - Create case
- `GET /cases/{id}`, `PATCH /cases/{id}`, `DELETE /cases/{id}` - Full CRUD
- `POST /cases/{id}/merge` - Merge cases
- `POST /cases/search` - Complex search

### 2. Constituents (Confidence: HIGH)

People who contact the caseworker/MP for assistance.

```sql
CREATE TABLE constituents (
    id                  INTEGER PRIMARY KEY,
    first_name          VARCHAR(255),
    last_name           VARCHAR(255),
    title               VARCHAR(50),
    organisation_type   VARCHAR(255),
    geocode_lat         DECIMAL,
    geocode_lng         DECIMAL,
    created_at          TIMESTAMP,
    updated_at          TIMESTAMP
);
```

### 3. Contact Details (Confidence: HIGH)

Contact information for constituents (phone, email, address, etc.).

```sql
CREATE TABLE contact_details (
    id                  INTEGER PRIMARY KEY,
    constituent_id      INTEGER NOT NULL REFERENCES constituents(id),
    contact_type_id     INTEGER REFERENCES contact_types(id),
    value               TEXT NOT NULL,
    source              VARCHAR(255),
    created_at          TIMESTAMP,
    updated_at          TIMESTAMP
);
```

### 4. Casenotes (Confidence: HIGH)

Activity records attached to cases.

```sql
CREATE TABLE casenotes (
    id                  INTEGER PRIMARY KEY,
    case_id             INTEGER NOT NULL REFERENCES cases(id),
    type                VARCHAR(50) NOT NULL,  -- 'note', 'email', 'letter', 'file', 'reviewDate', 'appointment'
    subtype_id          INTEGER,
    content             TEXT,
    actioned            BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP,
    updated_at          TIMESTAMP
);
```

### 5. Caseworkers / Users (Confidence: HIGH)

Staff members who handle cases.

```sql
CREATE TABLE caseworkers (
    id                  INTEGER PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    email               VARCHAR(255) UNIQUE,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP,
    updated_at          TIMESTAMP
);
```

### 6. Emails (Confidence: HIGH)

Email messages (drafts, sent, or received).

```sql
CREATE TABLE emails (
    id                  INTEGER PRIMARY KEY,
    case_id             INTEGER REFERENCES cases(id),
    constituent_id      INTEGER REFERENCES constituents(id),
    type                VARCHAR(50),  -- 'draft', 'sent', 'received', 'scheduled'
    subject             TEXT,
    html_body           TEXT,
    from_address        VARCHAR(255),
    to_addresses        TEXT,  -- JSON array
    cc_addresses        TEXT,
    bcc_addresses       TEXT,
    actioned            BOOLEAN DEFAULT FALSE,
    assigned_to_id      INTEGER REFERENCES caseworkers(id),
    scheduled_at        TIMESTAMP,
    sent_at             TIMESTAMP,
    created_at          TIMESTAMP,
    updated_at          TIMESTAMP
);
```

### 7. Email Attachments (Confidence: HIGH)

```sql
CREATE TABLE email_attachments (
    id                  INTEGER PRIMARY KEY,
    email_id            INTEGER NOT NULL REFERENCES emails(id),
    type                VARCHAR(50),  -- 'caseFile', 'letter', 'emailAttachment'
    file_name           VARCHAR(255),
    content             BYTEA,
    mime_type           VARCHAR(100),
    case_file_id        INTEGER REFERENCES case_files(id),
    letter_id           INTEGER REFERENCES letters(id),
    signed              BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP
);
```

### 8. Tags (Confidence: HIGH)

Labels applied to cases.

```sql
CREATE TABLE tags (
    id                  INTEGER PRIMARY KEY,
    tag                 VARCHAR(255) NOT NULL UNIQUE,
    created_at          TIMESTAMP,
    updated_at          TIMESTAMP
);

CREATE TABLE case_tags (
    case_id             INTEGER REFERENCES cases(id),
    tag_id              INTEGER REFERENCES tags(id),
    PRIMARY KEY (case_id, tag_id)
);
```

### 9. Flags (Confidence: HIGH)

Labels applied to constituents.

```sql
CREATE TABLE flags (
    id                  INTEGER PRIMARY KEY,
    flag                VARCHAR(255) NOT NULL UNIQUE,
    created_at          TIMESTAMP,
    updated_at          TIMESTAMP
);

CREATE TABLE constituent_flags (
    constituent_id      INTEGER REFERENCES constituents(id),
    flag_id             INTEGER REFERENCES flags(id),
    PRIMARY KEY (constituent_id, flag_id)
);
```

### 10. Case Files (Confidence: HIGH)

File attachments on cases.

```sql
CREATE TABLE case_files (
    id                  INTEGER PRIMARY KEY,
    case_id             INTEGER NOT NULL REFERENCES cases(id),
    file_name           VARCHAR(255),
    file_content        BYTEA,
    mime_type           VARCHAR(100),
    reference           TEXT,
    created_at          TIMESTAMP,
    updated_at          TIMESTAMP
);
```

### 11. Review Dates (Confidence: HIGH)

Scheduled follow-up dates.

```sql
CREATE TABLE review_dates (
    id                  INTEGER PRIMARY KEY,
    case_id             INTEGER NOT NULL REFERENCES cases(id),
    assigned_to_id      INTEGER REFERENCES caseworkers(id),
    review_date         TIMESTAMP NOT NULL,
    note                TEXT,
    is_completed        BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP,
    updated_at          TIMESTAMP
);
```

### 12. Custom Fields (Confidence: HIGH)

Extensible fields for cases.

```sql
CREATE TABLE custom_field_definitions (
    id                  INTEGER PRIMARY KEY,
    name                VARCHAR(255) NOT NULL UNIQUE,
    field_type          VARCHAR(50),
    created_at          TIMESTAMP,
    updated_at          TIMESTAMP
);

CREATE TABLE custom_field_values (
    id                  INTEGER PRIMARY KEY,
    case_id             INTEGER NOT NULL REFERENCES cases(id),
    custom_field_id     INTEGER NOT NULL REFERENCES custom_field_definitions(id),
    value               TEXT,
    UNIQUE(case_id, custom_field_id)
);
```

### 13. Connections (Confidence: MEDIUM)

Relationships between constituents.

```sql
CREATE TABLE connections (
    id                  INTEGER PRIMARY KEY,
    parent_id           INTEGER NOT NULL REFERENCES constituents(id),
    child_id            INTEGER NOT NULL REFERENCES constituents(id),
    connection_type_id  INTEGER REFERENCES connection_types(id),
    created_at          TIMESTAMP
);
```

---

## Reference Data Tables

### Status Types
```sql
CREATE TABLE status_types (
    id                  INTEGER PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    is_active           BOOLEAN DEFAULT TRUE
);
```

### Case Types
```sql
CREATE TABLE case_types (
    id                  INTEGER PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    is_active           BOOLEAN DEFAULT TRUE
);
```

### Category Types
```sql
CREATE TABLE category_types (
    id                  INTEGER PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    is_active           BOOLEAN DEFAULT TRUE
);
```

### Contact Types
```sql
CREATE TABLE contact_types (
    id                  INTEGER PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    type                VARCHAR(50),  -- 'enquiry' or 'contact'
    is_active           BOOLEAN DEFAULT TRUE
);
```

### Connection Types
```sql
CREATE TABLE connection_types (
    id                  INTEGER PRIMARY KEY,
    name                VARCHAR(255) NOT NULL
);
```

---

## Entity Relationships Diagram

```
                              ┌─────────────────┐
                              │  CASEWORKERS    │
                              │  (Users)        │
                              └────────┬────────┘
                                       │
                      ┌────────────────┼────────────────┐
                      │ assigned_to    │                │
                      ▼                ▼                ▼
┌─────────────┐  ┌─────────┐    ┌─────────────┐   ┌─────────────┐
│ CONSTITUENTS│◄─│  CASES  │───►│ REVIEW_DATES│   │   EMAILS    │
└──────┬──────┘  └────┬────┘    └─────────────┘   └─────────────┘
       │              │
       │              │ case_id
       │              ├───────────────┬─────────────────┐
       │              ▼               ▼                 ▼
       │       ┌─────────────┐  ┌─────────┐      ┌─────────────┐
       │       │  CASENOTES  │  │  TAGS   │◄────►│ CASE_TAGS   │
       │       └─────────────┘  └─────────┘      └─────────────┘
       │
       │ constituent_id
       ├───────────────┬────────────────────┐
       ▼               ▼                    ▼
┌─────────────┐  ┌─────────────┐     ┌─────────────┐
│CONTACT_DETS │  │   FLAGS     │◄───►│CONSTIT_FLAGS│
└─────────────┘  └─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│CONNECTIONS  │ (parent_id, child_id)
└─────────────┘
```

---

## Shadow Database External ID Mapping

Every table in the Shadow DB that mirrors a Legacy Entity MUST have:

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Internal ID for our system |
| `external_id` | INTEGER | The ID from the Legacy System (indexed, unique) |
| `last_synced_at` | TIMESTAMP | When this record was last synced |
