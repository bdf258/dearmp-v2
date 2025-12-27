# X-Road Integration Strategy for DearMP v2

## Strategic Evaluation: Secure Data Exchange for Government Case Management Systems

**Document Version:** 1.0
**Date:** December 2024
**Classification:** Strategic Planning

---

## Executive Summary

This document evaluates the integration of DearMP v2 with X-Road or equivalent secure data exchange infrastructure. The evaluation assumes DearMP operates as one of approximately 100 government-commissioned case management systems, each serving a distinct industry vertical (healthcare, social services, housing, immigration, benefits, education, etc.) with significant market penetration (20%+ market share).

The strategic imperative is clear: constituent cases rarely exist in isolation. A housing complaint may intersect with benefits data; an immigration case may require health service records; a planning dispute may need environmental agency inputs. Currently, these connections require manual data gathering across systems, creating delays, errors, and citizen frustration.

**Recommendation:** Pursue a phased X-Road integration, beginning with the Estonian/Finnish X-Road 8 reference implementation, while maintaining architectural flexibility for UK-specific adaptations or alternative protocols.

---

## Table of Contents

1. [What is X-Road?](#1-what-is-x-road)
2. [The Strategic Context](#2-the-strategic-context)
3. [Current DearMP Architecture Assessment](#3-current-dearmp-architecture-assessment)
4. [X-Road Integration Architecture](#4-x-road-integration-architecture)
5. [X-Road Derivatives and Alternatives](#5-x-road-derivatives-and-alternatives)
6. [Non-X-Road Alternatives](#6-non-x-road-alternatives)
7. [Security and Compliance Considerations](#7-security-and-compliance-considerations)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Cost-Benefit Analysis](#9-cost-benefit-analysis)
10. [Risk Assessment](#10-risk-assessment)
11. [Recommendations](#11-recommendations)
12. [MVP: Low-Cost Preparation for Future Federation](#12-mvp-low-cost-preparation-for-future-federation)

---

## 1. What is X-Road?

### 1.1 Overview

X-Road is an open-source software and ecosystem solution that provides unified, secure data exchange between organizations. Originally developed by Estonia (2001) and now jointly maintained with Finland, it forms the backbone of e-Estonia and is deployed in over 20 countries.

### 1.2 Core Capabilities

| Capability | Description |
|------------|-------------|
| **Federated Architecture** | No central database; data remains with authoritative sources |
| **Mutual Authentication** | All parties cryptographically authenticated (mTLS + signed messages) |
| **Non-repudiation** | All exchanges logged with tamper-proof audit trails |
| **Message-Level Security** | Encryption and signing at application layer, not just transport |
| **Distributed Trust** | No single point of compromise; Byzantine fault-tolerant |
| **Service Registry** | Centralized catalog of available services and providers |

### 1.3 Architectural Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                        X-ROAD ECOSYSTEM                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐           ┌──────────────┐           ┌──────────────┐
│  │   Member A   │           │  Central     │           │   Member B   │
│  │  (DearMP)    │           │  Authority   │           │  (HMRC)      │
│  │              │           │              │           │              │
│  │ ┌──────────┐ │           │ ┌──────────┐ │           │ ┌──────────┐ │
│  │ │ Security │◄├───────────┤►│ Trust    │◄├───────────┤►│ Security │ │
│  │ │ Server   │ │   mTLS    │ │ Services │ │   mTLS    │ │ Server   │ │
│  │ └────┬─────┘ │           │ └──────────┘ │           │ └────┬─────┘ │
│  │      │       │           │              │           │      │       │
│  │ ┌────▼─────┐ │           │ ┌──────────┐ │           │ ┌────▼─────┐ │
│  │ │ Adapter  │ │           │ │ Service  │ │           │ │ Adapter  │ │
│  │ │ Service  │ │           │ │ Registry │ │           │ │ Service  │ │
│  │ └────┬─────┘ │           │ └──────────┘ │           │ └────┬─────┘ │
│  │      │       │           │              │           │      │       │
│  │ ┌────▼─────┐ │           │ ┌──────────┐ │           │ ┌────▼─────┐ │
│  │ │ DearMP   │ │           │ │ Timestamp│ │           │ │ Backend  │ │
│  │ │ Backend  │ │           │ │ Authority│ │           │ │ System   │ │
│  │ └──────────┘ │           │ └──────────┘ │           │ └──────────┘ │
│  └──────────────┘           └──────────────┘           └──────────────┘
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.4 Key Design Principles

1. **Data Sovereignty**: Each organization controls its own data
2. **Once-Only Principle**: Citizens provide data once; systems share it
3. **Decentralized**: No central bottleneck or single point of failure
4. **Auditable**: Every request and response logged for compliance
5. **Technology Agnostic**: REST/SOAP adapters for any backend system

---

## 2. The Strategic Context

### 2.1 The 100-System Ecosystem

Assuming DearMP is one of ~100 case management systems commissioned by government, each with 20%+ market share in its vertical:

| Sector | Example Systems | Data Exchange Needs |
|--------|-----------------|---------------------|
| Healthcare | NHS Trusts, GP Practices | Patient records, referrals |
| Social Services | Local Authority Care | Care assessments, safeguarding |
| Housing | Housing Associations | Tenancy records, repairs, allocations |
| Benefits | DWP, Local Welfare | Eligibility, payments, fraud detection |
| Immigration | Home Office | Status checks, casework |
| Education | Schools, Universities | Enrollment, safeguarding |
| Justice | Courts, Probation | Case status, compliance |
| Environment | Planning, EPA | Permits, enforcement |
| Transport | DVLA, TfL | Licenses, permits |
| Tax | HMRC | Tax status, compliance |

### 2.2 The Interoperability Imperative

**Current State (Fragmented):**
```
Citizen → MP Office → Manual lookup in 5 systems → Delays → Errors → Frustration
```

**Target State (Federated):**
```
Citizen → MP Office → Automated X-Road queries → Real-time data → Resolution
```

### 2.3 Scale Considerations

With 100 systems, each potentially needing to communicate with the others:

- **Direct P2P Integration**: 100 × 99 / 2 = **4,950 bilateral integrations**
- **Hub-and-Spoke (API Gateway)**: 100 integrations, but single point of failure
- **Federated (X-Road model)**: 100 integrations + shared infrastructure

The federated model becomes dramatically more efficient as the ecosystem grows.

### 2.4 Estimated Transaction Volumes

| Metric | Conservative | Moderate | Aggressive |
|--------|--------------|----------|------------|
| Daily cross-system queries | 50,000 | 250,000 | 1,000,000 |
| Peak queries/second | 10 | 50 | 200 |
| Average payload size | 5 KB | 10 KB | 50 KB |
| Daily data transferred | 250 MB | 2.5 GB | 50 GB |

X-Road is designed to handle these volumes with horizontal scaling of Security Servers.

---

## 3. Current DearMP Architecture Assessment

### 3.1 Integration Readiness Score

| Criterion | Current State | X-Road Readiness | Gap |
|-----------|---------------|------------------|-----|
| **API Layer** | REST endpoints exist | ✅ Ready | Minor adaptation |
| **Authentication** | JWT + Supabase Auth | ⚠️ Partial | Need X.509 certs |
| **Data Models** | Custom schemas | ⚠️ Partial | Need canonical mapping |
| **Audit Logging** | Basic logging | ⚠️ Partial | Need structured trails |
| **Message Signing** | Not implemented | ❌ Gap | Significant work |
| **Rate Limiting** | Express rate-limit | ✅ Ready | Compatible |
| **Multi-tenancy** | Office-based RLS | ✅ Ready | Maps to X-Road members |

### 3.2 Architectural Strengths

1. **Anti-Corruption Layer Pattern**: Already isolates external system complexity
2. **Background Job Queue (pg-boss)**: Can handle async X-Road message processing
3. **PostgreSQL Backend**: X-Road Security Server uses PostgreSQL; compatible ops
4. **TypeScript/Node.js Stack**: Good library support for X-Road protocols
5. **Supabase Realtime**: Can broadcast cross-system data updates to UI

### 3.3 Architectural Gaps

1. **No X.509 Certificate Infrastructure**: Current auth is token-based
2. **No Message-Level Signing**: Transport security only (HTTPS)
3. **No Canonical Data Models**: Custom schemas lack interop mappings
4. **Limited Structured Logging**: Need OWASP-style audit trails
5. **No Service Discovery**: Hardcoded external system endpoints

### 3.4 Current External Integration Points

```
DearMP v2 External Integrations
├── Legacy Caseworker API (sync source)
│   └── Anti-Corruption Layer with field mapping
├── Google Gemini API (AI classification)
│   └── Edge Function integration
├── Outlook Web Access (email sending)
│   └── Browser automation with session management
└── Supabase Services
    ├── Auth (identity management)
    ├── Database (PostgreSQL)
    ├── Realtime (WebSocket subscriptions)
    └── Edge Functions (serverless)
```

---

## 4. X-Road Integration Architecture

### 4.1 Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DEARMP X-ROAD INTEGRATION                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        DEARMP APPLICATION                            │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐ │    │
│  │  │ Frontend │  │ Backend  │  │ Workers  │  │ X-Road Adapter       │ │    │
│  │  │ (React)  │  │ (Express)│  │ (pg-boss)│  │ Service (NEW)        │ │    │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  │ ┌──────────────────┐ │ │    │
│  │       │             │             │        │ │ Service Provider │ │ │    │
│  │       │             │             │        │ │ (expose data)    │ │ │    │
│  │       └─────────────┼─────────────┘        │ ├──────────────────┤ │ │    │
│  │                     │                      │ │ Service Consumer │ │ │    │
│  │              ┌──────▼──────┐               │ │ (request data)   │ │ │    │
│  │              │  Supabase   │               │ └──────────────────┘ │ │    │
│  │              │  PostgreSQL │               │         ▲            │ │    │
│  │              └──────┬──────┘               └─────────┼────────────┘ │    │
│  │                     │                               │              │    │
│  └─────────────────────┼───────────────────────────────┼──────────────┘    │
│                        │                               │                    │
│  ┌─────────────────────▼───────────────────────────────▼──────────────────┐ │
│  │                     X-ROAD SECURITY SERVER                             │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │ │
│  │  │ Message      │  │ Signature    │  │ Timestamp    │  │ Audit      │ │ │
│  │  │ Processing   │  │ Verification │  │ Verification │  │ Logging    │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │ │
│  │                            │                                          │ │
│  │                     ┌──────▼──────┐                                   │ │
│  │                     │ Certificate │                                   │ │
│  │                     │ Management  │                                   │ │
│  │                     └──────┬──────┘                                   │ │
│  └────────────────────────────┼──────────────────────────────────────────┘ │
│                               │                                             │
│                               ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                    X-ROAD CENTRAL SERVICES                              ││
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────────┐ ││
│  │  │ Trust Services │  │ Service        │  │ Configuration Management   │ ││
│  │  │ (CA + TSA)     │  │ Registry       │  │                            │ ││
│  │  └────────────────┘  └────────────────┘  └────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                               │                                             │
│                               ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │              OTHER GOVERNMENT SYSTEMS (FEDERATED MEMBERS)               ││
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       ││
│  │  │  HMRC   │  │   NHS   │  │   DWP   │  │  DVLA   │  │  etc... │       ││
│  │  │ Benefits│  │ Records │  │ Claims  │  │ License │  │         │       ││
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘       ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 DearMP as Service Provider

Services DearMP could expose to the X-Road ecosystem:

```typescript
// Example X-Road Service Definitions for DearMP

interface ConstituentLookupRequest {
  // Query by national identifier or partial details
  nationalId?: string;
  email?: string;
  postcode?: string;
  dateOfBirth?: string;
}

interface ConstituentLookupResponse {
  found: boolean;
  constituent?: {
    id: string;
    fullName: string;
    constituency: string;
    activeCase: boolean;
    lastContactDate: string;
  };
}

interface CaseSummaryRequest {
  caseId: string;
  requestingAuthority: string; // X-Road member code
  purpose: string;             // Legal basis for request
}

interface CaseSummaryResponse {
  caseId: string;
  status: 'open' | 'resolved' | 'escalated';
  category: string;
  createdDate: string;
  assignedTo: string;
  relatedAgencies: string[];   // Other X-Road members involved
}

interface ConsentVerificationRequest {
  constituentId: string;
  dataCategory: string;
  requestingSystem: string;
}

interface ConsentVerificationResponse {
  consentGiven: boolean;
  consentDate?: string;
  expiryDate?: string;
  scope?: string[];
}
```

### 4.3 DearMP as Service Consumer

Data DearMP could request from other X-Road members:

| External System | Data Request | Use Case in DearMP |
|-----------------|--------------|---------------------|
| **HMRC** | Tax status verification | Benefits-related cases |
| **DWP** | Benefits entitlement | Universal Credit queries |
| **NHS** | GP registration status | Healthcare casework |
| **DVLA** | Driving license validity | Transport complaints |
| **Home Office** | Immigration status | Visa/citizenship cases |
| **Land Registry** | Property ownership | Housing disputes |
| **Local Authority** | Council tax status | Residency verification |
| **Electoral Register** | Voter registration | Constituency confirmation |

### 4.4 Message Flow Example

```
Caseworker: Clicks "Verify Benefits Status" on constituent case
    │
    ▼
DearMP Backend: Creates X-Road request
    │
    ├── Adds user context (who requested, why)
    ├── Adds constituent consent reference
    ├── Structures payload per DWP service schema
    │
    ▼
X-Road Adapter Service: Prepares message
    │
    ├── Signs message with DearMP private key
    ├── Adds correlation ID for tracking
    ├── Routes to local Security Server
    │
    ▼
DearMP Security Server: Validates and forwards
    │
    ├── Verifies DearMP signature
    ├── Looks up DWP endpoint in registry
    ├── Encrypts with DWP public key
    ├── Adds timestamp from TSA
    ├── Logs request in audit trail
    │
    ▼
[Network] ──────────────────────────────────────────────▶
    │
    ▼
DWP Security Server: Receives and validates
    │
    ├── Verifies DearMP certificate chain
    ├── Validates timestamp freshness
    ├── Checks DearMP authorization for service
    ├── Logs inbound request
    │
    ▼
DWP Backend: Processes request
    │
    ├── Retrieves benefits data
    ├── Applies access control (what can DearMP see?)
    ├── Formats response per schema
    │
    ▼
[Response flows back through same chain with signing/logging]
    │
    ▼
DearMP Backend: Receives response
    │
    ├── Stores in case timeline
    ├── Triggers Supabase Realtime update
    │
    ▼
DearMP Frontend: Updates UI in real-time
    │
    └── Caseworker sees benefits status on case
```

---

## 5. X-Road Derivatives and Alternatives

### 5.1 X-Road Implementations by Country

| Implementation | Country/Region | Status | Notes |
|----------------|---------------|--------|-------|
| **X-Road 8** | Estonia/Finland | Production | Reference implementation |
| **GZDA** | Germany | Development | Based on X-Road, GDPR-focused |
| **UXP** | Ukraine | Production | War-resilient adaptation |
| **X-Road for Japan** | Japan | Pilot | Digital Agency initiative |
| **GovStack** | International | Framework | UN/ITU/Estonia/Germany |
| **MOSIP** | Multi-country | Production | Identity-focused, X-Road compatible |

### 5.2 Open Source Alternatives

#### 5.2.1 Apache Camel + Kafka

**Architecture**: Message-oriented middleware with event streaming

```
Pros:
+ Mature ecosystem with extensive connectors
+ Native Kubernetes support
+ Strong UK developer community
+ Can achieve similar outcomes with less ceremony

Cons:
- No built-in PKI/trust infrastructure
- Audit trails require custom implementation
- No central service registry
- Each system must implement security separately
```

#### 5.2.2 Kong/Tyk API Gateway Federation

**Architecture**: Federated API gateways with central policy management

```
Pros:
+ RESTful and developer-friendly
+ Strong rate limiting and analytics
+ Plugins for authentication (OAuth, mTLS)
+ UK-based company (Tyk)

Cons:
- Hub-and-spoke model, not truly federated
- Less suitable for highly sensitive data
- No message-level non-repudiation
- Requires bespoke audit implementation
```

#### 5.2.3 HashiCorp Consul + Vault

**Architecture**: Service mesh with secrets management

```
Pros:
+ Excellent service discovery
+ Strong secrets and PKI management
+ Zero-trust network architecture
+ Cloud-agnostic

Cons:
- Designed for microservices, not government data exchange
- No standard for cross-organization federation
- Complex operational overhead
- License changes (BSL) may concern public sector
```

### 5.3 Comparison Matrix

| Criterion | X-Road | Camel+Kafka | Kong/Tyk | Consul+Vault |
|-----------|--------|-------------|----------|--------------|
| Federated Trust | ✅ Native | ❌ Custom | ⚠️ Partial | ⚠️ Partial |
| Non-Repudiation | ✅ Built-in | ❌ Custom | ❌ Custom | ❌ Custom |
| Service Registry | ✅ Central | ⚠️ Custom | ✅ Central | ✅ Distributed |
| Audit Trail | ✅ Built-in | ❌ Custom | ⚠️ Logs only | ⚠️ Vault audit |
| Government Use | ✅ Proven | ⚠️ Limited | ⚠️ Limited | ⚠️ Limited |
| UK Precedent | ❌ None | ✅ Common | ✅ Common | ✅ Common |
| Vendor Support | ⚠️ NIIS | ✅ Many | ✅ Kong/Tyk | ✅ HashiCorp |
| Message-Level Crypto | ✅ Native | ❌ Custom | ❌ Transport | ❌ Transport |

---

## 6. Non-X-Road Alternatives

### 6.1 GOV.UK Verify / One Login

**Current UK government identity and data sharing infrastructure**

> ⚠️ **Important Clarification**: GOV.UK One Login is **NOT freely available** to all organizations. While the source code is open source (MIT license for many components, available at [github.com/govuk-one-login](https://github.com/govuk-one-login)), **integration is restricted to**:
> - Central government departments and agencies
> - Some public sector bodies (approved case-by-case)
>
> Private sector organizations and third-party software vendors **cannot integrate** with GOV.UK One Login. The £305M+ programme costs are absorbed centrally by government, not charged per-integration.

```
Architecture:
┌──────────┐      ┌─────────────┐      ┌───────────┐
│ DearMP   │◄────►│ GOV.UK      │◄────►│ DWP/HMRC  │
│          │      │ One Login   │      │ etc.      │
└──────────┘      └─────────────┘      └───────────┘

Availability:
- Central government: ✅ Available (free, centrally funded)
- Local authorities: ⚠️ Case-by-case approval
- Private sector vendors: ❌ Not available
- Third-party integrators: ❌ Not available

Pros:
+ Already deployed in UK government (80+ services, 7.8M users)
+ Citizen-centric identity verification
+ GDS-approved architecture
+ Aligned with UK data protection
+ Source code is open source (can study/learn from it)

Cons:
- Primarily identity, not data exchange
- Restricted access (central government only)
- Not designed for system-to-system bulk queries
- Centralized (single point of failure)
- Cannot self-host or deploy independently
```

**Implication for DearMP**: If DearMP is a government-commissioned system operated by central government, GOV.UK One Login integration may be possible. If DearMP is a private sector product sold to MP offices, GOV.UK One Login is **not an option** and alternatives like Keycloak must be considered.

### 6.2 NIEM (National Information Exchange Model)

**US-originated standard for justice/emergency data exchange**

```
Pros:
+ Mature data model (20+ years)
+ Strong in justice/public safety domains
+ XML-based canonical schemas
+ Open standard

Cons:
- US-centric governance
- XML-heavy (SOAP) in modern implementations
- Less focus on transport security
- Limited EU/UK adoption
```

### 6.3 FHIR (Fast Healthcare Interoperability Resources)

**For healthcare-specific data exchange**

```
Pros:
+ RESTful and modern
+ NHS already adopting
+ Strong in health sector globally
+ Open standard (HL7)

Cons:
- Healthcare-specific (not generalizable)
- Doesn't address cross-sector needs
- No built-in PKI/trust model
- Requires per-integration trust agreements
```

### 6.4 GraphQL Federation

**Modern API architecture with schema stitching**

```
Architecture:
┌──────────┐      ┌─────────────┐      ┌───────────┐
│ DearMP   │─────►│ Federation  │◄─────│ Other CMS │
│ Subgraph │      │ Gateway     │      │ Subgraph  │
└──────────┘      └─────────────┘      └───────────┘

Pros:
+ Developer-friendly (typed queries)
+ Excellent for complex data relationships
+ Strong tooling (Apollo, Hasura)
+ Real-time subscriptions

Cons:
- No standardized security model
- No government-scale precedent
- Requires central gateway (bottleneck)
- Trust/audit must be custom-built
```

### 6.5 Solid (Tim Berners-Lee's Decentralized Data)

**Emerging standard for citizen-controlled data pods**

```
Pros:
+ Citizen controls their own data
+ Decentralized by design
+ W3C standards-based
+ Strong privacy guarantees

Cons:
- Immature ecosystem
- Limited government adoption
- Requires citizen engagement (not system-to-system)
- Performance at scale unproven
```

### 6.6 Recommendation: Hybrid Approach

Given the UK context, consider a layered strategy:

```
Layer 1: Identity (choose based on access)
├── Option A: GOV.UK One Login (if central government)
│   └── Citizen identity verification, consent management
├── Option B: Keycloak (if private sector / self-hosted required)
│   └── Open source, self-hosted, OIDC-compatible
└── Both use OpenID Connect, so switching is possible

Layer 2: X-Road (or UK Adaptation)
├── System-to-system data exchange
├── Non-repudiation and audit
└── Federated trust infrastructure

Layer 3: Domain-Specific Standards
├── FHIR for healthcare data
├── NIEM for justice data
└── Custom schemas for sectors without standards
```

### 6.7 Truly Free & Open Source Stack

For organizations without access to GOV.UK One Login, this stack provides equivalent capabilities:

| Layer | Solution | License | Self-Hosted | Notes |
|-------|----------|---------|-------------|-------|
| **Identity** | Keycloak | Apache 2.0 | ✅ | Red Hat backed, OIDC/SAML |
| **Data Exchange** | X-Road | MIT | ✅ | Estonian/Finnish, proven at scale |
| **API Gateway** | Kong OSS | Apache 2.0 | ✅ | Rate limiting, auth plugins |
| **Messaging** | Apache Kafka | Apache 2.0 | ✅ | Event streaming, audit logs |
| **Service Mesh** | Linkerd | Apache 2.0 | ✅ | mTLS, observability |
| **PKI** | EJBCA | LGPL | ✅ | Certificate authority |
| **Secrets** | Vault (pre-BSL) | MPL 2.0 | ✅ | Use v1.14 or OpenBao fork |

All components can be deployed on UK-based infrastructure (AWS London, Azure UK, on-premises).

---

## 7. Security and Compliance Considerations

### 7.1 Data Protection (UK GDPR)

| Requirement | X-Road Feature | DearMP Implementation |
|-------------|---------------|----------------------|
| **Lawful Basis** | Request must include purpose | Adapter validates purpose codes |
| **Data Minimization** | Per-service access control | Only request specific fields |
| **Consent Records** | Audit trail | Link to constituent consent |
| **Subject Access** | Query logs available | Expose via constituent portal |
| **Right to Erasure** | Federated deletion | Propagate via X-Road messages |
| **Breach Notification** | Signed timestamps prove timing | Audit logs with nanosecond precision |

### 7.2 Authentication and Authorization

```
Trust Chain:
Government PKI (Root CA)
    │
    ├── Central X-Road CA
    │       │
    │       ├── DearMP Security Server Certificate
    │       │       │
    │       │       └── DearMP Signing Certificate
    │       │
    │       └── DWP Security Server Certificate
    │               │
    │               └── DWP Signing Certificate
    │
    └── Timestamp Authority Certificate
```

### 7.3 Audit Requirements

All X-Road messages automatically capture:

- Request timestamp (TSA-signed)
- Requesting system identity
- Requesting user identity (if available)
- Purpose/legal basis
- Response timestamp
- Data accessed (schema-level)
- Response size

DearMP should additionally log:

- Internal user who initiated request
- Case context (which constituent, which case)
- Business justification
- Data retention/deletion events

### 7.4 Security Classification Levels

| Classification | X-Road Suitability | Additional Controls |
|---------------|-------------------|---------------------|
| OFFICIAL | ✅ Suitable | Standard X-Road security |
| OFFICIAL-SENSITIVE | ✅ With controls | Enhanced audit, access limits |
| SECRET | ⚠️ Limited | Dedicated infrastructure, HSMs |
| TOP SECRET | ❌ Not suitable | Air-gapped systems only |

---

## 8. Implementation Roadmap

### Phase 0: Assessment and Planning (Months 1-2)

**Objectives:**
- Formal security assessment of X-Road for UK government use
- Stakeholder alignment across participating systems
- Governance structure definition

**Deliverables:**
- [ ] Security architecture review document
- [ ] Data protection impact assessment (DPIA)
- [ ] Cross-system governance charter
- [ ] Pilot participant selection (5-10 systems)

### Phase 1: Infrastructure Foundation (Months 3-5)

**Objectives:**
- Deploy central X-Road services (CA, TSA, Registry)
- Establish PKI hierarchy
- Deploy Security Servers for pilot participants

**DearMP-Specific Tasks:**
```
1. Certificate Management
   ├── Generate CSR for Security Server
   ├── Obtain certificate from Central CA
   └── Configure HSM or secure key storage

2. Security Server Deployment
   ├── Provision Ubuntu 22.04 LTS server
   ├── Install X-Road Security Server package
   ├── Configure network (ports 5500, 5577, 443)
   └── Register with Central Server

3. Adapter Service Development
   ├── Create Node.js X-Road adapter service
   ├── Implement REST-to-SOAP mapping (if needed)
   ├── Add request signing and verification
   └── Integrate with DearMP backend
```

### Phase 2: Service Provider Implementation (Months 6-8)

**Objectives:**
- Define and publish DearMP services to registry
- Implement authorization policies
- Enable other systems to query DearMP

**Services to Expose:**
```typescript
// DearMP X-Road Services v1.0

// 1. Constituent Verification
service: UK-GOV/DearMP/constituentVerification/v1
- Purpose: Verify constituent relationship to MP
- Access: Any government system with valid basis
- Data: Name, constituency, verification status

// 2. Case Status Check
service: UK-GOV/DearMP/caseStatus/v1
- Purpose: Check if case exists, basic status
- Access: Authorized government systems only
- Data: Case exists (bool), status, category

// 3. Consent Verification
service: UK-GOV/DearMP/consentCheck/v1
- Purpose: Verify citizen consent for data sharing
- Access: Any requesting system
- Data: Consent status, scope, expiry
```

### Phase 3: Service Consumer Implementation (Months 9-12)

**Objectives:**
- Integrate DearMP as consumer of external services
- Implement real-time data fetching in case workflows
- Add cross-system case context

**Priority Integrations:**
```
High Priority (60% of cases):
1. DWP Benefits Status → Benefits-related casework
2. HMRC Tax Status → Financial hardship cases
3. Home Office Immigration Status → Visa/citizenship cases

Medium Priority (30% of cases):
4. NHS GP Registration → Healthcare access cases
5. Local Authority Council Tax → Residency verification
6. DVLA Driving License → Transport-related cases

Lower Priority (10% of cases):
7. Land Registry → Property disputes
8. Electoral Register → Constituency confirmation
9. Education Records → Safeguarding cases
```

### Phase 4: Optimization and Scale (Months 13-18)

**Objectives:**
- Performance optimization
- Full ecosystem rollout
- Advanced features

**Activities:**
- Load testing at target volumes
- Caching strategies for frequent queries
- Async patterns for bulk operations
- Monitoring and alerting
- Disaster recovery procedures

### Implementation Timeline

```
Month:  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18
        ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤
Phase 0 ████
Phase 1       ██████████
Phase 2                   ████████████
Phase 3                               ████████████████
Phase 4                                               ████████████
```

---

## 9. Cost-Benefit Analysis

### 9.1 Implementation Costs (DearMP Perspective)

| Cost Category | One-Time | Annual Recurring | Notes |
|--------------|----------|-----------------|-------|
| **Infrastructure** | | | |
| Security Server (HA) | £15,000 | £8,000 | 2× servers, HSM optional |
| PKI/Certificate | £5,000 | £2,000 | Certificate renewals |
| Network configuration | £3,000 | £1,000 | Firewall, monitoring |
| **Development** | | | |
| Adapter Service | £40,000 | £10,000 | Build + maintain |
| Service definitions | £20,000 | £5,000 | Schemas, documentation |
| Integration testing | £15,000 | £8,000 | Cross-system testing |
| **Operational** | | | |
| Staff training | £10,000 | £3,000 | Initial + ongoing |
| Support/maintenance | - | £20,000 | Ops team allocation |
| Audit/compliance | £5,000 | £5,000 | Annual assessments |
| **Total (DearMP)** | **£113,000** | **£62,000** | |

### 9.2 Ecosystem Costs (All 100 Systems)

| Cost Category | Total One-Time | Total Annual |
|--------------|---------------|--------------|
| Central infrastructure | £500,000 | £200,000 |
| Per-system (× 100) | £11,300,000 | £6,200,000 |
| Governance/coordination | £300,000 | £150,000 |
| **Total Ecosystem** | **£12,100,000** | **£6,550,000** |

### 9.3 Quantified Benefits

| Benefit Category | Annual Saving | Basis |
|-----------------|---------------|-------|
| **Reduced Manual Lookups** | | |
| Time saved per case | 20 mins | Currently 5+ system checks |
| Cases per MP per year | 3,000 | Industry average |
| Total MPs/offices | 650 | UK Parliament |
| Labour cost saving | £16,250,000 | At £25/hr fully loaded |
| **Error Reduction** | | |
| Data entry errors prevented | £2,000,000 | Estimated rework costs |
| Compliance violations avoided | £1,000,000 | Potential fines avoided |
| **Speed to Resolution** | | |
| Average case resolution time | -30% | Based on Estonian data |
| Citizen satisfaction improvement | Qualitative | Higher NPS scores |
| **Fraud Detection** | | |
| Cross-reference fraud | £5,000,000 | Detected via data matching |

### 9.4 ROI Calculation

```
Year 1:
  Benefits: £24,250,000
  Costs: £18,650,000 (one-time + recurring)
  Net: £5,600,000

Year 2+:
  Benefits: £24,250,000
  Costs: £6,550,000 (recurring only)
  Net: £17,700,000

5-Year NPV (at 3.5% discount):
  Total Benefits: £111,300,000
  Total Costs: £44,850,000
  Net Present Value: £66,450,000
  ROI: 248%
```

### 9.5 Comparison: X-Road vs Alternatives

| Solution | 5-Year Cost | 5-Year Benefit | NPV | Risk Level |
|----------|-------------|----------------|-----|------------|
| X-Road | £45M | £111M | £66M | Medium |
| Point-to-Point | £80M | £90M | £10M | High |
| API Gateway Hub | £35M | £80M | £45M | Medium |
| Status Quo | £0 | £0 | £0 | N/A |

---

## 10. Risk Assessment

### 10.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| X-Road not adapted for UK legal context | Medium | High | Legal review, custom extensions |
| Performance bottlenecks at scale | Low | High | Load testing, horizontal scaling |
| Certificate management complexity | Medium | Medium | Automated cert lifecycle tools |
| Legacy system incompatibility | Medium | Medium | Anti-corruption layer patterns |
| Vendor lock-in to X-Road | Low | Medium | Open-source, standard protocols |

### 10.2 Organizational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Cross-agency coordination failure | High | Critical | Strong governance, executive sponsorship |
| Data ownership disputes | Medium | High | Clear data stewardship policies |
| Resistance to transparency | Medium | Medium | Phased rollout, change management |
| Skill gaps in PKI/security | High | Medium | Training, managed services |
| Budget cuts mid-implementation | Medium | High | Phased approach, quick wins first |

### 10.3 Compliance Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| GDPR violation via data sharing | Medium | Critical | DPIA, consent management, audit trails |
| Inadequate access controls | Low | High | RBAC, attribute-based access |
| Audit trail tampering | Very Low | Critical | Cryptographic signing, TSA |
| Cross-border data transfer | Medium | High | UK adequacy decisions, SCCs |

---

## 11. Recommendations

### 11.1 Strategic Recommendation

**Pursue X-Road integration with a UK-adapted implementation**, leveraging the proven Estonian/Finnish architecture while adapting governance and legal frameworks for UK requirements.

### 11.2 Tactical Recommendations

1. **Form Cross-Government Working Group**
   - Include GDS, CDDO, Cabinet Office, and key departments
   - Establish data sharing governance charter
   - Define common data schemas across sectors

2. **Start with High-Value Integrations**
   - DWP benefits data (highest volume impact)
   - HMRC tax status (clear use case)
   - Home Office immigration (politically visible)

3. **Build on Existing Infrastructure**
   - Integrate with GOV.UK One Login for citizen identity
   - Leverage existing PKI from government programmes
   - Reuse NHS FHIR work for health data

4. **Invest in Ecosystem, Not Just DearMP**
   - DearMP alone cannot justify X-Road
   - Value comes from network effects (100+ systems)
   - Advocate for cross-government adoption

5. **Plan for Incremental Rollout**
   - Pilot with 5 systems, prove value
   - Expand to 20 systems in year 2
   - Full 100-system rollout by year 3-4

### 11.3 DearMP-Specific Actions

**Immediate (Next 3 months):**
- [ ] Assess current API surface for X-Road compatibility
- [ ] Document data models for federation
- [ ] Identify 3 priority external data sources
- [ ] Estimate development effort for adapter service

**Short-term (3-12 months):**
- [ ] Participate in government interoperability working groups
- [ ] Develop X-Road adapter service architecture
- [ ] Implement consent management improvements
- [ ] Enhance audit logging for compliance

**Medium-term (12-24 months):**
- [ ] Deploy Security Server in staging environment
- [ ] Complete pilot integration with 1-2 external systems
- [ ] Production deployment with limited scope
- [ ] Expand to full service catalog

### 11.4 Alternative Path: If X-Road is Not Selected

If the government selects a different interoperability standard:

1. **Ensure DearMP architecture remains adaptable**
   - Keep external integrations behind adapter interfaces
   - Document data models in format-agnostic schemas
   - Maintain clean API boundaries

2. **Participate in standard selection process**
   - Provide requirements from MP casework perspective
   - Advocate for proven, open-source solutions
   - Avoid proprietary lock-in

3. **Prepare for any federated model**
   - Invest in PKI/certificate infrastructure regardless
   - Implement comprehensive audit logging
   - Design for mutual authentication patterns

---

## 12. MVP: Low-Cost Preparation for Future Federation

This section outlines minimal-investment changes that can be implemented **now** (with few users and limited budget) to enable seamless federation capabilities **later** (when scale justifies full X-Road deployment).

### 12.1 Philosophy: Build the Seams, Not the Building

The goal is not to implement X-Road today, but to ensure DearMP's architecture doesn't **preclude** federation tomorrow. These are "architectural seams" - clean interfaces that make future integration cheap rather than expensive.

**Investment now:** ~£5,000-15,000 (developer time)
**Savings later:** ~£50,000-100,000 (avoid major refactoring)

### 12.2 MVP Tier 1: Zero-Cost Patterns (Implement Immediately)

These require no new dependencies—just disciplined coding patterns.

#### 12.2.1 Canonical Data Types

Create TypeScript interfaces that mirror common government data exchange formats:

```typescript
// src/types/federation/canonical.ts

/**
 * ISO 8601 date string (YYYY-MM-DD)
 * X-Road and most government systems use this format
 */
export type ISODate = string;

/**
 * Canonical person identifier
 * Designed to map to multiple ID schemes
 */
export interface CanonicalPerson {
  // Internal ID (UUID)
  id: string;

  // External identifiers (for future federation)
  externalIds?: {
    scheme: 'nino' | 'nhs-number' | 'passport' | 'driving-license' | 'electoral-roll';
    value: string;
    verified: boolean;
    verifiedAt?: ISODate;
  }[];

  // Core demographics
  givenNames: string;
  familyName: string;
  dateOfBirth?: ISODate;

  // Contact (structured for interop)
  addresses?: CanonicalAddress[];
  emailAddresses?: { value: string; primary: boolean }[];
  phoneNumbers?: { value: string; type: 'mobile' | 'landline' | 'work' }[];
}

/**
 * UK address format compatible with:
 * - Royal Mail PAF
 * - OS AddressBase
 * - GDS address patterns
 */
export interface CanonicalAddress {
  uprn?: string;  // Unique Property Reference Number
  line1: string;
  line2?: string;
  line3?: string;
  city: string;
  postcode: string;
  country: 'GB' | 'UK' | string;
}

/**
 * Case summary - minimal shareable data about a case
 * Designed for cross-system queries without exposing sensitive details
 */
export interface CanonicalCaseSummary {
  id: string;
  externalRef?: string;
  status: 'open' | 'in-progress' | 'resolved' | 'escalated' | 'closed';
  category: string;
  subcategory?: string;
  createdAt: ISODate;
  updatedAt: ISODate;

  // For cross-system correlation
  relatedSystemRefs?: {
    system: string;  // e.g., 'dwp-uc', 'hmrc-paye', 'nhs-spine'
    reference: string;
  }[];
}
```

**Cost:** 2-4 hours
**Benefit:** When federation arrives, data mapping is already defined

#### 12.2.2 Request Context Object

Every external request should carry context that X-Road will require:

```typescript
// src/types/federation/context.ts

/**
 * Request context - attach to every cross-boundary operation
 * This becomes the X-Road message metadata when federation is enabled
 */
export interface FederationContext {
  // Who is making this request?
  requestor: {
    systemId: string;      // 'dearmp-v2'
    userId?: string;       // Internal user ID
    userRole?: string;     // 'caseworker', 'admin', etc.
  };

  // Why is this request being made?
  purpose: {
    code: string;          // e.g., 'CASE_INVESTIGATION', 'CONSENT_CHECK'
    description: string;   // Human-readable
    legalBasis?: string;   // GDPR Article 6 basis
  };

  // Traceability
  correlationId: string;   // UUID for request tracing
  timestamp: string;       // ISO 8601 with timezone

  // Consent reference (if applicable)
  consentRef?: {
    constituentId: string;
    consentId: string;
    scope: string[];
  };
}

// Helper to create context for internal use
export function createFederationContext(
  userId: string,
  purposeCode: string,
  purposeDesc: string
): FederationContext {
  return {
    requestor: {
      systemId: 'dearmp-v2',
      userId,
      userRole: undefined, // Populated by auth middleware
    },
    purpose: {
      code: purposeCode,
      description: purposeDesc,
    },
    correlationId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
}
```

**Cost:** 2-4 hours
**Benefit:** Audit trails are federation-ready; legal basis tracking built-in

#### 12.2.3 External Service Interface Pattern

Wrap all external service calls behind interfaces that can later route to X-Road:

```typescript
// src/services/federation/external-service.ts

/**
 * Abstract interface for external data sources
 * Today: direct API calls
 * Tomorrow: X-Road Security Server routing
 */
export interface ExternalDataService<TRequest, TResponse> {
  readonly serviceId: string;
  readonly version: string;

  query(
    request: TRequest,
    context: FederationContext
  ): Promise<ExternalServiceResult<TResponse>>;
}

export interface ExternalServiceResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  metadata: {
    responseTime: number;
    source: 'direct' | 'cache' | 'xroad';
    timestamp: string;
  };
}

// Example: Benefits status service (stub for now)
export class BenefitsStatusService
  implements ExternalDataService<BenefitsRequest, BenefitsResponse> {

  readonly serviceId = 'uk-gov/dwp/benefits-status';
  readonly version = 'v1';

  async query(
    request: BenefitsRequest,
    context: FederationContext
  ): Promise<ExternalServiceResult<BenefitsResponse>> {
    // TODAY: Return not-implemented (no DWP access yet)
    // TOMORROW: Route through X-Road adapter
    return {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Benefits lookup requires X-Road federation',
        retryable: false,
      },
      metadata: {
        responseTime: 0,
        source: 'direct',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
```

**Cost:** 4-8 hours
**Benefit:** External integrations have consistent interface; easy to swap implementations

### 12.3 MVP Tier 2: Low-Cost Infrastructure (~£2,000-5,000)

#### 12.3.1 Structured Audit Logging

Add a dedicated audit log table designed for compliance and federation:

```sql
-- migrations/xxx_add_federation_audit_log.sql

CREATE TABLE federation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- When
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Who (internal)
  user_id UUID REFERENCES auth.users(id),
  user_role TEXT,
  office_id UUID REFERENCES offices(id),

  -- What
  action TEXT NOT NULL,  -- 'READ', 'WRITE', 'QUERY', 'EXPORT'
  resource_type TEXT NOT NULL,  -- 'constituent', 'case', 'message'
  resource_id UUID,

  -- Why (federation context)
  purpose_code TEXT,
  purpose_description TEXT,
  legal_basis TEXT,

  -- Correlation
  correlation_id UUID NOT NULL,
  session_id UUID,

  -- External system (for future federation)
  external_system_id TEXT,  -- NULL for internal, 'dwp', 'hmrc' for federated
  external_request_id TEXT,

  -- What was accessed (for GDPR subject access requests)
  data_categories TEXT[],  -- ['personal', 'financial', 'health']

  -- Outcome
  success BOOLEAN NOT NULL,
  error_code TEXT,

  -- Searchable metadata
  metadata JSONB DEFAULT '{}'
);

-- Indexes for compliance queries
CREATE INDEX idx_audit_timestamp ON federation_audit_log(timestamp);
CREATE INDEX idx_audit_user ON federation_audit_log(user_id);
CREATE INDEX idx_audit_resource ON federation_audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_correlation ON federation_audit_log(correlation_id);
CREATE INDEX idx_audit_external ON federation_audit_log(external_system_id)
  WHERE external_system_id IS NOT NULL;

-- Retention policy (keep 7 years for GDPR)
-- Add pg_partman or manual partitioning for large scale
```

**Cost:** £500-1,000 (dev time) + negligible storage
**Benefit:** GDPR compliance, Subject Access Requests, federation audit trails

#### 12.3.2 Consent Management Foundation

Add basic consent tracking that federations require:

```sql
-- migrations/xxx_add_consent_management.sql

CREATE TABLE constituent_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  constituent_id UUID NOT NULL REFERENCES constituents(id),

  -- What they consented to
  consent_type TEXT NOT NULL,  -- 'data-sharing', 'contact', 'case-transfer'
  scope TEXT[] NOT NULL,       -- ['dwp', 'hmrc', 'nhs'] or ['*']

  -- When
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,      -- NULL = no expiry
  revoked_at TIMESTAMPTZ,

  -- How (evidence)
  granted_via TEXT NOT NULL,   -- 'web-form', 'email', 'verbal', 'letter'
  evidence_ref TEXT,           -- Link to stored evidence

  -- Who recorded it
  recorded_by UUID REFERENCES auth.users(id),
  office_id UUID REFERENCES offices(id),

  -- Status
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'revoked')),

  UNIQUE (constituent_id, consent_type, status)
    WHERE status = 'active'
);

CREATE INDEX idx_consent_constituent ON constituent_consents(constituent_id);
CREATE INDEX idx_consent_active ON constituent_consents(status)
  WHERE status = 'active';
```

**Cost:** £1,000-2,000 (dev time)
**Benefit:** Required for any data sharing; legal compliance

#### 12.3.3 Service Registry Stub

Create a configuration-driven service registry:

```typescript
// src/config/external-services.ts

/**
 * Registry of external services
 * Today: configuration only
 * Tomorrow: populated from X-Road Central Server
 */
export interface ServiceRegistryEntry {
  serviceId: string;
  name: string;
  description: string;
  provider: string;

  // Connection (null = not yet available)
  endpoint: string | null;
  available: boolean;

  // Federation metadata
  xroadMemberCode?: string;
  xroadSubsystemCode?: string;

  // Data classification
  dataCategories: string[];
  requiresConsent: boolean;

  // Status
  status: 'planned' | 'pilot' | 'production' | 'deprecated';
}

export const SERVICE_REGISTRY: ServiceRegistryEntry[] = [
  {
    serviceId: 'uk-gov/dwp/benefits-status',
    name: 'DWP Benefits Status',
    description: 'Check Universal Credit and legacy benefit status',
    provider: 'Department for Work and Pensions',
    endpoint: null,  // Not yet integrated
    available: false,
    dataCategories: ['financial', 'personal'],
    requiresConsent: true,
    status: 'planned',
  },
  {
    serviceId: 'uk-gov/hmrc/tax-status',
    name: 'HMRC Tax Status',
    description: 'Verify tax compliance status',
    provider: 'HM Revenue & Customs',
    endpoint: null,
    available: false,
    dataCategories: ['financial'],
    requiresConsent: true,
    status: 'planned',
  },
  {
    serviceId: 'uk-gov/home-office/immigration-status',
    name: 'Immigration Status Check',
    description: 'Verify right to remain/work',
    provider: 'Home Office',
    endpoint: null,
    available: false,
    dataCategories: ['personal', 'legal-status'],
    requiresConsent: true,
    status: 'planned',
  },
  // Add more as needed...
];

// Helper to check if a service is available
export function isServiceAvailable(serviceId: string): boolean {
  const entry = SERVICE_REGISTRY.find(s => s.serviceId === serviceId);
  return entry?.available ?? false;
}
```

**Cost:** 2-4 hours
**Benefit:** UI can show "coming soon" features; architecture is ready

### 12.4 MVP Tier 3: Preparation Investments (~£5,000-15,000)

#### 12.4.1 Self-Signed Certificate Infrastructure

Set up certificate management even without X-Road:

```bash
# scripts/setup-pki.sh
# Create a local CA for development/testing

# 1. Create CA directory structure
mkdir -p pki/{ca,certs,private,csr}
chmod 700 pki/private

# 2. Generate CA private key
openssl genrsa -out pki/private/ca.key 4096
chmod 600 pki/private/ca.key

# 3. Generate CA certificate
openssl req -new -x509 -days 3650 \
  -key pki/private/ca.key \
  -out pki/ca/ca.crt \
  -subj "/C=GB/O=DearMP/CN=DearMP Development CA"

# 4. Generate service certificate
openssl genrsa -out pki/private/dearmp.key 2048
openssl req -new \
  -key pki/private/dearmp.key \
  -out pki/csr/dearmp.csr \
  -subj "/C=GB/O=DearMP/CN=dearmp-api"

openssl x509 -req -days 365 \
  -in pki/csr/dearmp.csr \
  -CA pki/ca/ca.crt \
  -CAkey pki/private/ca.key \
  -CAcreateserial \
  -out pki/certs/dearmp.crt

echo "PKI setup complete. Certificates in ./pki/"
```

**Cost:** £1,000-2,000 (setup + documentation)
**Benefit:** Team learns PKI; ready for mTLS when X-Road arrives

#### 12.4.2 Message Signing Library

Implement request/response signing using standard libraries:

```typescript
// src/lib/signing.ts

import { createSign, createVerify, generateKeyPairSync } from 'crypto';

/**
 * Simple message signing for non-repudiation
 * Uses RSA-SHA256 (compatible with X-Road)
 */
export class MessageSigner {
  constructor(
    private privateKeyPem: string,
    private publicKeyPem: string
  ) {}

  /**
   * Sign a message payload
   */
  sign(payload: object): SignedMessage {
    const canonical = this.canonicalize(payload);
    const timestamp = new Date().toISOString();

    const signatureInput = `${timestamp}|${canonical}`;

    const signer = createSign('RSA-SHA256');
    signer.update(signatureInput);
    const signature = signer.sign(this.privateKeyPem, 'base64');

    return {
      payload,
      signature: {
        algorithm: 'RSA-SHA256',
        timestamp,
        value: signature,
      },
    };
  }

  /**
   * Verify a signed message
   */
  verify(message: SignedMessage, publicKey?: string): boolean {
    const key = publicKey ?? this.publicKeyPem;
    const canonical = this.canonicalize(message.payload);
    const signatureInput = `${message.signature.timestamp}|${canonical}`;

    const verifier = createVerify('RSA-SHA256');
    verifier.update(signatureInput);

    return verifier.verify(key, message.signature.value, 'base64');
  }

  /**
   * Canonicalize JSON for consistent signing
   * (JSON key ordering matters for signatures)
   */
  private canonicalize(obj: object): string {
    return JSON.stringify(obj, Object.keys(obj).sort());
  }
}

export interface SignedMessage {
  payload: object;
  signature: {
    algorithm: string;
    timestamp: string;
    value: string;
  };
}

// Generate keys for development
export function generateDevKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}
```

**Cost:** £2,000-3,000 (implementation + testing)
**Benefit:** Non-repudiation ready; can verify message integrity

#### 12.4.3 API Versioning and OpenAPI Spec

Document APIs in a format compatible with X-Road service definitions:

```yaml
# openapi/dearmp-federation-api.yaml
openapi: 3.0.3
info:
  title: DearMP Federation API
  version: 1.0.0
  description: |
    API endpoints designed for future X-Road federation.
    Currently internal-only; will be exposed via Security Server.
  contact:
    name: DearMP Team
  license:
    name: Proprietary

servers:
  - url: https://api.dearmp.local/federation/v1
    description: Internal (pre-federation)

paths:
  /constituents/verify:
    post:
      operationId: verifyConstituent
      summary: Verify constituent relationship to MP
      description: |
        X-Road Service ID: UK-GOV/DearMP/constituentVerification/v1
      tags:
        - Federation
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ConstituentVerifyRequest'
      responses:
        '200':
          description: Verification result
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ConstituentVerifyResponse'
        '403':
          description: Insufficient consent or authorization

  /cases/{caseId}/summary:
    get:
      operationId: getCaseSummary
      summary: Get minimal case summary for cross-system reference
      description: |
        X-Road Service ID: UK-GOV/DearMP/caseStatus/v1
      tags:
        - Federation
      parameters:
        - name: caseId
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: X-Purpose-Code
          in: header
          required: true
          schema:
            type: string
        - name: X-Correlation-Id
          in: header
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Case summary
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CaseSummary'

components:
  schemas:
    ConstituentVerifyRequest:
      type: object
      required:
        - identifier
      properties:
        identifier:
          type: object
          properties:
            type:
              type: string
              enum: [email, postcode-dob, nino]
            value:
              type: string

    ConstituentVerifyResponse:
      type: object
      properties:
        verified:
          type: boolean
        constituency:
          type: string
        hasActiveCase:
          type: boolean

    CaseSummary:
      type: object
      properties:
        id:
          type: string
          format: uuid
        status:
          type: string
          enum: [open, in-progress, resolved, escalated, closed]
        category:
          type: string
        createdAt:
          type: string
          format: date-time
```

**Cost:** £2,000-4,000 (documentation + endpoint stubs)
**Benefit:** Clear API contract; X-Road service registration ready

### 12.5 MVP Implementation Checklist

| Priority | Item | Cost | Time | Status |
|----------|------|------|------|--------|
| **P0** | Canonical TypeScript types | £0 | 4h | ⬜ |
| **P0** | FederationContext on all external calls | £0 | 4h | ⬜ |
| **P0** | ExternalDataService interface pattern | £0 | 8h | ⬜ |
| **P1** | Audit log table + basic logging | £500 | 2d | ⬜ |
| **P1** | Consent management table | £1,000 | 2d | ⬜ |
| **P1** | Service registry configuration | £0 | 4h | ⬜ |
| **P2** | Development PKI setup | £1,000 | 1d | ⬜ |
| **P2** | Message signing library | £2,000 | 3d | ⬜ |
| **P2** | OpenAPI federation spec | £2,000 | 2d | ⬜ |
| **P3** | UI placeholders for external data | £1,000 | 2d | ⬜ |
| **P3** | Integration test harness | £2,000 | 3d | ⬜ |

**Total MVP Investment:** ~£9,500 + 25 developer days
**Future Savings:** Estimated £50,000-100,000 in refactoring costs avoided

### 12.6 What This Enables

After implementing the MVP:

```
TODAY (MVP Complete):
┌─────────────────────────────────────────────────────────┐
│ DearMP Application                                       │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ✅ Canonical data types                              │ │
│ │ ✅ Federation context on all operations              │ │
│ │ ✅ Structured audit logging                          │ │
│ │ ✅ Consent management                                │ │
│ │ ✅ Service interface pattern                         │ │
│ │ ✅ Message signing capability                        │ │
│ │ ⬜ External integrations (stub: "Coming Soon")       │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘

TOMORROW (When Federation Arrives):
┌─────────────────────────────────────────────────────────┐
│ DearMP Application                                       │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ✅ Canonical data types (already done)               │ │
│ │ ✅ Federation context (already done)                 │ │
│ │ ✅ Audit logging (already done)                      │ │
│ │ ✅ Consent management (already done)                 │ │
│ │ ✅ Service interface (swap implementation)    ←──┐   │ │
│ │ ✅ Message signing (production keys)               │   │ │
│ │ 🆕 X-Road adapter (NEW: ~2 weeks work)      ←──────┤   │ │
│ └────────────────────────────────────────────────────┘   │ │
│                         │                                 │
│                         ▼                                 │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ X-Road Security Server (deploy & configure)          │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

The difference between "prepared" and "unprepared" when federation becomes available:

| Scenario | Unprepared | Prepared (MVP) |
|----------|------------|----------------|
| Time to integrate first external service | 3-6 months | 2-4 weeks |
| Refactoring required | Major (data models, logging, auth) | Minor (adapter only) |
| Risk of security gaps | High (retrofit audit/consent) | Low (built-in) |
| Cost | £50,000-100,000 | £10,000-20,000 |

---

## Appendix A: X-Road Technical Specifications

### A.1 Protocol Details

- **Transport**: HTTPS (TLS 1.2+)
- **Message Format**: SOAP 1.1 with WS-Security, REST with JSON also supported (X-Road 7+)
- **Signing**: RSA-2048 or ECDSA with SHA-256
- **Timestamps**: RFC 3161 Time-Stamp Protocol
- **Certificate**: X.509v3 with government-approved CA

### A.2 Network Requirements

| Port | Protocol | Purpose |
|------|----------|---------|
| 5500 | HTTPS | Security Server to Security Server |
| 5577 | HTTPS | Security Server management |
| 4000 | HTTP | Internal service connector (local only) |
| 443 | HTTPS | Admin UI |
| 80 | HTTP | OCSP responder (if hosting) |

### A.3 Server Requirements

**Minimum for Production (per Security Server):**
- CPU: 4 cores
- RAM: 8 GB
- Storage: 100 GB SSD (audit logs grow)
- OS: Ubuntu 22.04 LTS or RHEL 8+
- Database: PostgreSQL 12+ (external or local)

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Anti-Corruption Layer** | Pattern isolating modern system from legacy system quirks |
| **Central Server** | X-Road component managing trust and service registry |
| **Federated Identity** | Distributed authentication across organizations |
| **HSM** | Hardware Security Module for key protection |
| **mTLS** | Mutual TLS; both parties authenticate with certificates |
| **Non-Repudiation** | Cryptographic proof a message was sent/received |
| **Once-Only Principle** | Citizen provides data once, systems share it |
| **RLS** | Row-Level Security in PostgreSQL |
| **Security Server** | X-Road component mediating all data exchange |
| **TSA** | Time Stamp Authority; provides trusted timestamps |

---

## Appendix C: References

1. X-Road Documentation: https://x-road.global/
2. X-Road GitHub: https://github.com/nordic-institute/X-Road
3. Estonian e-Government: https://e-estonia.com/
4. GovStack Initiative: https://www.govstack.global/
5. UK Government Digital Service: https://www.gov.uk/government/organisations/government-digital-service
6. UK GDPR: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/

---

*Document prepared for strategic planning purposes. Implementation decisions should involve legal, security, and procurement review.*
