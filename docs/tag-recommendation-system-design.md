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
│                                            │  - Receives top 20 tags      │  │
│                                            │  - Each with usage_hint      │  │
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

### 2. Add Embedding and Usage Hint Columns to Tags Table

```sql
-- Migration: YYYYMMDD000002_add_tag_embeddings.sql

-- Add embedding column (768 dimensions for Gemini text-embedding-004)
ALTER TABLE tags ADD COLUMN embedding vector(768);

-- Add user-editable usage hint for LLM context (max 150 chars)
-- This tells the LLM how/when to use this tag
ALTER TABLE tags ADD COLUMN usage_hint TEXT;
ALTER TABLE tags ADD CONSTRAINT tags_usage_hint_length CHECK (char_length(usage_hint) <= 150);

COMMENT ON COLUMN tags.usage_hint IS 'User-editable description (max 150 chars) explaining when to apply this tag. Shown to LLM during triage.';

-- Create HNSW index for fast similarity search
-- HNSW works well with any dataset size (unlike IVFFlat which needs 1000+ vectors)
CREATE INDEX idx_tags_embedding ON tags
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Add metadata for embedding tracking
ALTER TABLE tags ADD COLUMN embedding_model TEXT;
ALTER TABLE tags ADD COLUMN embedding_updated_at TIMESTAMPTZ;

-- Composite text field for generating embeddings
-- Uses CONCAT_WS to properly handle NULLs without extra spaces
ALTER TABLE tags ADD COLUMN search_text TEXT
  GENERATED ALWAYS AS (
    TRIM(CONCAT_WS(' ', name, description, array_to_string(auto_assign_keywords, ' ')))
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

-- Enable RLS
ALTER TABLE tag_embedding_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to tag_embedding_queue"
  ON tag_embedding_queue FOR ALL USING (true);
```

### 4. Create Email Embedding Cache Table

**IMPORTANT**: The `messages` table is partitioned by `office_id` with a composite primary key `(office_id, id)`. Foreign keys to partitioned tables must include all partition key columns.

```sql
-- Migration: YYYYMMDD000004_email_embedding_cache.sql

CREATE TABLE email_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL,
  message_id UUID NOT NULL,
  embedding vector(768) NOT NULL,
  embedding_model TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Composite FK to partitioned messages table
  FOREIGN KEY (office_id, message_id) REFERENCES messages(office_id, id) ON DELETE CASCADE,
  UNIQUE(message_id)
);

-- Index for lookups
CREATE INDEX idx_email_embeddings_message_id ON email_embeddings(message_id);
CREATE INDEX idx_email_embeddings_office_id ON email_embeddings(office_id);

-- Enable RLS
ALTER TABLE email_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Email embeddings office policy"
  ON email_embeddings
  FOR ALL
  TO authenticated
  USING (office_id = get_my_office_id())
  WITH CHECK (office_id = get_my_office_id());

-- Service role bypass
CREATE POLICY "Service role has full access to email_embeddings"
  ON email_embeddings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
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
  usage_hint TEXT,
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
    t.usage_hint,
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

-- Keyword-based fallback search function
-- Used when vector search fails or returns insufficient results
CREATE OR REPLACE FUNCTION search_tags_by_keywords(
  search_text TEXT,
  target_office_id UUID,
  match_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  tag_id UUID,
  name TEXT,
  color TEXT,
  description TEXT,
  usage_hint TEXT,
  relevance FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  search_terms TEXT[];
BEGIN
  -- Split search text into words
  search_terms := regexp_split_to_array(lower(search_text), '\s+');

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.color,
    t.description,
    t.usage_hint,
    -- Calculate relevance based on keyword matches
    (
      SELECT COUNT(*)::FLOAT / array_length(search_terms, 1)
      FROM unnest(search_terms) term
      WHERE
        lower(t.name) LIKE '%' || term || '%'
        OR lower(COALESCE(t.description, '')) LIKE '%' || term || '%'
        OR EXISTS (
          SELECT 1 FROM unnest(t.auto_assign_keywords) kw
          WHERE lower(kw) LIKE '%' || term || '%'
        )
    ) AS relevance
  FROM tags t
  WHERE t.office_id = target_office_id
  ORDER BY relevance DESC
  LIMIT match_count;
END;
$$;
```

## Server Changes

### 1. New Infrastructure: Embedding Service

