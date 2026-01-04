# Tag Recommendation System Design

## Overview

This document outlines the architecture for a scalable tag recommendation system capable of handling thousands of tags. The system uses vector embeddings to semantically search tags against email content, returning the top 20 most relevant tags to the LLM for final recommendation.

## Problem Statement
The current triage system passes all tags to the LLM for recommendation. With thousands of tags per office, this approach:

1. **Exceeds context limits** - LLMs have finite context windows
2. **Increases latency** - More tokens = slower processing
3. **Reduces accuracy** - LLMs struggle with large option sets
4. **Increases cost** - More input tokens = higher API costs

## Solution Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Tag Recommendation Flow                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────┐    ┌──────────────────┐    ┌─────────────────────────────┐  │
│  │   Email    │───▶│  Text Embedding  │───▶│     Vector Search (pgvector)│  │
│  │  Content   │    │  (Gemini/OpenAI) │    │     Top 20 Similar Tags     │  │
│  └────────────┘    └──────────────────┘    └──────────────┬──────────────┘  │
│                                                           │                  │
│                                                           ▼                  │
│                                            ┌──────────────────────────────┐  │
│                                            │     LLM Triage Analysis      │  │
│                                            │  (Gemini 2.0 Flash)          │  │
│                                            │  - Receives top 20 tags only │  │
│                                            │  - Makes final selection     │  │
│                                            └──────────────┬───────────────┘  │
│                                                           │                  │
│                                                           ▼                  │
│                                            ┌──────────────────────────────┐  │
│                                            │   Suggested Tags (1-5)       │  │
│                                            │   with confidence scores     │  │
│                                            └──────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Database Changes

### 1. Enable pgvector Extension

```sql
-- Migration: YYYYMMDD000001_enable_pgvector.sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Add Embedding Column to Tags Table

```sql
-- Migration: YYYYMMDD000002_add_tag_embeddings.sql

-- Add embedding column (1536 dimensions for text-embedding-3-small, 768 for Gemini)
ALTER TABLE tags ADD COLUMN embedding vector(768);

-- Create index for fast similarity search
CREATE INDEX idx_tags_embedding ON tags
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Add metadata for embedding versioning
ALTER TABLE tags ADD COLUMN embedding_model TEXT;
ALTER TABLE tags ADD COLUMN embedding_updated_at TIMESTAMPTZ;

-- Composite text field for better embeddings
ALTER TABLE tags ADD COLUMN search_text TEXT
  GENERATED ALWAYS AS (
    name || ' ' || COALESCE(description, '') || ' ' || COALESCE(array_to_string(auto_assign_keywords, ' '), '')
  ) STORED;
```

### 3. Create Tag Embedding Queue Table

```sql
-- Migration: YYYYMMDD000003_tag_embedding_queue.sql

CREATE TABLE tag_embedding_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error TEXT,
  UNIQUE(tag_id)
);

-- Index for efficient queue processing
CREATE INDEX idx_tag_embedding_queue_pending
  ON tag_embedding_queue(priority DESC, created_at ASC)
  WHERE processed_at IS NULL;
```

### 4. Create Email Embedding Cache Table

```sql
-- Migration: YYYYMMDD000004_email_embedding_cache.sql

CREATE TABLE email_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  embedding vector(768) NOT NULL,
  embedding_model TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id)
);

-- Index for lookups
CREATE INDEX idx_email_embeddings_message_id ON email_embeddings(message_id);
```

### 5. Vector Search Function

```sql
-- Migration: YYYYMMDD000005_vector_search_function.sql

