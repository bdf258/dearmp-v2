# Infrastructure Definition

Copy the contents below into `docker-compose.yml`.

```yaml
version: '3.8'

services:
  # -----------------------------------------------------------------
  # THE SHADOW DATABASE
  # Holds the "New Schema" and mirrors the Legacy Data
  # -----------------------------------------------------------------
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASS}
      POSTGRES_DB: shadow_triage_db
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  # -----------------------------------------------------------------
  # REDIS
  # Handles Job Queues and Rate Limiting
  # -----------------------------------------------------------------
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # -----------------------------------------------------------------
  # API SERVICE
  # Serves the Frontend
  # -----------------------------------------------------------------
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@postgres:5432/shadow_triage_db
      - REDIS_URL=redis://redis:6379
      - LEGACY_API_URL=${LEGACY_API_URL}
      - LEGACY_API_KEY=${LEGACY_API_KEY}
    depends_on:
      - postgres
      - redis
    volumes:
      - ./src:/app/src # Enable hot-reload in dev

  # -----------------------------------------------------------------
  # WORKER SERVICE
  # Handles Polling, Sync, and LLM
  # -----------------------------------------------------------------
  worker:
    build:
      context: .
      dockerfile: Dockerfile.worker
    environment:
      - DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@postgres:5432/shadow_triage_db
      - REDIS_URL=redis://redis:6379
      - LEGACY_API_URL=${LEGACY_API_URL}
      - LEGACY_API_KEY=${LEGACY_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - postgres
      - redis
    volumes:
      - ./src:/app/src

volumes:
  pgdata:
```