**File: `/server/src/infrastructure/embedding/EmbeddingService.ts`**

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Logger } from 'winston';

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
  private logger: Logger;

  constructor(apiKey: string, logger: Logger) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.logger = logger;
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
    // Process in smaller batches with delays to avoid rate limits
    // Gemini rate limit: ~60 RPM for embedding
    const BATCH_SIZE = 10;
    const DELAY_MS = 1000;
    const results: EmbeddingResult[] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);

      this.logger.debug('Processing embedding batch', {
        batchIndex: Math.floor(i / BATCH_SIZE),
        batchSize: batch.length,
        totalTexts: texts.length
      });

      const batchResults = await Promise.all(
        batch.map(text => this.embedText(text))
      );
      results.push(...batchResults);

      // Add delay between batches to respect rate limits
      if (i + BATCH_SIZE < texts.length) {
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }

    return results;
  }
}
```

### 2. New Infrastructure: Tag Vector Repository

**File: `/server/src/infrastructure/repositories/TagVectorRepository.ts`**

```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from 'winston';

export interface SimilarTag {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  usageHint: string | null;
  similarity: number;
}

export interface TagForEmbedding {
  id: string;
  searchText: string;
}

export class TagVectorRepository {
  constructor(
    private supabase: SupabaseClient,
    private logger: Logger
  ) {}

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