CREATE OR REPLACE FUNCTION search_similar_tags(
  query_embedding vector(768),
  target_office_id UUID,
  match_count INTEGER DEFAULT 20,
  similarity_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  tag_id UUID,
  name TEXT,
  color TEXT,
  description TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.color,
    t.description,
    1 - (t.embedding <=> query_embedding) AS similarity
  FROM tags t
  WHERE
    t.office_id = target_office_id
    AND t.embedding IS NOT NULL
    AND 1 - (t.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

## Server Changes

### 1. New Infrastructure: Embedding Service

**File: `/server/src/infrastructure/embedding/EmbeddingService.ts`**

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokenCount: number;
}

export interface IEmbeddingService {
  embedText(text: string): Promise<EmbeddingResult>;
  embedBatch(texts: string[]): Promise<EmbeddingResult[]>;
}

export class GeminiEmbeddingService implements IEmbeddingService {
  private client: GoogleGenerativeAI;
  private model: string = 'text-embedding-004';

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async embedText(text: string): Promise<EmbeddingResult> {
    const embeddingModel = this.client.getGenerativeModel({ model: this.model });
    const result = await embeddingModel.embedContent(text);

    return {
      embedding: result.embedding.values,
      model: this.model,
      tokenCount: result.embedding.values.length
    };
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    // Gemini supports batch embedding
    const embeddingModel = this.client.getGenerativeModel({ model: this.model });
    const results = await Promise.all(
      texts.map(text => embeddingModel.embedContent(text))
    );

    return results.map(result => ({
      embedding: result.embedding.values,
      model: this.model,
      tokenCount: result.embedding.values.length
    }));
  }
}
```

### 2. New Infrastructure: Tag Vector Repository

**File: `/server/src/infrastructure/repositories/TagVectorRepository.ts`**

```typescript
import { SupabaseClient } from '@supabase/supabase-js';

export interface SimilarTag {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  similarity: number;
}

export class TagVectorRepository {
  constructor(private supabase: SupabaseClient) {}

  async updateTagEmbedding(
    tagId: string,
    embedding: number[],
    model: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('tags')
      .update({
        embedding: `[${embedding.join(',')}]`,
        embedding_model: model,
        embedding_updated_at: new Date().toISOString()
      })
      .eq('id', tagId);

    if (error) throw error;
  }

  async searchSimilarTags(
    embedding: number[],
    officeId: string,
    limit: number = 20,
    threshold: number = 0.3
  ): Promise<SimilarTag[]> {
    const { data, error } = await this.supabase.rpc('search_similar_tags', {
      query_embedding: `[${embedding.join(',')}]`,
      target_office_id: officeId,
      match_count: limit,
      similarity_threshold: threshold
    });

    if (error) throw error;
    return data;
  }

  async getTagsWithoutEmbeddings(
    officeId: string,
    limit: number = 100
  ): Promise<Array<{ id: string; search_text: string }>> {
    const { data, error } = await this.supabase
      .from('tags')
      .select('id, search_text')
      .eq('office_id', officeId)
      .is('embedding', null)
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async cacheEmailEmbedding(
    messageId: string,
    embedding: number[],
    model: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('email_embeddings')
      .upsert({
        message_id: messageId,
        embedding: `[${embedding.join(',')}]`,
        embedding_model: model
      });

    if (error) throw error;
  }

  async getEmailEmbedding(messageId: string): Promise<number[] | null> {
    const { data, error } = await this.supabase
      .from('email_embeddings')
      .select('embedding')
      .eq('message_id', messageId)
      .single();

    if (error || !data) return null;
    return data.embedding;
  }
}
```

### 3. New Application Service: Tag Recommendation Service

**File: `/server/src/application/services/TagRecommendationService.ts`**

```typescript
import { IEmbeddingService } from '../../infrastructure/embedding/EmbeddingService';
import { TagVectorRepository, SimilarTag } from '../../infrastructure/repositories/TagVectorRepository';
import { Logger } from 'winston';

export interface TagRecommendationInput {
  messageId: string;
  officeId: string;
  subject: string;
  body: string;
  senderEmail?: string;
}

export interface TagRecommendationResult {
  candidateTags: SimilarTag[];
  embeddingCached: boolean;
  searchTimeMs: number;
}

export class TagRecommendationService {
  constructor(
    private embeddingService: IEmbeddingService,
    private tagVectorRepo: TagVectorRepository,
    private logger: Logger
  ) {}

  async getRecommendedTags(input: TagRecommendationInput): Promise<TagRecommendationResult> {
    const startTime = Date.now();

    // 1. Check for cached email embedding
    let embedding = await this.tagVectorRepo.getEmailEmbedding(input.messageId);
    let embeddingCached = !!embedding;

    if (!embedding) {
      // 2. Generate embedding from email content
      const contentToEmbed = this.prepareEmailContent(input);
      const result = await this.embeddingService.embedText(contentToEmbed);
      embedding = result.embedding;

      // 3. Cache the embedding for future use
      await this.tagVectorRepo.cacheEmailEmbedding(
        input.messageId,
        embedding,
        result.model
      );
    }

    // 4. Search for similar tags
    const candidateTags = await this.tagVectorRepo.searchSimilarTags(
      embedding,
      input.officeId,
      20, // Top 20 tags
      0.25 // Similarity threshold
    );

    const searchTimeMs = Date.now() - startTime;

    this.logger.info('Tag recommendation search completed', {
      messageId: input.messageId,
      candidateCount: candidateTags.length,
      searchTimeMs,
      embeddingCached
    });

    return {
      candidateTags,
      embeddingCached,
      searchTimeMs
    };
  }

  private prepareEmailContent(input: TagRecommendationInput): string {
    // Combine relevant fields, prioritizing subject
    const parts = [
      input.subject,
      input.body.slice(0, 2000) // Limit body length for embedding
    ];

    return parts.filter(Boolean).join('\n\n');
  }
}
```

### 4. Modify Triage Job Handler

**File: `/server/src/infrastructure/queue/handlers/TriageJobHandler.ts`**

Changes needed:

```typescript
// Add to constructor dependencies
private tagRecommendationService: TagRecommendationService;

// Modify processEmail method
async processEmail(job: Job<TriageJobData>): Promise<void> {
  const { messageId, officeId } = job.data;

  // ... existing code to fetch email ...

  // NEW: Get recommended tags via vector search
  const tagRecommendation = await this.tagRecommendationService.getRecommendedTags({
    messageId,
    officeId,
    subject: email.subject,
    body: email.body,
    senderEmail: email.sender_email
  });

  // Prepare tag context for LLM (only top 20 relevant tags)
  const tagContext = tagRecommendation.candidateTags.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description
  }));

  // Pass filtered tags to LLM instead of all tags
  const triageResult = await this.llmService.analyzeEmail({
    email,
    availableTags: tagContext, // Only 20 tags instead of thousands
    // ... other params
  });

  // ... rest of existing code ...
}
```

### 5. New Job Types for Embedding Management

**File: `/server/src/infrastructure/queue/types.ts`**

Add new job types:

```typescript
export enum JobName {
  // ... existing jobs ...

