# Codebase Structure

Recommended structure for a Monorepo or Service-based architecture.

```text
/
├── docker-compose.yml      # Defines Postgres, Redis, API, and Worker
├── .env                    # Secrets (LLM Keys, Legacy API Tokens)
├── src/
│   ├── shared/             # Code shared between API and Worker
│   │   ├── database/       # Prisma/TypeORM Client & Schema
│   │   ├── types/          # Shared TS Interfaces
│   │   └── config/         # Env parsing
│   │
│   ├── lib/                # Core Logic Modules
│   │   ├── acl/            # ANTI-CORRUPTION LAYER (The most important folder)
│   │   │   ├── adapters/   # Maps New Objects <-> Legacy JSON
│   │   │   └── api/        # Wrappers for Legacy API calls (Axios/Fetch)
│   │   │
│   │   ├── llm/            # LLM Prompt Management & Client
│   │   └── queue/          # Redis Queue Definitions
│   │
│   ├── api/                # Express/Fastify App
│   │   ├── controllers/    # Route Handlers
│   │   ├── middleware/     # Auth & Validation
│   │   └── index.ts        # Entry point
│   │
│   └── worker/             # Background Processors
│       ├── jobs/           # Job Definitions (Sync, Analyze, Backfill)
│       ├── scheduler/      # Cron-like scheduling for Polling
│       └── index.ts        # Entry point
```
