/**
 * TagVectorRepository
 *
 * Repository for managing tag embeddings and vector similarity search.
 * Uses Supabase RPC functions for efficient similarity queries.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface SimilarTag {
  id: string;
  name: string;
  description: string | null;
  usageHint: string | null;
  similarity: number;
}

export interface TagForEmbedding {
  id: string;
  searchText: string;
  externalId: number;
}

export interface EmbeddingStats {
  total: number;
  embedded: number;
  pending: number;
  percentComplete: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

export class TagVectorRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Update a tag's embedding
   */
  async updateTagEmbedding(
    tagId: string,
    embedding: number[],
    model: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('legacy.tags')
      .update({
        embedding: `[${embedding.join(',')}]`,
        embedding_model: model,
        embedding_updated_at: new Date().toISOString(),
      })
      .eq('id', tagId);

    if (error) {
      console.error('[TagVectorRepository] Failed to update embedding:', error);
      throw new Error(`Failed to update tag embedding: ${error.message}`);
    }
  }

  /**
   * Search for similar tags using vector similarity
   */
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
      similarity_threshold: threshold,
    });

    if (error) {
      console.error('[TagVectorRepository] Vector search failed:', error);
      throw new Error(`Vector search failed: ${error.message}`);
    }

    return (data || []).map((row: {
      tag_id: string;
      name: string;
      description: string | null;
      usage_hint: string | null;
      similarity: number;
    }) => ({
      id: row.tag_id,
      name: row.name,
      description: row.description,
      usageHint: row.usage_hint,
      similarity: row.similarity,
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
      match_count: limit,
    });

    if (error) {
      console.error('[TagVectorRepository] Keyword search failed:', error);
      throw new Error(`Keyword search failed: ${error.message}`);
    }

    return (data || []).map((row: {
      tag_id: string;
      name: string;
      description: string | null;
      usage_hint: string | null;
      relevance: number;
    }) => ({
      id: row.tag_id,
      name: row.name,
      description: row.description,
      usageHint: row.usage_hint,
      similarity: row.relevance,
    }));
  }

  /**
   * Get tags without embeddings for backfill
   */
  async getTagsWithoutEmbeddings(
    officeId: string,
    limit: number = 100
  ): Promise<TagForEmbedding[]> {
    const { data, error } = await this.supabase
      .from('legacy.tags')
      .select('id, search_text, external_id')
      .eq('office_id', officeId)
      .is('embedding', null)
      .limit(limit);

    if (error) {
      console.error('[TagVectorRepository] Failed to get tags without embeddings:', error);
      throw new Error(`Failed to get tags: ${error.message}`);
    }

    return (data || [])
      .filter((row: { search_text: string | null }) => row.search_text && row.search_text.trim().length > 0)
      .map((row: { id: string; search_text: string; external_id: number }) => ({
        id: row.id,
        searchText: row.search_text,
        externalId: row.external_id,
      }));
  }

  /**
   * Get tags needing re-embedding (updated since last embed)
   */
  async getTagsNeedingReembedding(
    officeId: string,
    limit: number = 100
  ): Promise<TagForEmbedding[]> {
    const { data, error } = await this.supabase
      .from('legacy.tags')
      .select('id, search_text, external_id, updated_at, embedding_updated_at')
      .eq('office_id', officeId)
      .not('embedding', 'is', null)
      .limit(limit);

    if (error) {
      console.error('[TagVectorRepository] Failed to get tags needing reembedding:', error);
      throw new Error(`Failed to get tags: ${error.message}`);
    }

    // Filter to tags where updated_at > embedding_updated_at
    return (data || [])
      .filter((row: {
        search_text: string | null;
        updated_at: string;
        embedding_updated_at: string | null;
      }) => {
        if (!row.search_text || row.search_text.trim().length === 0) return false;
        if (!row.embedding_updated_at) return true;
        return new Date(row.updated_at) > new Date(row.embedding_updated_at);
      })
      .map((row: { id: string; search_text: string; external_id: number }) => ({
        id: row.id,
        searchText: row.search_text,
        externalId: row.external_id,
      }));
  }

  /**
   * Cache an email embedding
   */
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
        embedding_model: model,
      }, {
        onConflict: 'message_id',
      });

    if (error) {
      console.error('[TagVectorRepository] Failed to cache email embedding:', error);
      throw new Error(`Failed to cache email embedding: ${error.message}`);
    }
  }

  /**
   * Get cached email embedding
   */
  async getEmailEmbedding(messageId: string): Promise<number[] | null> {
    const { data, error } = await this.supabase
      .from('email_embeddings')
      .select('embedding')
      .eq('message_id', messageId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      console.error('[TagVectorRepository] Failed to get email embedding:', error);
      return null;
    }

    if (!data?.embedding) return null;

    // Parse the vector string back to array
    if (typeof data.embedding === 'string') {
      try {
        return JSON.parse(data.embedding);
      } catch {
        console.warn('[TagVectorRepository] Failed to parse embedding string');
        return null;
      }
    }

    return data.embedding;
  }

  /**
   * Get embedding statistics for an office
   */
  async getEmbeddingStats(officeId: string): Promise<EmbeddingStats> {
    const { data, error } = await this.supabase.rpc('get_tag_embedding_stats', {
      target_office_id: officeId,
    });

    if (error) {
      console.error('[TagVectorRepository] Failed to get stats:', error);
      throw new Error(`Failed to get stats: ${error.message}`);
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return { total: 0, embedded: 0, pending: 0, percentComplete: 100 };
    }

    return {
      total: row.total_tags,
      embedded: row.embedded_tags,
      pending: row.pending_tags,
      percentComplete: row.percent_complete,
    };
  }

  /**
   * Get all tags for an office (for LLM context when few tags exist)
   */
  async getAllTags(
    officeId: string,
    limit: number = 100
  ): Promise<SimilarTag[]> {
    const { data, error } = await this.supabase
      .from('legacy.tags')
      .select('id, tag, description, usage_hint')
      .eq('office_id', officeId)
      .limit(limit);

    if (error) {
      console.error('[TagVectorRepository] Failed to get all tags:', error);
      throw new Error(`Failed to get tags: ${error.message}`);
    }

    return (data || []).map((row: {
      id: string;
      tag: string;
      description: string | null;
      usage_hint: string | null;
    }) => ({
      id: row.id,
      name: row.tag,
      description: row.description,
      usageHint: row.usage_hint,
      similarity: 1.0, // All tags have equal "similarity" when returning all
    }));
  }

  /**
   * Get a single tag by ID
   */
  async getTagById(tagId: string): Promise<TagForEmbedding | null> {
    const { data, error } = await this.supabase
      .from('legacy.tags')
      .select('id, search_text, external_id')
      .eq('id', tagId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('[TagVectorRepository] Failed to get tag:', error);
      throw new Error(`Failed to get tag: ${error.message}`);
    }

    if (!data?.search_text) return null;

    return {
      id: data.id,
      searchText: data.search_text,
      externalId: data.external_id,
    };
  }
}