  // Embedding jobs
  EMBEDDING_GENERATE_TAG = 'embedding:generate-tag',
  EMBEDDING_GENERATE_BATCH = 'embedding:generate-batch',
  EMBEDDING_BACKFILL = 'embedding:backfill',
}

export interface EmbeddingJobData {
  [JobName.EMBEDDING_GENERATE_TAG]: {
    tagId: string;
    officeId: string;
  };
  [JobName.EMBEDDING_GENERATE_BATCH]: {
    officeId: string;
    batchSize: number;
  };
  [JobName.EMBEDDING_BACKFILL]: {
    officeId: string;
  };
}
```

### 6. New Embedding Job Handler

**File: `/server/src/infrastructure/queue/handlers/EmbeddingJobHandler.ts`**

```typescript
import { Job } from 'pg-boss';
import { IEmbeddingService } from '../../embedding/EmbeddingService';
import { TagVectorRepository } from '../../repositories/TagVectorRepository';
import { Logger } from 'winston';

export class EmbeddingJobHandler {
  constructor(
    private embeddingService: IEmbeddingService,
    private tagVectorRepo: TagVectorRepository,
    private logger: Logger
  ) {}

  async handleGenerateTag(job: Job<{ tagId: string; officeId: string }>): Promise<void> {
    const { tagId } = job.data;

    // Fetch tag with search_text
    const tag = await this.getTag(tagId);
    if (!tag) {
      this.logger.warn('Tag not found for embedding', { tagId });
      return;
    }

    // Generate embedding
    const result = await this.embeddingService.embedText(tag.search_text);

    // Store embedding
    await this.tagVectorRepo.updateTagEmbedding(tagId, result.embedding, result.model);

    this.logger.info('Tag embedding generated', { tagId, model: result.model });
  }

