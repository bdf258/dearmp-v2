# Constituent Service Backend ("The Shadow System")

## Overview
This backend serves as a "Strangler Fig" (Sidecar) application. It bridges the gap between a legacy CRM system and a new, high-throughput AI Triage Frontend.

**Core Responsibilities:**
1.  **Shadow Database:** Maintains a modern, local copy of data synced from the Legacy API.
2.  **Triage Engine:** Orchestrates LLM analysis and prioritisation of incoming emails.
3.  **Bi-Directional Sync:** Handles "Dual Writes" (immediate user actions) and "Background Polling" (catching up with external changes).

## Architecture Status
- **Pattern:** Anti-Corruption Layer (ACL)
- **Database Strategy:** Persistent Shadow Store with `external_id` mapping.
- **Sync Strategy:** Immediate Write-Through + Background Polling.

## Quick Start
1.  Copy `.env.example` to `.env`
2.  Run `docker-compose up -d`
3.  Run migrations: `npm run db:migrate`