    return (data || []).map((row: any) => ({
      id: row.tag_id,
      name: row.name,
      color: row.color,
      description: row.description,
      usageHint: row.usage_hint,
      similarity: row.similarity
    }));
  }

  /**
   * Fallback keyword search when vector search fails or returns too few results
   */
  async searchTagsByKeywords(
    searchText: string,
    officeId: string,
    limit: number = 20
  ): Promise<SimilarTag[]> {
    const { data, error } = await this.supabase.rpc('search_tags_by_keywords', {
      search_text: searchText,
      target_office_id: officeId,
      match_count: limit
    });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.tag_id,
      name: row.name,
      color: row.color,
      description: row.description,
      usageHint: row.usage_hint,
      similarity: row.relevance
    }));
  }

  async getTagsWithoutEmbeddings(
    officeId: string,
    limit: number = 100
  ): Promise<TagForEmbedding[]> {
    const { data, error } = await this.supabase
      .from('tags')
      .select('id, search_text')
      .eq('office_id', officeId)
      .is('embedding', null)
      .limit(limit);

    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id,
      searchText: row.search_text
    }));
  }

  async getTagsNeedingReembedding(
    officeId: string,
    limit: number = 100
  ): Promise<TagForEmbedding[]> {
    // Get tags that have been updated since their embedding was generated
    const { data, error } = await this.supabase
      .from('tags')
      .select('id, search_text, updated_at, embedding_updated_at')
      .eq('office_id', officeId)
      .not('embedding', 'is', null)
      .limit(limit);

    if (error) throw error;

    // Filter to tags where updated_at > embedding_updated_at
    return (data || [])
      .filter(row => {
        if (!row.embedding_updated_at) return true;
        return new Date(row.updated_at) > new Date(row.embedding_updated_at);
      })
      .map(row => ({
        id: row.id,
        searchText: row.search_text
      }));
  }

  async cacheEmailEmbedding(
    officeId: string,
    messageId: string,
    embedding: number[],
    model: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('email_embeddings')
      .upsert({
        office_id: officeId,
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

  async getEmbeddingStats(officeId: string): Promise<{
    total: number;
    embedded: number;
    pending: number;
  }> {
    const { data: totalData } = await this.supabase
      .from('tags')
      .select('id', { count: 'exact', head: true })
      .eq('office_id', officeId);

    const { data: embeddedData } = await this.supabase
      .from('tags')
      .select('id', { count: 'exact', head: true })
      .eq('office_id', officeId)
      .not('embedding', 'is', null);

    const total = (totalData as any)?.count ?? 0;
    const embedded = (embeddedData as any)?.count ?? 0;

    return {
      total,
      embedded,
      pending: total - embedded
    };
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
  fallbackUsed: boolean;
  fallbackReason?: string;
}

const MIN_VECTOR_RESULTS = 5; // Minimum results before falling back to keyword search

export class TagRecommendationService {
  constructor(
    private embeddingService: IEmbeddingService,
    private tagVectorRepo: TagVectorRepository,
    private logger: Logger
  ) {}

  async getRecommendedTags(input: TagRecommendationInput): Promise<TagRecommendationResult> {
    const startTime = Date.now();
    let fallbackUsed = false;
    let fallbackReason: string | undefined;

    try {
      // 1. Check for cached email embedding
      let embedding = await this.tagVectorRepo.getEmailEmbedding(input.messageId);
      let embeddingCached = !!embedding;

      if (!embedding) {
        // 2. Generate embedding from email content
        const contentToEmbed = this.prepareEmailContent(input);

        this.logger.debug('Generating email embedding', {
          messageId: input.messageId,
          contentLength: contentToEmbed.length
        });

        const result = await this.embeddingService.embedText(contentToEmbed);
        embedding = result.embedding;

        // 3. Cache the embedding for future use (emails are static)
        await this.tagVectorRepo.cacheEmailEmbedding(
          input.officeId,
          input.messageId,
          embedding,
          result.model
        );
      }

      // 4. Search for similar tags using vector similarity
      let candidateTags = await this.tagVectorRepo.searchSimilarTags(
        embedding,
        input.officeId,
        20, // Top 20 tags
        0.25 // Similarity threshold
      );

      // 5. If insufficient results, supplement with keyword matching
      if (candidateTags.length < MIN_VECTOR_RESULTS) {
        fallbackUsed = true;
        fallbackReason = `Vector search returned only ${candidateTags.length} results (threshold: ${MIN_VECTOR_RESULTS})`;

        this.logger.info('Supplementing with keyword search', {
          messageId: input.messageId,
          vectorResultCount: candidateTags.length,
          reason: fallbackReason
        });

        const keywordTags = await this.tagVectorRepo.searchTagsByKeywords(
          input.subject, // Search subject for keywords
          input.officeId,
          20 - candidateTags.length
        );

        // Merge and dedupe (vector results take priority)
        const existingIds = new Set(candidateTags.map(t => t.id));
        for (const tag of keywordTags) {
          if (!existingIds.has(tag.id)) {
            candidateTags.push(tag);
          }
        }
      }

      const searchTimeMs = Date.now() - startTime;

      this.logger.info('Tag recommendation search completed', {
        messageId: input.messageId,
        officeId: input.officeId,
        candidateCount: candidateTags.length,
        searchTimeMs,
        embeddingCached,
        fallbackUsed,
        topTagSimilarity: candidateTags[0]?.similarity,
        lowTagSimilarity: candidateTags[candidateTags.length - 1]?.similarity
      });

      return {
        candidateTags,
        embeddingCached,
        searchTimeMs,
        fallbackUsed,
        fallbackReason
      };

    } catch (error) {
      // If embedding fails entirely, fall back to keyword-only search
      const searchTimeMs = Date.now() - startTime;

      this.logger.error('Tag recommendation embedding failed, using keyword fallback', {
        messageId: input.messageId,
        officeId: input.officeId,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        searchTimeMs
      });

      const keywordTags = await this.tagVectorRepo.searchTagsByKeywords(
        input.subject, // Fall back to subject keywords
        input.officeId,
        20
      );

      return {
        candidateTags: keywordTags,
        embeddingCached: false,
        searchTimeMs: Date.now() - startTime,
        fallbackUsed: true,
        fallbackReason: `Embedding failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
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

Changes needed to integrate tag recommendations:

```typescript
// Add to constructor dependencies
private tagRecommendationService: TagRecommendationService;

// Modify processEmail method
async processEmail(job: Job<TriageProcessEmailJobData>): Promise<TriageJobResult> {
  const { emailId, officeId } = job.data;
  const startTime = Date.now();

  try {
    // ... existing code to fetch email and build context ...

    // NEW: Get recommended tags via vector search
    let tagContext: Array<{ id: string; name: string; description: string | null; usageHint: string | null }>;
    let tagRecommendationMeta: { searchTimeMs: number; fallbackUsed: boolean; fallbackReason?: string } | undefined;

    try {
      const tagRecommendation = await this.tagRecommendationService.getRecommendedTags({
        messageId: emailId,
        officeId,
        subject: email.subject || '',
        body: email.body || '',
        senderEmail: email.fromAddress
      });

      // Prepare tag context for LLM (only top 20 relevant tags with usage hints)
      tagContext = tagRecommendation.candidateTags.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        usageHint: t.usageHint
      }));

      tagRecommendationMeta = {
        searchTimeMs: tagRecommendation.searchTimeMs,
        fallbackUsed: tagRecommendation.fallbackUsed,
        fallbackReason: tagRecommendation.fallbackReason
      };

      this.logger.info('Tag recommendation for triage', {
        emailId,
        tagCount: tagContext.length,
        ...tagRecommendationMeta
      });

    } catch (error) {
      // Log detailed error but continue with keyword fallback
      this.logger.error('Tag recommendation failed in triage', {
        emailId,
        officeId,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });

      // Fallback: get most frequently used tags for this office
      tagContext = await this.getMostUsedTags(officeId, 20);
      tagRecommendationMeta = {
        searchTimeMs: 0,
        fallbackUsed: true,
        fallbackReason: `Exception: ${error instanceof Error ? error.message : String(error)}`
      };
    }

    // Pass filtered tags to LLM instead of all tags
    // Update the context to include only recommended tags
    const triageContext = {
      ...baseContext,
      referenceData: {
        ...baseContext.referenceData,
        tags: tagContext // Only 20 tags instead of thousands
      }
    };

    const triageResult = await this.llmService.analyzeEmail(triageContext);

    // ... rest of existing code ...
  } catch (error) {
    // ... existing error handling ...
  }
}

// Helper to get frequently used tags as ultimate fallback
private async getMostUsedTags(
  officeId: string,
  limit: number
): Promise<Array<{ id: string; name: string; description: string | null; usageHint: string | null }>> {
  const { data } = await this.supabase
    .from('tags')
    .select('id, name, description, usage_hint')
    .eq('office_id', officeId)
    .limit(limit);

  return (data || []).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    usageHint: t.usage_hint
  }));
}
```

### 5. Update Job Types

**File: `/server/src/infrastructure/queue/types.ts`**

Add to the existing `JobNames` constant:

```typescript
export const JobNames = {
  // ... existing jobs ...

  // Embedding jobs
  EMBEDDING_GENERATE_TAG: 'embedding:generate-tag',
  EMBEDDING_GENERATE_BATCH: 'embedding:generate-batch',
  EMBEDDING_BACKFILL: 'embedding:backfill',
  EMBEDDING_REFRESH: 'embedding:refresh',

  // Scheduled embedding maintenance
  SCHEDULED_EMBEDDING_REFRESH: 'scheduled:embedding-refresh',
} as const;
```

Add corresponding job data interfaces:

```typescript
// ============================================================================
// EMBEDDING JOB DATA
// ============================================================================

export interface EmbeddingGenerateTagJobData extends BaseJobData {
  type: typeof JobNames.EMBEDDING_GENERATE_TAG;
  tagId: string;
}

export interface EmbeddingGenerateBatchJobData extends BaseJobData {
  type: typeof JobNames.EMBEDDING_GENERATE_BATCH;
  batchSize: number;
}

export interface EmbeddingBackfillJobData extends BaseJobData {
  type: typeof JobNames.EMBEDDING_BACKFILL;
}

export interface EmbeddingRefreshJobData extends BaseJobData {
  type: typeof JobNames.EMBEDDING_REFRESH;
}

export interface ScheduledEmbeddingRefreshJobData extends BaseJobData {
  type: typeof JobNames.SCHEDULED_EMBEDDING_REFRESH;
}

// Add to union types
export type EmbeddingJobDataUnion =
  | EmbeddingGenerateTagJobData
  | EmbeddingGenerateBatchJobData
  | EmbeddingBackfillJobData
  | EmbeddingRefreshJobData
  | ScheduledEmbeddingRefreshJobData;

export type AllJobData =
  | SyncJobDataUnion
  | PushJobDataUnion
  | TriageJobDataUnion
  | ScheduledJobDataUnion
  | MaintenanceJobDataUnion
  | EmbeddingJobDataUnion; // Add this

// Add default options for embedding jobs
export const DefaultJobOptions: Record<string, JobOptions> = {
  // ... existing options ...

  [JobNames.EMBEDDING_GENERATE_TAG]: {
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 120,
  },
  [JobNames.EMBEDDING_GENERATE_BATCH]: {
    retryLimit: 2,
    retryDelay: 60,
    expireInSeconds: 600, // 10 minutes for batch
  },
  [JobNames.EMBEDDING_BACKFILL]: {
    retryLimit: 1,
    expireInSeconds: 3600, // 1 hour
    singletonSeconds: 3500, // Prevent overlapping
  },
  [JobNames.EMBEDDING_REFRESH]: {
    retryLimit: 1,
    expireInSeconds: 1800, // 30 minutes
    singletonSeconds: 1700,
  },
  [JobNames.SCHEDULED_EMBEDDING_REFRESH]: {
    retryLimit: 1,
    expireInSeconds: 1800,
    singletonSeconds: 1400, // 23+ minutes (for 25-min schedule)
  },
};
```

### 6. New Embedding Job Handler

**File: `/server/src/infrastructure/queue/handlers/EmbeddingJobHandler.ts`**

```typescript
import { Job } from 'pg-boss';
import { IEmbeddingService } from '../../embedding/EmbeddingService';
import { TagVectorRepository } from '../../repositories/TagVectorRepository';
import { Logger } from 'winston';
import { SupabaseClient } from '@supabase/supabase-js';

export class EmbeddingJobHandler {
  constructor(
    private embeddingService: IEmbeddingService,
    private tagVectorRepo: TagVectorRepository,
    private supabase: SupabaseClient,
    private logger: Logger
  ) {}

  /**
   * Generate embedding for a single tag
   */
  async handleGenerateTag(job: Job<{ tagId: string; officeId: string }>): Promise<void> {
    const { tagId, officeId } = job.data;

    this.logger.info('Generating embedding for tag', { tagId, officeId });

    // Fetch tag with search_text
    const { data: tag, error } = await this.supabase
      .from('tags')
      .select('id, search_text, name')
      .eq('id', tagId)
      .single();

    if (error || !tag) {
      this.logger.warn('Tag not found for embedding', { tagId, error: error?.message });
      return;
    }

    if (!tag.search_text || tag.search_text.trim() === '') {
      this.logger.warn('Tag has empty search_text, skipping', { tagId, name: tag.name });
      return;
    }

    try {
      // Generate embedding
      const result = await this.embeddingService.embedText(tag.search_text);

      // Store embedding
      await this.tagVectorRepo.updateTagEmbedding(tagId, result.embedding, result.model);

      this.logger.info('Tag embedding generated', { tagId, name: tag.name, model: result.model });
    } catch (error) {
      this.logger.error('Failed to generate tag embedding', {
        tagId,
        name: tag.name,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      throw error; // Re-throw to trigger job retry
    }
  }

  /**
   * Backfill embeddings for all tags without embeddings in an office
   */
  async handleBackfill(job: Job<{ officeId: string }>): Promise<void> {
    const { officeId } = job.data;
    const batchSize = 50;

    this.logger.info('Starting embedding backfill', { officeId });

    let processed = 0;
    let failed = 0;
    let hasMore = true;

    while (hasMore) {
      const tags = await this.tagVectorRepo.getTagsWithoutEmbeddings(officeId, batchSize);

      if (tags.length === 0) {
        hasMore = false;
        break;
      }

      this.logger.info('Processing backfill batch', {
        officeId,
        batchSize: tags.length,
        processedSoFar: processed
      });

      try {
        // Process in batches with rate limiting
        const embeddings = await this.embeddingService.embedBatch(
          tags.map(t => t.searchText)
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
      } catch (error) {
        failed += tags.length;
        this.logger.error('Backfill batch failed', {
          officeId,
          batchSize: tags.length,
          error: error instanceof Error ? error.message : String(error)
        });
        // Continue with next batch rather than failing entirely
      }

      this.logger.info('Backfill progress', { officeId, processed, failed });
    }

    this.logger.info('Backfill complete', { officeId, totalProcessed: processed, totalFailed: failed });
  }

  /**
   * Refresh embeddings for tags that have been updated
   * Called every 25 minutes by scheduled job
   */
  async handleRefresh(job: Job<{ officeId: string }>): Promise<void> {
    const { officeId } = job.data;
    const batchSize = 50;

    this.logger.info('Starting embedding refresh', { officeId });

    // Get tags needing re-embedding (updated since last embed)
    const tagsNeedingUpdate = await this.tagVectorRepo.getTagsNeedingReembedding(officeId, batchSize);

    // Also get any new tags without embeddings
    const newTags = await this.tagVectorRepo.getTagsWithoutEmbeddings(officeId, batchSize);

    const allTags = [...tagsNeedingUpdate, ...newTags];

    if (allTags.length === 0) {
      this.logger.info('No tags need embedding refresh', { officeId });
      return;
    }

    this.logger.info('Refreshing embeddings', {
      officeId,
      needingUpdate: tagsNeedingUpdate.length,
      newTags: newTags.length,
      total: allTags.length
    });

    let processed = 0;
    let failed = 0;

    try {
      const embeddings = await this.embeddingService.embedBatch(
        allTags.map(t => t.searchText)
      );

      await Promise.all(
        allTags.map((tag, i) =>
          this.tagVectorRepo.updateTagEmbedding(
            tag.id,
            embeddings[i].embedding,
            embeddings[i].model
          )
        )
      );

      processed = allTags.length;
    } catch (error) {
      failed = allTags.length;
      this.logger.error('Embedding refresh failed', {
        officeId,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
    }

    this.logger.info('Embedding refresh complete', { officeId, processed, failed });
  }

  /**
   * Scheduled job that runs every 25 minutes for all offices
   */
  async handleScheduledRefresh(job: Job<Record<string, never>>): Promise<void> {
    this.logger.info('Starting scheduled embedding refresh for all offices');

    // Get all active offices
    const { data: offices, error } = await this.supabase
      .from('offices')
      .select('id, name');

    if (error) {
      this.logger.error('Failed to fetch offices for embedding refresh', { error: error.message });
      throw error;
    }

    if (!offices || offices.length === 0) {
      this.logger.info('No offices found for embedding refresh');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const office of offices) {
      try {
        await this.handleRefresh({
          ...job,
          data: { officeId: office.id }
        } as Job<{ officeId: string }>);
        successCount++;
      } catch (error) {
        failCount++;
        this.logger.error('Embedding refresh failed for office', {
          officeId: office.id,
          officeName: office.name,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.logger.info('Scheduled embedding refresh complete', {
      totalOffices: offices.length,
      successCount,
      failCount
    });
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
  -- Queue embedding generation when tag is created or relevant fields change
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

-- Create trigger for tag changes that affect embeddings
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
import PgBoss from 'pg-boss';
import { TagVectorRepository } from '../../../infrastructure/repositories/TagVectorRepository';
import { JobNames } from '../../../infrastructure/queue/types';

export function createEmbeddingRoutes(
  boss: PgBoss,
  tagVectorRepo: TagVectorRepository
): Router {
  const router = Router();

  // Trigger backfill for an office
  router.post('/embeddings/backfill', authMiddleware, async (req, res) => {
    const { officeId } = req.body;

    if (!officeId) {
      return res.status(400).json({ success: false, error: 'officeId required' });
    }

    await boss.send(JobNames.EMBEDDING_BACKFILL, { officeId });

    res.json({ success: true, message: 'Backfill job queued' });
  });

  // Trigger refresh for an office
  router.post('/embeddings/refresh', authMiddleware, async (req, res) => {
    const { officeId } = req.body;

    if (!officeId) {
      return res.status(400).json({ success: false, error: 'officeId required' });
    }

    await boss.send(JobNames.EMBEDDING_REFRESH, { officeId });

    res.json({ success: true, message: 'Refresh job queued' });
  });

  // Get embedding status for an office
  router.get('/embeddings/status/:officeId', authMiddleware, async (req, res) => {
    const { officeId } = req.params;

    const stats = await tagVectorRepo.getEmbeddingStats(officeId);

    res.json({
      success: true,
      data: {
        totalTags: stats.total,
        embeddedTags: stats.embedded,
        pendingTags: stats.pending,
        percentComplete: stats.total > 0
          ? Math.round((stats.embedded / stats.total) * 100)
          : 100
      }
    });
  });

  return router;
}
```

## Worker Changes

### 1. Register Embedding Handler and Scheduled Job

**File: `/server/src/worker.ts`**

```typescript
// Add to imports
import { EmbeddingJobHandler } from './infrastructure/queue/handlers/EmbeddingJobHandler';
import { GeminiEmbeddingService } from './infrastructure/embedding/EmbeddingService';
import { TagVectorRepository } from './infrastructure/repositories/TagVectorRepository';
import { JobNames } from './infrastructure/queue/types';

// In worker initialization
const embeddingService = new GeminiEmbeddingService(config.geminiApiKey, logger);
const tagVectorRepo = new TagVectorRepository(supabase, logger);
const embeddingHandler = new EmbeddingJobHandler(
  embeddingService,
  tagVectorRepo,
  supabase,
  logger
);

// Register handlers
await boss.work(
  JobNames.EMBEDDING_GENERATE_TAG,
  embeddingHandler.handleGenerateTag.bind(embeddingHandler)
);
await boss.work(
  JobNames.EMBEDDING_BACKFILL,
  embeddingHandler.handleBackfill.bind(embeddingHandler)
);
await boss.work(
  JobNames.EMBEDDING_REFRESH,
  embeddingHandler.handleRefresh.bind(embeddingHandler)
);
await boss.work(
  JobNames.SCHEDULED_EMBEDDING_REFRESH,
  embeddingHandler.handleScheduledRefresh.bind(embeddingHandler)
);

// Schedule embedding refresh every 25 minutes
// This keeps embeddings up to date as tags are added/modified from legacy DB sync
await boss.schedule(
  JobNames.SCHEDULED_EMBEDDING_REFRESH,
  '*/25 * * * *', // Every 25 minutes
  {}
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
  usage_hint: string | null;  // NEW - user-editable, max 150 chars
  embedding: number[] | null;  // NEW
  embedding_model: string | null;  // NEW
  embedding_updated_at: string | null;  // NEW
  search_text: string;  // NEW (generated column)
}
```

### 2. Tag Settings: Usage Hint Editor

Add to the tag editing UI (e.g., in settings or tag management):

**File: `/src/components/settings/TagUsageHintEditor.tsx`**

```tsx
import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface TagUsageHintEditorProps {
  tagId: string;
  tagName: string;
  currentHint: string | null;
  onSave: (tagId: string, hint: string) => Promise<void>;
}

const MAX_HINT_LENGTH = 150;

export function TagUsageHintEditor({
  tagId,
  tagName,
  currentHint,
  onSave
}: TagUsageHintEditorProps) {
  const [hint, setHint] = useState(currentHint || '');
  const [saving, setSaving] = useState(false);

  const remainingChars = MAX_HINT_LENGTH - hint.length;
  const isOverLimit = remainingChars < 0;

  const handleSave = async () => {
    if (isOverLimit) return;
    setSaving(true);
    try {
      await onSave(tagId, hint);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={`hint-${tagId}`}>
          Usage hint for "{tagName}"
        </Label>
        <Badge variant={isOverLimit ? 'destructive' : 'secondary'}>
          {remainingChars} chars remaining
        </Badge>
      </div>
      <Textarea
        id={`hint-${tagId}`}
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        onBlur={handleSave}
        placeholder="Describe when this tag should be applied (e.g., 'Use for emails about housing issues including council housing, homelessness, and private rentals')"
        className="resize-none"
        rows={2}
        disabled={saving}
      />
      <p className="text-xs text-muted-foreground">
        This hint helps the AI understand when to suggest this tag during email triage.
      </p>
    </div>
  );
}
```

### 3. Admin: Embedding Status Dashboard

**File: `/src/components/admin/EmbeddingStatusCard.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface EmbeddingStats {
  totalTags: number;
  embeddedTags: number;
  pendingTags: number;
  percentComplete: number;
}

export function EmbeddingStatusCard({ officeId }: { officeId: string }) {
  const [stats, setStats] = useState<EmbeddingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    const response = await fetch(`/api/embeddings/status/${officeId}`);
    const data = await response.json();
    setStats(data.data);
    setLoading(false);
  };

  const triggerRefresh = async () => {
    setRefreshing(true);
    await fetch('/api/embeddings/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ officeId })
    });
    setRefreshing(false);
    fetchStats();
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
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium">Tag Embedding Status</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={triggerRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
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

### 4. No Changes to TagPicker

The TagPicker component does not need changes - it continues to work with the existing `suggestedTags` from triage suggestions. The vector search happens server-side before LLM processing.

## Configuration Changes

### 1. Environment Variables

**File: `.env.example`**

```bash
# Existing
GEMINI_API_KEY=your_gemini_api_key

# New (optional - uses defaults if not specified)
EMBEDDING_MODEL=text-embedding-004
EMBEDDING_DIMENSIONS=768
TAG_SEARCH_LIMIT=20
TAG_SIMILARITY_THRESHOLD=0.25
```

### 2. Server Config

**File: `/server/src/config/index.ts`**

Add to the `Config` interface:

```typescript
export interface Config {
  // ... existing config ...

  // Embedding
  embeddingModel: string;
  embeddingDimensions: number;
  tagSearchLimit: number;
  tagSimilarityThreshold: number;
}
```

Add to the `loadConfig()` function:

```typescript
export function loadConfig(): Config {
  // ... existing config ...

  return {
    // ... existing properties ...

    // Embedding
    embeddingModel: process.env.EMBEDDING_MODEL ?? 'text-embedding-004',
    embeddingDimensions: parseInt(process.env.EMBEDDING_DIMENSIONS ?? '768', 10),
    tagSearchLimit: parseInt(process.env.TAG_SEARCH_LIMIT ?? '20', 10),
    tagSimilarityThreshold: parseFloat(process.env.TAG_SIMILARITY_THRESHOLD ?? '0.25'),
  };
}
```

## Migration Plan

### Phase 1: Database Setup
1. Enable pgvector extension in Supabase
2. Run migrations to add embedding columns, usage_hint, and functions
3. Create HNSW indexes for vector search

### Phase 2: Backend Infrastructure
1. Implement EmbeddingService
2. Implement TagVectorRepository with fallback methods
3. Implement EmbeddingJobHandler
4. Register new job types in worker
5. Set up 25-minute scheduled refresh job

### Phase 3: Integration
1. Implement TagRecommendationService with fallback logic
2. Modify TriageJobHandler to use tag recommendations
3. Update LLM prompt to work with filtered tag set (including usage_hint)

### Phase 4: Backfill & Testing
1. Run backfill job for all existing tags
2. Test with sample emails
3. Monitor embedding quality and search relevance
4. Verify fallback behavior when embeddings fail

### Phase 5: Frontend
1. Add usage_hint editor to tag settings
2. Add embedding status dashboard for admins
3. Add manual tag embedding refresh capability

## Performance Considerations

### Embedding Generation
- Gemini text-embedding-004 supports batch requests
- Process tags in batches of 10 with 1-second delays to avoid rate limits
- Cache email embeddings permanently (emails are static records)
- 25-minute scheduled refresh keeps embeddings current without timeout issues

### Vector Search
- HNSW index works well at any scale (unlike IVFFlat which needs 1000+ vectors)
- Search completes in <10ms for typical office sizes
- Falls back to keyword search if vector search returns <5 results

### Fallback Strategy
1. If embedding generation fails → use keyword matching on subject
2. If vector search returns <5 results → supplement with keyword matches
3. If both fail → use most frequently used tags for the office
4. All fallback scenarios are logged with detailed error information

### Memory & Storage
- 768-dimension vector = ~3KB per tag
- 10,000 tags = ~30MB storage
- Email embeddings cached permanently (static records)

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
4. **Fallback rate**: % of searches using keyword fallback
5. **LLM accuracy**: Tag acceptance rate from recommendations

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
  fallbackUsed: boolean,
  fallbackReason?: string,
  topTagSimilarity: number,
  lowTagSimilarity: number
}

// Error logging for failures
{
  event: 'tag_recommendation_error',
  messageId: string,
  officeId: string,
  error: string,
  errorStack: string,
  searchTimeMs: number,
  fallbackUsed: true,
  fallbackReason: string
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
| **Server** | `EmbeddingService.ts`, `TagVectorRepository.ts`, `TagRecommendationService.ts`, `EmbeddingJobHandler.ts`, `embeddingRoutes.ts` | `worker.ts`, `TriageJobHandler.ts`, `types.ts`, `config/index.ts` |
| **Worker** | - | `worker.ts` (register handlers + 25-min schedule) |
| **Frontend** | `TagUsageHintEditor.tsx`, `EmbeddingStatusCard.tsx` (optional) | `database.types.ts` (auto-generated) |

## Appendix: Full Migration SQL

```sql
-- Run in order

-- 1. Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add columns to tags (including usage_hint)
ALTER TABLE tags ADD COLUMN embedding vector(768);
ALTER TABLE tags ADD COLUMN usage_hint TEXT;
ALTER TABLE tags ADD CONSTRAINT tags_usage_hint_length CHECK (char_length(usage_hint) <= 150);
ALTER TABLE tags ADD COLUMN embedding_model TEXT;
ALTER TABLE tags ADD COLUMN embedding_updated_at TIMESTAMPTZ;
ALTER TABLE tags ADD COLUMN search_text TEXT
  GENERATED ALWAYS AS (
    TRIM(CONCAT_WS(' ', name, description, array_to_string(auto_assign_keywords, ' ')))
  ) STORED;

COMMENT ON COLUMN tags.usage_hint IS 'User-editable description (max 150 chars) explaining when to apply this tag. Shown to LLM during triage.';

-- 3. Create HNSW embedding index (works well at any scale)
CREATE INDEX idx_tags_embedding ON tags
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

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

ALTER TABLE tag_embedding_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role has full access to tag_embedding_queue"
  ON tag_embedding_queue FOR ALL USING (true);

-- 5. Create email embeddings cache (with composite FK to partitioned messages)
CREATE TABLE email_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id UUID NOT NULL,
  message_id UUID NOT NULL,
  embedding vector(768) NOT NULL,
  embedding_model TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (office_id, message_id) REFERENCES messages(office_id, id) ON DELETE CASCADE,
  UNIQUE(message_id)
);

CREATE INDEX idx_email_embeddings_message_id ON email_embeddings(message_id);
CREATE INDEX idx_email_embeddings_office_id ON email_embeddings(office_id);

ALTER TABLE email_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Email embeddings office policy"
  ON email_embeddings
  FOR ALL
  TO authenticated
  USING (office_id = get_my_office_id())
  WITH CHECK (office_id = get_my_office_id());

CREATE POLICY "Service role has full access to email_embeddings"
  ON email_embeddings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. Create vector search function
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
  usage_hint TEXT,
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
    t.usage_hint,
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

-- 7. Create keyword fallback search function
CREATE OR REPLACE FUNCTION search_tags_by_keywords(
  search_text TEXT,
  target_office_id UUID,
  match_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  tag_id UUID,
  name TEXT,
  color TEXT,
  description TEXT,
  usage_hint TEXT,
  relevance FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  search_terms TEXT[];
BEGIN
  search_terms := regexp_split_to_array(lower(search_text), '\s+');

  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.color,
    t.description,
    t.usage_hint,
    (
      SELECT COUNT(*)::FLOAT / GREATEST(array_length(search_terms, 1), 1)
      FROM unnest(search_terms) term
      WHERE
        lower(t.name) LIKE '%' || term || '%'
        OR lower(COALESCE(t.description, '')) LIKE '%' || term || '%'
        OR EXISTS (
          SELECT 1 FROM unnest(t.auto_assign_keywords) kw
          WHERE lower(kw) LIKE '%' || term || '%'
        )
    ) AS relevance
  FROM tags t
  WHERE t.office_id = target_office_id
  ORDER BY relevance DESC
  LIMIT match_count;
END;
$$;

-- 8. Create trigger for auto-queuing
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