  async handleBackfill(job: Job<{ officeId: string }>): Promise<void> {
    const { officeId } = job.data;
    const batchSize = 50;

    let processed = 0;
    let hasMore = true;

    while (hasMore) {
      const tags = await this.tagVectorRepo.getTagsWithoutEmbeddings(officeId, batchSize);

      if (tags.length === 0) {
        hasMore = false;
        break;
      }

      // Process in batches
      const embeddings = await this.embeddingService.embedBatch(
        tags.map(t => t.search_text)
      );

      // Update all tags
      await Promise.all(
        tags.map((tag, i) =>
          this.tagVectorRepo.updateTagEmbedding(
            tag.id,
            embeddings[i].embedding,
            embeddings[i].model
          )
        )
      );

      processed += tags.length;
      this.logger.info('Backfill progress', { officeId, processed });
    }

    this.logger.info('Backfill complete', { officeId, totalProcessed: processed });
  }
}
```

### 7. Database Trigger for Auto-Embedding

```sql
-- Migration: YYYYMMDD000006_tag_embedding_trigger.sql

-- Trigger function to queue embedding generation
CREATE OR REPLACE FUNCTION queue_tag_embedding()
RETURNS TRIGGER AS $$
BEGIN
  -- Queue embedding generation when tag is created or search_text changes
  INSERT INTO tag_embedding_queue (tag_id, office_id, priority)
  VALUES (NEW.id, NEW.office_id,
    CASE
      WHEN TG_OP = 'INSERT' THEN 10  -- Higher priority for new tags
      ELSE 5
    END
  )
  ON CONFLICT (tag_id) DO UPDATE SET
    priority = EXCLUDED.priority,
    processed_at = NULL,
    error = NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_tag_embedding_queue
AFTER INSERT OR UPDATE OF name, description, auto_assign_keywords
ON tags
FOR EACH ROW
EXECUTE FUNCTION queue_tag_embedding();
```

### 8. New API Endpoints

**File: `/server/src/presentation/http/routes/embeddingRoutes.ts`**

```typescript
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';

export function createEmbeddingRoutes(/* dependencies */): Router {
  const router = Router();

  // Trigger backfill for an office
  router.post('/embeddings/backfill', authMiddleware, async (req, res) => {
    const { officeId } = req.body;

    await boss.send(JobName.EMBEDDING_BACKFILL, { officeId });

    res.json({ success: true, message: 'Backfill job queued' });
  });

  // Get embedding status for an office
  router.get('/embeddings/status/:officeId', authMiddleware, async (req, res) => {
    const { officeId } = req.params;

    const stats = await getEmbeddingStats(officeId);

    res.json({
      success: true,
      data: {
        totalTags: stats.total,
        embeddedTags: stats.embedded,
        pendingTags: stats.pending,
        percentComplete: Math.round((stats.embedded / stats.total) * 100)
      }
    });
  });

  return router;
}
```

## Worker Changes

### 1. Register Embedding Handler

**File: `/server/src/worker.ts`**

```typescript
// Add to imports
import { EmbeddingJobHandler } from './infrastructure/queue/handlers/EmbeddingJobHandler';
import { GeminiEmbeddingService } from './infrastructure/embedding/EmbeddingService';
import { TagVectorRepository } from './infrastructure/repositories/TagVectorRepository';

// In worker initialization
const embeddingService = new GeminiEmbeddingService(config.geminiApiKey);
const tagVectorRepo = new TagVectorRepository(supabase);
const embeddingHandler = new EmbeddingJobHandler(
  embeddingService,
  tagVectorRepo,
  logger
);

// Register handlers
await boss.work(JobName.EMBEDDING_GENERATE_TAG, embeddingHandler.handleGenerateTag);
await boss.work(JobName.EMBEDDING_BACKFILL, embeddingHandler.handleBackfill);

// Add scheduled job to process embedding queue
await boss.schedule(
  'embedding:process-queue',
  '*/5 * * * *', // Every 5 minutes
  { batchSize: 50 }
);
```

### 2. Modify Triage Handler Integration

The TriageJobHandler needs to be modified to use TagRecommendationService before calling the LLM. See section 4 above.

## Frontend Changes

### 1. Types Update

**File: `/src/database.types.ts`** (auto-generated, but for reference):

```typescript
export interface Tag {
  id: string;
  office_id: string;
  name: string;
  color: string | null;
  description: string | null;
  auto_assign_keywords: string[] | null;
  embedding: number[] | null;  // NEW
  embedding_model: string | null;  // NEW
  embedding_updated_at: string | null;  // NEW
  search_text: string;  // NEW (generated column)
}
```

### 2. Admin: Embedding Status Dashboard

**File: `/src/components/admin/EmbeddingStatusCard.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useSupabase } from '@/lib/SupabaseContext';

interface EmbeddingStats {
  totalTags: number;
  embeddedTags: number;
  pendingTags: number;
  percentComplete: number;
}

export function EmbeddingStatusCard({ officeId }: { officeId: string }) {
  const [stats, setStats] = useState<EmbeddingStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    const response = await fetch(`/api/embeddings/status/${officeId}`);
    const data = await response.json();
    setStats(data.data);
    setLoading(false);
  };

  const triggerBackfill = async () => {
    await fetch('/api/embeddings/backfill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ officeId })
    });
    fetchStats();
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [officeId]);

  if (loading || !stats) return <div>Loading...</div>;

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-medium mb-2">Tag Embedding Status</h3>
      <Progress value={stats.percentComplete} className="mb-2" />
      <p className="text-sm text-muted-foreground">
        {stats.embeddedTags} / {stats.totalTags} tags embedded ({stats.percentComplete}%)
      </p>
      {stats.pendingTags > 0 && (
        <Button onClick={triggerBackfill} size="sm" className="mt-2">
          Process Pending ({stats.pendingTags})
        </Button>
      )}
    </div>
  );
}
```

### 3. No Changes to TagPicker

The TagPicker component does not need changes - it continues to work with the existing `suggestedTags` from triage suggestions. The vector search happens server-side before LLM processing.

## Configuration Changes

### 1. Environment Variables

**File: `.env.example`**

```bash
# Existing
GEMINI_API_KEY=your_gemini_api_key

# New (optional - uses Gemini by default)
EMBEDDING_MODEL=text-embedding-004
EMBEDDING_DIMENSIONS=768
TAG_SEARCH_LIMIT=20
TAG_SIMILARITY_THRESHOLD=0.25
```

### 2. Server Config

**File: `/server/src/config.ts`**

```typescript
export const config = {
  // ... existing config ...

  embedding: {
    model: process.env.EMBEDDING_MODEL || 'text-embedding-004',
    dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '768'),
    tagSearchLimit: parseInt(process.env.TAG_SEARCH_LIMIT || '20'),
    similarityThreshold: parseFloat(process.env.TAG_SIMILARITY_THRESHOLD || '0.25'),
  }
};
```

## Migration Plan

### Phase 1: Database Setup
1. Enable pgvector extension in Supabase
2. Run migrations to add embedding columns and functions
3. Create indexes for vector search

### Phase 2: Backend Infrastructure
1. Implement EmbeddingService
2. Implement TagVectorRepository
3. Implement EmbeddingJobHandler
4. Register new job types in worker

### Phase 3: Integration
1. Implement TagRecommendationService
2. Modify TriageJobHandler to use tag recommendations
3. Update LLM prompt to work with filtered tag set

### Phase 4: Backfill & Testing
1. Run backfill job for all existing tags
2. Test with sample emails
3. Monitor embedding quality and search relevance

### Phase 5: Frontend (Optional)
1. Add embedding status dashboard for admins
2. Add manual tag embedding refresh capability

## Performance Considerations

### Embedding Generation
- Gemini text-embedding-004 supports batch requests
- Process tags in batches of 50 to avoid rate limits
- Cache email embeddings to avoid regeneration on retry

### Vector Search
- IVFFlat index with 100 lists for ~10,000 tags
- For >100,000 tags, consider HNSW index
- Search completes in <10ms for typical office sizes

### Memory & Storage
- 768-dimension vector = ~3KB per tag
- 10,000 tags = ~30MB storage
- Email embeddings cached separately, cleaned after 30 days

## Cost Analysis

### Gemini Embedding Costs
- text-embedding-004: ~$0.00001 per 1K characters
- Average tag (name + description + keywords): ~100 characters
- 10,000 tags backfill: ~$0.01
- Per email embedding: negligible

### Infrastructure Costs
- pgvector: No additional cost (PostgreSQL extension)
- Storage: Minimal (~30MB per 10K tags)
- Compute: Embedding generation is lightweight

## Monitoring & Observability

### Metrics to Track
1. **Embedding coverage**: % of tags with embeddings
2. **Search latency**: Time for vector search (p50, p95, p99)
3. **Hit rate**: % of emails with >5 relevant tags found
4. **LLM accuracy**: Tag acceptance rate from recommendations

### Logging
```typescript
// Log structure for debugging
{
  event: 'tag_recommendation',
  messageId: string,
  officeId: string,
  candidateCount: number,
  searchTimeMs: number,
  embeddingCached: boolean,
  topTagSimilarity: number,
  lowTagSimilarity: number
}
```

## Future Enhancements

### 1. Hybrid Search
Combine vector similarity with keyword matching for better precision:
```sql
-- Combine vector score with keyword bonus
SELECT *,
  (1 - (embedding <=> query_embedding)) * 0.7 +
  ts_rank(to_tsvector(search_text), query) * 0.3 AS hybrid_score
FROM tags
ORDER BY hybrid_score DESC;
```

### 2. Tag Clustering
Group similar tags to avoid recommending near-duplicates:
```sql
-- Cluster tags by similarity
SELECT DISTINCT ON (cluster_id) *
FROM (
  SELECT *,
    DENSE_RANK() OVER (ORDER BY embedding <=> first_value(embedding) OVER ()) as cluster_id
  FROM tags
) clustered;
```

### 3. Learning from User Behavior
Track which recommended tags are accepted/rejected to improve:
```typescript
interface TagFeedback {
  tagId: string;
  messageId: string;
  recommended: boolean;
  accepted: boolean;
  timestamp: Date;
}
```

### 4. Multi-Modal Embeddings
For offices that receive attachments, embed document content alongside email text.

## Summary of Changes by Component

| Component | Files to Create | Files to Modify |
|-----------|----------------|-----------------|
| **Database** | 6 migration files | - |
| **Server** | `EmbeddingService.ts`, `TagVectorRepository.ts`, `TagRecommendationService.ts`, `EmbeddingJobHandler.ts`, `embeddingRoutes.ts` | `worker.ts`, `TriageJobHandler.ts`, `types.ts`, `config.ts` |
| **Worker** | - | `worker.ts` (register handlers) |
| **Frontend** | `EmbeddingStatusCard.tsx` (optional) | `database.types.ts` (auto-generated) |

## Appendix: Full Migration SQL

```sql
-- Run in order

-- 1. Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add columns to tags
ALTER TABLE tags ADD COLUMN embedding vector(768);
ALTER TABLE tags ADD COLUMN embedding_model TEXT;
ALTER TABLE tags ADD COLUMN embedding_updated_at TIMESTAMPTZ;
ALTER TABLE tags ADD COLUMN search_text TEXT
  GENERATED ALWAYS AS (
    name || ' ' || COALESCE(description, '') || ' ' || COALESCE(array_to_string(auto_assign_keywords, ' '), '')
  ) STORED;

-- 3. Create embedding index
CREATE INDEX idx_tags_embedding ON tags
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 4. Create queue table
CREATE TABLE tag_embedding_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  office_id UUID NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error TEXT,
  UNIQUE(tag_id)
);

CREATE INDEX idx_tag_embedding_queue_pending
  ON tag_embedding_queue(priority DESC, created_at ASC)
  WHERE processed_at IS NULL;

-- 5. Create email embeddings cache
CREATE TABLE email_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  embedding vector(768) NOT NULL,
  embedding_model TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id)
);

CREATE INDEX idx_email_embeddings_message_id ON email_embeddings(message_id);

-- 6. Create search function
CREATE OR REPLACE FUNCTION search_similar_tags(
  query_embedding vector(768),
  target_office_id UUID,
  match_count INTEGER DEFAULT 20,
  similarity_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  tag_id UUID,
  name TEXT,
  color TEXT,
  description TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.color,
    t.description,
    1 - (t.embedding <=> query_embedding) AS similarity
  FROM tags t
  WHERE
    t.office_id = target_office_id
    AND t.embedding IS NOT NULL
    AND 1 - (t.embedding <=> query_embedding) >= similarity_threshold
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 7. Create trigger for auto-queuing
CREATE OR REPLACE FUNCTION queue_tag_embedding()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO tag_embedding_queue (tag_id, office_id, priority)
  VALUES (NEW.id, NEW.office_id,
    CASE
      WHEN TG_OP = 'INSERT' THEN 10
      ELSE 5
    END
  )
  ON CONFLICT (tag_id) DO UPDATE SET
    priority = EXCLUDED.priority,
    processed_at = NULL,
    error = NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tag_embedding_queue
AFTER INSERT OR UPDATE OF name, description, auto_assign_keywords
ON tags
FOR EACH ROW
EXECUTE FUNCTION queue_tag_embedding();
```
